// StepGatherPanel - UI component for step-based resource gathering
// Shows available steps and gather buttons for stones/woods

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
import { STONES_BY_ID } from '../data/stones';
import { WOODS_BY_ID } from '../data/woods';
import {
  STEPS_PER_GATHER,
  calculateGatherableAmount,
  calculateGatheringAbility,
} from '../config/gathering';
import { useGameState } from '../hooks/useGameState';

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
    gatherStone,
    gatherWood,
    isAvailable,
    needsInstall,
    openHealthSettings,
    openPlayStore,
  } = stepGathering;

  const { state } = useGameState();

  // Calculate directly from reactive availableSteps to ensure UI updates immediately
  const gatherableCount = calculateGatherableAmount(availableSteps);
  const canGather = gatherableCount > 0 && geoData !== null;

  // Calculate gathering abilities based on owned tools
  const stoneAbility = calculateGatheringAbility('stone', state.ownedTools);
  const woodAbility = calculateGatheringAbility('wood', state.ownedTools);
  const stoneYieldRange = stoneAbility === 1 ? '1' : `1-${Math.floor(2 * stoneAbility - 1)}`;
  const woodYieldRange = woodAbility === 1 ? '1' : `1-${Math.floor(2 * woodAbility - 1)}`;

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

  const handleGatherStone = useCallback(async () => {
    const result = await gatherStone(geoData);
    if (result.success && result.resourceId && result.quantity) {
      const stone = STONES_BY_ID[result.resourceId];
      showToast(`+${result.quantity} ${stone?.name || result.resourceId}`, 'success');
    } else if (!result.success) {
      showToast(result.error || 'Not enough steps', 'error');
    }
  }, [gatherStone, geoData, showToast]);

  const handleGatherWood = useCallback(async () => {
    const result = await gatherWood(geoData);
    if (result.success && result.resourceId && result.quantity) {
      const wood = WOODS_BY_ID[result.resourceId];
      showToast(`+${result.quantity} ${wood?.name || result.resourceId}`, 'success');
    } else if (!result.success) {
      showToast(result.error || 'Not enough steps', 'error');
    }
  }, [gatherWood, geoData, showToast]);

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
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color="#4CAF50" />
      </View>
    );
  }

  // Health Connect needs to be installed (Android)
  if (needsInstall) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <Text style={styles.permissionText}>Health Connect app is required to track steps</Text>
        <TouchableOpacity style={styles.installButton} onPress={handleInstallHealthConnect}>
          <Text style={styles.permissionButtonText}>Install Health Connect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Permission not yet requested
  if (permissionStatus === 'not_determined') {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <Text style={styles.permissionText}>Connect health to gather resources with steps</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
          <Text style={styles.permissionButtonText}>Connect Health</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowRationale(true)} style={styles.learnWhyLink}>
          <Text style={styles.learnWhyText}>Learn why we need this</Text>
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
      <View style={[styles.container, compact && styles.containerCompact]}>
        <Text style={styles.permissionText}>
          Step access denied. Enable it in Health Connect settings.
        </Text>
        <View style={styles.deniedButtons}>
          <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings}>
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retryButton} onPress={handleRequestPermission}>
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
        <View style={[styles.container, styles.containerCompact]}>
          <Text style={styles.compactLabel}>Forage</Text>
          <View style={styles.compactHeader}>
            <View>
              <Text style={styles.stepCount}>{availableSteps.toLocaleString()} steps</Text>
              <Text style={styles.gatherInfo}>
                {gatherableCount > 0
                  ? `${gatherableCount} gather${gatherableCount !== 1 ? 's' : ''} available`
                  : `${STEPS_PER_GATHER - (availableSteps % STEPS_PER_GATHER)} more for next`}
              </Text>
            </View>
            <TouchableOpacity onPress={handleSync} style={styles.syncButton}>
              <Text style={styles.syncButtonText}>Sync</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.compactButtons}>
            <TouchableOpacity
              style={[styles.gatherButton, styles.stoneButton, !canGather && styles.disabledButton]}
              onPress={handleGatherStone}
              disabled={!canGather}
            >
              <Text style={styles.gatherButtonText}>
                🪨 Stone <Text style={styles.yieldText}>×{stoneYieldRange}</Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.gatherButton, styles.woodButton, !canGather && styles.disabledButton]}
              onPress={handleGatherWood}
              disabled={!canGather}
            >
              <Text style={styles.gatherButtonText}>
                🪵 Wood <Text style={styles.yieldText}>×{woodYieldRange}</Text>
              </Text>
            </TouchableOpacity>
          </View>
          {!geoData && <Text style={styles.locationWarning}>Waiting for location...</Text>}
        </View>
      </>
    );
  }

  // Full mode
  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <View style={styles.container}>
        <Text style={styles.title}>Forage</Text>

        <View style={styles.stepSection}>
          <Text style={styles.stepCount}>{availableSteps.toLocaleString()}</Text>
          <Text style={styles.stepLabel}>steps available</Text>
          <Text style={styles.gatherInfoFull}>
            {gatherableCount > 0
              ? `${gatherableCount} gather${gatherableCount !== 1 ? 's' : ''} available (${STEPS_PER_GATHER} steps each)`
              : `${STEPS_PER_GATHER - (availableSteps % STEPS_PER_GATHER)} more steps for next gather`}
          </Text>
          <TouchableOpacity onPress={handleSync} style={styles.syncButtonFull}>
            <Text style={styles.syncButtonText}>Sync Steps</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gatherSection}>
          <TouchableOpacity
            style={[
              styles.gatherButtonFull,
              styles.stoneButton,
              !canGather && styles.disabledButton,
            ]}
            onPress={handleGatherStone}
            disabled={!canGather}
          >
            <Text style={styles.gatherButtonText}>
              🪨 Gather Stone <Text style={styles.yieldText}>×{stoneYieldRange}</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.gatherButtonFull,
              styles.woodButton,
              !canGather && styles.disabledButton,
            ]}
            onPress={handleGatherWood}
            disabled={!canGather}
          >
            <Text style={styles.gatherButtonText}>
              🪵 Gather Wood <Text style={styles.yieldText}>×{woodYieldRange}</Text>
            </Text>
          </TouchableOpacity>
        </View>
        {!geoData && <Text style={styles.locationWarning}>Waiting for location...</Text>}

        <Text style={styles.totalGathered}>
          Total gathered: {totalStepsGathered.toLocaleString()} steps
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
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
    color: '#333',
    marginBottom: 12,
  },
  stepSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  stepLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  gatherInfo: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  gatherInfoFull: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
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
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
  },
  syncButtonFull: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
  },
  syncButtonText: {
    fontSize: 12,
    color: '#1976D2',
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
  stoneButton: {
    backgroundColor: '#78909C',
  },
  woodButton: {
    backgroundColor: '#8D6E63',
  },
  disabledButton: {
    backgroundColor: '#BDBDBD',
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
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
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
    color: '#1976D2',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  installButton: {
    backgroundColor: '#2196F3',
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
    backgroundColor: '#FF9800',
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
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  totalGathered: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
  },
  locationWarning: {
    fontSize: 11,
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },
});

export default StepGatherPanel;
