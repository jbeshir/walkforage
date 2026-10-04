// Shared setup for step sync tests: an in-memory AsyncStorage behind the jest.setup mock, saved
// games in any schema version, app restarts, and Health Connect's own total for a window.
// Use together with the fake Health Connect (see ./fakeHealthConnect.ts).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fakeHC } from './fakeHealthConnect';
import { useStepSyncStatus } from '../../src/services/stepSync';
import {
  useGameStore,
  STORAGE_KEY,
  SCHEMA_VERSION,
  createInitialGameData,
} from '../../src/store/gameStore';
import { loadGame, __resetPersistenceForTests } from '../../src/store/persistence';
import { StepLedger } from '../../src/types/health';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

let storage = new Map<string, string>();

/** Backs AsyncStorage with a fresh in-memory map. Call in beforeEach. */
export function useMemoryStorage(): void {
  storage = new Map();
  mockAsyncStorage.getItem.mockImplementation(async (key) => storage.get(key) ?? null);
  mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
    storage.set(key, value);
  });
  useStepSyncStatus.setState({ syncing: false, lastResult: null });
}

/** Stores a saved game (current schema unless given) and returns the stored blob. */
export function seedSave(data: Record<string, unknown>, schemaVersion = SCHEMA_VERSION): string {
  const blob = JSON.stringify({ schemaVersion, ...data });
  storage.set(STORAGE_KEY, blob);
  return blob;
}

export function storedBlob(): string | undefined {
  return storage.get(STORAGE_KEY);
}

export function storedGame(): Record<string, unknown> {
  return JSON.parse(storage.get(STORAGE_KEY)!) as Record<string, unknown>;
}

/** A process restart: memory goes back to initial state and the saved game is loaded again. */
export async function restartApp(): Promise<void> {
  useGameStore.setState({
    ...createInitialGameData(),
    isLoading: true,
    saveError: false,
    loadFailed: false,
  });
  __resetPersistenceForTests();
  await loadGame();
}

export function ledger(): StepLedger {
  const { stepLedger } = useGameStore.getState();
  if (!stepLedger) throw new Error('No step ledger');
  return stepLedger;
}

export function availableSteps(): number {
  return useGameStore.getState().availableSteps;
}

/** Health Connect's de-duplicated total for [from, to): the truth a sync should credit. */
export function hcTotal(from: number, to: number): number {
  return fakeHC.aggregate(
    {
      operator: 'between',
      startTime: new Date(from).toISOString(),
      endTime: new Date(to).toISOString(),
    },
    undefined
  ).total;
}

/** Epoch ms of a wall-clock time in the process time zone. */
export function local(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}
