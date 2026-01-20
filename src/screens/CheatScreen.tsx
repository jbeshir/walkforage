// Cheat Screen - Developer/testing tools for granting resources
// Appears as a tab after activation (tap Tech Tree header 5 times)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { STONES } from '../data/stones';
import { WOODS } from '../data/woods';
import { TECHNOLOGIES } from '../data/techTree';
import { useGameState } from '../hooks/useGameState';

type ResourceTab = 'steps' | 'stones' | 'woods' | 'tech';

export default function CheatScreen() {
  const { addResource, syncSteps, unlockTech, resetGame, state } = useGameState();
  const [activeTab, setActiveTab] = useState<ResourceTab>('steps');
  const [stepsAmount, setStepsAmount] = useState('1000');

  const handleAddSteps = () => {
    const amount = parseInt(stepsAmount, 10);
    if (!isNaN(amount) && amount > 0) {
      syncSteps(amount);
    }
  };

  const handleAddStone = (stoneId: string, quantity: number) => {
    addResource('stones', stoneId, quantity);
  };

  const handleAddWood = (woodId: string, quantity: number) => {
    addResource('woods', woodId, quantity);
  };

  const handleUnlockAllTech = () => {
    for (const tech of TECHNOLOGIES) {
      if (!state.unlockedTechs.includes(tech.id)) {
        unlockTech(tech.id);
      }
    }
  };

  const handleResetGame = () => {
    Alert.alert('Reset Game', 'This will delete ALL progress and start fresh. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => resetGame(),
      },
    ]);
  };

  const renderTabButton = (tab: ResourceTab, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderStepsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Add Steps</Text>
      <View style={styles.stepsRow}>
        <TextInput
          style={styles.stepsInput}
          value={stepsAmount}
          onChangeText={setStepsAmount}
          keyboardType="numeric"
          placeholder="Amount"
          placeholderTextColor="#666"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddSteps}>
          <Text style={styles.addButtonText}>Add Steps</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.quickButtons}>
        {[100, 500, 1000, 5000, 10000].map((amount) => (
          <TouchableOpacity
            key={amount}
            style={styles.quickButton}
            onPress={() => syncSteps(amount)}
          >
            <Text style={styles.quickButtonText}>+{amount}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.currentValue}>Current: {state.availableSteps} steps available</Text>
    </View>
  );

  const renderStonesTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Add Stones</Text>
      <View style={styles.resourceGrid}>
        {STONES.map((stone) => (
          <View key={stone.id} style={styles.resourceItem}>
            <View style={[styles.colorSwatch, { backgroundColor: stone.color }]} />
            <Text style={styles.resourceName} numberOfLines={1}>
              {stone.name}
            </Text>
            <View style={styles.quantityButtons}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleAddStone(stone.id, 1)}
              >
                <Text style={styles.quantityButtonText}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleAddStone(stone.id, 10)}
              >
                <Text style={styles.quantityButtonText}>+10</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleAddStone(stone.id, 100)}
              >
                <Text style={styles.quantityButtonText}>+100</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderWoodsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Add Woods</Text>
      <View style={styles.resourceGrid}>
        {WOODS.map((wood) => (
          <View key={wood.id} style={styles.resourceItem}>
            <View style={[styles.colorSwatch, { backgroundColor: wood.color }]} />
            <Text style={styles.resourceName} numberOfLines={1}>
              {wood.name}
            </Text>
            <View style={styles.quantityButtons}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleAddWood(wood.id, 1)}
              >
                <Text style={styles.quantityButtonText}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleAddWood(wood.id, 10)}
              >
                <Text style={styles.quantityButtonText}>+10</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleAddWood(wood.id, 100)}
              >
                <Text style={styles.quantityButtonText}>+100</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderTechTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Technology</Text>
      <TouchableOpacity style={styles.unlockAllButton} onPress={handleUnlockAllTech}>
        <Text style={styles.unlockAllButtonText}>Unlock All Technologies</Text>
      </TouchableOpacity>
      <Text style={styles.currentValue}>
        Currently unlocked: {state.unlockedTechs.length} technologies
      </Text>

      <Text style={[styles.sectionTitle, styles.dangerZoneTitle]}>Danger Zone</Text>
      <TouchableOpacity style={styles.resetButton} onPress={handleResetGame}>
        <Text style={styles.resetButtonText}>Reset All Progress</Text>
      </TouchableOpacity>
      <Text style={styles.dangerText}>Deletes all resources, tools, tech, and steps</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cheat Menu</Text>
        <Text style={styles.headerSubtitle}>Development tools - persists until app restart</Text>
      </View>

      <View style={styles.tabs}>
        {renderTabButton('steps', 'Steps')}
        {renderTabButton('stones', 'Stones')}
        {renderTabButton('woods', 'Woods')}
        {renderTabButton('tech', 'Tech')}
      </View>

      <View style={styles.content}>
        {activeTab === 'steps' && renderStepsTab()}
        {activeTab === 'stones' && renderStonesTab()}
        {activeTab === 'woods' && renderWoodsTab()}
        {activeTab === 'tech' && renderTechTab()}
      </View>
    </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b6b',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#ff6b6b',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#888',
  },
  tabButtonTextActive: {
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepsInput: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  quickButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  quickButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  quickButtonText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 16,
  },
  currentValue: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  resourceGrid: {
    gap: 8,
    paddingBottom: 20,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 12,
  },
  resourceName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  quantityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quantityButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  unlockAllButton: {
    backgroundColor: '#9C27B0',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  unlockAllButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#D32F2F',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dangerText: {
    fontSize: 12,
    color: '#D32F2F',
    marginTop: 8,
    textAlign: 'center',
  },
  dangerZoneTitle: {
    marginTop: 32,
  },
});
