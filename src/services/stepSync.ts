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
  alignToClock,
  bucketsToRead,
  prune,
  reconcile,
  reconcileFrom,
  welcomeBuckets,
} from './stepLedger';
import { DayCredit, StepSyncMode, StepSyncResult } from '../types/health';

type SyncedResult = Extract<StepSyncResult, { status: 'synced' }>;

interface StepSyncStatus {
  syncing: boolean;
  lastResult: StepSyncResult | null;
  /** Health Connect's total for each ledger bucket (by `startMs`) when a sync last read it. */
  lastTotals: ReadonlyMap<number, number>;
  /**
   * What syncs credited since the player last dismissed the summary, merged into one result. A
   * welcome is kept even if it credited nothing, so a new player is greeted.
   */
  unseenCredit: SyncedResult | null;
}

/** Ephemeral sync state for the UI. */
export const useStepSyncStatus = create<StepSyncStatus>()(() => ({
  syncing: false,
  lastResult: null,
  lastTotals: new Map(),
  unseenCredit: null,
}));

export function dismissCreditSummary(): void {
  useStepSyncStatus.setState({ unseenCredit: null });
}

/** Both credits as one: steps summed per day, late only if every credit for the day was late. */
function mergeCredits(seen: SyncedResult | null, next: SyncedResult): SyncedResult {
  if (!seen) return next;
  const days = new Map<number, DayCredit>(seen.perDay.map((day) => [day.startMs, day]));
  for (const day of next.perDay) {
    const earlier = days.get(day.startMs);
    days.set(
      day.startMs,
      earlier
        ? { startMs: day.startMs, steps: earlier.steps + day.steps, late: earlier.late && day.late }
        : day
    );
  }
  const historyLimitedBefore = next.historyLimitedBefore ?? seen.historyLimitedBefore;
  return {
    status: 'synced',
    credited: seen.credited + next.credited,
    perDay: [...days.values()].sort((a, b) => a.startMs - b.startMs),
    welcome: seen.welcome || next.welcome,
    ...(historyLimitedBefore !== undefined && { historyLimitedBefore }),
    syncedAt: next.syncedAt,
  };
}

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
  // Never rejects: a sync that throws is an error result, so the next trigger starts a new sync
  // rather than joining a rejected one, and the Sync button comes back.
  const result = runSync(mode)
    .catch((error: unknown): StepSyncResult => {
      console.error('Step sync failed:', error);
      return { status: 'error', code: 'unknown', message: String(error) };
    })
    .then((synced) => {
      inFlight = null;
      useStepSyncStatus.setState(({ unseenCredit }) => ({
        syncing: false,
        lastResult: synced,
        unseenCredit:
          synced.status === 'synced' && (synced.credited > 0 || synced.welcome)
            ? mergeCredits(unseenCredit, synced)
            : unseenCredit,
      }));
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
  const stored = useGameStore.getState().stepLedger;
  if (stored && now < stored.lastSyncedAt) {
    console.warn(
      `Step sync: the clock (${new Date(now).toISOString()}) is before the last sync ` +
        `(${new Date(stored.lastSyncedAt).toISOString()}); it was ahead then or is behind now`
    );
  }
  const ledger = stored && alignToClock(stored, now);
  // A restored or migrated save always has a ledger, so no ledger means a new game: its first
  // sync credits the last week as a welcome.
  const buckets = ledger ? ledger.buckets : welcomeBuckets(now);
  const toRead = bucketsToRead(
    buckets,
    now,
    ledger ? reconcileFrom(ledger.lastSyncedAt, now, mode) : -Infinity
  );
  const historyStart = ledger
    ? await healthService.historyStartAfterReinstall(ledger.lastSyncedAt, now)
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

  // The game was reset or reloaded during the reads, which were for a ledger that is gone:
  // crediting them would put the old game's ledger into the new one. Sync the current game.
  if (useGameStore.getState().stepLedger !== stored) return runSync(mode);

  const {
    buckets: reconciled,
    perDay,
    credited,
  } = reconcile(buckets, totals, ledger ? ledger.lastSyncedAt : -Infinity);
  const kept = prune(reconciled, now);
  useGameStore.getState().applyStepSync(credited, { buckets: kept, lastSyncedAt: now });
  // A recent sync reads only the last days; earlier buckets keep the total read before.
  useStepSyncStatus.setState(({ lastTotals }) => ({
    lastTotals: new Map(
      kept.flatMap(({ startMs }) => {
        const total = totals.get(startMs) ?? lastTotals.get(startMs);
        return total === undefined ? [] : [[startMs, total] as const];
      })
    ),
  }));
  await saveGame();
  const historyLimitedBefore =
    historyStart !== undefined && toRead.some((bucket) => bucket.startMs < historyStart)
      ? historyStart
      : undefined;
  return {
    status: 'synced',
    credited,
    perDay,
    welcome: stored === null,
    ...(historyLimitedBefore !== undefined && { historyLimitedBefore }),
    syncedAt: now,
  };
}
