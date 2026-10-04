// Tests for useStepGathering hook
// Runs against the fake Health Connect with the real HealthService, step sync, store and
// persistence (in-memory AsyncStorage).

import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fakeHC, hcErrors, walk, sumCounts } from './helpers/fakeHealthConnect';
import { useStepGathering } from '../src/hooks/useStepGathering';
import { GameStateProvider } from '../src/hooks/useGameState';
import { useStepSyncStatus } from '../src/services/stepSync';
import { useGameStore, STORAGE_KEY } from '../src/store/gameStore';
import { STEPS_PER_GATHER } from '../src/config/gathering';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const NOW = Date.UTC(2026, 9, 4, 18);

let storage: Map<string, string>;

function seedSave(data: Record<string, unknown>): void {
  storage.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, ...data }));
}

/** Where the last successful sync left off (the end of the window it read). */
function watermark(): number {
  return useGameStore.getState().lastSyncTimestamp;
}

function storedGame(): Record<string, unknown> {
  return JSON.parse(storage.get(STORAGE_KEY)!) as Record<string, unknown>;
}

// Wrapper component for tests
function TestWrapper({ children }: { children: ReactNode }) {
  return React.createElement(GameStateProvider, null, children);
}

async function renderReady(options?: Parameters<typeof useStepGathering>[0]) {
  const rendered = renderHook(() => useStepGathering(options), { wrapper: TestWrapper });
  await waitFor(() => {
    expect(rendered.result.current.isLoading).toBe(false);
  });
  return rendered;
}

