/** @jest-environment ./__tests__/helpers/timeZoneEnvironment.ts */
// Tests for the step sync orchestrator: welcome credit, single flight, errors, hydration gate,
// crash safety and the clock. Runs against the fake Health Connect with the real HealthService,
// step ledger, store and persistence (in-memory AsyncStorage), in Europe/London.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fakeHC, hcErrors, walk, sumCounts } from './helpers/fakeHealthConnect';
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
import { syncSteps, useStepSyncStatus } from '../src/services/stepSync';
import { ledgerSince } from '../src/services/stepLedger';
import { healthService } from '../src/services/HealthService';
import { useGameStore } from '../src/store/gameStore';
import { saveGame, startPersistence } from '../src/store/persistence';
import type { FakeStepRecordInput } from './helpers/fakeHealthConnect';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);

setTimeZone('Europe/London');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const NOW = local(2026, 10, 4, 18);

/** Half-hour records, one per hour, `perHour` steps each, starting in [from, to). */
function hourly(from: number, to: number, perHour: number): FakeStepRecordInput[] {
  const records: FakeStepRecordInput[] = [];
  for (let t = from; t < to; t += HOUR_MS) {
    records.push({
      start: t + 10 * MINUTE_MS,
      end: t + 40 * MINUTE_MS,
      count: perHour,
      origin: 'android',
    });
  }
  return records;
}

function aggregateWindows(): { start: number; end: number }[] {
  return fakeHC.callsTo('aggregateRecord').map((call) => {
    const { timeRangeFilter } = call.args[0] as {
      timeRangeFilter: { startTime: string; endTime: string };
    };
    return {
      start: Date.parse(timeRangeFilter.startTime),
      end: Date.parse(timeRangeFilter.endTime),
    };
  });
}

