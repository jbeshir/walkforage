// Tests for the step sync orchestrator against the fake Health Connect, the real HealthService,
// store and persistence, and an in-memory AsyncStorage.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fakeHC, hcErrors, walk, sumCounts } from './helpers/fakeHealthConnect';
import { syncSteps, useStepSyncStatus } from '../src/services/stepSync';
import { healthService } from '../src/services/HealthService';
import { useGameStore, STORAGE_KEY } from '../src/store/gameStore';
import { loadGame, saveGame, startPersistence } from '../src/store/persistence';
import type { FakeStepRecordInput } from './helpers/fakeHealthConnect';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const NOW = Date.UTC(2026, 9, 4, 18);

let storage: Map<string, string>;

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

function seedSave(data: Record<string, unknown>): string {
  const blob = JSON.stringify({ schemaVersion: 1, ...data });
  storage.set(STORAGE_KEY, blob);
  return blob;
}

function storedGame(): Record<string, unknown> {
  return JSON.parse(storage.get(STORAGE_KEY)!) as Record<string, unknown>;
}

async function loadAndConnect(): Promise<void> {
  await loadGame();
  await healthService.checkPermission();
}

describe('stepSync', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    Platform.OS = 'android';
    fakeHC.reset();
    useStepSyncStatus.setState({ syncing: false, lastResult: null });
    storage = new Map();
    mockAsyncStorage.getItem.mockImplementation(async (key) => storage.get(key) ?? null);
    mockAsyncStorage.setItem.mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('credits nothing and keeps the watermark when a 9-day-gap read fails, then credits all 9 days once', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const watermark = NOW - 9 * DAY_MS;
    const records = hourly(watermark, NOW, 500);
    fakeHC.upsert(records);
    const blob = seedSave({ availableSteps: 2000, lastSyncTimestamp: watermark });
    await loadAndConnect();

    fakeHC.failNext('readRecords', hcErrors.serviceUnavailable());
    const failed = await syncSteps();

    expect(failed).toMatchObject({ status: 'error', code: 'unavailable' });
    expect(useGameStore.getState().availableSteps).toBe(2000);
    expect(useGameStore.getState().lastSyncTimestamp).toBe(watermark);
    expect(storage.get(STORAGE_KEY)).toBe(blob);
    expect(useStepSyncStatus.getState().lastResult).toEqual(failed);

    const synced = await syncSteps();

    expect(synced).toEqual({ status: 'synced', credited: sumCounts(records) });
    expect(sumCounts(records)).toBe(9 * 24 * 500);
    expect(useGameStore.getState().availableSteps).toBe(2000 + 9 * 24 * 500);
    expect(storedGame()).toMatchObject({
      availableSteps: 2000 + 9 * 24 * 500,
      lastSyncTimestamp: NOW,
    });

    expect(await syncSteps()).toEqual({ status: 'synced', credited: 0 });
    expect(useGameStore.getState().availableSteps).toBe(2000 + 9 * 24 * 500);
    consoleError.mockRestore();
  });

  it('shares one in-flight sync between concurrent callers and credits once', async () => {
    fakeHC.upsert(hourly(NOW - 3 * HOUR_MS, NOW, 400));
    seedSave({ availableSteps: 0, lastSyncTimestamp: NOW - 3 * HOUR_MS });
    await loadAndConnect();
    fakeHC.latencyMs = 1500;

    const first = syncSteps();
    const second = syncSteps();

    expect(second).toBe(first);
    expect(useStepSyncStatus.getState().syncing).toBe(true);
    await jest.advanceTimersByTimeAsync(1500);

    expect(await first).toEqual({ status: 'synced', credited: 1200 });
    expect(fakeHC.callsTo('readRecords')).toHaveLength(1);
    expect(useGameStore.getState().availableSteps).toBe(1200);
    expect(useStepSyncStatus.getState().syncing).toBe(false);
  });

  it('moves the watermark to the query end, so steps starting during a slow read are credited next time', async () => {
    seedSave({ availableSteps: 0, lastSyncTimestamp: NOW - HOUR_MS });
    fakeHC.upsert(hourly(NOW - HOUR_MS, NOW, 300));
    await loadAndConnect();
    fakeHC.latencyMs = 5000;

    const pending = syncSteps();
    // A record starting while the read is in flight
    fakeHC.upsert([{ start: NOW + 1000, end: NOW + MINUTE_MS, count: 70, origin: 'android' }]);
    await jest.advanceTimersByTimeAsync(5000);

    expect(await pending).toEqual({ status: 'synced', credited: 300 });
    expect(useGameStore.getState().lastSyncTimestamp).toBe(NOW);

    fakeHC.latencyMs = 0;
    jest.setSystemTime(NOW + 2 * MINUTE_MS);
    expect(await syncSteps()).toEqual({ status: 'synced', credited: 70 });
  });

  it('reads every record when there are more than 1000 (paging)', async () => {
    const records = walk(NOW - 30 * HOUR_MS, NOW, 4); // 1800 per-minute records
    fakeHC.upsert(records);
    seedSave({ availableSteps: 0, lastSyncTimestamp: NOW - 30 * HOUR_MS });
    await loadAndConnect();

    expect(await syncSteps()).toEqual({ status: 'synced', credited: sumCounts(records) });
    expect(useGameStore.getState().availableSteps).toBe(7200);
    expect(fakeHC.callsTo('readRecords')).toHaveLength(2);
  });

  it('still credits real steps after cheat bonus steps', async () => {
    fakeHC.upsert(hourly(NOW - 2 * HOUR_MS, NOW, 1500));
    seedSave({ availableSteps: 100, lastSyncTimestamp: NOW - 2 * HOUR_MS });
    await loadAndConnect();

    useGameStore.getState().addBonusSteps(1000);

    expect(useGameStore.getState().lastSyncTimestamp).toBe(NOW - 2 * HOUR_MS);
    expect(await syncSteps()).toEqual({ status: 'synced', credited: 3000 });
    expect(useGameStore.getState().availableSteps).toBe(100 + 1000 + 3000);
  });

  it('reports a revoked permission and advances nothing', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    fakeHC.upsert(hourly(NOW - 2 * HOUR_MS, NOW, 1500));
    const blob = seedSave({ availableSteps: 100, lastSyncTimestamp: NOW - 2 * HOUR_MS });
    await loadAndConnect();
    fakeHC.granted = false;

    expect(await syncSteps()).toMatchObject({ status: 'error', code: 'permission' });
    expect(useGameStore.getState().availableSteps).toBe(100);
    expect(useGameStore.getState().lastSyncTimestamp).toBe(NOW - 2 * HOUR_MS);
    expect(storage.get(STORAGE_KEY)).toBe(blob);
    consoleError.mockRestore();
  });

  it('returns not_authorized without reading when step access is not granted', async () => {
    fakeHC.granted = false;
    seedSave({ availableSteps: 100, lastSyncTimestamp: NOW - HOUR_MS });
    await loadAndConnect();

    expect(await syncSteps()).toMatchObject({ status: 'error', code: 'not_authorized' });
    expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
  });

  it('starts counting from now on the first sync without a save', async () => {
    fakeHC.upsert(hourly(NOW - 5 * HOUR_MS, NOW, 1000));
    await loadAndConnect();

    expect(await syncSteps()).toEqual({ status: 'synced', credited: 0 });
    expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
    expect(storedGame()).toMatchObject({ availableSteps: 0, lastSyncTimestamp: NOW });
  });

  it('does not read while the clock is behind the watermark', async () => {
    seedSave({ availableSteps: 100, lastSyncTimestamp: NOW + HOUR_MS });
    await loadAndConnect();

    expect(await syncSteps()).toEqual({ status: 'synced', credited: 0 });
    expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
    expect(useGameStore.getState().lastSyncTimestamp).toBe(NOW + HOUR_MS);
  });

  describe('hydration gate', () => {
    it('returns not_loaded before the saved game has loaded, reading and writing nothing', async () => {
      seedSave({ availableSteps: 100, lastSyncTimestamp: NOW - HOUR_MS });
      await healthService.checkPermission();

      expect(useGameStore.getState().isLoading).toBe(true);
      expect(await syncSteps()).toMatchObject({ status: 'error', code: 'not_loaded' });
      expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('sets loadFailed when getItem rejects, never overwrites the stored game, and refuses to sync', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const blob = seedSave({ availableSteps: 4321, lastSyncTimestamp: NOW - HOUR_MS });
      fakeHC.upsert(hourly(NOW - HOUR_MS, NOW, 500));
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('SQLITE_IOERR'));
      const stop = startPersistence();

      await loadAndConnect();

      expect(useGameStore.getState().loadFailed).toBe(true);
      expect(useGameStore.getState().isLoading).toBe(false);
      expect(await syncSteps()).toMatchObject({ status: 'error', code: 'not_loaded' });
      expect(fakeHC.callsTo('readRecords')).toHaveLength(0);

      useGameStore.getState().addBonusSteps(10);
      await saveGame();
      await jest.advanceTimersByTimeAsync(31_000); // throttle and periodic saves

      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      expect(storage.get(STORAGE_KEY)).toBe(blob);
      stop();
      consoleError.mockRestore();
    });

    it('sets loadFailed on a corrupt save and keeps it on disk', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      storage.set(STORAGE_KEY, '[1, 2, 3]');
      await loadAndConnect();

      expect(useGameStore.getState().loadFailed).toBe(true);
      await saveGame();
      expect(storage.get(STORAGE_KEY)).toBe('[1, 2, 3]');
      consoleError.mockRestore();
    });
  });
});
