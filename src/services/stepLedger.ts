// stepLedger - Pure functions over the step ledger: which local-day buckets exist, which of them a
// sync reads from the health platform, and how a read total is credited. Nothing here mutates its
// input or reads the clock; callers pass `nowMs`.
//
// Each bucket's bounds are fixed when it is created and every new bucket starts where the previous
// one ended, so time zone changes and DST can never overlap or skip time. A bucket's `credited` is
// a high-water mark: only a total above it is credited, and a lower total is ignored (steps are
// never clawed back).

import { DayCredit, StepBucket, StepLedger } from '../types/health';
import { RECONCILE_DAYS, WELCOME_DAYS } from '../config/stepSync';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight at the start of the day containing `ms`. */
export function localDayStart(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** The first local midnight after `ms` (23 or 25 hours after the previous one across DST). */
export function nextLocalMidnight(ms: number): number {
  const date = new Date(ms);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

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

/** A ledger that has credited nothing after `ms`: one bucket from `ms` to the next midnight. */
export function ledgerSince(ms: number): StepLedger {
  return {
    buckets: [{ startMs: ms, endMs: nextLocalMidnight(ms), credited: 0 }],
    lastSyncedAt: ms,
  };
}

/** Appends day buckets after the last one until `nowMs` is covered. A clock behind adds none. */
export function extendBuckets(buckets: StepBucket[], nowMs: number): StepBucket[] {
  const last = buckets[buckets.length - 1];
  return last.endMs > nowMs ? buckets : [...buckets, ...dayBucketsFrom(last.endMs, nowMs)];
}

/** The first ledger of a new game: the WELCOME_DAYS full local days before today, and today. */
export function welcomeBuckets(nowMs: number): StepBucket[] {
  // Calendar arithmetic, not WELCOME_DAYS × 24 h, so a DST change in the week can't shift the start.
  const weekAgo = new Date(nowMs);
  weekAgo.setDate(weekAgo.getDate() - WELCOME_DAYS);
  return dayBucketsFrom(localDayStart(weekAgo.getTime()), nowMs);
}

/**
 * Where a sync starts re-reading: everything since the last sync, and at least the last
 * RECONCILE_DAYS, so data a watch or fitness app delivers late is still credited.
 */
export function reconcileFrom(lastSyncedAt: number, nowMs: number): number {
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
 * total, or whose total is not above the mark, are unchanged.
 */
export function reconcile(
  buckets: StepBucket[],
  totals: ReadonlyMap<number, number>
): { buckets: StepBucket[]; perDay: DayCredit[]; credited: number } {
  const perDay: DayCredit[] = [];
  const reconciled = buckets.map((bucket) => {
    const total = totals.get(bucket.startMs);
    if (total === undefined || total <= bucket.credited) return bucket;
    perDay.push({ startMs: bucket.startMs, steps: total - bucket.credited });
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
