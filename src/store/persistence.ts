import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { shallow } from 'zustand/shallow';
import {
  useGameStore,
  selectData,
  toPersisted,
  STORAGE_KEY,
  createInitialGameData,
  migratePersisted,
  sanitiseCount,
  asArrayOr,
  sanitiseStacks,
} from './gameStore';
import { getAllMaterialTypes } from '../config/materials';
import { createEmptyInventory } from '../types/resources';
import { StepBucket, StepLedger } from '../types/health';
import { ledgerSince } from '../services/stepLedger';

const SAVE_THROTTLE_MS = 3000;
const SAVE_FAILURE_THRESHOLD = 3;

let savePromise: Promise<void> = Promise.resolve();
let saveFailureCount = 0;
let lastSaveTime = 0;
let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

function enqueueSave(): Promise<void> {
  const doWrite = async (): Promise<void> => {
    // Read LIVE state at execution time so the latest queued save wins.
    const state = useGameStore.getState();
    // Until the stored game has loaded, memory holds initial state, not the player's game:
    // writing it would overwrite their save.
    if (state.isLoading || state.loadFailed) return;
    const data = selectData(state);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(data)));
    lastSaveTime = Date.now();
    saveFailureCount = 0;
    useGameStore.getState()._setSaveError(false);
  };
  savePromise = savePromise.then(doWrite).catch((err: unknown) => {
    saveFailureCount += 1;
    console.error('Failed to save game:', err);
    if (saveFailureCount >= SAVE_FAILURE_THRESHOLD) {
      useGameStore.getState()._setSaveError(true);
    }
  });
  return savePromise;
}

export async function saveGame(): Promise<void> {
  await enqueueSave();
}

function throttledSave(): void {
  const now = Date.now();
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
  if (now - lastSaveTime >= SAVE_THROTTLE_MS) {
    void enqueueSave();
  } else {
    pendingTimeout = setTimeout(
      () => {
        void enqueueSave();
        pendingTimeout = null;
      },
      SAVE_THROTTLE_MS - (now - lastSaveTime)
    );
  }
}

function isTime(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x >= 0;
}

function sanitiseBuckets(x: unknown): StepBucket[] | null {
  if (!Array.isArray(x) || x.length === 0) return null;
  const buckets: StepBucket[] = [];
  for (const el of x) {
    if (el === null || typeof el !== 'object') return null;
    const { startMs, endMs, credited } = el as Record<string, unknown>;
    if (!isTime(startMs) || !isTime(endMs) || !isTime(credited) || endMs <= startMs) return null;
    const previous = buckets[buckets.length - 1];
    if (previous && previous.endMs !== startMs) return null;
    buckets.push({ startMs, endMs, credited });
  }
  return buckets;
}

/**
 * A stored ledger, or null if there is none. Null means a new game whose first sync credits the
 * welcome week, so a malformed ledger that still has a valid `lastSyncedAt` does not become null:
 * it restarts from `lastSyncedAt`, crediting the steps since then (never twice, but late data for
 * days before it is lost). Only a ledger with no usable `lastSyncedAt` is dropped.
 */
function sanitiseLedger(x: unknown): StepLedger | null {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return null;
  const { buckets, lastSyncedAt } = x as Record<string, unknown>;
  if (!isTime(lastSyncedAt) || lastSyncedAt === 0) return null;
  const sanitised = sanitiseBuckets(buckets);
  return sanitised ? { buckets: sanitised, lastSyncedAt } : ledgerSince(lastSyncedAt);
}

export async function loadGame(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      const rawParsed = JSON.parse(saved) as unknown;
      if (rawParsed === null || typeof rawParsed !== 'object' || Array.isArray(rawParsed)) {
        throw new Error('Saved game is not an object');
      }
      // Migrate unversioned/older saves up to current schema before validation.
      const migrated = migratePersisted(rawParsed as Record<string, unknown>);

      // Rebuild inventory: only accept well-formed stacks per material type.
      const mergedInventory = createEmptyInventory();
      const migratedInventory =
        migrated.inventory !== null &&
        typeof migrated.inventory === 'object' &&
        !Array.isArray(migrated.inventory)
          ? (migrated.inventory as Record<string, unknown>)
          : {};
      for (const type of getAllMaterialTypes()) {
        mergedInventory[type] = sanitiseStacks(migratedInventory[type]);
      }

      const initialData = createInitialGameData();
      useGameStore.getState()._hydrate({
        inventory: mergedInventory,
        unlockedTechs: asArrayOr(migrated.unlockedTechs, initialData.unlockedTechs),
        ownedTools: asArrayOr(migrated.ownedTools, initialData.ownedTools),
        ownedComponents: asArrayOr(migrated.ownedComponents, initialData.ownedComponents),
        craftingQueue: asArrayOr(migrated.craftingQueue, initialData.craftingQueue),
        explorationPoints: sanitiseCount(migrated.explorationPoints, initialData.explorationPoints),
        availableSteps: sanitiseCount(migrated.availableSteps, initialData.availableSteps),
        totalStepsGathered: sanitiseCount(
          migrated.totalStepsGathered,
          initialData.totalStepsGathered
        ),
        stepLedger: sanitiseLedger(migrated.stepLedger),
      });
    }
  } catch (error) {
    // Unreadable, corrupt or unmigratable: keep the stored blob untouched (saves are blocked)
    // and never let the initial state pass for a real game.
    console.error('Failed to load game:', error);
    useGameStore.getState()._setLoadFailed(true);
  } finally {
    useGameStore.getState()._setLoading(false);
  }
}

export async function resetGame(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  useGameStore.getState()._reset();
}

export function startPersistence(): () => void {
  const unsub = useGameStore.subscribe(selectData, throttledSave, { equalityFn: shallow });
  const interval = setInterval(() => void enqueueSave(), 30000);
  const appSub = AppState.addEventListener('change', (s) => {
    if (s === 'background' || s === 'inactive') {
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      void enqueueSave();
    }
  });
  return () => {
    unsub();
    clearInterval(interval);
    appSub.remove();
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
  };
}

export function __resetPersistenceForTests(): void {
  savePromise = Promise.resolve();
  saveFailureCount = 0;
  lastSaveTime = 0;
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
}
