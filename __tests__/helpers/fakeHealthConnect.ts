// Fake react-native-health-connect backed by an in-memory Steps record store.
// Mirrors the 3.5.x JS surface the app uses: getSdkStatus, initialize, getGrantedPermissions,
// requestPermission, openHealthConnectSettings, readRecords and aggregateRecord.
//
// Usage (jest hoists the factory, so it must load the fixture with requireActual; the test then
// imports `fakeHC` from the same module instance to arrange records and state):
//
//   import { fakeHC, walk, fitbitBatch } from './helpers/fakeHealthConnect';
//
//   jest.mock('react-native-health-connect', () =>
//     jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
//   );
//
//   beforeEach(() => fakeHC.reset());
//
//   it('...', async () => {
//     fakeHC.upsert(walk(from, to, 10));
//     fakeHC.failNext('aggregateRecord', hcErrors.serviceUnavailable());
//     ...
//   });
//
// Semantics modelled on Health Connect (see /workspace/investigation/HC-RESEARCH.md):
// - readRecords returns raw records whose start time lies in the window (a record starting
//   before the window is missed), ascending by default, paged by `pageSize` (default 1000).
//   The last page's token is `lastPageToken` ('' by default, as HC may return), so callers
//   must use a truthy check.
// - aggregateRecord de-duplicates by origin priority: at every instant only the highest-priority
//   origin with a record covering it counts, and each record is pro-rated linearly by the part
//   of its duration that is inside the query window and not covered by a higher-priority origin.
// - Reads and aggregates ignore records starting before `firstGrantAt - 30 days`.
// - Without the Steps read grant, reads reject with PERMISSION_ERROR.
// - Rejections carry the RNHC `code` (ExceptionsUtils.kt mapping of the Kotlin exception).

import type {
  AggregateRequest,
  AggregateResult,
  AggregateResultRecordType,
  Permission,
  ReadRecordsOptions,
  ReadRecordsResult,
  RecordType,
} from 'react-native-health-connect';

type HealthConnectModule = typeof import('react-native-health-connect');
type TimeRangeFilter = ReadRecordsOptions['timeRangeFilter'];

export const FITBIT_ORIGIN = 'com.fitbit.FitbitMobile';
/** HC attributes phone on-device steps to the platform. */
export const ON_DEVICE_ORIGIN = 'android';

const MINUTE_MS = 60_000;
const FITBIT_RECORD_MS = 15 * MINUTE_MS;
const HISTORY_WINDOW_MS = 30 * 24 * 60 * MINUTE_MS;
const DEFAULT_PAGE_SIZE = 1000;
const SDK_AVAILABLE = 3;
const STEPS_READ: Permission = { recordType: 'Steps', accessType: 'read' };

export interface FakeStepRecord {
  id: string;
  start: number;
  end: number;
  count: number;
  origin: string;
}

export type FakeStepRecordInput = Omit<FakeStepRecord, 'id'> & { id?: string };

export type FakeMethod =
  | 'getSdkStatus'
  | 'initialize'
  | 'getGrantedPermissions'
  | 'requestPermission'
  | 'openHealthConnectSettings'
  | 'readRecords'
  | 'aggregateRecord';

export interface FakeCall {
  method: FakeMethod;
  args: unknown[];
  at: number;
}

export type HealthConnectRejection = Error & { code: string };

function rejection(code: string, message: string): HealthConnectRejection {
  return Object.assign(new Error(message), { code });
}

/** Rejections shaped like RNHC's native promise rejections. */
export const hcErrors = {
  permission: () =>
    rejection(
      'PERMISSION_ERROR',
      "java.lang.SecurityException: Caller doesn't have android.permission.health.READ_STEPS"
    ),
  serviceUnavailable: () =>
    rejection('SERVICE_UNAVAILABLE', 'java.lang.IllegalStateException: Health Connect is updating'),
  remote: () =>
    rejection('UNDERLYING_ERROR', 'android.os.RemoteException: Health Connect service died'),
  rateLimited: () =>
    rejection(
      'SERVICE_UNAVAILABLE',
      'java.lang.IllegalStateException: Rate limit exceeded: API call quota exhausted'
    ),
  notInitialized: () =>
    rejection('CLIENT_NOT_INITIALIZED', 'Health Connect client is not initialized'),
  argument: (message: string) =>
    rejection('ARGUMENT_VALIDATION_ERROR', `java.lang.IllegalArgumentException: ${message}`),
};

