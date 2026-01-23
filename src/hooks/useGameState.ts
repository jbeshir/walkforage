// Game state management hook for WalkForage
// Handles inventory and tech progress
// Uses React Context to share state across all components

import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  createContext,
  ReactNode,
  useRef,
  useMemo,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Inventory, ResourceStack, createEmptyInventory } from '../types/resources';
import { getAllMaterialTypes } from '../config/materials';
import { OwnedTool, OwnedComponent, CraftingJob, Tool, CraftedComponent } from '../types/tools';
import {
  CraftingService,
  CraftCheckResult,
  CraftParams,
  CraftingState,
} from '../services/CraftingService';

const STORAGE_KEY = 'walkforage_gamestate';

export interface GameState {
  inventory: Inventory;
  unlockedTechs: string[];
  ownedTools: OwnedTool[];
  ownedComponents: OwnedComponent[];
  craftingQueue: CraftingJob[];
  explorationPoints: number;
  // Step gathering state (inlined from PersistedStepGatheringState)
  availableSteps: number;
  lastSyncTimestamp: number;
  totalStepsGathered: number;
}

const INITIAL_STATE: GameState = {
  inventory: createEmptyInventory(),
  unlockedTechs: [], // Start with no techs unlocked
  ownedTools: [],
  ownedComponents: [],
  craftingQueue: [],
  explorationPoints: 0,
  availableSteps: 0,
  lastSyncTimestamp: 0,
  totalStepsGathered: 0,
};

// Parameters for crafting (used by both tools and components)
export interface CraftItemParams extends CraftParams {
  craftable: Tool | CraftedComponent;
}

export interface GameStateHook {
  state: GameState;
  isLoading: boolean;

  // Inventory actions
  addResource: (category: keyof Inventory, resourceId: string, quantity: number) => void;
  removeResource: (category: keyof Inventory, resourceId: string, quantity: number) => boolean;
  hasResource: (category: keyof Inventory, resourceId: string, quantity: number) => boolean;
  getResourceCount: (category: keyof Inventory, resourceId: string) => number;

  // Tech actions
  unlockTech: (techId: string) => void;
  hasTech: (techId: string) => boolean;

  // Tool inventory actions
  hasTool: (toolId: string) => boolean;
  getOwnedTools: (toolId: string) => OwnedTool[];
  getBestTool: (toolId: string) => OwnedTool | null;
  getOwnedComponents: (componentId: string) => OwnedComponent[];

  // Unified crafting via CraftingService
  canCraft: (craftable: Tool | CraftedComponent) => CraftCheckResult;
  craft: (params: CraftItemParams) => { success: boolean; error?: string };

  // Exploration actions
  addExplorationPoints: (points: number) => void;

  // Step gathering actions
  syncSteps: (newSteps: number) => void;
  spendSteps: (amount: number) => void;
  getStepGatheringState: () => {
    availableSteps: number;
    lastSyncTimestamp: number;
    totalStepsGathered: number;
  };

  // Persistence
  saveGame: () => Promise<void>;
  loadGame: () => Promise<void>;
  resetGame: () => Promise<void>;
}

// Create context with undefined default (will be provided by GameStateProvider)
const GameStateContext = createContext<GameStateHook | undefined>(undefined);

// Provider component props
interface GameStateProviderProps {
  children: ReactNode;
}

// Throttle interval for auto-save (saves at most once per this interval during activity)
const SAVE_THROTTLE_MS = 3000;

