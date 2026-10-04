/** @jest-environment ./__tests__/helpers/timeZoneEnvironment.ts */
// Unit tests for the pure step ledger functions, in Europe/London (DST: last Sunday of March and
// October) unless a test switches zone.

import {
  bucketsToRead,
  extendBuckets,
  ledgerSince,
  localDayStart,
  nextLocalMidnight,
  prune,
  reconcile,
  reconcileFrom,
  welcomeBuckets,
} from '../src/services/stepLedger';
import { StepBucket } from '../src/types/health';
import { setTimeZone } from './helpers/timeZone';

// Set before the describe bodies run, since they build fixtures in local time.
setTimeZone('Europe/London');

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Epoch ms of a wall-clock time in the current zone. */
function local(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function bucket(startMs: number, endMs: number, credited = 0): StepBucket {
  return { startMs, endMs, credited };
}

function expectContiguous(buckets: StepBucket[]): void {
  buckets.forEach((b, i) => {
    expect(b.endMs).toBeGreaterThan(b.startMs);
    if (i > 0) expect(b.startMs).toBe(buckets[i - 1].endMs);
  });
}

/** Deep-freezes buckets so any mutation throws. */
function frozen(buckets: StepBucket[]): StepBucket[] {
  return Object.freeze(buckets.map((b) => Object.freeze({ ...b }))) as StepBucket[];
}

describe('stepLedger', () => {
  afterEach(() => {
    setTimeZone('Europe/London');
  });

  describe('local days', () => {
    it('finds local midnights on an ordinary day (BST, UTC+1)', () => {
      const t = local(2026, 7, 1, 14);

      expect(localDayStart(t)).toBe(Date.UTC(2026, 5, 30, 23));
      expect(nextLocalMidnight(t)).toBe(Date.UTC(2026, 6, 1, 23));
    });

    it('makes the spring-forward day 23 hours long', () => {
      const start = local(2026, 3, 29);

      expect(start).toBe(Date.UTC(2026, 2, 29, 0));
      expect(nextLocalMidnight(start) - start).toBe(23 * HOUR_MS);
      expect(localDayStart(local(2026, 3, 29, 12))).toBe(start);
    });

    it('makes the fall-back day 25 hours long', () => {
      const start = local(2026, 10, 25);

      expect(start).toBe(Date.UTC(2026, 9, 24, 23));
      expect(nextLocalMidnight(start) - start).toBe(25 * HOUR_MS);
      expect(nextLocalMidnight(local(2026, 10, 25, 23, 30))).toBe(Date.UTC(2026, 9, 26, 0));
    });

    it('moves past a time that is exactly midnight', () => {
      const midnight = local(2026, 7, 1);

      expect(localDayStart(midnight)).toBe(midnight);
      expect(nextLocalMidnight(midnight)).toBe(local(2026, 7, 2));
    });
  });

  describe('ledgerSince', () => {
    it('starts one uncredited bucket at the time, ending at the next local midnight', () => {
      const t = local(2026, 9, 25, 14, 30);

      expect(ledgerSince(t)).toEqual({
        buckets: [bucket(t, local(2026, 9, 26))],
        lastSyncedAt: t,
      });
    });
  });

  describe('extendBuckets', () => {
    it('appends whole local days until now is covered, without touching existing buckets', () => {
      const first = bucket(local(2026, 9, 25, 14, 30), local(2026, 9, 26), 1234);
      const input = frozen([first]);

      const extended = extendBuckets(input, local(2026, 9, 28, 9));

      expect(extended).toEqual([
        first,
        bucket(local(2026, 9, 26), local(2026, 9, 27)),
        bucket(local(2026, 9, 27), local(2026, 9, 28)),
        bucket(local(2026, 9, 28), local(2026, 9, 29)),
      ]);
      expect(input).toHaveLength(1);
    });

    it('adds a bucket when now is exactly the end of the last one', () => {
      const input = [bucket(local(2026, 9, 25), local(2026, 9, 26))];

      expect(extendBuckets(input, local(2026, 9, 26))).toEqual([
        ...input,
        bucket(local(2026, 9, 26), local(2026, 9, 27)),
      ]);
    });

    it('adds nothing while the last bucket still covers now', () => {
      const input = frozen([bucket(local(2026, 9, 25), local(2026, 9, 26))]);

      expect(extendBuckets(input, local(2026, 9, 25, 23, 59))).toBe(input);
    });

    it('adds nothing when the clock is set back before the last bucket', () => {
      const input = frozen([bucket(local(2026, 9, 25), local(2026, 9, 26))]);

      expect(extendBuckets(input, local(2026, 9, 20))).toBe(input);
    });

    it('keeps 23 h and 25 h DST days contiguous', () => {
      const spring = extendBuckets(
        [bucket(local(2026, 3, 27), local(2026, 3, 28))],
        local(2026, 3, 30, 12)
      );
      const autumn = extendBuckets(
        [bucket(local(2026, 10, 23), local(2026, 10, 24))],
        local(2026, 10, 26, 12)
      );

      expectContiguous(spring);
      expectContiguous(autumn);
      expect(spring.map((b) => (b.endMs - b.startMs) / HOUR_MS)).toEqual([24, 24, 23, 24]);
      expect(autumn.map((b) => (b.endMs - b.startMs) / HOUR_MS)).toEqual([24, 24, 25, 24]);
    });

    it('keeps existing bounds and stays contiguous when the time zone changes', () => {
      const londonDay = bucket(local(2026, 9, 25), local(2026, 9, 26));
      expect(londonDay.endMs).toBe(Date.UTC(2026, 8, 25, 23)); // London midnight

      setTimeZone('America/New_York');
      const extended = extendBuckets([londonDay], Date.UTC(2026, 8, 27, 12));

      expect(extended[0]).toEqual(londonDay);
      expectContiguous(extended);
      // 19:00 New York on the 25th up to New York midnight, then whole New York days
      expect(extended[1]).toEqual(bucket(Date.UTC(2026, 8, 25, 23), Date.UTC(2026, 8, 26, 4)));
      expect(extended[2]).toEqual(bucket(Date.UTC(2026, 8, 26, 4), Date.UTC(2026, 8, 27, 4)));
      expect(extended[3]).toEqual(bucket(Date.UTC(2026, 8, 27, 4), Date.UTC(2026, 8, 28, 4)));
      expect(extended).toHaveLength(4);
    });
  });

  describe('welcomeBuckets', () => {
    it('covers the 7 full local days before today, and today', () => {
      const now = local(2026, 10, 4, 18);

      const buckets = welcomeBuckets(now);

      expect(buckets).toHaveLength(8);
      expect(buckets[0].startMs).toBe(local(2026, 9, 27));
      expect(buckets[7]).toEqual(bucket(local(2026, 10, 4), local(2026, 10, 5)));
      expect(buckets.every((b) => b.credited === 0)).toBe(true);
      expectContiguous(buckets);
    });

    it('starts at local midnight 7 calendar days back across a DST change', () => {
      const now = local(2026, 3, 31, 9); // two days after spring-forward

      const buckets = welcomeBuckets(now);

      expect(buckets[0].startMs).toBe(local(2026, 3, 24));
      expect(buckets[0].startMs).toBe(Date.UTC(2026, 2, 24, 0)); // GMT, not 7 × 24 h before BST
      expect(buckets).toHaveLength(8);
      expect(buckets.map((b) => (b.endMs - b.startMs) / HOUR_MS)).toEqual([
        24, 24, 24, 24, 24, 23, 24, 24,
      ]);
      expect(buckets[7].startMs).toBeLessThanOrEqual(now);
      expect(buckets[7].endMs).toBeGreaterThan(now);
    });
  });

  describe('reconcileFrom', () => {
    const now = local(2026, 10, 4, 18);

    it('re-reads the reconcile window after a recent sync', () => {
      expect(reconcileFrom(now - HOUR_MS, now, 'full')).toBe(now - 14 * DAY_MS);
    });

    it('reads everything since an older sync', () => {
      expect(reconcileFrom(now - 45 * DAY_MS, now, 'full')).toBe(now - 45 * DAY_MS);
    });

    it('re-reads only the recent window in recent mode', () => {
      expect(reconcileFrom(now - HOUR_MS, now, 'recent')).toBe(now - 2 * DAY_MS);
      expect(reconcileFrom(now - 2 * DAY_MS, now, 'recent')).toBe(now - 2 * DAY_MS);
    });

    it('reads as a full sync in recent mode when the last sync is before the recent window', () => {
      expect(reconcileFrom(now - 2 * DAY_MS - 1, now, 'recent')).toBe(now - 14 * DAY_MS);
      expect(reconcileFrom(now - 45 * DAY_MS, now, 'recent')).toBe(now - 45 * DAY_MS);
    });

    it('re-reads the recent window in recent mode when the clock is behind the last sync', () => {
      expect(reconcileFrom(now + HOUR_MS, now, 'recent')).toBe(now - 2 * DAY_MS);
    });
  });

  describe('bucketsToRead', () => {
    const days = [
      bucket(local(2026, 10, 1), local(2026, 10, 2)),
      bucket(local(2026, 10, 2), local(2026, 10, 3)),
      bucket(local(2026, 10, 3), local(2026, 10, 4)),
    ];

    it('selects buckets overlapping [since, now)', () => {
      expect(bucketsToRead(days, local(2026, 10, 3, 12), local(2026, 10, 2, 6))).toEqual([
        days[1],
        days[2],
      ]);
    });

    it('excludes a bucket ending exactly at since', () => {
      expect(bucketsToRead(days, local(2026, 10, 3, 12), local(2026, 10, 2))).toEqual([
        days[1],
        days[2],
      ]);
    });

    it('never selects a bucket starting at or after now (clock set back)', () => {
      expect(bucketsToRead(days, local(2026, 10, 2), -Infinity)).toEqual([days[0]]);
    });
  });

  describe('reconcile', () => {
    const a = bucket(local(2026, 10, 1), local(2026, 10, 2), 5000);
    const b = bucket(local(2026, 10, 2), local(2026, 10, 3), 0);
    const c = bucket(local(2026, 10, 3), local(2026, 10, 4), 800);

    it('credits only totals above each high-water mark, without mutating its input', () => {
      const input = frozen([a, b, c]);

      const result = reconcile(
        input,
        new Map([
          [a.startMs, 5200],
          [b.startMs, 3000],
          [c.startMs, 800],
        ])
      );

      expect(result.credited).toBe(200 + 3000);
      expect(result.perDay).toEqual([
        { startMs: a.startMs, steps: 200 },
        { startMs: b.startMs, steps: 3000 },
      ]);
      expect(result.buckets).toEqual([{ ...a, credited: 5200 }, { ...b, credited: 3000 }, c]);
      expect(result.buckets[2]).toBe(input[2]);
      expect(input[0].credited).toBe(5000);
    });

    it('never claws back: a lower total credits nothing and keeps the mark', () => {
      const result = reconcile([a], new Map([[a.startMs, 4200]]));

      expect(result).toEqual({ buckets: [a], perDay: [], credited: 0 });
    });

    it('leaves buckets without a total unchanged', () => {
      const result = reconcile([a, b], new Map([[b.startMs, 10]]));

      expect(result.buckets).toEqual([a, { ...b, credited: 10 }]);
      expect(result.credited).toBe(10);
    });
  });

  describe('prune', () => {
    const now = local(2026, 10, 20, 12);

    it('drops buckets that ended before the reconcile window, keeping the rest contiguous', () => {
      const days = extendBuckets([bucket(local(2026, 9, 30), local(2026, 10, 1))], now);

      const pruned = prune(frozen(days), now);

      expect(pruned[0].endMs).toBeGreaterThanOrEqual(now - 14 * DAY_MS);
      expect(pruned[0].startMs).toBeLessThan(now - 14 * DAY_MS);
      expect(pruned[pruned.length - 1]).toEqual(days[days.length - 1]);
      expect(pruned).toHaveLength(15);
      expectContiguous(pruned);
    });

    it('always keeps the last bucket', () => {
      const old = [
        bucket(local(2026, 9, 1), local(2026, 9, 2), 10),
        bucket(local(2026, 9, 2), local(2026, 9, 3), 20),
      ];

      expect(prune(old, now)).toEqual([old[1]]);
    });
  });
});
