// stepLedger - Pure functions over the step ledger: which local-day buckets exist, which of them a
// sync reads from the health platform, and how a read total is credited. Nothing here mutates its
// input or reads the clock; callers pass `nowMs`.
//
// Each bucket's bounds are fixed when it is created and every new bucket starts where the previous
// one ended, so time zone changes and DST can never overlap or skip time. A bucket's `credited` is
// a high-water mark: only a total above it is credited, and a lower total is ignored (steps are
// never clawed back).

import { DayCredit, StepBucket, StepLedger, StepSyncMode } from '../types/health';
import { RECENT_RECONCILE_DAYS, RECONCILE_DAYS, WELCOME_DAYS } from '../config/stepSync';
import { DAY_MS, localDayStart, nextLocalMidnight } from '../utils/time';

/** Uncredited day buckets from `startMs` until one covers `nowMs`. */
function dayBucketsFrom(startMs: number, nowMs: number): StepBucket[] {
  const buckets: StepBucket[] = [];
  let start = startMs;
  do {
    const end = nextLocalMidnight(start);
    buckets.push({ startMs: start, endMs: end, credited: 0 });
    start = end;
  } while (start <= nowMs);
  return buckets;
}

/** Uncredited day buckets from `startMs` up to `endMs`, the last one cut short to end there. */
function dayBucketsUntil(startMs: number, endMs: number): StepBucket[] {
  const buckets: StepBucket[] = [];
  for (let start = startMs; start < endMs; ) {
    const end = Math.min(nextLocalMidnight(start), endMs);
    buckets.push({ startMs: start, endMs: end, credited: 0 });
    start = end;
  }
  return buckets;
}

/** A ledger that has credited nothing after `ms`: one bucket from `ms` to the next midnight. */
export function ledgerSince(ms: number): StepLedger {
  return {
    buckets: [{ startMs: ms, endMs: nextLocalMidnight(ms), credited: 0 }],
    lastSyncedAt: ms,
  };
}

/**
 * The ledger as a sync at `nowMs` sees it: its buckets cover `nowMs`, and `lastSyncedAt` is not
 * after it. Normally this only appends day buckets after the last one until `nowMs` is covered.
 *
 * A clock that was ahead at the last sync (set wrong, then corrected) left buckets after `nowMs`,
 * and that sync's prune may have dropped the real days before them:
 * - Trailing buckets after `nowMs` that credited nothing are dropped. That loses no high-water
 *   mark, and their days are added again when the clock reaches them.
 * - Credited buckets after `nowMs` are kept, unread until the clock reaches them: Health Connect
 *   holds those steps at those times (counted under the wrong clock), so they must not be
 *   credited again then. This is also a clock set back below the last bucket.
 * - If no bucket is left at or before `nowMs`, the real days' marks were pruned: buckets start
 *   again at today's local midnight. Earlier days are not read again (that could credit them
 *   twice); steps from earlier today that the skewed sync already credited are credited again.
 * - A `lastSyncedAt` after `nowMs` is moved back to the start of the bucket holding `nowMs`. The
 *   skewed sync read real time only up to when it really ran, so that bucket is read again (its
 *   mark prevents a double credit) and nothing in it counts as late.
 */
export function alignToClock(ledger: StepLedger, nowMs: number): StepLedger {
  let kept = ledger.buckets.length;
  while (
    kept > 0 &&
    ledger.buckets[kept - 1].startMs > nowMs &&
    ledger.buckets[kept - 1].credited === 0
  ) {
    kept--;
  }
  const remaining = kept === ledger.buckets.length ? ledger.buckets : ledger.buckets.slice(0, kept);
  const first = remaining[0];
  const last = remaining[remaining.length - 1];
  const buckets =
    remaining.length === 0
      ? dayBucketsFrom(localDayStart(nowMs), nowMs)
      : first.startMs > nowMs
        ? [...dayBucketsUntil(localDayStart(nowMs), first.startMs), ...remaining]
        : last.endMs > nowMs
          ? remaining
          : [...remaining, ...dayBucketsFrom(last.endMs, nowMs)];
  const lastSyncedAt =
    ledger.lastSyncedAt <= nowMs
      ? ledger.lastSyncedAt
      : Math.max(...buckets.filter((b) => b.startMs <= nowMs).map((b) => b.startMs));
  return { buckets, lastSyncedAt };
}

/** The first ledger of a new game: the WELCOME_DAYS full local days before today, and today. */
export function welcomeBuckets(nowMs: number): StepBucket[] {
  // Calendar arithmetic, not WELCOME_DAYS × 24 h, so a DST change in the week can't shift the start.
  const weekAgo = new Date(nowMs);
  weekAgo.setDate(weekAgo.getDate() - WELCOME_DAYS);
  return dayBucketsFrom(localDayStart(weekAgo.getTime()), nowMs);
}

/**
 * Where a sync starts re-reading. A full sync reads everything since the last sync, and at least
 * the last RECONCILE_DAYS, so data a watch or fitness app delivers late is still credited. A
 * recent sync reads only the last RECENT_RECONCILE_DAYS, unless the last sync was before them:
 * then it reads as a full sync.
 */
export function reconcileFrom(lastSyncedAt: number, nowMs: number, mode: StepSyncMode): number {
  const recentFrom = nowMs - RECENT_RECONCILE_DAYS * DAY_MS;
  if (mode === 'recent' && lastSyncedAt >= recentFrom) return recentFrom;
  return Math.min(lastSyncedAt, nowMs - RECONCILE_DAYS * DAY_MS);
}

/**
 * Buckets overlapping [sinceMs, nowMs). Each is read over [startMs, min(endMs, nowMs)), which is
 * never empty; buckets starting at or after `nowMs` (a clock set back) are not read.
 */
export function bucketsToRead(buckets: StepBucket[], nowMs: number, sinceMs: number): StepBucket[] {
  return buckets.filter((b) => b.endMs > sinceMs && b.startMs < nowMs);
}

/**
 * Credits each bucket's total (keyed by `startMs`) above its high-water mark. Buckets without a
 * total, or whose total is not above the mark, are unchanged. A credit is `late` when its bucket
 * ended by `lastSyncedAt` (-Infinity if nothing was synced before): that sync read the whole
 * bucket, so anything above the mark arrived after it.
 */
export function reconcile(
  buckets: StepBucket[],
  totals: ReadonlyMap<number, number>,
  lastSyncedAt: number
): { buckets: StepBucket[]; perDay: DayCredit[]; credited: number } {
  const perDay: DayCredit[] = [];
  const reconciled = buckets.map((bucket) => {
    const total = totals.get(bucket.startMs);
    if (total === undefined || total <= bucket.credited) return bucket;
    perDay.push({
      startMs: bucket.startMs,
      steps: total - bucket.credited,
      late: bucket.endMs <= lastSyncedAt,
    });
    return { ...bucket, credited: total };
  });
  return {
    buckets: reconciled,
    perDay,
    credited: perDay.reduce((sum, day) => sum + day.steps, 0),
  };
}

/** Drops buckets that ended before the reconcile window, always keeping the last bucket. */
export function prune(buckets: StepBucket[], nowMs: number): StepBucket[] {
  const horizon = nowMs - RECONCILE_DAYS * DAY_MS;
  const kept = buckets.filter((b) => b.endMs >= horizon);
  return kept.length > 0 ? kept : buckets.slice(-1);
}
