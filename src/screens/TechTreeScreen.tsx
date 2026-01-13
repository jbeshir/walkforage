// Tech Tree Screen - View and unlock technologies
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useGameState } from '../hooks/useGameState';
import { TECHNOLOGIES, TECH_BY_ID, getAvailableTechs, getTechsByEra } from '../data/techTree';
import { Technology, TechEra } from '../types/tech';

const ERA_COLORS: Record<TechEra, string> = {
  stone: '#8B7355',
  copper: '#B87333',
  bronze: '#CD7F32',
  iron: '#4A4A4A',
  advanced: '#1E90FF',
};

const ERA_NAMES: Record<TechEra, string> = {
  stone: 'Stone Age',
  copper: 'Copper Age',
  bronze: 'Bronze Age',
  iron: 'Iron Age',
  advanced: 'Advanced',
};

interface TechNodeProps {
  tech: Technology;
  isUnlocked: boolean;
  isAvailable: boolean;
  onPress: () => void;
}

function TechNode({ tech, isUnlocked, isAvailable, onPress }: TechNodeProps) {
  const bgColor = isUnlocked
    ? ERA_COLORS[tech.era]
    : isAvailable
    ? `${ERA_COLORS[tech.era]}80` // 50% opacity
    : '#ccc';

  return (
    <TouchableOpacity
      style={[styles.techNode, { backgroundColor: bgColor }]}
      onPress={onPress}
      disabled={isUnlocked}
    >
      <Text style={styles.techName}>{tech.name}</Text>
      {isUnlocked && <Text style={styles.unlockedBadge}>UNLOCKED</Text>}
      {!isUnlocked && isAvailable && (
        <Text style={styles.availableBadge}>AVAILABLE</Text>
      )}
      {!isUnlocked && !isAvailable && (
        <Text style={styles.lockedBadge}>LOCKED</Text>
      )}
    </TouchableOpacity>
  );
}

export default function TechTreeScreen() {
  const { state, hasTech, unlockTech, hasResource, removeResource } = useGameState();

  const availableTechs = getAvailableTechs(state.techProgress.unlockedTechs);

  const handleTechPress = (tech: Technology) => {
    if (hasTech(tech.id)) {
      // Show tech details
      Alert.alert(
        tech.name,
        `${tech.description}\n\nUnlocks: ${tech.unlocks.join(', ') || 'None'}\nBuildings: ${tech.enablesBuildings.join(', ') || 'None'}`
      );
      return;
    }

    // Check if available
    const isAvailable = tech.prerequisites.every((prereq) =>
      hasTech(prereq.techId)
    );
    if (!isAvailable) {
      const missing = tech.prerequisites
        .filter((p) => !hasTech(p.techId))
        .map((p) => TECH_BY_ID[p.techId]?.name || p.techId);
      Alert.alert('Locked', `Requires: ${missing.join(', ')}`);
      return;
    }

    // Check resources
    const missingResources = tech.resourceCost.filter(
      (cost) => !hasResource('stones', cost.resourceId, cost.quantity) &&
               !hasResource('woods', cost.resourceId, cost.quantity) &&
               !hasResource('ores', cost.resourceId, cost.quantity)
    );

    if (missingResources.length > 0) {
      const missing = missingResources
        .map((r) => `${r.quantity}x ${r.resourceId}`)
        .join(', ');
      Alert.alert('Insufficient Resources', `Need: ${missing}`);
      return;
    }

    // Unlock tech
    Alert.alert(
      'Unlock Technology?',
      `${tech.name}\n\nCost:\n${tech.resourceCost
        .map((r) => `${r.quantity}x ${r.resourceId}`)
        .join('\n')}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          onPress: () => {
            // Deduct resources
            tech.resourceCost.forEach((cost) => {
              // Try each category until one succeeds
              const removed =
                removeResource('stones', cost.resourceId, cost.quantity) ||
                removeResource('woods', cost.resourceId, cost.quantity) ||
                removeResource('ores', cost.resourceId, cost.quantity);
              void removed; // Result intentionally unused after deduction
            });
            unlockTech(tech.id);
            Alert.alert('Unlocked!', `${tech.name} is now available.`);
          },
        },
      ]
    );
  };

  const eras: TechEra[] = ['stone', 'copper', 'bronze', 'iron', 'advanced'];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Technology Tree</Text>
        <Text style={styles.headerSubtitle}>
          {state.techProgress.unlockedTechs.length} / {TECHNOLOGIES.length} unlocked
        </Text>
      </View>

      {eras.map((era) => {
        const eraTechs = getTechsByEra(era);
        if (eraTechs.length === 0) return null;

        return (
          <View key={era} style={styles.eraSection}>
            <View style={[styles.eraHeader, { backgroundColor: ERA_COLORS[era] }]}>
              <Text style={styles.eraTitle}>{ERA_NAMES[era]}</Text>
              <Text style={styles.eraCount}>
                {eraTechs.filter((t) => hasTech(t.id)).length} / {eraTechs.length}
              </Text>
            </View>
            <View style={styles.techGrid}>
              {eraTechs.map((tech) => (
                <TechNode
                  key={tech.id}
                  tech={tech}
                  isUnlocked={hasTech(tech.id)}
                  isAvailable={availableTechs.some((t) => t.id === tech.id)}
                  onPress={() => handleTechPress(tech)}
                />
              ))}
            </View>
          </View>
        );
      })}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  eraSection: {
    marginBottom: 20,
  },
  eraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  eraTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  eraCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  techNode: {
    width: '45%',
    margin: '2.5%',
    padding: 15,
    borderRadius: 10,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  techName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  unlockedBadge: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  availableBadge: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  lockedBadge: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  bottomPadding: {
    height: 30,
  },
});
