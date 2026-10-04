/** @jest-environment ./__tests__/helpers/timeZoneEnvironment.ts */
// Tests for useStepGathering hook
// Runs against the fake Health Connect with the real HealthService, step sync, step ledger, store
// and persistence (in-memory AsyncStorage), in Europe/London.

import React, { ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fakeHC, hcErrors, walk, sumCounts, fitbitBatch } from './helpers/fakeHealthConnect';
import {
  ledger,
  local,
  seedSave as seedGame,
  storedBlob,
  storedGame,
  useMemoryStorage,
} from './helpers/stepSyncHarness';
import { setTimeZone } from './helpers/timeZone';
import { useStepGathering } from '../src/hooks/useStepGathering';
import { GameStateProvider } from '../src/hooks/useGameState';
import { useStepSyncStatus } from '../src/services/stepSync';
import { ledgerSince } from '../src/services/stepLedger';
import { STEPS_PER_GATHER } from '../src/config/gathering';
import { STORAGE_KEY, useGameStore } from '../src/store/gameStore';
import { FOREGROUND_RECONCILE_MS } from '../src/config/stepSync';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

setTimeZone('Europe/London');

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const NOW = local(2026, 10, 4, 18);

/** Stores a saved game whose last sync was at `lastSyncedAt`. */
function seedSave(lastSyncedAt: number, data: Record<string, unknown>): void {
  seedGame({ ...data, stepLedger: ledgerSince(lastSyncedAt) });
}

