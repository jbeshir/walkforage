// WalkForage - Location-Based Idle Village Builder
// Main App with Tab Navigation

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet } from 'react-native';

// Import screens
import ExploreScreen from './src/screens/ExploreScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import CraftingScreen from './src/screens/CraftingScreen';
import TechTreeScreen from './src/screens/TechTreeScreen';
import VillageScreen from './src/screens/VillageScreen';

const Tab = createBottomTabNavigator();

// Simple icon component (replace with proper icons later)
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Explore: '🗺️',
    Inventory: '🎒',
    Crafting: '🔨',
    Tech: '⚙️',
    Village: '🏠',
  };

  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      {icons[name] || '📦'}
    </Text>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => (
            <TabIcon name={route.name} focused={focused} />
          ),
          tabBarActiveTintColor: '#4CAF50',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: styles.tabBar,
          headerStyle: styles.header,
          headerTintColor: '#333',
          headerTitleStyle: styles.headerTitle,
        })}
      >
        <Tab.Screen
          name="Explore"
          component={ExploreScreen}
          options={{ title: 'Explore' }}
        />
        <Tab.Screen
          name="Inventory"
          component={InventoryScreen}
          options={{ title: 'Inventory' }}
        />
        <Tab.Screen
          name="Crafting"
          component={CraftingScreen}
          options={{ title: 'Crafting' }}
        />
        <Tab.Screen
          name="Tech"
          component={TechTreeScreen}
          options={{ title: 'Tech Tree' }}
        />
        <Tab.Screen
          name="Village"
          component={VillageScreen}
          options={{ title: 'Village' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
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
