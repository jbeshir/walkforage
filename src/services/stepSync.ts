// stepSync - The one place steps are credited from Health Connect/HealthKit into the game.
// Every trigger (mount, permission grant, interval, Sync button) shares a single in-flight sync,
// so overlapping triggers can never read and credit the same window twice.
// Steps are credited per local-day bucket of the step ledger (src/services/stepLedger.ts): every
// sync re-reads recent buckets and credits only what is above each bucket's high-water mark, so
// late data is credited once and a crash before the save can be re-synced without double credit.

import { create } from 'zustand';
import { healthService } from './HealthService';
import { useGameStore } from '../store/gameStore';
import { saveGame } from '../store/persistence';
import {
  bucketsToRead,
  extendBuckets,
  prune,
  reconcile,
  reconcileFrom,
  welcomeBuckets,
} from './stepLedger';
import { StepSyncResult } from '../types/health';

interface StepSyncStatus {
  syncing: boolean;
  lastResult: StepSyncResult | null;
}

/** Ephemeral sync state for the UI. */
export const useStepSyncStatus = create<StepSyncStatus>()(() => ({
  syncing: false,
  lastResult: null,
}));

let inFlight: Promise<StepSyncResult> | null = null;

/** Sync steps, or join the sync already running. */
export function syncSteps(): Promise<StepSyncResult> {
  if (!inFlight) {
    useStepSyncStatus.setState({ syncing: true });
    inFlight = runSync().then((result) => {
      inFlight = null;
      useStepSyncStatus.setState({ syncing: false, lastResult: result });
      return result;
    });
  }
  return inFlight;
}

async function runSync(): Promise<StepSyncResult> {
  const store = useGameStore.getState();
  // Before hydration (or after a failed load) the store holds initial state, not the player's
  // game; syncing against it would credit the wrong window and save over their game.
  if (store.isLoading || store.loadFailed) {
    return {
      status: 'error',
      code: 'not_loaded',
      message: store.loadFailed ? 'Saved game could not be loaded' : 'Saved game is still loading',
    };
  }
  if (healthService.getPermissionStatus() !== 'authorized') {
    return { status: 'error', code: 'not_authorized', message: 'Step access not granted' };
  }

  const now = Date.now();
  const ledger = store.stepLedger;
  // A restored or migrated save always has a ledger, so no ledger means a new game: its first
  // sync credits the last week as a welcome.
  const buckets = ledger ? extendBuckets(ledger.buckets, now) : welcomeBuckets(now);
  const toRead = bucketsToRead(
    buckets,
    now,
    ledger ? reconcileFrom(ledger.lastSyncedAt, now) : -Infinity
  );
  const historyStart = ledger
    ? await healthService.historyStartAfterReinstall(ledger.lastSyncedAt)
    : undefined;

  // Read every bucket before crediting any: one failure commits nothing.
  const totals = new Map<number, number>();
  for (const bucket of toRead) {
    const read = await healthService.readSteps(bucket.startMs, Math.min(bucket.endMs, now));
    if (!read.ok) {
      return { status: 'error', code: read.code, message: read.message };
    }
    totals.set(bucket.startMs, read.steps);
  }

  const { buckets: reconciled, perDay, credited } = reconcile(buckets, totals);
  useGameStore
    .getState()
    .applyStepSync(credited, { buckets: prune(reconciled, now), lastSyncedAt: now });
  await saveGame();
  const historyLimitedBefore =
    historyStart !== undefined && toRead.some((bucket) => bucket.startMs < historyStart)
      ? historyStart
      : undefined;
  return {
    status: 'synced',
    credited,
    perDay,
    welcome: ledger === null,
    ...(historyLimitedBefore !== undefined && { historyLimitedBefore }),
    syncedAt: now,
  };
}
