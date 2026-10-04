/** @jest-environment ./__tests__/helpers/timeZoneEnvironment.ts */
// End-to-end step sync scenarios: weekly check-ins, a Pixel Watch syncing through the Fitbit app
// late (com.fitbit.FitbitMobile, priority over on-device steps), time zones and DST, long absences,
// restores onto a reinstall or a new phone, and saves from before the step ledger.
// Runs against the fake Health Connect with the real HealthService, step ledger, store and
// persistence (in-memory AsyncStorage). Expected credits are hand-computed from the records or
// taken from the fake's own de-duplicated aggregate over the whole period.

import { Platform } from 'react-native';
import { getInstallationTimeAsync } from 'expo-application';
import {
  FITBIT_ORIGIN,
  ON_DEVICE_ORIGIN,
  fakeHC,
  fitbitBatch,
  sumCounts,
  walk,
} from './helpers/fakeHealthConnect';
import {
  availableSteps,
  hcTotal,
  ledger,
  loadAndConnect,
  local,
  restartApp,
  seedSave,
  storedBlob,
  storedGame,
  useMemoryStorage,
} from './helpers/stepSyncHarness';
import { setTimeZone } from './helpers/timeZone';
import { syncSteps } from '../src/services/stepSync';
import { ledgerSince, localDayStart } from '../src/services/stepLedger';
import { useGameStore } from '../src/store/gameStore';
import { StepBucket, StepSyncResult } from '../src/types/health';
import type { FakeStepRecordInput } from './helpers/fakeHealthConnect';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);

// Set before the describe bodies run, since they build fixtures in local time.
setTimeZone('Europe/London');

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const NOW = local(2026, 10, 4, 18);

async function syncAt(ms: number): Promise<StepSyncResult> {
  jest.setSystemTime(ms);
  return syncSteps();
}

function credited(result: StepSyncResult): number {
  if (result.status !== 'synced') throw new Error(`sync failed: ${result.message}`);
  return result.credited;
}

function expectContiguous(buckets: StepBucket[]): void {
  buckets.forEach((b, i) => {
    expect(b.endMs).toBeGreaterThan(b.startMs);
    if (i > 0) expect(b.startMs).toBe(buckets[i - 1].endMs);
  });
}

/** Records for the same walk on each local day in [firstDay, lastDay]. */
function daily(
  firstDay: number,
  lastDay: number,
  make: (dayStart: number) => FakeStepRecordInput[]
): FakeStepRecordInput[] {
  const records: FakeStepRecordInput[] = [];
  for (let day = new Date(firstDay); day.getTime() <= lastDay; day.setDate(day.getDate() + 1)) {
    records.push(...make(day.getTime()));
  }
  return records;
}

function startingIn(records: FakeStepRecordInput[], from: number, to = Infinity): number {
  return sumCounts(records.filter((r) => r.start >= from && r.start < to));
}