describe('useStepGathering', () => {
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

  describe('Initialization', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('should report available and authorized after initialization', async () => {
      const { result } = await renderReady();

      expect(result.current.isAvailable).toBe(true);
      expect(result.current.permissionStatus).toBe('authorized');
      expect(fakeHC.callsTo('getGrantedPermissions').length).toBeGreaterThan(0);
    });

    it('should report unavailable when health service is not available', async () => {
      Platform.OS = 'web';

      const { result } = await renderReady();

      expect(result.current.isAvailable).toBe(false);
      expect(result.current.permissionStatus).toBe('unavailable');
    });
  });

  describe('Permission Request', () => {
    it('should request permission when requested', async () => {
      fakeHC.granted = false;

      const { result } = await renderReady();

      expect(result.current.permissionStatus).toBe('not_determined');

      await act(async () => {
        expect(await result.current.requestPermission()).toBe('authorized');
      });

      expect(fakeHC.callsTo('requestPermission')).toHaveLength(1);
      expect(result.current.permissionStatus).toBe('authorized');
    });

    it('should handle permission denial', async () => {
      fakeHC.granted = false;
      fakeHC.grantOnRequest = false;

      const { result } = await renderReady();

      await act(async () => {
        expect(await result.current.requestPermission()).toBe('denied');
      });

      expect(result.current.permissionStatus).toBe('denied');
      expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
    });

    it('should credit steps exactly once after an in-app grant', async () => {
      fakeHC.granted = false;
      const records = walk(NOW - 2 * HOUR_MS, NOW, 20);
      fakeHC.upsert(records);
      seedSave({ availableSteps: 500, lastSyncTimestamp: NOW - 2 * HOUR_MS });

      const { result } = await renderReady();
      expect(fakeHC.callsTo('readRecords')).toHaveLength(0);

      await act(async () => {
        await result.current.requestPermission();
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(500 + sumCounts(records));
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });
      expect(fakeHC.callsTo('readRecords')).toHaveLength(1);
      expect(result.current.availableSteps).toBe(500 + sumCounts(records));
    });
  });

  describe('Step Synchronization', () => {
    it('should sync on mount and credit only new steps on a manual sync', async () => {
      fakeHC.upsert(walk(NOW - HOUR_MS, NOW, 50));
      seedSave({ availableSteps: 0, lastSyncTimestamp: NOW - HOUR_MS });

      const { result } = await renderReady();

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(3000);
      });

      const mark = watermark();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(11 * MINUTE_MS);
      });
      fakeHC.upsert(walk(mark, mark + 10 * MINUTE_MS, 30));

      await act(async () => {
        expect(await result.current.syncSteps()).toEqual({ status: 'synced', credited: 300 });
      });
      expect(result.current.availableSteps).toBe(3300);
      expect(storedGame()).toMatchObject({ availableSteps: 3300 });
    });

    it('should share the mount sync with a manual tap and credit once', async () => {
      const records = walk(NOW - HOUR_MS, NOW, 40);
      fakeHC.upsert(records);
      seedSave({ availableSteps: 0, lastSyncTimestamp: NOW - HOUR_MS });
      fakeHC.latencyMs = 1500;

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });
      await waitFor(
        () => {
          expect(fakeHC.callsTo('readRecords')).toHaveLength(1);
        },
        { timeout: 5000 }
      );
      expect(useStepSyncStatus.getState().syncing).toBe(true);

      let manual!: Promise<unknown>;
      act(() => {
        manual = result.current.syncSteps();
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1500);
      });

      expect(await manual).toEqual({ status: 'synced', credited: sumCounts(records) });
      expect(fakeHC.callsTo('readRecords')).toHaveLength(1);
      expect(result.current.availableSteps).toBe(sumCounts(records));
    });

    it('should not sync or save before the saved game has loaded', async () => {
      const records = walk(NOW - HOUR_MS, NOW, 10);
      fakeHC.upsert(records);
      seedSave({ availableSteps: 7000, lastSyncTimestamp: NOW - HOUR_MS });
      let finishLoad!: () => void;
      mockAsyncStorage.getItem.mockImplementationOnce(
        (key) =>
          new Promise((resolve) => {
            finishLoad = () => resolve(storage.get(key) ?? null);
          })
      );

      const { result } = await renderReady();
      expect(result.current.permissionStatus).toBe('authorized');

      await act(async () => {
        await jest.advanceTimersByTimeAsync(31_000); // past the periodic save
      });
      expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      expect(storedGame()).toMatchObject({ availableSteps: 7000 });

      await act(async () => {
        finishLoad();
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(7000 + sumCounts(records));
      });
      expect(fakeHC.callsTo('readRecords')).toHaveLength(1);
      expect(storedGame()).toMatchObject({ availableSteps: 7000 + sumCounts(records) });
    });

    it('should not sync when the saved game failed to load', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      seedSave({ availableSteps: 7000, lastSyncTimestamp: NOW - HOUR_MS });
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('SQLITE_IOERR'));

      const { result } = await renderReady();

      await act(async () => {
        expect(await result.current.syncSteps()).toMatchObject({
          status: 'error',
          code: 'not_loaded',
        });
      });
      expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    });

    it('should report a read error and keep steps and watermark', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      seedSave({ availableSteps: 900, lastSyncTimestamp: NOW - HOUR_MS });
      fakeHC.upsert(walk(NOW - HOUR_MS, NOW, 10));

      const { result } = await renderReady();
      await waitFor(() => {
        expect(result.current.availableSteps).toBe(1500);
      });

      const mark = watermark();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(MINUTE_MS);
      });
      fakeHC.failNext('readRecords', hcErrors.rateLimited());

      await act(async () => {
        expect(await result.current.syncSteps()).toMatchObject({
          status: 'error',
          code: 'rate_limited',
        });
      });
      expect(result.current.availableSteps).toBe(1500);
      expect(watermark()).toBe(mark);
      expect(storedGame()).toMatchObject({ availableSteps: 1500, lastSyncTimestamp: mark });
      consoleError.mockRestore();
    });

    it('should fail sync when permission not granted', async () => {
      fakeHC.granted = false;

      const { result } = await renderReady();

      await act(async () => {
        expect(await result.current.syncSteps()).toMatchObject({
          status: 'error',
          code: 'not_authorized',
        });
      });
    });

    it('should not credit historical steps on first sync', async () => {
      fakeHC.upsert(walk(NOW - 3 * HOUR_MS, NOW, 50));

      const { result } = await renderReady();

      await waitFor(() => {
        expect(useStepSyncStatus.getState().lastResult).toEqual({
          status: 'synced',
          credited: 0,
        });
      });
      expect(result.current.availableSteps).toBe(0);
      expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
      expect(watermark()).toBeGreaterThanOrEqual(NOW);
      expect(storedGame()).toMatchObject({ availableSteps: 0, lastSyncTimestamp: watermark() });
    });
  });

  describe('Step Spending', () => {
    it('should spend steps correctly', async () => {
      seedSave({ availableSteps: 3000, lastSyncTimestamp: NOW - 60000, totalStepsGathered: 0 });

      const { result } = await renderReady();

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(3000);
      });

      act(() => {
        result.current.spendSteps(STEPS_PER_GATHER);
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(2000);
      });
    });

    it('should track total steps gathered', async () => {
      seedSave({ availableSteps: 5000, lastSyncTimestamp: NOW - 60000, totalStepsGathered: 10000 });

      const { result } = await renderReady();

      await waitFor(() => {
        expect(result.current.totalStepsGathered).toBe(10000);
      });
    });
  });

  describe('Material Gathering', () => {
    beforeEach(() => {
      // Start with enough steps for gathering
      seedSave({
        availableSteps: 5000,
        lastSyncTimestamp: NOW - 60000,
        totalStepsGathered: 0,
        inventory: { stone: [], wood: [], food: [] },
        unlockedTechs: [],
        ownedTools: [],
        ownedComponents: [],
      });
    });

    it('should fail gathering when no steps available', async () => {
      seedSave({ availableSteps: 0, lastSyncTimestamp: NOW - 60000, totalStepsGathered: 0 });

      const { result } = await renderReady();

      await act(async () => {
        const gatherResult = await result.current.gatherMaterial('stone', null);
        expect(gatherResult.success).toBe(false);
        expect(gatherResult.error).toContain('steps');
      });
    });

    it('should succeed gathering wood (base ability allows gathering)', async () => {
      // Wood has baseGatheringAbility of 1, so it doesn't require a tool
      const { result } = await renderReady();

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(5000);
      });

      await act(async () => {
        const gatherResult = await result.current.gatherMaterial('wood', null);
        expect(gatherResult.success).toBe(true);
        expect(gatherResult.resourceId).toBeDefined();
      });
    });

    it('should succeed gathering stone (no tool required)', async () => {
      const onGather = jest.fn();

      const { result } = await renderReady({ onGather });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(5000);
      });

      await act(async () => {
        const gatherResult = await result.current.gatherMaterial('stone', null);
        expect(gatherResult.success).toBe(true);
        expect(gatherResult.resourceId).toBeDefined();
        expect(gatherResult.quantity).toBeGreaterThan(0);
        expect(gatherResult.stepsSpent).toBe(STEPS_PER_GATHER);
      });

      // Should call onGather callback
      expect(onGather).toHaveBeenCalledWith('stone', expect.any(String), expect.any(Number));

      // Steps should be spent
      expect(result.current.availableSteps).toBe(4000);
    });

    it('should succeed gathering food (no tool required)', async () => {
      const { result } = await renderReady();

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(5000);
      });

      await act(async () => {
        const gatherResult = await result.current.gatherMaterial('food', null);
        expect(gatherResult.success).toBe(true);
        expect(gatherResult.resourceId).toBeDefined();
      });
    });

    it('should return list of gatherable material types', async () => {
      const { result } = await renderReady();

      expect(result.current.gatherableMaterialTypes).toBeDefined();
      expect(result.current.gatherableMaterialTypes.length).toBeGreaterThan(0);
      expect(result.current.gatherableMaterialTypes).toContain('stone');
      expect(result.current.gatherableMaterialTypes).toContain('food');
    });
  });

  describe('Auto-sync Interval', () => {
    it('should credit steps walked since the last sync on each interval tick', async () => {
      seedSave({ availableSteps: 0, lastSyncTimestamp: NOW - MINUTE_MS });

      const { result } = await renderReady({ autoSyncInterval: 60000 });
      await waitFor(() => {
        expect(useStepSyncStatus.getState().lastResult).toEqual({
          status: 'synced',
          credited: 0,
        });
      });
      const readsAfterMount = fakeHC.callsTo('readRecords').length;

      fakeHC.upsert(walk(watermark(), watermark() + MINUTE_MS, 80));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(61000);
      });

      expect(fakeHC.callsTo('readRecords')).toHaveLength(readsAfterMount + 1);
      expect(result.current.availableSteps).toBe(80);
    });

    it('should not auto-sync when interval is 0', async () => {
      seedSave({ availableSteps: 0, lastSyncTimestamp: NOW - MINUTE_MS });

      await renderReady({ autoSyncInterval: 0 });
      await waitFor(() => {
        expect(useStepSyncStatus.getState().lastResult).not.toBeNull();
      });
      const initialCallCount = fakeHC.callsTo('readRecords').length;

      await act(async () => {
        await jest.advanceTimersByTimeAsync(120000);
      });

      expect(fakeHC.callsTo('readRecords')).toHaveLength(initialCallCount);
    });
  });

  describe('Health Settings', () => {
    it('should open health settings', async () => {
      const { result } = await renderReady();

      await act(async () => {
        expect(await result.current.openHealthSettings()).toBe(true);
      });

      expect(fakeHC.callsTo('openHealthConnectSettings')).toHaveLength(1);
    });
  });
});
