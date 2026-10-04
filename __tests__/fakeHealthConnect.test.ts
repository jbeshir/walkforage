// Self-tests for the fake Health Connect fixture used by the step-sync tests

import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';
import {
  FITBIT_ORIGIN,
  ON_DEVICE_ORIGIN,
  dayRecord,
  fakeHC,
  fitbitBatch,
  hcErrors,
  sumCounts,
  walk,
} from './helpers/fakeHealthConnect';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const DAY_START = new Date(2026, 5, 15).getTime();
const NEXT_DAY_START = new Date(2026, 5, 16).getTime();

const iso = (ms: number) => new Date(ms).toISOString();
const between = (from: number, to: number) => ({
  operator: 'between' as const,
  startTime: iso(from),
  endTime: iso(to),
});
const aggregate = (from: number, to: number) =>
  aggregateRecord({ recordType: 'Steps', timeRangeFilter: between(from, to) });

async function readAll(from: number, to: number, pageSize?: number) {
  const records = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const result = await readRecords('Steps', {
      timeRangeFilter: between(from, to),
      pageSize,
      pageToken,
    });
    records.push(...result.records);
    pageToken = result.pageToken;
    pages++;
  } while (pageToken);
  return { records, pages };
}

describe('fake Health Connect', () => {
  beforeEach(() => {
    fakeHC.reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('aggregateRecord', () => {
    const walkStart = DAY_START + 10 * HOUR;
    const walkEnd = walkStart + HOUR;

    it('de-duplicates two origins covering the same time by priority', async () => {
      fakeHC.upsert(walk(walkStart, walkEnd, 10));
      fakeHC.upsert(fitbitBatch(walkStart, walkEnd, 100));

      await expect(aggregate(DAY_START, NEXT_DAY_START)).resolves.toEqual({
        COUNT_TOTAL: 400,
        dataOrigins: [FITBIT_ORIGIN],
      });

      fakeHC.priority = [ON_DEVICE_ORIGIN, FITBIT_ORIGIN];
      await expect(aggregate(DAY_START, NEXT_DAY_START)).resolves.toEqual({
        COUNT_TOTAL: 600,
        dataOrigins: [ON_DEVICE_ORIGIN],
      });
    });

    it('counts a lower-priority origin only where no higher-priority record covers', async () => {
      fakeHC.upsert(walk(walkStart, walkEnd + HOUR, 10));
      fakeHC.upsert(fitbitBatch(walkStart, walkEnd, 100));

      await expect(aggregate(DAY_START, NEXT_DAY_START)).resolves.toEqual({
        COUNT_TOTAL: 400 + 600,
        dataOrigins: [FITBIT_ORIGIN, ON_DEVICE_ORIGIN],
      });
    });

    it('ranks unlisted origins after listed ones, in insertion order', async () => {
      fakeHC.upsert([{ start: walkStart, end: walkEnd, count: 70, origin: 'com.example.b' }]);
      fakeHC.upsert([{ start: walkStart, end: walkEnd, count: 80, origin: 'com.example.a' }]);

      const both = await aggregate(walkStart, walkEnd);
      expect(both.COUNT_TOTAL).toBe(70);

      fakeHC.upsert(walk(walkStart, walkEnd, 1));
      const withListed = await aggregate(walkStart, walkEnd);
      expect(withListed).toEqual({ COUNT_TOTAL: 60, dataOrigins: [ON_DEVICE_ORIGIN] });
    });

    it('pro-rates a whole-day record over [12:00, 24:00) to half', async () => {
      fakeHC.upsert([dayRecord(DAY_START, 10_000)]);

      const result = await aggregate(DAY_START + 12 * HOUR, NEXT_DAY_START);

      expect(result.COUNT_TOTAL).toBe(5_000);
    });

    it('pro-rates a straddling record by its overlap with the window', async () => {
      fakeHC.upsert([
        {
          start: walkStart - 10 * MINUTE,
          end: walkStart + 10 * MINUTE,
          count: 200,
          origin: ON_DEVICE_ORIGIN,
        },
      ]);

      const result = await aggregate(walkStart, walkEnd);

      expect(result.COUNT_TOTAL).toBe(100);
    });

    it('rejects a non-Steps record type', async () => {
      await expect(
        aggregateRecord({
          recordType: 'Distance',
          timeRangeFilter: between(DAY_START, NEXT_DAY_START),
        })
      ).rejects.toMatchObject({ code: 'AGGREGATION_NOT_SUPPORTED' });
    });
  });

  describe('readRecords', () => {
    it('returns every record across pages, ending with an empty pageToken', async () => {
      const records = walk(DAY_START, DAY_START + 2_500 * MINUTE, 3);
      fakeHC.upsert(records);

      const first = await readRecords('Steps', {
        timeRangeFilter: between(DAY_START, DAY_START + 3 * DAY),
      });
      expect(first.records).toHaveLength(1000);
      expect(first.pageToken).toBeTruthy();

      const { records: all, pages } = await readAll(DAY_START, DAY_START + 3 * DAY);
      expect(pages).toBe(3);
      expect(all).toHaveLength(2_500);
      expect(new Set(all.map((r) => r.metadata?.id)).size).toBe(2_500);
      expect(all.reduce((sum, r) => sum + r.count, 0)).toBe(sumCounts(records));
      expect(fakeHC.callsTo('readRecords').at(-1)?.args).toEqual([
        'Steps',
        expect.objectContaining({ pageToken: expect.any(String) }),
      ]);
    });

    it('can end paging with an undefined pageToken', async () => {
      fakeHC.lastPageToken = undefined;
      fakeHC.upsert(walk(DAY_START, DAY_START + 30 * MINUTE, 3));

      const result = await readRecords('Steps', {
        timeRangeFilter: between(DAY_START, NEXT_DAY_START),
        pageSize: 10,
        pageToken: 'page-20',
      });

      expect(result.records).toHaveLength(10);
      expect(result.pageToken).toBeUndefined();
    });

    it('filters by start time, missing a record that starts before the window', async () => {
      const windowStart = DAY_START + 10 * HOUR;
      fakeHC.upsert([
        {
          start: windowStart - 10 * MINUTE,
          end: windowStart + 10 * MINUTE,
          count: 200,
          origin: ON_DEVICE_ORIGIN,
        },
        {
          start: windowStart + 30 * MINUTE,
          end: windowStart + 31 * MINUTE,
          count: 50,
          origin: ON_DEVICE_ORIGIN,
        },
      ]);

      const { records } = await readAll(windowStart, windowStart + HOUR);

      expect(records).toEqual([
        {
          recordType: 'Steps',
          count: 50,
          startTime: iso(windowStart + 30 * MINUTE),
          endTime: iso(windowStart + 31 * MINUTE),
          metadata: { id: expect.any(String), dataOrigin: ON_DEVICE_ORIGIN },
        },
      ]);
      expect((await aggregate(windowStart, windowStart + HOUR)).COUNT_TOTAL).toBe(150);
    });

    it('orders ascending by default and descending on request, with origin filter', async () => {
      fakeHC.upsert(walk(DAY_START, DAY_START + 3 * MINUTE, 1));
      fakeHC.upsert(fitbitBatch(DAY_START, DAY_START + 15 * MINUTE, 9));
      const timeRangeFilter = between(DAY_START, NEXT_DAY_START);

      const ascending = await readRecords('Steps', {
        timeRangeFilter,
        dataOriginFilter: [ON_DEVICE_ORIGIN],
      });
      const descending = await readRecords('Steps', {
        timeRangeFilter,
        dataOriginFilter: [ON_DEVICE_ORIGIN],
        ascendingOrder: false,
      });

      expect(ascending.records.map((r) => r.startTime)).toEqual(
        [0, 1, 2].map((m) => iso(DAY_START + m * MINUTE))
      );
      expect(descending.records.map((r) => r.startTime)).toEqual(
        [2, 1, 0].map((m) => iso(DAY_START + m * MINUTE))
      );
    });
  });

  describe('record store', () => {
    it('upserts in place by id, accepts late inserts and deletes', async () => {
      const [first] = fakeHC.upsert(fitbitBatch(DAY_START, DAY_START + 30 * MINUTE, 100));
      fakeHC.upsert(fitbitBatch(DAY_START, DAY_START + 15 * MINUTE, 250));

      expect(fakeHC.records).toHaveLength(2);
      expect(fakeHC.records[0]).toMatchObject({ id: first, count: 250 });
      expect((await aggregate(DAY_START, NEXT_DAY_START)).COUNT_TOTAL).toBe(350);

      const [late] = fakeHC.upsert([dayRecord(DAY_START - DAY, 4_000)]);
      expect((await aggregate(DAY_START - DAY, NEXT_DAY_START)).COUNT_TOTAL).toBe(4_350);

      fakeHC.delete([late, first]);
      expect((await aggregate(DAY_START - DAY, NEXT_DAY_START)).COUNT_TOTAL).toBe(100);
    });

    it('rejects records that do not end after they start', () => {
      expect(() =>
        fakeHC.upsert([{ start: DAY_START, end: DAY_START, count: 1, origin: ON_DEVICE_ORIGIN }])
      ).toThrow();
    });

    it('builds a record spanning the whole local day', () => {
      const record = dayRecord(DAY_START, 10, FITBIT_ORIGIN);
      expect(record).toEqual({
        start: DAY_START,
        end: NEXT_DAY_START,
        count: 10,
        origin: FITBIT_ORIGIN,
      });
    });
  });

  describe('history floor', () => {
    it('hides data starting before firstGrantAt - 30 days', async () => {
      const now = DAY_START + 12 * HOUR;
      fakeHC.upsert([
        dayRecord(DAY_START - 40 * DAY, 1_000),
        dayRecord(DAY_START - 20 * DAY, 2_000),
      ]);
      fakeHC.firstGrantAt = now;

      const { records } = await readAll(DAY_START - 60 * DAY, now);
      expect(records.map((r) => r.count)).toEqual([2_000]);
      expect((await aggregate(DAY_START - 60 * DAY, now)).COUNT_TOTAL).toBe(2_000);

      fakeHC.firstGrantAt = now - 30 * DAY;
      expect((await aggregate(DAY_START - 60 * DAY, now)).COUNT_TOTAL).toBe(3_000);
    });

    it('anchors the floor at the first grant after a reinstall', async () => {
      const now = DAY_START + 12 * HOUR;
      jest.useFakeTimers({ now });
      fakeHC.upsert([dayRecord(DAY_START - 40 * DAY, 1_000)]);
      fakeHC.granted = false;
      fakeHC.firstGrantAt = null;

      await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);

      expect(fakeHC.firstGrantAt).toBe(now);
      expect((await aggregate(DAY_START - 60 * DAY, now)).COUNT_TOTAL).toBe(0);
    });
  });

  describe('errors', () => {
    it('rejects the next call with an injected error code, then recovers', async () => {
      fakeHC.failNext('readRecords', hcErrors.permission());
      const options = { timeRangeFilter: between(DAY_START, NEXT_DAY_START) };

      await expect(readRecords('Steps', options)).rejects.toMatchObject({
        code: 'PERMISSION_ERROR',
        message: expect.stringContaining('SecurityException'),
      });
      await expect(readRecords('Steps', options)).resolves.toEqual({ records: [], pageToken: '' });
    });

    it('lets a number of calls through before failing', async () => {
      fakeHC.failNext('aggregateRecord', hcErrors.remote(), 1, 2);

      await expect(aggregate(DAY_START, NEXT_DAY_START)).resolves.toMatchObject({ COUNT_TOTAL: 0 });
      await expect(aggregate(DAY_START, NEXT_DAY_START)).resolves.toMatchObject({ COUNT_TOTAL: 0 });
      await expect(aggregate(DAY_START, NEXT_DAY_START)).rejects.toMatchObject({
        code: 'UNDERLYING_ERROR',
      });
      await expect(aggregate(DAY_START, NEXT_DAY_START)).resolves.toMatchObject({ COUNT_TOTAL: 0 });
    });

    it('rejects every call with a persistent error until cleared', async () => {
      fakeHC.failAlways('aggregateRecord', hcErrors.serviceUnavailable());

      await expect(aggregate(DAY_START, NEXT_DAY_START)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
      await expect(aggregate(DAY_START, NEXT_DAY_START)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });

      fakeHC.clearFailures();
      await expect(aggregate(DAY_START, NEXT_DAY_START)).resolves.toMatchObject({ COUNT_TOTAL: 0 });
    });

    it('provides RNHC-like rejections for each failure kind', () => {
      expect(hcErrors.remote()).toMatchObject({
        code: 'UNDERLYING_ERROR',
        message: expect.stringContaining('RemoteException'),
      });
      expect(hcErrors.rateLimited()).toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        message: expect.stringMatching(/rate limit/i),
      });
      expect(hcErrors.notInitialized()).toMatchObject({ code: 'CLIENT_NOT_INITIALIZED' });
    });

    it('rejects reads without the Steps grant and inverted windows', async () => {
      await expect(aggregate(NEXT_DAY_START, DAY_START)).rejects.toMatchObject({
        code: 'ARGUMENT_VALIDATION_ERROR',
      });

      fakeHC.granted = false;
      await expect(aggregate(DAY_START, NEXT_DAY_START)).rejects.toMatchObject({
        code: 'PERMISSION_ERROR',
      });
    });
  });

  describe('grant and SDK state', () => {
    it('reports SDK status and fails initialize when the SDK is unavailable', async () => {
      await expect(getSdkStatus()).resolves.toBe(3);
      await expect(initialize()).resolves.toBe(true);

      fakeHC.sdkStatus = 1;
      await expect(getSdkStatus()).resolves.toBe(1);
      await expect(initialize()).resolves.toBe(false);
    });

    it('grants on request unless the user declines', async () => {
      const steps = [{ accessType: 'read' as const, recordType: 'Steps' as const }];
      fakeHC.granted = false;
      fakeHC.grantOnRequest = false;

      await expect(getGrantedPermissions()).resolves.toEqual([]);
      await expect(requestPermission(steps)).resolves.toEqual([]);

      fakeHC.grantOnRequest = true;
      await expect(requestPermission(steps)).resolves.toEqual(steps);
      await expect(getGrantedPermissions()).resolves.toEqual(steps);
    });
  });

  describe('latency, call log and reset', () => {
    it('holds calls pending until fake timers advance', async () => {
      jest.useFakeTimers({ now: DAY_START });
      fakeHC.latencyMs = 5_000;
      let settled = false;
      const pending = aggregate(DAY_START, NEXT_DAY_START).then((r) => {
        settled = true;
        return r;
      });

      await jest.advanceTimersByTimeAsync(4_999);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toMatchObject({ COUNT_TOTAL: 0 });
      expect(fakeHC.calls).toEqual([
        {
          method: 'aggregateRecord',
          args: [expect.objectContaining({ recordType: 'Steps' })],
          at: DAY_START,
        },
      ]);
    });

    it('reset restores defaults and clears records, failures and calls', async () => {
      fakeHC.upsert(walk(DAY_START, DAY_START + HOUR, 5));
      fakeHC.failAlways('getSdkStatus', hcErrors.remote());
      fakeHC.granted = false;
      fakeHC.priority = [];
      await getSdkStatus().catch(() => undefined);

      fakeHC.reset();

      expect(fakeHC.records).toEqual([]);
      expect(fakeHC.calls).toEqual([]);
      expect(fakeHC.priority).toEqual([FITBIT_ORIGIN, ON_DEVICE_ORIGIN]);
      expect(fakeHC.granted).toBe(true);
      await expect(getSdkStatus()).resolves.toBe(3);
    });
  });
});