describe('stepSync', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    Platform.OS = 'android';
    fakeHC.reset();
    useMemoryStorage();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('first install', () => {
    it('credits the 7 full local days before today and today as a welcome, then only new steps', async () => {
      const weekStart = local(2026, 9, 27);
      const before = hourly(weekStart - 3 * DAY_MS, weekStart, 400); // older than the welcome week
      const week = hourly(weekStart, NOW, 300);
      fakeHC.upsert([...before, ...week]);
      await loadAndConnect();

      const welcome = await syncSteps();

      expect(sumCounts(week)).toBe((7 * 24 + 18) * 300);
      expect(welcome).toMatchObject({
        status: 'synced',
        credited: sumCounts(week),
        welcome: true,
        syncedAt: NOW,
      });
      expect(welcome).not.toHaveProperty('historyLimitedBefore');
      expect(welcome.status === 'synced' && welcome.perDay).toEqual(
        Array.from({ length: 8 }, (_, i) => ({
          startMs: local(2026, 9, 27 + i),
          steps: (i < 7 ? 24 : 18) * 300,
        }))
      );
      expect(aggregateWindows()).toHaveLength(8);
      expect(aggregateWindows()[0].start).toBe(weekStart);
      expect(aggregateWindows()[7]).toEqual({ start: local(2026, 10, 4), end: NOW });
      expect(availableSteps()).toBe(sumCounts(week));
      expect(storedGame()).toMatchObject({ availableSteps: sumCounts(week), stepLedger: ledger() });

      expect(await syncSteps()).toMatchObject({ status: 'synced', credited: 0, welcome: false });

      jest.setSystemTime(NOW + HOUR_MS);
      const later = walk(NOW, NOW + 30 * MINUTE_MS, 50);
      fakeHC.upsert(later);
      expect(await syncSteps()).toMatchObject({
        status: 'synced',
        credited: sumCounts(later),
        perDay: [{ startMs: local(2026, 10, 4), steps: sumCounts(later) }],
        welcome: false,
      });
      expect(availableSteps()).toBe(sumCounts(week) + sumCounts(later));
    });

    it('does not give a welcome credit to a restored save', async () => {
      fakeHC.upsert(hourly(NOW - 10 * DAY_MS, NOW, 300));
      seedSave({ availableSteps: 50, stepLedger: ledgerSince(NOW - 2 * HOUR_MS) });
      await loadAndConnect();

      expect(await syncSteps()).toMatchObject({
        status: 'synced',
        credited: hcTotal(NOW - 2 * HOUR_MS, NOW),
        welcome: false,
      });
      expect(hcTotal(NOW - 2 * HOUR_MS, NOW)).toBe(600);
    });
  });

  it('commits nothing when a read fails on a 9-day-gap open, then credits all 9 days once', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const lastSync = NOW - 9 * DAY_MS;
    const records = hourly(lastSync, NOW, 500);
    fakeHC.upsert(records);
    const blob = seedSave({ availableSteps: 2000, stepLedger: ledgerSince(lastSync) });
    await loadAndConnect();
    const savedLedger = ledger();

    fakeHC.failNext('aggregateRecord', hcErrors.serviceUnavailable());
    const failed = await syncSteps();

    expect(failed).toMatchObject({ status: 'error', code: 'unavailable' });
    expect(availableSteps()).toBe(2000);
    expect(ledger()).toBe(savedLedger);
    expect(storedBlob()).toBe(blob);
    expect(useStepSyncStatus.getState().lastResult).toEqual(failed);

    const synced = await syncSteps();

    expect(sumCounts(records)).toBe(9 * 24 * 500);
    expect(synced).toMatchObject({ status: 'synced', credited: 9 * 24 * 500, welcome: false });
    expect(availableSteps()).toBe(2000 + 9 * 24 * 500);
    expect(storedGame()).toMatchObject({ availableSteps: 2000 + 9 * 24 * 500 });

    expect(await syncSteps()).toMatchObject({ status: 'synced', credited: 0 });
    expect(availableSteps()).toBe(2000 + 9 * 24 * 500);
    consoleError.mockRestore();
  });

  it('commits nothing when one bucket of several fails, and keeps the ledger and saved game', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const lastSync = local(2026, 9, 26, 12);
    fakeHC.upsert(hourly(lastSync, NOW, 100));
    const blob = seedSave({ availableSteps: 10, stepLedger: ledgerSince(lastSync) });
    await loadAndConnect();
    const savedLedger = ledger();

    fakeHC.failNext('aggregateRecord', hcErrors.remote(), 1, 4); // the 5th of 9 buckets

    expect(await syncSteps()).toMatchObject({ status: 'error', code: 'unavailable' });
    expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(5);
    expect(availableSteps()).toBe(10);
    expect(ledger()).toBe(savedLedger);
    expect(storedBlob()).toBe(blob);

    expect(await syncSteps()).toMatchObject({
      status: 'synced',
      credited: hcTotal(lastSync, NOW),
    });
    expect(hcTotal(lastSync, NOW)).toBe((12 + 7 * 24 + 18) * 100);
    consoleError.mockRestore();
  });

  it('shares one in-flight sync between concurrent callers and credits once', async () => {
    fakeHC.upsert(hourly(NOW - 3 * HOUR_MS, NOW, 400));
    seedSave({ availableSteps: 0, stepLedger: ledgerSince(NOW - 3 * HOUR_MS) });
    await loadAndConnect();
    fakeHC.latencyMs = 1500;

    const first = syncSteps();
    const second = syncSteps();

    expect(second).toBe(first);
    expect(useStepSyncStatus.getState().syncing).toBe(true);
    await jest.advanceTimersByTimeAsync(1500);

    expect(await first).toMatchObject({ status: 'synced', credited: 1200 });
    expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(1);
    expect(availableSteps()).toBe(1200);
    expect(useStepSyncStatus.getState().syncing).toBe(false);
  });

  it('reads up to the sync start, so steps starting during a slow read are credited next time', async () => {
    seedSave({ availableSteps: 0, stepLedger: ledgerSince(NOW - HOUR_MS) });
    fakeHC.upsert(hourly(NOW - HOUR_MS, NOW, 300));
    await loadAndConnect();
    fakeHC.latencyMs = 5000;

    const pending = syncSteps();
    // A record starting while the read is in flight
    fakeHC.upsert([{ start: NOW + 1000, end: NOW + MINUTE_MS, count: 70, origin: 'android' }]);
    await jest.advanceTimersByTimeAsync(5000);

    expect(await pending).toMatchObject({ status: 'synced', credited: 300, syncedAt: NOW });
    expect(ledger().lastSyncedAt).toBe(NOW);

    fakeHC.latencyMs = 0;
    jest.setSystemTime(NOW + 2 * MINUTE_MS);
    expect(await syncSteps()).toMatchObject({ status: 'synced', credited: 70 });
  });

  it('still credits real steps after cheat bonus steps', async () => {
    fakeHC.upsert(hourly(NOW - 2 * HOUR_MS, NOW, 1500));
    seedSave({ availableSteps: 100, stepLedger: ledgerSince(NOW - 2 * HOUR_MS) });
    await loadAndConnect();
    const savedLedger = ledger();

    useGameStore.getState().addBonusSteps(1000);

    expect(ledger()).toBe(savedLedger);
    expect(await syncSteps()).toMatchObject({ status: 'synced', credited: 3000 });
    expect(availableSteps()).toBe(100 + 1000 + 3000);
  });

  it('reports a revoked permission and advances nothing', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    fakeHC.upsert(hourly(NOW - 2 * HOUR_MS, NOW, 1500));
    const blob = seedSave({ availableSteps: 100, stepLedger: ledgerSince(NOW - 2 * HOUR_MS) });
    await loadAndConnect();
    const savedLedger = ledger();
    fakeHC.granted = false;

    expect(await syncSteps()).toMatchObject({ status: 'error', code: 'permission' });
    expect(availableSteps()).toBe(100);
    expect(ledger()).toBe(savedLedger);
    expect(storedBlob()).toBe(blob);
    consoleError.mockRestore();
  });

  it('returns not_authorized without reading when step access is not granted', async () => {
    fakeHC.granted = false;
    seedSave({ availableSteps: 100, stepLedger: ledgerSince(NOW - HOUR_MS) });
    await loadAndConnect();

    expect(await syncSteps()).toMatchObject({ status: 'error', code: 'not_authorized' });
    expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
  });

  it('credits the truth exactly once when the app is killed before the sync is saved', async () => {
    const lastSync = NOW - 3 * DAY_MS;
    const records = hourly(lastSync, NOW, 250);
    fakeHC.upsert(records);
    const blob = seedSave({ availableSteps: 700, stepLedger: ledgerSince(lastSync) });
    await loadAndConnect();

    // The sync's write never lands, as when the process dies mid-write.
    let failWrite!: () => void;
    const writeStarted = new Promise<void>((started) => {
      mockAsyncStorage.setItem.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            failWrite = () => reject(new Error('process killed'));
            started();
          })
      );
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const pending = syncSteps();
    await writeStarted;

    expect(availableSteps()).toBe(700 + sumCounts(records)); // applied in memory
    expect(storedBlob()).toBe(blob); // not on disk
    failWrite();
    await pending;

    await restartApp();
    expect(availableSteps()).toBe(700);

    expect(await syncSteps()).toMatchObject({ status: 'synced', credited: sumCounts(records) });
    expect(sumCounts(records)).toBe(3 * 24 * 250);
    expect(storedGame()).toMatchObject({ availableSteps: 700 + 3 * 24 * 250 });

    await restartApp();
    expect(await syncSteps()).toMatchObject({ status: 'synced', credited: 0 });
    expect(availableSteps()).toBe(700 + 3 * 24 * 250);
    consoleError.mockRestore();
  });

  it('never reads an empty or inverted window when the clock is set back, and catches up after', async () => {
    const lastSync = NOW - 2 * DAY_MS;
    fakeHC.upsert(hourly(lastSync, NOW, 100));
    seedSave({ availableSteps: 0, stepLedger: ledgerSince(lastSync) });
    await loadAndConnect();
    expect(await syncSteps()).toMatchObject({ credited: 48 * 100 });
    const synced = ledger();

    // The clock goes back to yesterday morning, before the start of today's bucket.
    const back = local(2026, 10, 3, 6);
    jest.setSystemTime(back);
    fakeHC.calls = [];
    const result = await syncSteps();

    expect(result).toMatchObject({ status: 'synced', credited: 0, syncedAt: back });
    expect(aggregateWindows()).toEqual([
      { start: lastSync, end: local(2026, 10, 3) },
      { start: local(2026, 10, 3), end: back },
    ]);
    expect(ledger().buckets).toEqual(synced.buckets);
    expect(availableSteps()).toBe(4800);

    // Back to the right time: steps walked meanwhile are credited, earlier ones are not repeated.
    jest.setSystemTime(NOW + 2 * HOUR_MS);
    const later = hourly(NOW, NOW + 2 * HOUR_MS, 100);
    fakeHC.upsert(later);
    expect(await syncSteps()).toMatchObject({ status: 'synced', credited: sumCounts(later) });
    expect(availableSteps()).toBe(4800 + 200);
  });

  describe('hydration gate', () => {
    it('returns not_loaded before the saved game has loaded, reading and writing nothing', async () => {
      seedSave({ availableSteps: 100, stepLedger: ledgerSince(NOW - HOUR_MS) });
      await healthService.checkPermission();

      expect(useGameStore.getState().isLoading).toBe(true);
      expect(await syncSteps()).toMatchObject({ status: 'error', code: 'not_loaded' });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('sets loadFailed when getItem rejects, never overwrites the stored game, and refuses to sync', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const blob = seedSave({ availableSteps: 4321, stepLedger: ledgerSince(NOW - HOUR_MS) });
      fakeHC.upsert(hourly(NOW - HOUR_MS, NOW, 500));
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('SQLITE_IOERR'));
      const stop = startPersistence();

      await loadAndConnect();

      expect(useGameStore.getState().loadFailed).toBe(true);
      expect(useGameStore.getState().isLoading).toBe(false);
      expect(useGameStore.getState().stepLedger).toBeNull();
      expect(await syncSteps()).toMatchObject({ status: 'error', code: 'not_loaded' });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);

      useGameStore.getState().addBonusSteps(10);
      await saveGame();
      await jest.advanceTimersByTimeAsync(31_000); // throttle and periodic saves

      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      expect(storedBlob()).toBe(blob);
      stop();
      consoleError.mockRestore();
    });

    it('sets loadFailed on a corrupt save and keeps it on disk', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockAsyncStorage.getItem.mockResolvedValueOnce('[1, 2, 3]');
      await loadAndConnect();

      expect(useGameStore.getState().loadFailed).toBe(true);
      await saveGame();
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
