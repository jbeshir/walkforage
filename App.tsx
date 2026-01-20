// WalkForage - Location-Based Idle Village Builder
// Main App with Tab Navigation

import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Modal } from 'react-native';
import { useHealthRationaleIntent } from './src/hooks/useHealthRationaleIntent';
import { HealthPermissionRationale } from './src/components/HealthPermissionRationale';
import { GameStateProvider } from './src/hooks/useGameState';

// Import screens
import ForageScreen from './src/screens/ForageScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import CraftingScreen from './src/screens/CraftingScreen';
import TechTreeScreen from './src/screens/TechTreeScreen';
import VillageScreen from './src/screens/VillageScreen';
import CheatScreen from './src/screens/CheatScreen';

const Tab = createBottomTabNavigator();

// Simple icon component (replace with proper icons later)
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Forage: '🗺️',
    Materials: '🪨',
    Tools: '🔨',
    Tech: '⚙️',
    Village: '🏠',
    Cheat: '🔧',
  };

  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icons[name] || '📦'}</Text>
  );
}

export default function App() {
  // Handle Health Connect rationale intent (when user taps privacy policy in HC dialog)
  const { showRationale, dismissRationale } = useHealthRationaleIntent();

  // Cheat mode state - persists until app restart
  const [cheatModeEnabled, setCheatModeEnabled] = useState(false);

  const enableCheatMode = useCallback(() => {
    setCheatModeEnabled(true);
  }, []);

  return (
    <GameStateProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        {/* Health Connect rationale modal - shown when launched from HC settings */}
        <Modal visible={showRationale} animationType="slide" onRequestClose={dismissRationale}>
          <HealthPermissionRationale onClose={dismissRationale} />
        </Modal>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
            tabBarActiveTintColor: route.name === 'Cheat' ? '#ff6b6b' : '#4CAF50',
            tabBarInactiveTintColor: '#999',
            tabBarStyle: styles.tabBar,
            headerStyle: styles.header,
            headerTintColor: '#333',
            headerTitleStyle: styles.headerTitle,
          })}
        >
          <Tab.Screen name="Forage" component={ForageScreen} options={{ title: 'Forage' }} />
          <Tab.Screen
            name="Materials"
            component={InventoryScreen}
            options={{ title: 'Materials' }}
          />
          <Tab.Screen name="Tools" component={CraftingScreen} options={{ title: 'Tools' }} />
          <Tab.Screen name="Tech" options={{ title: 'Tech Tree' }}>
            {() => <TechTreeScreen onEnableCheatMode={enableCheatMode} />}
          </Tab.Screen>
          <Tab.Screen name="Village" component={VillageScreen} options={{ title: 'Village' }} />
          {cheatModeEnabled && (
            <Tab.Screen
              name="Cheat"
              component={CheatScreen}
              options={{
                title: 'Cheat',
                tabBarActiveTintColor: '#ff6b6b',
                headerStyle: { ...styles.header, backgroundColor: '#2a2a2a' },
                headerTintColor: '#ff6b6b',
              }}
            />
          )}
        </Tab.Navigator>
      </NavigationContainer>
    </GameStateProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 5,
    paddingBottom: 5,
    height: 60,
  },
  tabIcon: {
    fontSize: 24,
  },
  tabIconFocused: {
    transform: [{ scale: 1.1 }],
  },
  header: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 18,
  },
});