/** When the last successful sync ran (its reads end there). */
function lastSyncedAt(): number {
  return ledger().lastSyncedAt;
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

type AppStateListener = (state: AppStateStatus) => void;
const appStateListeners = new Set<AppStateListener>();

/** Backs the AppState mock with listeners that can be told the app moved. */
function useAppState(): void {
  appStateListeners.clear();
  AppState.currentState = 'active';
  jest.mocked(AppState.addEventListener).mockImplementation((_type, listener) => {
    appStateListeners.add(listener as AppStateListener);
    return { remove: () => appStateListeners.delete(listener as AppStateListener) };
  });
}

async function moveApp(state: AppStateStatus): Promise<void> {
  await act(async () => {
    AppState.currentState = state;
    appStateListeners.forEach((listener) => listener(state));
  });
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
    useMemoryStorage();
    useAppState();
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
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
    });

    it('should credit steps exactly once after an in-app grant', async () => {
      fakeHC.granted = false;
      const records = walk(NOW - 2 * HOUR_MS, NOW, 20);
      fakeHC.upsert(records);
      seedSave(NOW - 2 * HOUR_MS, { availableSteps: 500 });

      const { result } = await renderReady();
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);

      await act(async () => {
        await result.current.requestPermission();
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(500 + sumCounts(records));
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(1);
      expect(result.current.availableSteps).toBe(500 + sumCounts(records));
    });
  });

  describe('Step Synchronization', () => {
    it('should sync on mount and credit only new steps on a manual sync', async () => {
      fakeHC.upsert(walk(NOW - HOUR_MS, NOW, 50));
      seedSave(NOW - HOUR_MS, { availableSteps: 0 });

      const { result } = await renderReady();

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(3000);
      });

      const mark = lastSyncedAt();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(11 * MINUTE_MS);
      });
      fakeHC.upsert(walk(mark, mark + 10 * MINUTE_MS, 30));

      await act(async () => {
        expect(await result.current.syncSteps()).toMatchObject({ status: 'synced', credited: 300 });
      });
      expect(result.current.availableSteps).toBe(3300);
      expect(storedGame()).toMatchObject({ availableSteps: 3300 });
    });

    it('should share the mount sync with a manual tap and credit once', async () => {
      const records = walk(NOW - HOUR_MS, NOW, 40);
      fakeHC.upsert(records);
      seedSave(NOW - HOUR_MS, { availableSteps: 0 });
      fakeHC.latencyMs = 1500;

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });
      await waitFor(
        () => {
          expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(1);
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

      expect(await manual).toMatchObject({ status: 'synced', credited: sumCounts(records) });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(1);
      expect(result.current.availableSteps).toBe(sumCounts(records));
    });

    it('should not sync or save before the saved game has loaded', async () => {
      const records = walk(NOW - HOUR_MS, NOW, 10);
      fakeHC.upsert(records);
      seedSave(NOW - HOUR_MS, { availableSteps: 7000 });
      let finishLoad!: () => void;
      mockAsyncStorage.getItem.mockImplementationOnce(
        (key) =>
          new Promise((resolve) => {
            finishLoad = () => resolve(key === STORAGE_KEY ? (storedBlob() ?? null) : null);
          })
      );

      const { result } = await renderReady();
      expect(result.current.permissionStatus).toBe('authorized');

      await act(async () => {
        await jest.advanceTimersByTimeAsync(31_000); // past the periodic save
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      expect(storedGame()).toMatchObject({ availableSteps: 7000 });

      await act(async () => {
        finishLoad();
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(7000 + sumCounts(records));
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(1);
      expect(storedGame()).toMatchObject({ availableSteps: 7000 + sumCounts(records) });
    });

    it('should not sync when the saved game failed to load', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      seedSave(NOW - HOUR_MS, { availableSteps: 7000 });
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('SQLITE_IOERR'));

      const { result } = await renderReady();

      await act(async () => {
        expect(await result.current.syncSteps()).toMatchObject({
          status: 'error',
          code: 'not_loaded',
        });
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    });

    it('should report a read error and keep steps and the ledger', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      seedSave(NOW - HOUR_MS, { availableSteps: 900 });
      fakeHC.upsert(walk(NOW - HOUR_MS, NOW, 10));

      const { result } = await renderReady();
      await waitFor(() => {
        expect(result.current.availableSteps).toBe(1500);
      });

      const synced = ledger();
      const blob = storedBlob();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(MINUTE_MS);
      });
      fakeHC.failNext('aggregateRecord', hcErrors.rateLimited());

      await act(async () => {
        expect(await result.current.syncSteps()).toMatchObject({
          status: 'error',
          code: 'rate_limited',
        });
      });
      expect(result.current.availableSteps).toBe(1500);
      expect(ledger()).toBe(synced);
      expect(storedBlob()).toBe(blob);
      expect(storedGame()).toMatchObject({ availableSteps: 1500 });
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

    it('should credit the welcome week on the first sync of a new game', async () => {
      const week = walk(local(2026, 9, 27, 12), local(2026, 9, 27, 13), 50);
      const today = walk(NOW - 3 * HOUR_MS, NOW, 50);
      fakeHC.upsert([
        ...walk(local(2026, 9, 26, 12), local(2026, 9, 26, 13), 50),
        ...week,
        ...today,
      ]);

      const { result } = await renderReady();

      await waitFor(() => {
        expect(useStepSyncStatus.getState().lastResult).toMatchObject({
          status: 'synced',
          credited: sumCounts(week) + sumCounts(today),
          welcome: true,
        });
      });
      expect(result.current.availableSteps).toBe(3000 + 9000);
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(8);
      expect(lastSyncedAt()).toBeGreaterThanOrEqual(NOW);
      expect(storedGame()).toMatchObject({ availableSteps: 12000, stepLedger: ledger() });
    });
  });

  describe('Step Spending', () => {
    it('should spend steps correctly', async () => {
      seedSave(NOW - MINUTE_MS, { availableSteps: 3000, totalStepsGathered: 0 });

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
      seedSave(NOW - MINUTE_MS, { availableSteps: 5000, totalStepsGathered: 10000 });

      const { result } = await renderReady();

      await waitFor(() => {
        expect(result.current.totalStepsGathered).toBe(10000);
      });
    });
  });

  describe('Material Gathering', () => {
    beforeEach(() => {
      // Start with enough steps for gathering
      seedSave(NOW - MINUTE_MS, {
        availableSteps: 5000,
        totalStepsGathered: 0,
        inventory: { stone: [], wood: [], food: [] },
        unlockedTechs: [],
        ownedTools: [],
        ownedComponents: [],
      });
    });

    it('should fail gathering when no steps available', async () => {
      seedSave(NOW - MINUTE_MS, { availableSteps: 0, totalStepsGathered: 0 });

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

  describe('Lifecycle', () => {
    /** Waits for the sync that starts once the saved game has loaded. */
    async function renderSynced() {
      const rendered = await renderReady();
      await waitFor(() => {
        expect(useStepSyncStatus.getState().lastResult).not.toBeNull();
      });
      return rendered;
    }

    /** Lets FOREGROUND_RECONCILE_MS pass: exactly one interval tick. */
    async function nextInterval(): Promise<void> {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(FOREGROUND_RECONCILE_MS);
      });
    }

    it('syncs exactly once when the app returns to the foreground, and not in the background', async () => {
      seedSave(NOW - MINUTE_MS, { availableSteps: 0 });
      const { result } = await renderSynced();
      const reads = fakeHC.callsTo('aggregateRecord').length;
      const refreshes = fakeHC.callsTo('getSdkStatus').length;

      await moveApp('background');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(6 * FOREGROUND_RECONCILE_MS);
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(reads);
      const walked = walk(lastSyncedAt(), lastSyncedAt() + 20 * MINUTE_MS, 40);
      fakeHC.upsert(walked);

      await moveApp('active');

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(sumCounts(walked));
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(reads + 1);
      expect(fakeHC.callsTo('getSdkStatus')).toHaveLength(refreshes + 1);
    });

    it('does not sync when the app returns to the foreground before the saved game has loaded', async () => {
      const records = walk(NOW - HOUR_MS, NOW, 10);
      fakeHC.upsert(records);
      seedSave(NOW - HOUR_MS, { availableSteps: 100 });
      let finishLoad!: () => void;
      mockAsyncStorage.getItem.mockImplementationOnce(
        (key) =>
          new Promise((resolve) => {
            finishLoad = () => resolve(key === STORAGE_KEY ? (storedBlob() ?? null) : null);
          })
      );
      const { result } = await renderReady();

      await moveApp('background');
      await moveApp('active');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2 * FOREGROUND_RECONCILE_MS);
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
      expect(useStepSyncStatus.getState().lastResult).toBeNull();

      await act(async () => {
        finishLoad();
      });
      await waitFor(() => {
        expect(result.current.availableSteps).toBe(100 + sumCounts(records));
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(1);
    });

    it('stops reading when access is revoked while running, then credits once after a re-grant', async () => {
      seedSave(NOW - MINUTE_MS, { availableSteps: 300 });
      const { result } = await renderSynced();
      expect(result.current.permissionStatus).toBe('authorized');
      const synced = ledger();
      const blob = storedBlob();
      const reads = fakeHC.callsTo('aggregateRecord').length;
      const walked = walk(lastSyncedAt(), lastSyncedAt() + 4 * MINUTE_MS, 50);
      fakeHC.upsert(walked);

      // Revoked in Health Connect settings while the app stays open
      fakeHC.granted = false;
      await nextInterval();

      expect(result.current.permissionStatus).toBe('not_determined');
      expect(useStepSyncStatus.getState().lastResult).toMatchObject({
        status: 'error',
        code: 'not_authorized',
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(reads);
      expect(result.current.availableSteps).toBe(300);
      expect(ledger()).toBe(synced);
      expect(storedBlob()).toBe(blob);

      // Granted again in settings; the user comes back to the app
      fakeHC.granted = true;
      await moveApp('background');
      await moveApp('active');

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(300 + sumCounts(walked));
      });
      expect(result.current.permissionStatus).toBe('authorized');
      await nextInterval();
      expect(result.current.availableSteps).toBe(300 + sumCounts(walked));
      expect(storedGame()).toMatchObject({ availableSteps: 300 + sumCounts(walked) });
    });

    it('credits steps once Health Connect becomes available on resume', async () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const records = walk(NOW - HOUR_MS, NOW, 30);
      fakeHC.upsert(records);
      seedSave(NOW - HOUR_MS, { availableSteps: 0 });
      fakeHC.sdkStatus = 1; // SDK_UNAVAILABLE: initialization fails

      const { result } = await renderSynced();

      expect(result.current.permissionStatus).toBe('unavailable');
      expect(useStepSyncStatus.getState().lastResult).toMatchObject({
        status: 'error',
        code: 'unavailable',
      });
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);

      fakeHC.sdkStatus = 3;
      await moveApp('background');
      await moveApp('active');

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(sumCounts(records));
      });
      expect(result.current.permissionStatus).toBe('authorized');
      consoleWarn.mockRestore();
    });

    it('re-reads only the last 2 days on the interval, and every reconciled day on resume', async () => {
      seedSave(local(2026, 9, 24, 12), { availableSteps: 0 });
      await renderSynced();
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(11); // 24 Sep to 4 Oct
      // Fitbit delivers five-day-old steps late
      const late = fitbitBatch(local(2026, 9, 29, 9), local(2026, 9, 29, 10), 500);
      fakeHC.upsert(late);
      const windowsBefore = aggregateWindows().length;

      await nextInterval();

      const now = Date.now();
      expect(aggregateWindows().slice(windowsBefore)).toEqual([
        { start: local(2026, 10, 2), end: local(2026, 10, 3) },
        { start: local(2026, 10, 3), end: local(2026, 10, 4) },
        { start: local(2026, 10, 4), end: now },
      ]);
      expect(useGameStore.getState().availableSteps).toBe(0);

      await moveApp('background');
      await moveApp('active');

      await waitFor(() => {
        expect(useGameStore.getState().availableSteps).toBe(sumCounts(late));
      });
    });

    it('credits Fitbit steps written minutes after the walk on the next interval tick', async () => {
      seedSave(NOW - HOUR_MS, { availableSteps: 0 });
      const { result } = await renderSynced();

      // The walk just before opening the app reaches Health Connect after the first tick
      await nextInterval();
      expect(result.current.availableSteps).toBe(0);
      const walked = fitbitBatch(NOW - 30 * MINUTE_MS, NOW, 900);
      fakeHC.upsert(walked);

      await nextInterval();

      expect(result.current.availableSteps).toBe(sumCounts(walked));
      expect(useStepSyncStatus.getState().lastResult).toMatchObject({
        status: 'synced',
        credited: 1800,
      });
    });

    it('commits nothing when a sync in flight while the app goes to the background fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      seedSave(NOW - MINUTE_MS, { availableSteps: 700 });
      const { result } = await renderSynced();
      const synced = ledger();
      fakeHC.upsert(walk(lastSyncedAt(), lastSyncedAt() + 10 * MINUTE_MS, 50));
      fakeHC.latencyMs = 1000;
      fakeHC.failNext('aggregateRecord', hcErrors.serviceUnavailable());

      await act(async () => {
        await jest.advanceTimersByTimeAsync(FOREGROUND_RECONCILE_MS + 1000);
      });
      expect(useStepSyncStatus.getState().syncing).toBe(true);
      await moveApp('background');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });

      expect(useStepSyncStatus.getState().lastResult).toMatchObject({
        status: 'error',
        code: 'unavailable',
      });
      expect(result.current.availableSteps).toBe(700);
      expect(ledger()).toBe(synced);
      expect(storedGame()).toMatchObject({ availableSteps: 700, stepLedger: synced });
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    });
  });

  describe('Without a usable Health Connect', () => {
    it('reports unavailable and never reads when the SDK is unavailable', async () => {
      fakeHC.sdkStatus = 1; // SDK_UNAVAILABLE

      const { result } = await renderReady();

      expect(result.current.permissionStatus).toBe('unavailable');
      expect(result.current.needsInstall).toBe(false);
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
    });

    it('asks for an install when the provider needs an update', async () => {
      fakeHC.sdkStatus = 2; // SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED

      const { result } = await renderReady();

      expect(result.current.needsInstall).toBe(true);
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
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