describe('step sync scenarios', () => {
  beforeEach(() => {
    setTimeZone('Europe/London');
    jest.useFakeTimers({ now: NOW });
    Platform.OS = 'android';
    fakeHC.reset();
    useMemoryStorage();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('weekly gap: credits exactly the de-duplicated total of 9 days of phone and Fitbit steps, once', async () => {
    const lastSync = local(2026, 9, 25, 21);
    const onDevice = daily(local(2026, 9, 25), local(2026, 10, 4), (day) =>
      walk(day + 7 * HOUR_MS, day + 9 * HOUR_MS, 12)
    );
    const evening = walk(local(2026, 9, 25, 22), local(2026, 9, 25, 22, 30), 12);
    const fitbitMornings = [local(2026, 9, 28), local(2026, 9, 30), local(2026, 10, 2)];
    const fitbit = [
      ...fitbitMornings.flatMap((day) =>
        fitbitBatch(day + 7.5 * HOUR_MS, day + 8.5 * HOUR_MS, 300)
      ),
      ...fitbitBatch(local(2026, 10, 1, 17), local(2026, 10, 1, 18), 400),
    ];
    fakeHC.upsert([...onDevice, ...evening, ...fitbit]);
    expect(onDevice.length + evening.length).toBeGreaterThan(1000);
    const creditedBefore = hcTotal(local(2026, 9, 25), lastSync);
    seedSave({
      availableSteps: 900,
      stepLedger: {
        buckets: [
          { startMs: local(2026, 9, 25), endMs: local(2026, 9, 26), credited: creditedBefore },
        ],
        lastSyncedAt: lastSync,
      },
    });
    await loadAndConnect();

    const result = await syncSteps();

    // 25th evening 360; 9 days × 1440 on-device; Fitbit replaces 720 with 1200 on 3 mornings;
    // a Fitbit-only hour of 1600.
    const truth = 360 + 9 * 1440 + 3 * (1200 - 720) + 1600;
    expect(credited(result)).toBe(truth);
    expect(hcTotal(lastSync, NOW)).toBe(truth);
    expect(sumCounts([...evening, ...onDevice, ...fitbit]) - creditedBefore).toBeGreaterThan(truth);
    expect(availableSteps()).toBe(900 + truth);
    expect(storedGame()).toMatchObject({ availableSteps: 900 + truth });

    expect(credited(await syncSteps())).toBe(0);
    expect(availableSteps()).toBe(900 + truth);
  });

  describe('Pixel Watch steps arriving late through the Fitbit app', () => {
    it('credits Fitbit records written hours later for this afternoon and last night', async () => {
      seedSave({ availableSteps: 0, stepLedger: ledgerSince(local(2026, 10, 3, 8)) });
      const morning = walk(local(2026, 10, 4, 9), local(2026, 10, 4, 9, 30), 40);
      fakeHC.upsert(morning);
      await loadAndConnect();
      expect(credited(await syncAt(NOW))).toBe(1200); // check-in at 18:00

      // At 21:00 the Fitbit app delivers today 14:00–17:00 and a backlog for yesterday evening.
      jest.setSystemTime(local(2026, 10, 4, 21));
      const today = fitbitBatch(local(2026, 10, 4, 14), local(2026, 10, 4, 17), 250);
      const lastNight = fitbitBatch(local(2026, 10, 3, 19), local(2026, 10, 3, 22), 200);
      fakeHC.upsert([...today, ...lastNight]);

      const result = await syncSteps();

      expect(result).toMatchObject({
        status: 'synced',
        credited: 12 * 250 + 12 * 200,
        perDay: [
          { startMs: local(2026, 10, 3, 8), steps: 12 * 200 }, // the ledger's first bucket
          { startMs: local(2026, 10, 4), steps: 12 * 250 },
        ],
      });
      expect(availableSteps()).toBe(1200 + sumCounts(today) + sumCounts(lastNight));
    });

    it('credits only the Fitbit excess over on-device steps already credited for the same hours', async () => {
      seedSave({ availableSteps: 0, stepLedger: ledgerSince(local(2026, 10, 4, 8)) });
      const onDevice = walk(local(2026, 10, 4, 14), local(2026, 10, 4, 17), 10); // 1800
      fakeHC.upsert(onDevice);
      await loadAndConnect();
      expect(credited(await syncAt(NOW))).toBe(1800);

      jest.setSystemTime(local(2026, 10, 4, 21));
      const fitbit = fitbitBatch(local(2026, 10, 4, 14), local(2026, 10, 4, 17), 250); // 3000
      fakeHC.upsert(fitbit);

      expect(await syncSteps()).toMatchObject({
        credited: 1200,
        perDay: [{ startMs: local(2026, 10, 4, 8), steps: 1200 }],
      });
      expect(availableSteps()).toBe(sumCounts(fitbit));
      expect(hcTotal(local(2026, 10, 4), local(2026, 10, 4, 21))).toBe(3000);
    });
  });

  describe('no clawback', () => {
    it('keeps the high-water mark when Health Connect totals drop, and credits only rises above it', async () => {
      const today = local(2026, 10, 4);
      seedSave({ availableSteps: 0, stepLedger: ledgerSince(today) });
      fakeHC.upsert(walk(local(2026, 10, 4, 10), local(2026, 10, 4, 10, 50), 100)); // 5000 on-device
      await loadAndConnect();
      expect(credited(await syncAt(local(2026, 10, 4, 12)))).toBe(5000);

      // Fitbit's batch for the same hour counts 4200 and wins on priority: the total drops.
      fakeHC.upsert(fitbitBatch(local(2026, 10, 4, 10), local(2026, 10, 4, 11), 1050));
      expect(hcTotal(today, local(2026, 10, 4, 13))).toBe(4200);
      expect(credited(await syncAt(local(2026, 10, 4, 13)))).toBe(0);
      expect(ledger().buckets).toEqual([
        { startMs: today, endMs: local(2026, 10, 5), credited: 5000 },
      ]);
      expect(availableSteps()).toBe(5000);

      // A 1000-step Fitbit walk: total 5200, so only the 200 above the mark is credited.
      const walk3pm = fitbitBatch(local(2026, 10, 4, 15), local(2026, 10, 4, 16), 250);
      fakeHC.upsert(walk3pm);
      expect(await syncAt(local(2026, 10, 4, 16))).toMatchObject({
        credited: 200,
        perDay: [{ startMs: today, steps: 200 }],
      });
      expect(availableSteps()).toBe(5200);

      // Deleting that walk takes nothing back.
      fakeHC.delete(walk3pm.map((r) => r.id!));
      expect(credited(await syncAt(local(2026, 10, 4, 17)))).toBe(0);
      expect(availableSteps()).toBe(5200);
      expect(ledger().buckets[0].credited).toBe(5200);

      // Accepted consequence: new steps first make up the deleted ones before counting again.
      fakeHC.upsert(fitbitBatch(local(2026, 10, 4, 17), local(2026, 10, 4, 18), 300)); // +1200
      expect(credited(await syncAt(local(2026, 10, 4, 18)))).toBe(4200 + 1200 - 5200);
      expect(availableSteps()).toBe(5400);
    });
  });

  it('in session: credits steps whose records are written minutes after the walk', async () => {
    seedSave({ availableSteps: 0, stepLedger: ledgerSince(local(2026, 10, 4, 8)) });
    await loadAndConnect();
    expect(credited(await syncAt(NOW))).toBe(0);

    // Walk 18:00–18:20; the phone writes the records at 18:25.
    const steps = walk(NOW, NOW + 20 * MINUTE_MS, 90);
    expect(credited(await syncAt(NOW + 22 * MINUTE_MS))).toBe(0);
    jest.setSystemTime(NOW + 25 * MINUTE_MS);
    fakeHC.upsert(steps);

    expect(credited(await syncAt(NOW + 30 * MINUTE_MS))).toBe(20 * 90);
    expect(credited(await syncAt(NOW + 35 * MINUTE_MS))).toBe(0);
    expect(availableSteps()).toBe(1800);
  });

  it('time zones and DST: a London week with the clocks going back, then New York, credits every step once', async () => {
    const lastSync = local(2026, 10, 21, 20); // 19:00 UTC
    const utcDays = Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 9, 20 + i));
    const records = [
      ...walk(Date.UTC(2026, 9, 21, 12), Date.UTC(2026, 9, 21, 12, 30), 20), // before the last sync
      ...utcDays.flatMap((utcDay) => [
        ...walk(utcDay + 7 * HOUR_MS, utcDay + 7.5 * HOUR_MS, 20),
        ...walk(utcDay + 22.75 * HOUR_MS, utcDay + 23.25 * HOUR_MS, 30), // across London midnight (BST)
        ...walk(utcDay + 3.75 * HOUR_MS, utcDay + 4.25 * HOUR_MS, 40), // across New York midnight (EDT)
      ]),
      ...walk(Date.UTC(2026, 9, 25, 0, 30), Date.UTC(2026, 9, 25, 1, 30), 25), // London's repeated hour
    ];
    fakeHC.upsert(records);
    seedSave({ availableSteps: 0, stepLedger: ledgerSince(lastSync) });
    await loadAndConnect();

    let total = 0;
    const syncAndCheck = async (at: number) => {
      total += credited(await syncAt(at));
      expect(total).toBe(startingIn(records, lastSync, at));
      expect(total).toBe(hcTotal(lastSync, at));
      expectContiguous(ledger().buckets);
    };

    await syncAndCheck(local(2026, 10, 22, 9));
    await syncAndCheck(local(2026, 10, 24, 21));
    await syncAndCheck(local(2026, 10, 25, 12)); // 25-hour day
    await syncAndCheck(local(2026, 10, 26, 8));
    const london = ledger().buckets;
    expect(london.find((b) => b.startMs === local(2026, 10, 25))!.endMs).toBe(
      local(2026, 10, 25) + 25 * HOUR_MS
    );

    setTimeZone('America/New_York');
    await syncAndCheck(local(2026, 10, 27, 10));
    await syncAndCheck(local(2026, 10, 28, 23));
    await syncAndCheck(local(2026, 10, 29, 12));

    const buckets = ledger().buckets;
    expect(buckets.slice(0, london.length).map((b) => [b.startMs, b.endMs])).toEqual(
      london.map((b) => [b.startMs, b.endMs])
    );
    // The first New York bucket runs from London midnight to New York midnight.
    expect(buckets[london.length]).toMatchObject({
      startMs: Date.UTC(2026, 9, 27, 0),
      endMs: Date.UTC(2026, 9, 27, 4),
    });
    expect(total).toBe(startingIn(records, lastSync, local(2026, 10, 29, 12)));
    expect(credited(await syncSteps())).toBe(0);
    expect(availableSteps()).toBe(total);
  });

  it('45-day absence: credits all 45 days once', async () => {
    const lastSync = NOW - 45 * DAY_MS;
    fakeHC.firstGrantAt = lastSync - 10 * DAY_MS; // history floor 40 days before the absence
    const days = daily(local(2026, 8, 21), local(2026, 10, 4), (day) =>
      walk(day + 9 * HOUR_MS, day + 9 * HOUR_MS + 100 * MINUTE_MS, 10)
    );
    const evening = walk(lastSync + HOUR_MS, lastSync + HOUR_MS + 50 * MINUTE_MS, 10);
    fakeHC.upsert([...days, ...evening]);
    seedSave({ availableSteps: 0, stepLedger: ledgerSince(lastSync) });
    await loadAndConnect();

    const result = await syncSteps();

    expect(credited(result)).toBe(45 * 1000 + 500);
    expect(result).toMatchObject({ welcome: false });
    expect(result).not.toHaveProperty('historyLimitedBefore');
    expect(result.status === 'synced' && result.perDay).toHaveLength(46);
    expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(46);
    expect(ledger().buckets).toHaveLength(15); // pruned to the reconcile window
    expectContiguous(ledger().buckets);

    expect(credited(await syncSteps())).toBe(0);
    expect(availableSteps()).toBe(45500);
  });

  describe('restore from backup', () => {
    it('onto a reinstall 40 days later: credits only what Health Connect can share, and says so', async () => {
      const lastSync = NOW - 40 * DAY_MS;
      const installedAt = NOW - 2 * HOUR_MS;
      jest.mocked(getInstallationTimeAsync).mockResolvedValue(new Date(installedAt));
      fakeHC.firstGrantAt = NOW - HOUR_MS; // the new grant: history from 30 days before it
      const history = daily(local(2026, 7, 1), local(2026, 10, 4), (day) =>
        fitbitBatch(day + 12 * HOUR_MS, day + 13 * HOUR_MS, 750)
      );
      fakeHC.upsert(history);
      const backupDay = localDayStart(lastSync);
      seedSave({
        availableSteps: 1234,
        stepLedger: {
          buckets: [
            { startMs: backupDay - DAY_MS, endMs: backupDay, credited: 3000 },
            { startMs: backupDay, endMs: backupDay + DAY_MS, credited: 3000 },
          ],
          lastSyncedAt: lastSync,
        },
      });
      await loadAndConnect();

      const result = await syncSteps();

      const readable = startingIn(history, fakeHC.historyFloor());
      expect(readable).toBe(30 * 3000);
      expect(result).toMatchObject({
        status: 'synced',
        credited: readable,
        welcome: false,
        historyLimitedBefore: installedAt - 30 * DAY_MS,
      });
      expect(availableSteps()).toBe(1234 + readable);

      // The next sync knows the app was installed before it, so there is nothing more to say.
      const again = await syncSteps();
      expect(again).toMatchObject({ credited: 0 });
      expect(again).not.toHaveProperty('historyLimitedBefore');
    });

    it('of a 1-day-old backup onto a new phone: credits only steps above the backed-up marks', async () => {
      const backupAt = NOW - DAY_MS;
      const history = [
        ...daily(local(2026, 9, 25), local(2026, 10, 4), (day) =>
          fitbitBatch(day + 12 * HOUR_MS, day + 13 * HOUR_MS, 750)
        ),
        ...fitbitBatch(local(2026, 10, 3, 20), local(2026, 10, 3, 21), 500), // after the backup
        ...fitbitBatch(local(2026, 10, 4, 8), local(2026, 10, 4, 9), 250),
      ];

      // Old phone: the last sync before the backup.
      fakeHC.upsert(history);
      seedSave({ availableSteps: 0, stepLedger: ledgerSince(local(2026, 9, 25)) });
      await loadAndConnect();
      jest.setSystemTime(backupAt);
      const backedUp = credited(await syncSteps());
      expect(backedUp).toBe(startingIn(history, local(2026, 9, 25), backupAt));
      const backup = storedBlob();

      // New phone: the Fitbit app backfills the same history, except it lost October 1st.
      fakeHC.reset();
      fakeHC.firstGrantAt = NOW - 30 * MINUTE_MS;
      jest.mocked(getInstallationTimeAsync).mockResolvedValue(new Date(NOW - HOUR_MS));
      fakeHC.upsert(history.filter((r) => localDayStart(r.start) !== local(2026, 10, 1)));
      jest.setSystemTime(NOW);
      await restartApp();
      expect(storedBlob()).toBe(backup);

      const result = await syncSteps();

      expect(result).toMatchObject({
        status: 'synced',
        credited: 2000 + 1000 + 3000,
        welcome: false,
        perDay: [
          { startMs: local(2026, 10, 3), steps: 2000 },
          { startMs: local(2026, 10, 4), steps: 4000 },
        ],
      });
      expect(result).not.toHaveProperty('historyLimitedBefore');
      expect(startingIn(history, backupAt)).toBe(6000);
      expect(availableSteps()).toBe(backedUp + 6000);
    });
  });

  describe('saves from before the step ledger (schema v1)', () => {
    it('migrates the watermark to a ledger, keeps steps, and credits exactly the steps since it', async () => {
      const watermark = local(2026, 10, 2, 14, 30);
      const records = daily(local(2026, 10, 1), local(2026, 10, 4), (day) => [
        ...walk(day + 9 * HOUR_MS, day + 10 * HOUR_MS, 20),
        ...walk(day + 15 * HOUR_MS, day + 16 * HOUR_MS, 30),
      ]);
      fakeHC.upsert(records);
      seedSave({ availableSteps: 2500, totalStepsGathered: 4000, lastSyncTimestamp: watermark }, 1);
      await loadAndConnect();

      expect(useGameStore.getState()).toMatchObject({
        availableSteps: 2500,
        totalStepsGathered: 4000,
        stepLedger: {
          buckets: [{ startMs: watermark, endMs: local(2026, 10, 3), credited: 0 }],
          lastSyncedAt: watermark,
        },
      });

      const result = await syncSteps();

      // 2 Oct 15:00–16:00, then 3 Oct both walks, then 4 Oct both walks (before 18:00).
      expect(credited(result)).toBe(1800 + 2 * (1200 + 1800));
      expect(credited(result)).toBe(startingIn(records, watermark, NOW));
      expect(result).toMatchObject({ welcome: false });
      expect(storedGame()).toMatchObject({ schemaVersion: 2, availableSteps: 2500 + 7800 });
      expect(storedGame()).not.toHaveProperty('lastSyncTimestamp');
    });

    it('migrates an unversioned save with a watermark the same way', async () => {
      const watermark = NOW - 3 * HOUR_MS;
      fakeHC.upsert(walk(NOW - 5 * HOUR_MS, NOW, 2));
      seedSave({ availableSteps: 10, lastSyncTimestamp: watermark }, 0);
      await loadAndConnect();

      expect(credited(await syncSteps())).toBe(3 * 60 * 2);
      expect(storedGame()).toMatchObject({ schemaVersion: 2, availableSteps: 370 });
    });

    it('treats a v1 save that never synced as a new game and gives the welcome credit', async () => {
      const week = walk(local(2026, 9, 27, 10), local(2026, 9, 27, 11), 25);
      fakeHC.upsert([...walk(local(2026, 9, 20, 10), local(2026, 9, 20, 11), 25), ...week]);
      seedSave({ availableSteps: 300, lastSyncTimestamp: 0 }, 1);
      await loadAndConnect();

      expect(useGameStore.getState().stepLedger).toBeNull();
      expect(await syncSteps()).toMatchObject({ credited: sumCounts(week), welcome: true });
      expect(availableSteps()).toBe(300 + 1500);
    });
  });

  describe('loading a saved ledger', () => {
    const lastSyncedAt = NOW - 2 * HOUR_MS;
    const day = local(2026, 10, 4);
    const valid = {
      buckets: [
        { startMs: day - DAY_MS, endMs: day, credited: 4000 },
        { startMs: day, endMs: day + DAY_MS, credited: 700 },
      ],
      lastSyncedAt,
    };

    it('keeps a well-formed ledger', async () => {
      seedSave({
        availableSteps: 0,
        stepLedger: { ...valid, buckets: valid.buckets.map((b) => ({ ...b, extra: 1 })) },
      });
      await loadAndConnect();

      expect(useGameStore.getState().stepLedger).toEqual(valid);
    });

    it.each([
      ['no buckets', []],
      ['buckets that are not a list', { 0: valid.buckets[0] }],
      ['a gap between buckets', [valid.buckets[0], { ...valid.buckets[1], startMs: day + 1 }]],
      ['an empty bucket', [{ startMs: day, endMs: day, credited: 0 }]],
      ['a negative credit', [{ ...valid.buckets[1], credited: -5 }]],
      ['a non-numeric bound', [{ ...valid.buckets[1], endMs: 'tomorrow' }]],
      ['a null bucket', [valid.buckets[0], null]],
    ])(
      'restarts a ledger with %s from lastSyncedAt instead of giving a welcome',
      async (_label, buckets) => {
        fakeHC.upsert(walk(NOW - 4 * HOUR_MS, NOW, 5));
        seedSave({ availableSteps: 0, stepLedger: { buckets, lastSyncedAt } });
        await loadAndConnect();

        expect(useGameStore.getState().stepLedger).toEqual(ledgerSince(lastSyncedAt));
        expect(await syncSteps()).toMatchObject({ credited: 2 * 60 * 5, welcome: false });
      }
    );

    it.each([
      ['missing', undefined],
      ['a string', { buckets: valid.buckets, lastSyncedAt: String(lastSyncedAt) }],
      ['negative', { buckets: valid.buckets, lastSyncedAt: -1 }],
      ['zero', { buckets: valid.buckets, lastSyncedAt: 0 }],
      ['null', { buckets: valid.buckets, lastSyncedAt: null }],
    ])('drops a ledger whose lastSyncedAt is %s', async (_label, stepLedger) => {
      seedSave({ availableSteps: 0, stepLedger });
      await loadAndConnect();

      expect(useGameStore.getState().stepLedger).toBeNull();
    });
  });
});
