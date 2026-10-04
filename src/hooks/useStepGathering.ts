// useStepGathering - Hook for step-based resource gathering
// Wires the step sync (src/services/stepSync.ts) to the screen lifecycle and allows spending
// steps for resources. Uses useGameStore for persistence across screen changes

import { useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { healthService } from '../services/HealthService';
import { syncSteps } from '../services/stepSync';
import { useGameStore } from '../store/gameStore';
import {
  HealthPermissionStatus,
  GatherResult,
  StepSyncMode,
  StepSyncResult,
} from '../types/health';
import { FOREGROUND_RECONCILE_MS } from '../config/stepSync';
import { LocationGeoData } from '../types/gis';
import { MaterialType, getMaterialConfig, getGatherableMaterialTypes } from '../config/materials';
import {
  STEPS_PER_GATHER,
  calculateGatherableAmount,
  calculateGatheringAbility,
  calculateGatherYield,
} from '../config/gathering';

export interface UseStepGatheringOptions {
  /** Callback when resources are gathered - receives category, resourceId, quantity */
  onGather?: (category: MaterialType, resourceId: string, quantity: number) => void;
}

export interface UseStepGatheringReturn {
  /** Steps available for gathering (reactive - use for render) */
  availableSteps: number;
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
  /** Generic gather function for any material type */
  gatherMaterial: (
    materialType: MaterialType,
    geoData: LocationGeoData | null
  ) => Promise<GatherResult>;
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
  /** Get list of gatherable material types */
  gatherableMaterialTypes: MaterialType[];
}

export function useStepGathering(options: UseStepGatheringOptions = {}): UseStepGatheringReturn {
  const { onGather } = options;

  const ownedTools = useGameStore((s) => s.ownedTools);
  const availableSteps = useGameStore((s) => s.availableSteps);
  const totalStepsGathered = useGameStore((s) => s.totalStepsGathered);
  const getStepGatheringState = useGameStore((s) => s.getStepGatheringState);
  const gameLoaded = useGameStore((s) => !s.isLoading && !s.loadFailed);
  const persistSpendSteps = useGameStore((s) => s.spendSteps);

  // Health status is ephemeral: shown as the last health service refresh found it
  const [permissionStatus, setPermissionStatus] =
    useState<HealthPermissionStatus>('not_determined');
  const [needsInstall, setNeedsInstall] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const showHealthStatus = useCallback(() => {
    setPermissionStatus(healthService.getPermissionStatus());
    setNeedsInstall(healthService.needsHealthConnectInstall());
  }, []);

  // Every sync refreshes the health status first, so show what it found
  const sync = useCallback(
    async (mode: StepSyncMode): Promise<StepSyncResult> => {
      const result = await syncSteps(mode);
      showHealthStatus();
      return result;
    },
    [showHealthStatus]
  );

  const syncAndLog = useCallback(
    async (mode: StepSyncMode): Promise<void> => {
      const result = await sync(mode);
      // No grant yet and a save still loading (or failed to) are states the UI already shows, and
      // the interval would repeat them every few minutes.
      if (
        result.status === 'error' &&
        result.code !== 'not_authorized' &&
        result.code !== 'not_loaded'
      ) {
        console.warn('step sync failed:', result.code, result.message);
      }
    },
    [sync]
  );

  // Check the health service on mount
  useEffect(() => {
    let mounted = true;
    void healthService.refreshStatus().then(() => {
      if (mounted) {
        showHealthStatus();
        setIsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [showHealthStatus]);

  // Once the saved game has loaded: a full sync now and whenever the app returns to the
  // foreground, and a recent sync every FOREGROUND_RECONCILE_MS while it stays there. Nothing is
  // listened to before the load, so returning to the app can never sync against initial state.
  useEffect(() => {
    if (!gameLoaded) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    const startInterval = () => {
      interval ??= setInterval(() => void syncAndLog('recent'), FOREGROUND_RECONCILE_MS);
    };
    const stopInterval = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    void syncAndLog('full');
    if (AppState.currentState === 'active') startInterval();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncAndLog('full');
        startInterval();
      } else {
        stopInterval();
      }
    });
    return () => {
      subscription.remove();
      stopInterval();
    };
  }, [gameLoaded, syncAndLog]);

  const syncNow = useCallback(() => sync('full'), [sync]);

  const requestPermission = useCallback(async (): Promise<HealthPermissionStatus> => {
    setIsLoading(true);
    try {
      const status = await healthService.requestPermission();
      showHealthStatus();
      // Before the load completes, the load's own sync credits the grant.
      const { isLoading: loading, loadFailed } = useGameStore.getState();
      if (status === 'authorized' && !loading && !loadFailed) void syncAndLog('full');
      return status;
    } finally {
      setIsLoading(false);
    }
  }, [showHealthStatus, syncAndLog]);

  const spendSteps = useCallback(
    (amount: number) => {
      persistSpendSteps(amount);
    },
    [persistSpendSteps]
  );

  // Generic gather function that works for any gatherable material type
  const gatherMaterial = useCallback(
    async (materialType: MaterialType, geoData: LocationGeoData | null): Promise<GatherResult> => {
      const config = getMaterialConfig(materialType);

      // Check if this material type supports gathering
      if (!config.gathering) {
        return { success: false, error: `${config.singularName} cannot be gathered` };
      }

      // Check if gathering is enabled for this material (ability >= 1)
      const gatheringAbility = calculateGatheringAbility(materialType, ownedTools);
      if (gatheringAbility === 0) {
        return {
          success: false,
          error: `Need a tool to gather ${config.singularName.toLowerCase()}`,
        };
      }

      // Use fresh state to avoid race conditions with rapid clicking
      const currentState = getStepGatheringState();
      if (calculateGatherableAmount(currentState.availableSteps) === 0) {
        return { success: false, error: 'Not enough steps' };
      }

      // Get geo-appropriate resource using the material's gathering config
      const resource = geoData
        ? config.gathering.getRandomResourceForLocation(geoData)
        : config.gathering.getRandomResource();

      if (!resource) {
        return { success: false, error: `No ${config.singularName.toLowerCase()} type available` };
      }

      // Calculate yield based on tool bonuses
      const quantity = calculateGatherYield(gatheringAbility);

      // Spend steps (persisted)
      spendSteps(STEPS_PER_GATHER);

      // Notify via callback
      if (onGather) {
        onGather(materialType, resource.id, quantity);
      }

      return {
        success: true,
        resourceId: resource.id,
        quantity,
        stepsSpent: STEPS_PER_GATHER,
      };
    },
    [getStepGatheringState, ownedTools, spendSteps, onGather]
  );

  const openHealthSettings = useCallback(async (): Promise<boolean> => {
    return healthService.openHealthSettings();
  }, []);

  const openPlayStore = useCallback(async (): Promise<boolean> => {
    return healthService.openHealthConnectPlayStore();
  }, []);

  return {
    availableSteps,
    totalStepsGathered,
    permissionStatus,
    isLoading,
    syncSteps: syncNow,
    requestPermission,
    gatherMaterial,
    spendSteps,
    isAvailable: healthService.isAvailable(),
    needsInstall,
    openHealthSettings,
    openPlayStore,
    gatherableMaterialTypes: getGatherableMaterialTypes(),
  };
}

export default useStepGathering;