// Provider component that holds the shared state
export function GameStateProvider({ children }: GameStateProviderProps) {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const stateRef = useRef<GameState>(state);

  // Keep stateRef in sync with state for use in callbacks
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const loadGame = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<GameState>;
        // Merge inventories - ensure all material types exist
        const mergedInventory = createEmptyInventory();
        if (parsed.inventory) {
          for (const type of getAllMaterialTypes()) {
            if (parsed.inventory[type]) {
              mergedInventory[type] = parsed.inventory[type];
            }
          }
        }
        // Merge with initial state to handle missing fields
        setState({
          ...INITIAL_STATE,
          ...parsed,
          inventory: mergedInventory,
        });
      }
    } catch (error) {
      console.error('Failed to load game:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save using ref so it can be called from AppState listener without stale closure
  const saveGameImmediate = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
      lastSaveTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to save game:', error);
    }
  }, []);

  // Public save function that uses current state
  const saveGame = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      lastSaveTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to save game:', error);
    }
  }, [state]);

  // Throttled save: saves immediately if throttle period has passed,
  // otherwise schedules a save for the end of the throttle period
  const throttledSave = useCallback(() => {
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTimeRef.current;

    // Clear any pending save
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }

    if (timeSinceLastSave >= SAVE_THROTTLE_MS) {
      // Enough time has passed, save immediately
      saveGameImmediate();
    } else {
      // Schedule save for when throttle period ends
      const timeUntilNextSave = SAVE_THROTTLE_MS - timeSinceLastSave;
      pendingSaveRef.current = setTimeout(() => {
        saveGameImmediate();
        pendingSaveRef.current = null;
      }, timeUntilNextSave);
    }
  }, [saveGameImmediate]);

  const resetGame = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setState(INITIAL_STATE);
    } catch (error) {
      console.error('Failed to reset game:', error);
    }
  }, []);

  // Load game on mount
  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // Save when app goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Cancel any pending throttled save and save immediately
        if (pendingSaveRef.current) {
          clearTimeout(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
        saveGameImmediate();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [saveGameImmediate]);

  // Auto-save periodically (backup, in case throttled saves miss something)
  useEffect(() => {
    const interval = setInterval(() => {
      saveGame();
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [saveGame]);

  // Throttled save on state changes (after initial load)
  // Unlike debounce, throttle guarantees saves happen during sustained activity
  useEffect(() => {
    if (!isLoading) {
      throttledSave();
    }

    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
    };
  }, [state, isLoading, throttledSave]);

  // Inventory helpers
  const findResourceIndex = (stacks: ResourceStack[], resourceId: string): number => {
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

  const getResourceCount = useCallback(
    (category: keyof Inventory, resourceId: string): number => {
      const stacks = state.inventory[category];
      const stack = stacks.find((s) => s.resourceId === resourceId);
      return stack?.quantity || 0;
    },
    [state.inventory]
  );

  // Tech helpers
  const unlockTech = useCallback((techId: string) => {
    setState((prev) => ({
      ...prev,
      unlockedTechs: [...prev.unlockedTechs, techId],
    }));
  }, []);

  const hasTech = useCallback(
    (techId: string): boolean => {
      return state.unlockedTechs.includes(techId);
    },
    [state.unlockedTechs]
  );

  // Tool inventory helpers
  const getOwnedTools = useCallback(
    (toolId: string): OwnedTool[] => {
      return state.ownedTools.filter((t) => t.toolId === toolId);
    },
    [state.ownedTools]
  );

  const hasTool = useCallback(
    (toolId: string): boolean => {
      return getOwnedTools(toolId).length > 0;
    },
    [getOwnedTools]
  );

  const getBestTool = useCallback(
    (toolId: string): OwnedTool | null => {
      const owned = getOwnedTools(toolId);
      if (owned.length === 0) return null;

      // Return the one with highest quality
      return owned.reduce((best, current) => (current.quality > best.quality ? current : best));
    },
    [getOwnedTools]
  );

  const getOwnedComponents = useCallback(
    (componentId: string): OwnedComponent[] => {
      return state.ownedComponents.filter((c) => c.componentId === componentId);
    },
    [state.ownedComponents]
  );

  // Helper to get CraftingState from GameState
  const getCraftingState = useCallback((): CraftingState => {
    return {
      inventory: state.inventory,
      unlockedTechs: state.unlockedTechs,
      ownedTools: state.ownedTools,
      ownedComponents: state.ownedComponents,
    };
  }, [state.inventory, state.unlockedTechs, state.ownedTools, state.ownedComponents]);

  // Unified canCraft using CraftingService
  const canCraft = useCallback(
    (craftable: Tool | CraftedComponent): CraftCheckResult => {
      return CraftingService.canCraft(craftable, getCraftingState());
    },
    [getCraftingState]
  );

  // Unified craft using CraftingService
  const craft = useCallback(
    (params: CraftItemParams): { success: boolean; error?: string } => {
      const { craftable, selectedMaterials, selectedComponentIds, selectedFoods } = params;

      const result = CraftingService.craft(
        craftable,
        { selectedMaterials, selectedComponentIds, selectedFoods },
        getCraftingState()
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Apply the new state from CraftingService
      setState((prev) => ({
        ...prev,
        inventory: result.newState.inventory,
        ownedTools: result.newState.ownedTools,
        ownedComponents: result.newState.ownedComponents,
      }));

      return { success: true };
    },
    [getCraftingState]
  );

  // Exploration helpers
  const addExplorationPoints = useCallback((points: number) => {
    setState((prev) => ({
      ...prev,
      explorationPoints: prev.explorationPoints + points,
    }));
  }, []);

  // Step gathering helpers
  const syncSteps = useCallback((newSteps: number) => {
    setState((prev) => ({
      ...prev,
      availableSteps: prev.availableSteps + newSteps,
      lastSyncTimestamp: Date.now(),
    }));
  }, []);

  const spendSteps = useCallback((amount: number) => {
    setState((prev) => ({
      ...prev,
      availableSteps: Math.max(0, prev.availableSteps - amount),
      totalStepsGathered: prev.totalStepsGathered + amount,
    }));
  }, []);

  // Use stateRef to return truly fresh state, avoiding stale closure issues
  const getStepGatheringState = useCallback(() => {
    return {
      availableSteps: stateRef.current.availableSteps,
      lastSyncTimestamp: stateRef.current.lastSyncTimestamp,
      totalStepsGathered: stateRef.current.totalStepsGathered,
    };
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  // Callbacks are stable (useCallback with empty/stable deps), so only state/isLoading matter
  const value: GameStateHook = useMemo(
    () => ({
      state,
      isLoading,
      addResource,
      removeResource,
      hasResource,
      getResourceCount,
      unlockTech,
      hasTech,
      hasTool,
      getOwnedTools,
      getBestTool,
      getOwnedComponents,
      canCraft,
      craft,
      addExplorationPoints,
      syncSteps,
      spendSteps,
      getStepGatheringState,
      saveGame,
      loadGame,
      resetGame,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, isLoading]
  );

  return React.createElement(GameStateContext.Provider, { value }, children);
}

// Hook to consume game state from context
export function useGameState(): GameStateHook {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
}