interface Failure {
  method: FakeMethod;
  error: Error;
  /** Calls to let through before failing. */
  skip: number;
  remaining: number;
}

function windowOf(filter: TimeRangeFilter): { from: number; to: number } {
  const from = filter.operator === 'before' ? -Infinity : Date.parse(filter.startTime);
  const to = filter.operator === 'after' ? Infinity : Date.parse(filter.endTime);
  if (!(from < to)) throw hcErrors.argument('end time needs be after start time');
  return { from, to };
}

class FakeHealthConnect {
  private store!: FakeStepRecord[];
  private originOrder!: string[];
  private nextId!: number;
  private failures!: Failure[];

  /** Origins in descending priority; unlisted origins rank after these, in insertion order. */
  priority!: string[];
  sdkStatus!: number;
  initializeResult!: boolean;
  granted!: boolean;
  /** Whether requestPermission grants Steps read (the user taps "Allow"). */
  grantOnRequest!: boolean;
  /**
   * When Steps read was first granted. -Infinity (default): long ago, so no history floor.
   * null: never granted (fresh install or new phone); the next granting requestPermission sets it.
   */
  firstGrantAt!: number | null;
  /** Token returned with the last page of readRecords ('' by default, as HC may return). */
  lastPageToken!: string | undefined;
  /** Delay before every bridge call settles; driven by real or jest fake timers. */
  latencyMs!: number;
  calls!: FakeCall[];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.store = [];
    this.originOrder = [];
    this.nextId = 1;
    this.failures = [];
    this.priority = [FITBIT_ORIGIN, ON_DEVICE_ORIGIN];
    this.sdkStatus = SDK_AVAILABLE;
    this.initializeResult = true;
    this.granted = true;
    this.grantOnRequest = true;
    this.firstGrantAt = -Infinity;
    this.lastPageToken = '';
    this.latencyMs = 0;
    this.calls = [];
  }

  get records(): readonly FakeStepRecord[] {
    return this.store;
  }

  /** Inserts records, or replaces in place those whose id already exists. Returns the ids. */
  upsert(records: FakeStepRecordInput[]): string[] {
    return records.map((input) => {
      if (!(input.start < input.end)) throw new Error('Steps record needs start < end');
      const record = { ...input, id: input.id ?? `record-${this.nextId++}` };
      const index = this.store.findIndex((r) => r.id === record.id);
      this.store =
        index >= 0 ? this.store.map((r, i) => (i === index ? record : r)) : [...this.store, record];
      if (!this.originOrder.includes(record.origin)) {
        this.originOrder = [...this.originOrder, record.origin];
      }
      return record.id;
    });
  }

  delete(ids: string[]): void {
    this.store = this.store.filter((r) => !ids.includes(r.id));
  }

  /** After `after` more calls succeed, the next `times` calls to `method` reject with `error`. */
  failNext(method: FakeMethod, error: Error, times = 1, after = 0): void {
    this.failures = [...this.failures, { method, error, skip: after, remaining: times }];
  }

  /** Every call to `method` rejects with `error` until clearFailures(). */
  failAlways(method: FakeMethod, error: Error): void {
    this.failNext(method, error, Infinity);
  }

  clearFailures(): void {
    this.failures = [];
  }

  callsTo(method: FakeMethod): FakeCall[] {
    return this.calls.filter((c) => c.method === method);
  }

  historyFloor(): number {
    return this.firstGrantAt === null ? -Infinity : this.firstGrantAt - HISTORY_WINDOW_MS;
  }

  async enter(method: FakeMethod, args: unknown[]): Promise<void> {
    this.log(method, args);
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
    const index = this.failures.findIndex((f) => f.method === method && f.remaining > 0);
    if (index >= 0) {
      const failure = this.failures[index];
      this.failures = this.failures.map((f, i) =>
        i !== index
          ? f
          : f.skip > 0
            ? { ...f, skip: f.skip - 1 }
            : { ...f, remaining: f.remaining - 1 }
      );
      if (failure.skip === 0) throw failure.error;
    }
  }

  log(method: FakeMethod, args: unknown[]): void {
    this.calls = [
      ...this.calls,
      { method, args: JSON.parse(JSON.stringify(args)) as unknown[], at: Date.now() },
    ];
  }

  grantRequested(stepsRequested: boolean): Permission[] {
    if (stepsRequested && this.grantOnRequest && !this.granted) {
      this.granted = true;
      this.firstGrantAt = this.firstGrantAt ?? Date.now();
    }
    return stepsRequested && this.granted ? [STEPS_READ] : [];
  }

  /** Records visible to this app: readable history, optional origin filter. */
  readable(originFilter: string[] | undefined): FakeStepRecord[] {
    if (!this.granted) throw hcErrors.permission();
    const floor = this.historyFloor();
    return this.store.filter(
      (r) =>
        r.start >= floor &&
        (originFilter === undefined || originFilter.length === 0 || originFilter.includes(r.origin))
    );
  }

  read(options: ReadRecordsOptions): { page: FakeStepRecord[]; pageToken: string | undefined } {
    const { from, to } = windowOf(options.timeRangeFilter);
    const ascending = options.ascendingOrder ?? true;
    const matching = this.readable(options.dataOriginFilter)
      .filter((r) => r.start >= from && r.start < to)
      .sort((a, b) => (ascending ? a.start - b.start : b.start - a.start));
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = options.pageToken ? Number(options.pageToken.replace(/^page-/, '')) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw hcErrors.argument('invalid page token');
    const end = offset + pageSize;
    return {
      page: matching.slice(offset, end),
      pageToken: end < matching.length ? `page-${end}` : this.lastPageToken,
    };
  }

  aggregate(
    filter: TimeRangeFilter,
    originFilter: string[] | undefined
  ): { total: number; origins: string[] } {
    const { from, to } = windowOf(filter);
    const rank = (origin: string) => {
      const listed = this.priority.indexOf(origin);
      return listed >= 0 ? listed : this.priority.length + this.originOrder.indexOf(origin);
    };
    const events = this.readable(originFilter)
      .filter((r) => r.end > from && r.start < to)
      .flatMap((r) => [
        { at: Math.max(r.start, from), record: r, opens: true },
        { at: Math.min(r.end, to), record: r, opens: false },
      ])
      .sort((a, b) => a.at - b.at);

    const active = new Set<FakeStepRecord>();
    const contributing = new Set<string>();
    let total = 0;
    let previous = -Infinity;
    for (const event of events) {
      if (event.at > previous && active.size > 0) {
        const best = Math.min(...[...active].map((r) => rank(r.origin)));
        for (const r of active) {
          if (rank(r.origin) === best) {
            total += (r.count * (event.at - previous)) / (r.end - r.start);
            contributing.add(r.origin);
          }
        }
      }
      previous = event.at;
      if (event.opens) active.add(event.record);
      else active.delete(event.record);
    }
    return {
      total: Math.round(total),
      origins: [...contributing].sort((a, b) => rank(a) - rank(b)),
    };
  }
}

