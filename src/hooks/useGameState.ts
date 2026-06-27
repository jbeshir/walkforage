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
import { MaterialType, getAllMaterialTypes } from '../config/materials';
import { OwnedTool, OwnedComponent, CraftingJob, Tool, CraftedComponent } from '../types/tools';
import {
  CraftingService,
  CraftCheckResult,
  CraftParams,
  CraftingState,
} from '../services/CraftingService';
import {
  addResource as addResourcePure,
  removeResource as removeResourcePure,
  hasResource as hasResourcePure,
  getResourceCount as getResourceCountPure,
} from '../services/InventoryService';
import { hasTech as hasTechPure } from '../services/TechService';

const STORAGE_KEY = 'walkforage_gamestate';
const SCHEMA_VERSION = 1;

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

type PersistedObject = Record<string, unknown>;
type Migration = (obj: PersistedObject) => PersistedObject;

// Ordered migrations keyed by the version they migrate FROM.
// v0 = unversioned legacy save. Identity/tag migration -> v1.
const migrations: Record<number, Migration> = {
  0: (obj) => ({ ...obj, schemaVersion: 1 }),
};

function toPersisted(s: GameState): GameState & { schemaVersion: number } {
  return { ...s, schemaVersion: SCHEMA_VERSION };
}

function versionOf(obj: PersistedObject): number {
  const v = obj.schemaVersion;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

function migratePersisted(obj: PersistedObject): PersistedObject {
  let current = obj;
  let version = versionOf(current);
  while (version < SCHEMA_VERSION) {
    const migration = migrations[version];
    if (!migration) {
      throw new Error(`Missing migration from schema version ${version}`);
    }
    current = migration(current);
    const next = versionOf(current);
    if (next <= version) {
      throw new Error(`Migration from version ${version} did not advance schemaVersion`);
    }
    version = next;
  }
  return current;
}

function sanitiseCount(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : fallback;
}

function asArrayOr<T>(x: unknown, fallback: T[]): T[] {
  return Array.isArray(x) ? (x as T[]) : fallback;
}

function sanitiseStacks(x: unknown): ResourceStack[] {
  if (!Array.isArray(x)) return [];
  const out: ResourceStack[] = [];
  for (const el of x) {
    if (el === null || typeof el !== 'object' || Array.isArray(el)) continue;
    const rec = el as Record<string, unknown>;
    if (typeof rec.resourceId !== 'string' || rec.resourceId.length === 0) continue;
    out.push({ resourceId: rec.resourceId, quantity: sanitiseCount(rec.quantity, 0) });
  }
  return out;
}

// Parameters for crafting (used by both tools and components)
export interface CraftItemParams extends CraftParams {
  craftable: Tool | CraftedComponent;
}

export interface GameStateHook {
  state: GameState;
  isLoading: boolean;
  saveError: boolean;

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
const SAVE_FAILURE_THRESHOLD = 3;

// Provider component that holds the shared state
export function GameStateProvider({ children }: GameStateProviderProps) {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const stateRef = useRef<GameState>(state);
  const savePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const saveFailureCountRef = useRef(0);

  // Keep stateRef in sync with state for use in callbacks
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const loadGame = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const rawParsed = JSON.parse(saved) as unknown;
        // Migrate unversioned/older saves up to current schema before validation.
        const base: PersistedObject =
          rawParsed !== null && typeof rawParsed === 'object' && !Array.isArray(rawParsed)
            ? (rawParsed as PersistedObject)
            : {};
        const migrated = migratePersisted(base);

        // Rebuild inventory: only accept well-formed stacks per material type.
        const mergedInventory = createEmptyInventory();
        const migratedInventory =
          migrated.inventory !== null &&
          typeof migrated.inventory === 'object' &&
          !Array.isArray(migrated.inventory)
            ? (migrated.inventory as Record<string, unknown>)
            : {};
        for (const type of getAllMaterialTypes()) {
          mergedInventory[type] = sanitiseStacks(migratedInventory[type]);
        }

        setState({
          ...INITIAL_STATE,
          inventory: mergedInventory,
          unlockedTechs: asArrayOr(migrated.unlockedTechs, INITIAL_STATE.unlockedTechs),
          ownedTools: asArrayOr(migrated.ownedTools, INITIAL_STATE.ownedTools),
          ownedComponents: asArrayOr(migrated.ownedComponents, INITIAL_STATE.ownedComponents),
          craftingQueue: asArrayOr(migrated.craftingQueue, INITIAL_STATE.craftingQueue),
          explorationPoints: sanitiseCount(
            migrated.explorationPoints,
            INITIAL_STATE.explorationPoints
          ),
          availableSteps: sanitiseCount(migrated.availableSteps, INITIAL_STATE.availableSteps),
          totalStepsGathered: sanitiseCount(
            migrated.totalStepsGathered,
            INITIAL_STATE.totalStepsGathered
          ),
          lastSyncTimestamp:
            typeof migrated.lastSyncTimestamp === 'number' &&
            Number.isFinite(migrated.lastSyncTimestamp)
              ? Math.max(0, migrated.lastSyncTimestamp)
              : INITIAL_STATE.lastSyncTimestamp,
        });
      }
    } catch (error) {
      console.error('Failed to load game:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const enqueueSave = useCallback((): Promise<void> => {
    const doWrite = async (): Promise<void> => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(stateRef.current)));
      lastSaveTimeRef.current = Date.now();
      saveFailureCountRef.current = 0;
      setSaveError(false);
    };
    savePromiseRef.current = savePromiseRef.current.then(doWrite).catch((error: unknown) => {
      saveFailureCountRef.current += 1;
      console.error('Failed to save game:', error);
      if (saveFailureCountRef.current >= SAVE_FAILURE_THRESHOLD) {
        setSaveError(true);
      }
    });
    return savePromiseRef.current;
  }, []);

  const saveGame = useCallback(async (): Promise<void> => {
    await enqueueSave();
  }, [enqueueSave]);

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
      void enqueueSave();
    } else {
      // Schedule save for when throttle period ends
      const timeUntilNextSave = SAVE_THROTTLE_MS - timeSinceLastSave;
      pendingSaveRef.current = setTimeout(() => {
        void enqueueSave();
        pendingSaveRef.current = null;
      }, timeUntilNextSave);
    }
  }, [enqueueSave]);

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
    void loadGame();
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
        void enqueueSave();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [enqueueSave]);

  // Auto-save periodically (backup, in case throttled saves miss something)
  useEffect(() => {
    const interval = setInterval(() => {
      void enqueueSave();
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [enqueueSave]);

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

  // Inventory helpers - delegate to InventoryService pure functions
  const addResource = useCallback(
    (category: keyof Inventory, resourceId: string, quantity: number) => {
      setState((prev) => ({
        ...prev,
        inventory: addResourcePure(prev.inventory, category as MaterialType, resourceId, quantity),
      }));
    },
    []
  );

  const removeResource = useCallback(
    (category: keyof Inventory, resourceId: string, quantity: number): boolean => {
      let success = false;
      setState((prev) => {
        const result = removeResourcePure(
          prev.inventory,
          category as MaterialType,
          resourceId,
          quantity
        );
        if (result) {
          success = true;
          return { ...prev, inventory: result };
        }
        return prev;
      });
      return success;
    },
    []
  );

  const hasResource = useCallback(
    (category: keyof Inventory, resourceId: string, quantity: number): boolean => {
      return hasResourcePure(state.inventory, category as MaterialType, resourceId, quantity);
    },
    [state.inventory]
  );

  const getResourceCount = useCallback(
    (category: keyof Inventory, resourceId: string): number => {
      return getResourceCountPure(state.inventory, category as MaterialType, resourceId);
    },
    [state.inventory]
  );

  // Tech helpers - delegate to TechService pure functions
  const unlockTech = useCallback((techId: string) => {
    setState((prev) => ({
      ...prev,
      unlockedTechs: [...prev.unlockedTechs, techId],
    }));
  }, []);

  const hasTech = useCallback(
    (techId: string): boolean => {
      return hasTechPure(techId, state.unlockedTechs);
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
      saveError,
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
    [state, isLoading, saveError]
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
