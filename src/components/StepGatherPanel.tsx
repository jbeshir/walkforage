// StepGatherPanel - UI component for step-based resource gathering
// Shows available steps and gather buttons dynamically for all gatherable material types

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { HealthPermissionRationale } from './HealthPermissionRationale';
import { ToastContainer, ToastMessage, ToastType } from './Toast';
import { UseStepGatheringReturn } from '../hooks/useStepGathering';
import { LocationGeoData } from '../types/gis';
import { MaterialType, getGatherableMaterialTypes, getMaterialConfig } from '../config/materials';
import {
  STEPS_PER_GATHER,
  calculateGatherableAmount,
  calculateGatheringAbility,
} from '../config/gathering';
import { useGameState } from '../hooks/useGameState';
import { useTheme } from '../hooks/useTheme';

let toastId = 0;

export interface StepGatherPanelProps {
  /** Step gathering hook return value */
  stepGathering: UseStepGatheringReturn;
  /** Current location geo data for geo-appropriate resource selection */
  geoData: LocationGeoData | null;
  /** Whether to show in compact mode (for overlay) */
  compact?: boolean;
}

export function StepGatherPanel({ stepGathering, geoData, compact = false }: StepGatherPanelProps) {
  const {
    availableSteps,
    totalStepsGathered,
    permissionStatus,
    isLoading,
    syncSteps,
    requestPermission,
    gatherMaterial,
    isAvailable,
    needsInstall,
    openHealthSettings,
    openPlayStore,
  } = stepGathering;

  const { state } = useGameState();
  const { colors } = useTheme().theme;

  // Calculate directly from reactive availableSteps to ensure UI updates immediately
  const gatherableCount = calculateGatherableAmount(availableSteps);
  const canGather = gatherableCount > 0 && geoData !== null;

  // Get gatherable material types from config
  const gatherableTypes = getGatherableMaterialTypes();

  // Calculate gathering abilities and yield ranges for each material type
  // Filter to only materials that can be gathered (ability >= 1)
  const materialGatheringInfo = gatherableTypes
    .map((materialType) => {
      const config = getMaterialConfig(materialType);
      const ability = calculateGatheringAbility(materialType, state.ownedTools);
      const maxYield = Math.floor(2 * ability - 1);
      const yieldRange = maxYield <= 1 ? '1' : `1-${maxYield}`;
      return { materialType, config, ability, yieldRange };
    })
    .filter(({ ability }) => ability >= 1);

  const [showRationale, setShowRationale] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `toast-${++toastId}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleRequestPermission = useCallback(async () => {
    const status = await requestPermission();
    if (status === 'authorized') {
      await syncSteps();
    } else if (status === 'denied') {
      Alert.alert(
        'Permission Denied',
        'Step access was denied. Would you like to open Health Connect settings to grant permission?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => openHealthSettings() },
        ]
      );
    }
  }, [requestPermission, syncSteps, openHealthSettings]);

  const handleInstallHealthConnect = useCallback(async () => {
    Alert.alert(
      'Health Connect Required',
      'WalkForage needs Health Connect to track your steps. Install it from the Play Store?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Install', onPress: () => openPlayStore() },
      ]
    );
  }, [openPlayStore]);

  const handleOpenSettings = useCallback(async () => {
    await openHealthSettings();
  }, [openHealthSettings]);

  // Generic gather handler for any material type
  const handleGatherMaterial = useCallback(
    async (materialType: MaterialType) => {
      const config = getMaterialConfig(materialType);
      const result = await gatherMaterial(materialType, geoData);
      if (result.success && result.resourceId && result.quantity) {
        const resource = config.getResourceById(result.resourceId);
        showToast(`+${result.quantity} ${resource?.name || result.resourceId}`, 'success');
      } else if (!result.success) {
        showToast(result.error || 'Not enough steps', 'error');
      }
    },
    [gatherMaterial, geoData, showToast]
  );

  const handleSync = useCallback(async () => {
    const result = await syncSteps();
    if (result.success && result.newSteps > 0) {
      showToast(`+${result.newSteps} steps synced!`, 'info');
    } else if (result.success) {
      showToast('No new steps', 'info');
    } else {
      showToast(result.error || 'Sync failed', 'error');
    }
  }, [syncSteps, showToast]);

  // Not available on this platform
  if (!isAvailable) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          compact && styles.containerCompact,
          { backgroundColor: colors.overlayPanel, shadowColor: colors.shadow },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // Health Connect needs to be installed (Android)
  if (needsInstall) {
    return (
      <View
        style={[
          styles.container,
          compact && styles.containerCompact,
          { backgroundColor: colors.overlayPanel, shadowColor: colors.shadow },
        ]}
      >
        <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
          Health Connect app is required to track steps
        </Text>
        <TouchableOpacity
          style={[styles.installButton, { backgroundColor: colors.info }]}
          onPress={handleInstallHealthConnect}
        >
          <Text style={styles.permissionButtonText}>Install Health Connect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Permission not yet requested
  if (permissionStatus === 'not_determined') {
    return (
      <View
        style={[
          styles.container,
          compact && styles.containerCompact,
          { backgroundColor: colors.overlayPanel, shadowColor: colors.shadow },
        ]}
      >
        <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
          Connect health to gather resources with steps
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          onPress={handleRequestPermission}
        >
          <Text style={styles.permissionButtonText}>Connect Health</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowRationale(true)} style={styles.learnWhyLink}>
          <Text style={[styles.learnWhyText, { color: colors.info }]}>Learn why we need this</Text>
        </TouchableOpacity>
        <Modal
          visible={showRationale}
          animationType="slide"
          onRequestClose={() => setShowRationale(false)}
        >
          <HealthPermissionRationale onClose={() => setShowRationale(false)} />
        </Modal>
      </View>
    );
  }

  // Permission denied - show settings button
  if (permissionStatus === 'denied') {
    return (
      <View
        style={[
          styles.container,
          compact && styles.containerCompact,
          { backgroundColor: colors.overlayPanel, shadowColor: colors.shadow },
        ]}
      >
        <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
          Step access denied. Enable it in Health Connect settings.
        </Text>
        <View style={styles.deniedButtons}>
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: colors.warning }]}
            onPress={handleOpenSettings}
          >
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={handleRequestPermission}
          >
            <Text style={styles.permissionButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Unavailable (unsupported device/platform)
  if (permissionStatus === 'unavailable') {
    return null;
  }

  // Compact mode for overlay
  if (compact) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <View
          style={[
            styles.container,
            styles.containerCompact,
            { backgroundColor: colors.overlayPanel, shadowColor: colors.shadow },
          ]}
        >
          <Text style={[styles.compactLabel, { color: colors.textSecondary }]}>Forage</Text>
          <View style={styles.compactHeader}>
            <View>
              <Text style={[styles.stepCount, { color: colors.primary }]}>
                {availableSteps.toLocaleString()} steps
              </Text>
              <Text style={[styles.gatherInfo, { color: colors.textTertiary }]}>
                {gatherableCount > 0
                  ? `${gatherableCount} gather${gatherableCount !== 1 ? 's' : ''} available`
                  : `${STEPS_PER_GATHER - (availableSteps % STEPS_PER_GATHER)} more for next`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleSync}
              style={[styles.syncButton, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Text style={[styles.syncButtonText, { color: colors.info }]}>Sync</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.compactButtons}>
            {materialGatheringInfo.map(({ materialType, config, yieldRange }) => (
              <TouchableOpacity
                key={materialType}
                style={[
                  styles.gatherButton,
                  { backgroundColor: config.buttonColor },
                  !canGather && { backgroundColor: colors.border },
                ]}
                onPress={() => handleGatherMaterial(materialType)}
                disabled={!canGather}
              >
                <Text style={styles.gatherButtonText}>
                  {config.icon} {config.singularName}{' '}
                  <Text style={styles.yieldText}>×{yieldRange}</Text>
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!geoData && (
            <Text style={[styles.locationWarning, { color: colors.warning }]}>
              Waiting for location...
            </Text>
          )}
        </View>
      </>
    );
  }

  // Full mode
  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <View
        style={[
          styles.container,
          { backgroundColor: colors.overlayPanel, shadowColor: colors.shadow },
        ]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>Forage</Text>

        <View style={styles.stepSection}>
          <Text style={[styles.stepCount, { color: colors.primary }]}>
            {availableSteps.toLocaleString()}
          </Text>
          <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>steps available</Text>
          <Text style={[styles.gatherInfoFull, { color: colors.textSecondary }]}>
            {gatherableCount > 0
              ? `${gatherableCount} gather${gatherableCount !== 1 ? 's' : ''} available (${STEPS_PER_GATHER} steps each)`
              : `${STEPS_PER_GATHER - (availableSteps % STEPS_PER_GATHER)} more steps for next gather`}
          </Text>
          <TouchableOpacity
            onPress={handleSync}
            style={[styles.syncButtonFull, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Text style={[styles.syncButtonText, { color: colors.info }]}>Sync Steps</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gatherSection}>
          {materialGatheringInfo.map(({ materialType, config, yieldRange }) => (
            <TouchableOpacity
              key={materialType}
              style={[
                styles.gatherButtonFull,
                { backgroundColor: config.buttonColor },
                !canGather && { backgroundColor: colors.border },
              ]}
              onPress={() => handleGatherMaterial(materialType)}
              disabled={!canGather}
            >
              <Text style={styles.gatherButtonText}>
                {config.icon} Gather {config.singularName}{' '}
                <Text style={styles.yieldText}>×{yieldRange}</Text>
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {!geoData && (
          <Text style={[styles.locationWarning, { color: colors.warning }]}>
            Waiting for location...
          </Text>
        )}

        <Text style={[styles.totalGathered, { color: colors.textTertiary }]}>
          Total gathered: {totalStepsGathered.toLocaleString()} steps
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  containerCompact: {
    padding: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  stepSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepCount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  gatherInfo: {
    fontSize: 11,
    marginTop: 2,
  },
  gatherInfoFull: {
    fontSize: 13,
    marginTop: 4,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  compactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  syncButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  syncButtonFull: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  gatherSection: {
    flexDirection: 'row',
    gap: 12,
  },
  gatherButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  gatherButtonFull: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  gatherButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  yieldText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '400',
  },
  permissionText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  learnWhyLink: {
    marginTop: 12,
    alignSelf: 'center',
  },
  learnWhyText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  installButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'center',
  },
  deniedButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  settingsButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  totalGathered: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  locationWarning: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },
});

export default StepGatherPanel;