export const fakeHC = new FakeHealthConnect();

async function readRecords<T extends RecordType>(
  recordType: T,
  options: ReadRecordsOptions
): Promise<ReadRecordsResult<T>> {
  await fakeHC.enter('readRecords', [recordType, options]);
  if (recordType !== 'Steps') throw rejection('INVALID_RECORD_TYPE', 'Record type is not valid');
  const { page, pageToken } = fakeHC.read(options);
  const result: ReadRecordsResult<'Steps'> = {
    records: page.map((r) => ({
      recordType: 'Steps',
      count: r.count,
      startTime: new Date(r.start).toISOString(),
      endTime: new Date(r.end).toISOString(),
      metadata: { id: r.id, dataOrigin: r.origin },
    })),
    pageToken,
  };
  return result as unknown as ReadRecordsResult<T>;
}

async function aggregateRecord<T extends AggregateResultRecordType>(
  request: AggregateRequest<T>
): Promise<AggregateResult<T>> {
  await fakeHC.enter('aggregateRecord', [request]);
  if (request.recordType !== 'Steps') {
    throw rejection('AGGREGATION_NOT_SUPPORTED', 'Aggregation is not supported for this record');
  }
  const { total, origins } = fakeHC.aggregate(request.timeRangeFilter, request.dataOriginFilter);
  const result: AggregateResult<'Steps'> = { COUNT_TOTAL: total, dataOrigins: origins };
  return result as unknown as AggregateResult<T>;
}

