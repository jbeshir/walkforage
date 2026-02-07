// Tech Tree Screen - View and unlock technologies
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameState } from '../hooks/useGameState';
import { useTheme } from '../hooks/useTheme';
import { TECHNOLOGIES, TECH_BY_ID, getAvailableTechs, getTechsByEra } from '../data/techTree';
import { Technology, LITHIC_ERAS, ERA_COLORS, ERA_NAMES, TechResourceCost } from '../types/tech';
import { getMaterialIcon, MaterialType } from '../config/materials';
import { ThemeColors } from '../config/theme';
import TechResourceModal, { ResourceSelection } from '../components/TechResourceModal';
import TechUnlockedModal from '../components/TechUnlockedModal';

// Format resource costs as a readable string with icons
function formatResourceCost(costs: TechResourceCost[]): string {
  if (costs.length === 0) return 'Free';
  return costs.map((c) => `${c.quantity} ${getMaterialIcon(c.resourceType)}`).join('  ');
}

interface TechNodeProps {
  tech: Technology;
  isUnlocked: boolean;
  isAvailable: boolean;
  onPress: () => void;
  colors: ThemeColors;
}

function TechNode({ tech, isUnlocked, isAvailable, onPress, colors }: TechNodeProps) {
  const bgColor = isUnlocked
    ? ERA_COLORS[tech.era]
    : isAvailable
      ? `${ERA_COLORS[tech.era]}80` // 50% opacity
      : colors.border;

  return (
    <TouchableOpacity
      style={[styles.techNode, { backgroundColor: bgColor, borderColor: colors.borderLight }]}
      onPress={onPress}
    >
      <Text style={styles.techName}>{tech.name}</Text>
      {isUnlocked && (
        <Text style={[styles.unlockedBadge, { color: colors.success }]}>UNLOCKED</Text>
      )}
      {!isUnlocked && isAvailable && <Text style={styles.availableBadge}>AVAILABLE</Text>}
      {!isUnlocked && !isAvailable && (
        <Text style={[styles.lockedBadge, { color: colors.textTertiary }]}>LOCKED</Text>
      )}
      {!isUnlocked && tech.resourceCost.length > 0 && (
        <Text style={styles.costText}>{formatResourceCost(tech.resourceCost)}</Text>
      )}
    </TouchableOpacity>
  );
}

// Constants for cheat menu activation
const CHEAT_TAP_COUNT = 5;
const CHEAT_TAP_WINDOW_MS = 2000; // 5 taps within 2 seconds

interface TechTreeScreenProps {
  onEnableCheatMode?: () => void;
}

