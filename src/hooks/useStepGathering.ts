// useStepGathering - Hook for step-based resource gathering
// Syncs steps from HealthConnect/HealthKit and allows spending steps for resources
// Uses useGameState for persistence across screen changes

import { useState, useCallback, useEffect, useRef } from 'react';
import { healthService } from '../services/HealthService';
import { resourceSpawnService } from '../services/ResourceSpawnService';
import { useGameState } from './useGameState';
import {
  HealthPermissionStatus,
  StepGatheringState,
  GatherResult,
  StepSyncResult,
} from '../types/health';
import { LocationGeoData } from '../types/gis';
import { STEPS_PER_GATHER, calculateGatherableAmount } from '../config/gathering';

export interface UseStepGatheringOptions {
  /** Callback when resources are gathered - receives category, resourceId, quantity */
  onGather?: (category: 'stones' | 'woods', resourceId: string, quantity: number) => void;
  /** Auto-sync interval in milliseconds (0 to disable) */
  autoSyncInterval?: number;
}

export interface UseStepGatheringReturn {
  /** Current step gathering state */
  state: StepGatheringState;
  /** Whether service is loading/initializing */
  isLoading: boolean;
  /** Sync steps from health service */
  syncSteps: () => Promise<StepSyncResult>;
  /** Request health permission */
  requestPermission: () => Promise<HealthPermissionStatus>;
  /** Calculate how many gathers are available */
  getGatherableCount: () => number;
  /** Gather a stone using available steps */
  gatherStone: (geoData: LocationGeoData | null) => Promise<GatherResult>;
  /** Gather wood using available steps */
  gatherWood: (geoData: LocationGeoData | null) => Promise<GatherResult>;
  /** Spend steps (used by external state management) */
  spendSteps: (amount: number) => void;
  /** Check if health service is available */
  isAvailable: boolean;
  /** Whether Health Connect needs to be installed (Android) */
  needsInstall: boolean;
  /** Open health settings to manage permissions */
  openHealthSettings: () => Promise<boolean>;
  /** Open Play Store to install Health Connect (Android) */
  openPlayStore: () => Promise<boolean>;
}

