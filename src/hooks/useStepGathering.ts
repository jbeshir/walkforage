// useStepGathering - Hook for step-based resource gathering
// Syncs steps from HealthConnect/HealthKit and allows spending steps for resources
// Uses useGameState for persistence across screen changes

import { useState, useCallback, useEffect } from 'react';
import { healthService } from '../services/HealthService';
import { resourceSpawnService } from '../services/ResourceSpawnService';
import { useGameState } from './useGameState';
import { HealthPermissionStatus, GatherResult, StepSyncResult } from '../types/health';
import { LocationGeoData } from '../types/gis';
import { MaterialType } from '../types/resources';
import {
  STEPS_PER_GATHER,
  calculateGatherableAmount,
  calculateGatheringAbility,
  calculateGatherYield,
} from '../config/gathering';

export interface UseStepGatheringOptions {
  /** Callback when resources are gathered - receives category, resourceId, quantity */
  onGather?: (category: MaterialType, resourceId: string, quantity: number) => void;
  /** Auto-sync interval in milliseconds (0 to disable) */
  autoSyncInterval?: number;
}

export interface UseStepGatheringReturn {
  /** Steps available for gathering (reactive - use for render) */
  availableSteps: number;
  /** Timestamp of last step sync */
  lastSyncTimestamp: number;
  /** Total steps ever used for gathering */
  totalStepsGathered: number;
  /** Current health permission status */
  permissionStatus: HealthPermissionStatus;
  /** Whether service is loading/initializing */
  isLoading: boolean;
  /** Sync steps from health service */
  syncSteps: () => Promise<StepSyncResult>;
  /** Request health permission */
  requestPermission: () => Promise<HealthPermissionStatus>;
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
    state: gameState,
    getStepGatheringState, // Keep for callbacks that need fresh data
    syncSteps: persistSyncSteps,
    spendSteps: persistSpendSteps,
  } = useGameState();

  // Permission status is ephemeral - checked with health service on each init
  const [permissionStatus, setPermissionStatus] =
    useState<HealthPermissionStatus>('not_determined');
  const [isLoading, setIsLoading] = useState(true);

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

        // If already authorized, sync (debounce will prevent rapid re-syncs)
        if (status === 'authorized') {
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
    // Get fresh state to avoid stale closure issues
    const currentState = getStepGatheringState();

    // Check permission via service to avoid stale closure issues
    // (permissionStatus from closure may be stale when called from init effect)
    const currentPermission = healthService.getPermissionStatus();
    if (currentPermission !== 'authorized') {
      return {
        newSteps: 0,
        totalAvailable: currentState.availableSteps,
        success: false,
        error: 'Permission not granted',
      };
    }

    // Debounce: don't re-sync within 30 seconds (persists across app restarts)
    const MIN_SYNC_INTERVAL_MS = 30000;
    if (currentState.lastSyncTimestamp > 0) {
      const timeSinceLastSync = Date.now() - currentState.lastSyncTimestamp;
      if (timeSinceLastSync < MIN_SYNC_INTERVAL_MS) {
        return {
          newSteps: 0,
          totalAvailable: currentState.availableSteps,
          success: true,
        };
      }
    }

    try {
      // Get steps since last sync
      // On first launch (no timestamp), start fresh - don't credit historical steps
      const isFirstSync = !currentState.lastSyncTimestamp;
      const syncSince = currentState.lastSyncTimestamp || Date.now();
      const newSteps = isFirstSync ? 0 : await healthService.getStepsSince(syncSince);

      // Persist the new steps to game state (also updates lastSyncTimestamp)
      persistSyncSteps(newSteps);

      return {
        newSteps,
        totalAvailable: currentState.availableSteps + newSteps,
        success: true,
      };
    } catch (error) {
      return {
        newSteps: 0,
        totalAvailable: currentState.availableSteps,
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }, [getStepGatheringState, persistSyncSteps]);

  const requestPermission = useCallback(async (): Promise<HealthPermissionStatus> => {
    setIsLoading(true);
    try {
      const status = await healthService.requestPermission();
      setPermissionStatus(status);

      // If permission granted, sync (debounce will prevent rapid re-syncs)
      if (status === 'authorized') {
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

  const gatherStone = useCallback(
    async (geoData: LocationGeoData | null): Promise<GatherResult> => {
      // Use fresh state to avoid race conditions with rapid clicking
      const currentState = getStepGatheringState();
      if (calculateGatherableAmount(currentState.availableSteps) === 0) {
        return { success: false, error: 'Not enough steps' };
      }

      // Get geo-appropriate stone
      const stone = geoData
        ? resourceSpawnService.getRandomStoneForLocation(geoData)
        : resourceSpawnService.getRandomStone();

      if (!stone) {
        return { success: false, error: 'No stone type available' };
      }

      // Calculate yield based on tool bonuses
      // Note: Stone gathering doesn't currently have tools, but keep the logic for future
      const gatheringAbility = calculateGatheringAbility('stone', gameState.ownedTools);
      const quantity = calculateGatherYield(gatheringAbility);

      // Spend steps (persisted)
      spendSteps(STEPS_PER_GATHER);

      // Notify via callback
      if (onGather) {
        onGather('stone', stone.id, quantity);
      }

      return {
        success: true,
        resourceId: stone.id,
        quantity,
        stepsSpent: STEPS_PER_GATHER,
      };
    },
    [getStepGatheringState, gameState.ownedTools, spendSteps, onGather]
  );

  const gatherWood = useCallback(
    async (geoData: LocationGeoData | null): Promise<GatherResult> => {
      // Use fresh state to avoid race conditions with rapid clicking
      const currentState = getStepGatheringState();
      if (calculateGatherableAmount(currentState.availableSteps) === 0) {
        return { success: false, error: 'Not enough steps' };
      }

      // Get geo-appropriate wood
      const wood = geoData
        ? resourceSpawnService.getRandomWoodForLocation(geoData)
        : resourceSpawnService.getRandomWood();

      if (!wood) {
        return { success: false, error: 'No wood type available' };
      }

      // Calculate yield based on tool bonuses
      // Wood gathering tools provide bonuses here
      const gatheringAbility = calculateGatheringAbility('wood', gameState.ownedTools);
      const quantity = calculateGatherYield(gatheringAbility);

      // Spend steps (persisted)
      spendSteps(STEPS_PER_GATHER);

      // Notify via callback
      if (onGather) {
        onGather('wood', wood.id, quantity);
      }

      return {
        success: true,
        resourceId: wood.id,
        quantity,
        stepsSpent: STEPS_PER_GATHER,
      };
    },
    [getStepGatheringState, gameState.ownedTools, spendSteps, onGather]
  );

  const openHealthSettings = useCallback(async (): Promise<boolean> => {
    return healthService.openHealthSettings();
  }, []);

  const openPlayStore = useCallback(async (): Promise<boolean> => {
    return healthService.openHealthConnectPlayStore();
  }, []);

  return {
    availableSteps: gameState.availableSteps,
    lastSyncTimestamp: gameState.lastSyncTimestamp,
    totalStepsGathered: gameState.totalStepsGathered,
    permissionStatus,
    isLoading,
    syncSteps: doSyncSteps,
    requestPermission,
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