export default function TechTreeScreen({ onEnableCheatMode }: TechTreeScreenProps) {
  const { state, hasTech, unlockTech, removeResource } = useGameState();
  const { theme } = useTheme();
  const { colors } = theme;

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTech, setSelectedTech] = useState<Technology | null>(null);
  const [unlockedModalVisible, setUnlockedModalVisible] = useState(false);
  const [viewingTech, setViewingTech] = useState<Technology | null>(null);

  // Track taps for cheat menu activation
  const tapTimesRef = useRef<number[]>([]);

  const handleHeaderTap = useCallback(() => {
    const now = Date.now();
    // Add current tap and filter out old taps outside the window
    tapTimesRef.current = [
      ...tapTimesRef.current.filter((t) => now - t < CHEAT_TAP_WINDOW_MS),
      now,
    ];

    // Check if we have enough taps
    if (tapTimesRef.current.length >= CHEAT_TAP_COUNT) {
      tapTimesRef.current = []; // Reset
      onEnableCheatMode?.();
    }
  }, [onEnableCheatMode]);

  const availableTechs = getAvailableTechs(state.unlockedTechs);

  // Get total count of a resource type across all specific resources
  const getTotalResourceCount = (resourceType: MaterialType): number => {
    const stacks = state.inventory[resourceType];
    return stacks.reduce((sum, stack) => sum + stack.quantity, 0);
  };

  const handleTechPress = (tech: Technology) => {
    if (hasTech(tech.id)) {
      // Show tech details in modal
      setViewingTech(tech);
      setUnlockedModalVisible(true);
      return;
    }

    // Check if available
    const isAvailable = tech.prerequisites.every((prereqId) => hasTech(prereqId));
    if (!isAvailable) {
      const missing = tech.prerequisites
        .filter((prereqId) => !hasTech(prereqId))
        .map((prereqId) => TECH_BY_ID[prereqId]?.name || prereqId);
      Alert.alert('Locked', `Requires: ${missing.join(', ')}`);
      return;
    }

    // Check resources by type
    const missingResources = tech.resourceCost.filter(
      (cost) => getTotalResourceCount(cost.resourceType) < cost.quantity
    );

    if (missingResources.length > 0) {
      const missing = missingResources
        .map((r) => `${r.quantity} ${getMaterialIcon(r.resourceType)}`)
        .join(', ');
      Alert.alert('Insufficient Resources', `Need: ${missing}`);
      return;
    }

    // If no resources required, just unlock directly
    if (tech.resourceCost.length === 0) {
      unlockTech(tech.id);
      Alert.alert('Unlocked!', `${tech.name} is now available.`);
      return;
    }

    // Open material selection modal
    setSelectedTech(tech);
    setModalVisible(true);
  };

  const handleModalConfirm = (selection: ResourceSelection) => {
    if (!selectedTech) return;

    // Deduct selected resources for all material types
    for (const [materialType, selections] of Object.entries(selection.materials)) {
      if (selections) {
        selections.forEach(({ resourceId, quantity }) => {
          removeResource(materialType as MaterialType, resourceId, quantity);
        });
      }
    }

    // Unlock the tech
    unlockTech(selectedTech.id);
    Alert.alert('Unlocked!', `${selectedTech.name} is now available.`);

    setModalVisible(false);
    setSelectedTech(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={handleHeaderTap} activeOpacity={1}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Technology Tree</Text>
          </TouchableOpacity>
          <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
            {state.unlockedTechs.length} / {TECHNOLOGIES.length} unlocked
          </Text>
        </View>

        {LITHIC_ERAS.map((era) => {
          const eraTechs = getTechsByEra(era);
          if (eraTechs.length === 0) return null;

          return (
            <View key={era} style={[styles.eraSection, { backgroundColor: colors.surface }]}>
              <View style={[styles.eraHeader, { backgroundColor: ERA_COLORS[era] }]}>
                <Text style={styles.eraTitle}>{ERA_NAMES[era]}</Text>
                <Text style={styles.eraCount}>
                  {eraTechs.filter((t) => hasTech(t.id)).length} / {eraTechs.length}
                </Text>
              </View>
              <View style={[styles.techGrid, { backgroundColor: colors.surfaceSecondary }]}>
                {eraTechs.map((tech) => (
                  <TechNode
                    key={tech.id}
                    tech={tech}
                    isUnlocked={hasTech(tech.id)}
                    isAvailable={availableTechs.some((t) => t.id === tech.id)}
                    onPress={() => handleTechPress(tech)}
                    colors={colors}
                  />
                ))}
              </View>
            </View>
          );
        })}

        <View style={styles.bottomPadding} />

        {/* Material Selection Modal */}
        {selectedTech && (
          <TechResourceModal
            visible={modalVisible}
            onClose={() => {
              setModalVisible(false);
              setSelectedTech(null);
            }}
            onConfirm={handleModalConfirm}
            techName={selectedTech.name}
            resourceCosts={selectedTech.resourceCost}
            availableMaterials={state.inventory}
          />
        )}

        {/* Unlocked Tech Details Modal */}
        {viewingTech && (
          <TechUnlockedModal
            visible={unlockedModalVisible}
            onClose={() => {
              setUnlockedModalVisible(false);
              setViewingTech(null);
            }}
            tech={viewingTech}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 5,
  },
  eraSection: {
    marginBottom: 16,
    marginHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  eraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  eraTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  eraCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  techNode: {
    width: '46%',
    margin: '2%',
    padding: 12,
    borderRadius: 10,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  techName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  unlockedBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  availableBadge: {
    fontSize: 9,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  lockedBadge: {
    fontSize: 9,
  },
  costText: {
    fontSize: 10,
    color: '#fff',
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bottomPadding: {
    height: 30,
  },
});
