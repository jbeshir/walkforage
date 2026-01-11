// Game state management hook for WalkForage
// Handles inventory, tech progress, and village state

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Inventory, ResourceStack } from '../types/resources';
import { TechProgress, ToolSet } from '../types/tech';
import { Village, PlacedBuilding } from '../types/village';

const STORAGE_KEY = 'walkforage_gamestate';

export interface GameState {
  inventory: Inventory;
  techProgress: TechProgress;
  tools: ToolSet;
  village: Village;
  explorationPoints: number;
  totalDistanceWalked: number;
  discoveredZones: string[];
  lastSaveTime: number;
}

const INITIAL_STATE: GameState = {
  inventory: {
    stones: [],
    woods: [],
    ores: [],
    other: [],
  },
  techProgress: {
    unlockedTechs: [],
    currentResearch: null,
    researchProgress: 0,
  },
  tools: {
    pickaxe: 'none',
    axe: 'none',
    hammer: 'none',
    saw: 'none',
    chisel: 'none',
  },
  village: {
    name: 'New Settlement',
    buildings: [],
    totalWorkers: 1,
    availableWorkers: 1,
    gridSize: { width: 10, height: 10 },
  },
  explorationPoints: 0,
  totalDistanceWalked: 0,
  discoveredZones: [],
  lastSaveTime: Date.now(),
};

export interface GameStateHook {
  state: GameState;
  isLoading: boolean;

  // Inventory actions
  addResource: (category: keyof Inventory, resourceId: string, quantity: number) => void;
  removeResource: (category: keyof Inventory, resourceId: string, quantity: number) => boolean;
  hasResource: (category: keyof Inventory, resourceId: string, quantity: number) => boolean;

  // Tech actions
  unlockTech: (techId: string) => void;
  hasTech: (techId: string) => boolean;

  // Exploration actions
  addExplorationPoints: (points: number) => void;
  addDistance: (meters: number) => void;
  discoverZone: (zoneId: string) => void;

  // Village actions
  placeBuilding: (building: PlacedBuilding) => void;
  upgradeBuilding: (buildingId: string) => void;

  // Persistence
  saveGame: () => Promise<void>;
  loadGame: () => Promise<void>;
  resetGame: () => Promise<void>;
}

export function useGameState(): GameStateHook {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);

  // Load game on mount
  useEffect(() => {
    loadGame();
  }, []);

  // Auto-save periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveGame();
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [state]);

  const loadGame = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GameState;
        setState(parsed);
      }
    } catch (error) {
      console.error('Failed to load game:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveGame = useCallback(async () => {
    try {
      const toSave = { ...state, lastSaveTime: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save game:', error);
    }
  }, [state]);

  const resetGame = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setState(INITIAL_STATE);
    } catch (error) {
      console.error('Failed to reset game:', error);
    }
  }, []);

  // Inventory helpers
  const findResourceIndex = (
    stacks: ResourceStack[],
    resourceId: string
  ): number => {
    return stacks.findIndex((s) => s.resourceId === resourceId);
  };

  const addResource = useCallback(
    (category: keyof Inventory, resourceId: string, quantity: number) => {
      setState((prev) => {
        const stacks = [...prev.inventory[category]];
        const index = findResourceIndex(stacks, resourceId);

        if (index >= 0) {
          stacks[index] = {
            ...stacks[index],
            quantity: stacks[index].quantity + quantity,
          };
        } else {
          stacks.push({ resourceId, quantity });
        }

        return {
          ...prev,
          inventory: { ...prev.inventory, [category]: stacks },
        };
      });
    },
    []
  );

  const removeResource = useCallback(
    (category: keyof Inventory, resourceId: string, quantity: number): boolean => {
      let success = false;
      setState((prev) => {
        const stacks = [...prev.inventory[category]];
        const index = findResourceIndex(stacks, resourceId);

        if (index >= 0 && stacks[index].quantity >= quantity) {
          stacks[index] = {
            ...stacks[index],
            quantity: stacks[index].quantity - quantity,
          };
          if (stacks[index].quantity === 0) {
            stacks.splice(index, 1);
          }
          success = true;
          return {
            ...prev,
            inventory: { ...prev.inventory, [category]: stacks },
          };
        }
        return prev;
      });
      return success;
    },
    []
  );

  const hasResource = useCallback(
    (category: keyof Inventory, resourceId: string, quantity: number): boolean => {
      const stacks = state.inventory[category];
      const stack = stacks.find((s) => s.resourceId === resourceId);
      return stack !== undefined && stack.quantity >= quantity;
    },
    [state.inventory]
  );

  // Tech helpers
  const unlockTech = useCallback((techId: string) => {
    setState((prev) => ({
      ...prev,
      techProgress: {
        ...prev.techProgress,
        unlockedTechs: [...prev.techProgress.unlockedTechs, techId],
      },
    }));
  }, []);

  const hasTech = useCallback(
    (techId: string): boolean => {
      return state.techProgress.unlockedTechs.includes(techId);
    },
    [state.techProgress.unlockedTechs]
  );

  // Exploration helpers
  const addExplorationPoints = useCallback((points: number) => {
    setState((prev) => ({
      ...prev,
      explorationPoints: prev.explorationPoints + points,
    }));
  }, []);

  const addDistance = useCallback((meters: number) => {
    setState((prev) => ({
      ...prev,
      totalDistanceWalked: prev.totalDistanceWalked + meters,
    }));
  }, []);

  const discoverZone = useCallback((zoneId: string) => {
    setState((prev) => {
      if (prev.discoveredZones.includes(zoneId)) return prev;
      return {
        ...prev,
        discoveredZones: [...prev.discoveredZones, zoneId],
      };
    });
  }, []);

  // Village helpers
  const placeBuilding = useCallback((building: PlacedBuilding) => {
    setState((prev) => ({
      ...prev,
      village: {
        ...prev.village,
        buildings: [...prev.village.buildings, building],
      },
    }));
  }, []);

  const upgradeBuilding = useCallback((buildingId: string) => {
    setState((prev) => ({
      ...prev,
      village: {
        ...prev.village,
        buildings: prev.village.buildings.map((b) =>
          b.id === buildingId ? { ...b, level: b.level + 1 } : b
        ),
      },
    }));
  }, []);

  return {
    state,
    isLoading,
    addResource,
    removeResource,
    hasResource,
    unlockTech,
    hasTech,
    addExplorationPoints,
    addDistance,
    discoverZone,
    placeBuilding,
    upgradeBuilding,
    saveGame,
    loadGame,
    resetGame,
  };
}
