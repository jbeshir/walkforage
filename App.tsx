// WalkForage - Location-Based Resource Gathering Game
// Main App with Tab Navigation

import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Modal } from 'react-native';
import { useHealthRationaleIntent } from './src/hooks/useHealthRationaleIntent';
import { HealthPermissionRationale } from './src/components/HealthPermissionRationale';
import { GameStateProvider } from './src/hooks/useGameState';
import { ThemeProvider, useTheme } from './src/hooks/useTheme';
import { GeoDataProvider } from './src/providers/GeoDataProvider';

// Import screens
import ForageScreen from './src/screens/ForageScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import CraftingScreen from './src/screens/CraftingScreen';
import TechTreeScreen from './src/screens/TechTreeScreen';
import CheatScreen from './src/screens/CheatScreen';

const Tab = createBottomTabNavigator();

// Simple icon component (replace with proper icons later)
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Forage: '🗺️',
    Materials: '🪨',
    Tools: '🔨',
    Tech: '⚙️',
    Cheat: '🔧',
  };

  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icons[name] || '📦'}</Text>
  );
}

// Inner app component that uses theme
function AppContent() {
  const { theme, isDark } = useTheme();
  const { colors } = theme;

  // Handle Health Connect rationale intent (when user taps privacy policy in HC dialog)
  const { showRationale, dismissRationale } = useHealthRationaleIntent();

  // Cheat mode state - persists until app restart
  const [cheatModeEnabled, setCheatModeEnabled] = useState(false);

  const enableCheatMode = useCallback(() => {
    setCheatModeEnabled(true);
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Health Connect rationale modal - shown when launched from HC settings */}
      <Modal visible={showRationale} animationType="slide" onRequestClose={dismissRationale}>
        <HealthPermissionRationale onClose={dismissRationale} />
      </Modal>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
          tabBarActiveTintColor: route.name === 'Cheat' ? colors.cheat : colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 8,
            paddingBottom: 4,
          },
          headerStyle: {
            backgroundColor: colors.surface,
            elevation: 2,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: styles.headerTitle,
        })}
      >
        <Tab.Screen name="Forage" component={ForageScreen} options={{ title: 'Forage' }} />
        <Tab.Screen name="Materials" component={InventoryScreen} options={{ title: 'Materials' }} />
        <Tab.Screen name="Tools" component={CraftingScreen} options={{ title: 'Tools' }} />
        <Tab.Screen name="Tech" options={{ title: 'Tech Tree' }}>
          {() => <TechTreeScreen onEnableCheatMode={enableCheatMode} />}
        </Tab.Screen>
        {cheatModeEnabled && (
          <Tab.Screen
            name="Cheat"
            component={CheatScreen}
            options={{
              title: 'Cheat',
              tabBarActiveTintColor: colors.cheat,
              headerStyle: {
                backgroundColor: colors.surface,
                elevation: 2,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
              },
              headerTintColor: colors.cheat,
            }}
          />
        )}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <GameStateProvider>
        <GeoDataProvider>
          <AppContent />
        </GeoDataProvider>
      </GameStateProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 24,
  },
  tabIconFocused: {
    transform: [{ scale: 1.1 }],
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 18,
  },
});
