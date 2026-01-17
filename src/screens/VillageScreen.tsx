// Village Screen - Placeholder for village building
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useGameState } from '../hooks/useGameState';

export default function VillageScreen() {
  const { state } = useGameState();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{state.village.name}</Text>
        <Text style={styles.subtitle}>{state.village.buildings.length} buildings</Text>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Village Stats</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Workers</Text>
          <Text style={styles.statValue}>
            {state.village.availableWorkers} / {state.village.totalWorkers}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Grid Size</Text>
          <Text style={styles.statValue}>
            {state.village.gridSize.width} x {state.village.gridSize.height}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Technologies</Text>
          <Text style={styles.statValue}>{state.techProgress.unlockedTechs.length} unlocked</Text>
        </View>
      </View>

      <View style={styles.buildingsSection}>
        <Text style={styles.sectionTitle}>Buildings</Text>
        {state.village.buildings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No buildings yet</Text>
            <Text style={styles.emptyText}>
              Unlock technologies and gather resources to start building your village!
            </Text>
            <Text style={styles.hintText}>
              Tip: Start by unlocking Flint Knapping in the Tech Tree
            </Text>
          </View>
        ) : (
          state.village.buildings.map((building) => (
            <View key={building.id} style={styles.buildingCard}>
              <Text style={styles.buildingName}>{building.buildingId}</Text>
              <Text style={styles.buildingLevel}>Level {building.level}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonTitle}>Coming Soon</Text>
        <Text style={styles.comingSoonText}>
          Full village building with grid placement, worker assignment, and idle production
          mechanics.
        </Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  statsCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  buildingsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 15,
  },
  hintText: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
  },
  buildingCard: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buildingName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  buildingLevel: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  comingSoon: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 30,
  },
});
