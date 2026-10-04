// useStepGathering - Hook for step-based resource gathering
// Wires the step sync (src/services/stepSync.ts) to the screen lifecycle and allows spending
// steps for resources. Uses useGameStore for persistence across screen changes

import { useState, useCallback, useEffect } from 'react';
import { healthService } from '../services/HealthService';
import { syncSteps } from '../services/stepSync';
import { useGameStore } from '../store/gameStore';
import { HealthPermissionStatus, GatherResult, StepSyncResult } from '../types/health';
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
  /** Auto-sync interval in milliseconds (0 to disable) */
  autoSyncInterval?: number;
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

async function syncAndLog(): Promise<void> {
  const result = await syncSteps();
  if (result.status === 'error') console.warn('step sync failed:', result.code, result.message);
}

export function useStepGathering(options: UseStepGatheringOptions = {}): UseStepGatheringReturn {
  const { onGather, autoSyncInterval = 0 } = options;

  const ownedTools = useGameStore((s) => s.ownedTools);
  const availableSteps = useGameStore((s) => s.availableSteps);
  const totalStepsGathered = useGameStore((s) => s.totalStepsGathered);
  const getStepGatheringState = useGameStore((s) => s.getStepGatheringState);
  const isHydrated = useGameStore((s) => !s.isLoading);
  const persistSpendSteps = useGameStore((s) => s.spendSteps);

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
      }
    }

    void init();
    return () => {
      mounted = false;
    };
  }, []);

  // Sync once the saved game has loaded and step access is granted: on mount, and again
  // when the user grants access in-app.
  useEffect(() => {
    if (!isHydrated || permissionStatus !== 'authorized') return;
    void syncAndLog();
  }, [isHydrated, permissionStatus]);

  // Auto-sync interval
  useEffect(() => {
    if (autoSyncInterval <= 0) return;
    if (permissionStatus !== 'authorized') return;

    const interval = setInterval(() => void syncAndLog(), autoSyncInterval);

    return () => clearInterval(interval);
  }, [autoSyncInterval, permissionStatus]);

  const requestPermission = useCallback(async (): Promise<HealthPermissionStatus> => {
    setIsLoading(true);
    try {
      // A grant flips permissionStatus to 'authorized', which triggers the sync effect above.
      const status = await healthService.requestPermission();
      setPermissionStatus(status);
      return status;
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    syncSteps,
    requestPermission,
    gatherMaterial,
    spendSteps,
    isAvailable: healthService.isAvailable(),
    needsInstall: healthService.needsHealthConnectInstall(),
    openHealthSettings,
    openPlayStore,
    gatherableMaterialTypes: getGatherableMaterialTypes(),
  };
}

export default useStepGathering;
