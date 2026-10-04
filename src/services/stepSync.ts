// stepSync - The one place steps are credited from Health Connect/HealthKit into the game.
// Every trigger (app start, return to the foreground, foreground interval, permission grant, Sync
// button) shares a single in-flight sync, so overlapping triggers can never read and credit the
// same window twice.
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
import { StepSyncMode, StepSyncResult } from '../types/health';

interface StepSyncStatus {
  syncing: boolean;
  lastResult: StepSyncResult | null;
}

/** Ephemeral sync state for the UI. */
export const useStepSyncStatus = create<StepSyncStatus>()(() => ({
  syncing: false,
  lastResult: null,
}));

let inFlight: { mode: StepSyncMode; result: Promise<StepSyncResult> } | null = null;
let fullAfterRecent: Promise<StepSyncResult> | null = null;

/**
 * Sync steps, or join the sync already running. A full sync covers a recent one, so a recent
 * caller always joins. A full caller joins a running full sync; while a recent sync runs, full
 * callers share one full sync queued to start after it, so they still get a full reconcile.
 */
export function syncSteps(mode: StepSyncMode = 'full'): Promise<StepSyncResult> {
  if (!inFlight) return startSync(mode);
  if (mode === 'recent' || inFlight.mode === 'full') return inFlight.result;
  fullAfterRecent ??= inFlight.result.then(() => {
    fullAfterRecent = null;
    return syncSteps('full');
  });
  return fullAfterRecent;
}

function startSync(mode: StepSyncMode): Promise<StepSyncResult> {
  useStepSyncStatus.setState({ syncing: true });
  const result = runSync(mode).then((synced) => {
    inFlight = null;
    useStepSyncStatus.setState({ syncing: false, lastResult: synced });
    return synced;
  });
  inFlight = { mode, result };
  return result;
}

async function runSync(mode: StepSyncMode): Promise<StepSyncResult> {
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
  const permission = await healthService.refreshStatus();
  if (permission === 'unavailable') {
    return { status: 'error', code: 'unavailable', message: 'Step data is not available' };
  }
  if (permission !== 'authorized') {
    return { status: 'error', code: 'not_authorized', message: 'Step access not granted' };
  }

  const now = Date.now();
  const ledger = useGameStore.getState().stepLedger;
  // A restored or migrated save always has a ledger, so no ledger means a new game: its first
  // sync credits the last week as a welcome.
  const buckets = ledger ? extendBuckets(ledger.buckets, now) : welcomeBuckets(now);
  const toRead = bucketsToRead(
    buckets,
    now,
    ledger ? reconcileFrom(ledger.lastSyncedAt, now, mode) : -Infinity
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