export function useStepGathering(options: UseStepGatheringOptions = {}): UseStepGatheringReturn {
  const { onGather, autoSyncInterval = 0 } = options;

  // Get persisted state and update functions from useGameState
  const {
    getStepGatheringState,
    syncSteps: persistSyncSteps,
    spendSteps: persistSpendSteps,
  } = useGameState();

  // Get persisted state (step counts, timestamps)
  const persistedState = getStepGatheringState();

  // Permission status is ephemeral - checked with health service on each init
  const [permissionStatus, setPermissionStatus] =
    useState<HealthPermissionStatus>('not_determined');
  const [isLoading, setIsLoading] = useState(true);

  // Track if initial sync has been done this session to avoid duplicate syncs
  const hasInitialSynced = useRef(false);

  // Create the combined state object for consumers
  const state: StepGatheringState = {
    ...persistedState,
    permissionStatus,
  };

  // Initialize health service on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      const available = healthService.isAvailable();
      if (!available) {
        if (mounted) {
          setPermissionStatus('unavailable');
          setIsLoading(false);
        }
        return;
      }

      const initialized = await healthService.initialize();
      if (!initialized) {
        if (mounted) {
          setPermissionStatus(healthService.getPermissionStatus());
          setIsLoading(false);
        }
        return;
      }

      // Check if we already have permission
      const status = await healthService.checkPermission();
      if (mounted) {
        setPermissionStatus(status);
        setIsLoading(false);

        // If already authorized and haven't synced this session, do initial sync
        if (status === 'authorized' && !hasInitialSynced.current) {
          hasInitialSynced.current = true;
          doSyncSteps();
        }
      }
    }

    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync interval
  useEffect(() => {
    if (autoSyncInterval <= 0) return;
    if (permissionStatus !== 'authorized') return;

    const interval = setInterval(() => {
      doSyncSteps();
    }, autoSyncInterval);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncInterval, permissionStatus]);

  // Internal sync function that uses persisted state
  const doSyncSteps = useCallback(async (): Promise<StepSyncResult> => {
    if (permissionStatus !== 'authorized') {
      return {
        newSteps: 0,
        totalAvailable: persistedState.availableSteps,
        success: false,
        error: 'Permission not granted',
      };
    }

    try {
      // Get steps since last sync (or last 24 hours if no sync)
      const syncSince = persistedState.lastSyncTimestamp || Date.now() - 24 * 60 * 60 * 1000;
      const newSteps = await healthService.getStepsSince(syncSince);

      // Persist the new steps to game state
      persistSyncSteps(newSteps);

      return {
        newSteps,
        totalAvailable: persistedState.availableSteps + newSteps,
        success: true,
      };
    } catch (error) {
      return {
        newSteps: 0,
        totalAvailable: persistedState.availableSteps,
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }, [
    permissionStatus,
    persistedState.lastSyncTimestamp,
    persistedState.availableSteps,
    persistSyncSteps,
  ]);

  const requestPermission = useCallback(async (): Promise<HealthPermissionStatus> => {
    setIsLoading(true);
    try {
      const status = await healthService.requestPermission();
      setPermissionStatus(status);

      // If permission granted and haven't synced, do initial sync
      if (status === 'authorized' && !hasInitialSynced.current) {
        hasInitialSynced.current = true;
        doSyncSteps();
      }

      return status;
    } finally {
      setIsLoading(false);
    }
  }, [doSyncSteps]);

  const spendSteps = useCallback(
    (amount: number) => {
      persistSpendSteps(amount);
    },
    [persistSpendSteps]
  );

  const getGatherableCount = useCallback((): number => {
    return calculateGatherableAmount(persistedState.availableSteps);
  }, [persistedState.availableSteps]);

  const gatherStone = useCallback(
    async (geoData: LocationGeoData | null): Promise<GatherResult> => {
      if (getGatherableCount() === 0) {
        return { success: false, error: 'Not enough steps' };
      }

      // Get geo-appropriate stone
      const stone = geoData
        ? resourceSpawnService.getRandomStoneForLocation(geoData)
        : resourceSpawnService.getRandomStone();

      if (!stone) {
        return { success: false, error: 'No stone type available' };
      }

      // Spend steps (persisted)
      spendSteps(STEPS_PER_GATHER);

      // Notify via callback
      if (onGather) {
        onGather('stones', stone.id, 1);
      }

      return {
        success: true,
        resourceId: stone.id,
        quantity: 1,
        stepsSpent: STEPS_PER_GATHER,
      };
    },
    [getGatherableCount, spendSteps, onGather]
  );

  const gatherWood = useCallback(
    async (geoData: LocationGeoData | null): Promise<GatherResult> => {
      if (getGatherableCount() === 0) {
        return { success: false, error: 'Not enough steps' };
      }

      // Get geo-appropriate wood
      const wood = geoData
        ? resourceSpawnService.getRandomWoodForLocation(geoData)
        : resourceSpawnService.getRandomWood();

      if (!wood) {
        return { success: false, error: 'No wood type available' };
      }

      // Spend steps (persisted)
      spendSteps(STEPS_PER_GATHER);

      // Notify via callback
      if (onGather) {
        onGather('woods', wood.id, 1);
      }

      return {
        success: true,
        resourceId: wood.id,
        quantity: 1,
        stepsSpent: STEPS_PER_GATHER,
      };
    },
    [getGatherableCount, spendSteps, onGather]
  );

  const openHealthSettings = useCallback(async (): Promise<boolean> => {
    return healthService.openHealthSettings();
  }, []);

  const openPlayStore = useCallback(async (): Promise<boolean> => {
    return healthService.openHealthConnectPlayStore();
  }, []);

  return {
    state,
    isLoading,
    syncSteps: doSyncSteps,
    requestPermission,
    getGatherableCount,
    gatherStone,
    gatherWood,
    spendSteps,
    isAvailable: healthService.isAvailable(),
    needsInstall: healthService.needsHealthConnectInstall(),
    openHealthSettings,
    openPlayStore,
  };
}

export default useStepGathering;