/** Module object for the `jest.mock('react-native-health-connect', …)` factory. */
export const fakeHealthConnectModule: Pick<
  HealthConnectModule,
  | 'getSdkStatus'
  | 'initialize'
  | 'getGrantedPermissions'
  | 'requestPermission'
  | 'openHealthConnectSettings'
  | 'readRecords'
  | 'aggregateRecord'
> = {
  getSdkStatus: async (...args) => {
    await fakeHC.enter('getSdkStatus', args);
    return fakeHC.sdkStatus;
  },
  initialize: async (...args) => {
    await fakeHC.enter('initialize', args);
    return fakeHC.sdkStatus === SDK_AVAILABLE && fakeHC.initializeResult;
  },
  getGrantedPermissions: async () => {
    await fakeHC.enter('getGrantedPermissions', []);
    return fakeHC.granted ? [STEPS_READ] : [];
  },
  requestPermission: async (permissions) => {
    await fakeHC.enter('requestPermission', [permissions]);
    return fakeHC.grantRequested(
      permissions.some((p) => p.recordType === 'Steps' && p.accessType === 'read')
    );
  },
  openHealthConnectSettings: () => {
    fakeHC.log('openHealthConnectSettings', []);
  },
  readRecords,
  aggregateRecord,
};

/** Sum of raw record counts (not de-duplicated). */
export function sumCounts(records: FakeStepRecordInput[]): number {
  return records.reduce((sum, r) => sum + r.count, 0);
}

/** One record per whole minute in [from, to), `perMin` steps each. */
export function walk(
  from: number,
  to: number,
  perMin: number,
  origin = ON_DEVICE_ORIGIN
): FakeStepRecordInput[] {
  const records: FakeStepRecordInput[] = [];
  for (let t = from; t + MINUTE_MS <= to; t += MINUTE_MS) {
    records.push({ start: t, end: t + MINUTE_MS, count: perMin, origin });
  }
  return records;
}

/** A single record spanning the local day that starts at `dayStart` (23/25 h on DST days). */
export function dayRecord(
  dayStart: number,
  count: number,
  origin = ON_DEVICE_ORIGIN
): FakeStepRecordInput {
  const end = new Date(dayStart);
  end.setHours(24, 0, 0, 0);
  return { start: dayStart, end: end.getTime(), count, origin };
}

/**
 * Fitbit-like 15-minute records over [from, to), `perRecord` steps each. Ids derive from the
 * start time, so re-sending a batch updates the same records in place, as the Fitbit app does.
 * Upsert the batch after the walk to model Fitbit's late delivery.
 */
export function fitbitBatch(from: number, to: number, perRecord: number): FakeStepRecordInput[] {
  const records: FakeStepRecordInput[] = [];
  for (let t = from; t + FITBIT_RECORD_MS <= to; t += FITBIT_RECORD_MS) {
    records.push({
      id: `fitbit-${t}`,
      start: t,
      end: t + FITBIT_RECORD_MS,
      count: perRecord,
      origin: FITBIT_ORIGIN,
    });
  }
  return records;
}
