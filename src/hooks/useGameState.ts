// Game state management hook for WalkForage
// Handles inventory, tech progress, and village state

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Inventory, ResourceStack } from '../types/resources';
import { TechProgress } from '../types/tech';
import { Village, PlacedBuilding } from '../types/village';
import {
  PlayerToolInventory,
  OwnedTool,
  CraftingJob,
  MaterialTier,
  ToolRequirement,
  isTierAtLeast,
  QUALITY_MULTIPLIERS,
} from '../types/tools';
import { getToolById, getComponentById } from '../data/tools';
import { STONES_BY_ID } from '../data/stones';
import { WOODS_BY_ID } from '../data/woods';

/**
 * Determine the inventory category for a resource ID by looking it up in the data.
 * Falls back to 'stones' if not found (safest default for unknown resources).
 */
function getResourceCategory(resourceId: string): keyof Inventory {
  // Check woods first
  if (WOODS_BY_ID[resourceId]) {
    return 'woods';
  }

  // Check stones - ores are a subcategory of stones with category === 'ore'
  const stone = STONES_BY_ID[resourceId];
  if (stone) {
    return stone.category === 'ore' ? 'ores' : 'stones';
  }

  // Fallback for unknown resources
  return 'stones';
}

const STORAGE_KEY = 'walkforage_gamestate';

export interface GameState {
  inventory: Inventory;
  techProgress: TechProgress;
  toolInventory: PlayerToolInventory;
  craftingQueue: CraftingJob[];
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
    unlockedTechs: ['flint_knapping'], // Start with basic knapping unlocked
    currentResearch: null,
    researchProgress: 0,
  },
  toolInventory: {
    ownedTools: [],
    componentInventory: {},
  },
  craftingQueue: [],
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

  // Tool inventory actions
  hasTool: (toolId: string, minTier?: MaterialTier) => boolean;
  getOwnedTools: (toolId: string) => OwnedTool[];
  getBestTool: (toolId: string, minTier?: MaterialTier) => OwnedTool | null;
  canCraftTool: (toolId: string) => { canCraft: boolean; missingRequirements: string[] };
  canCraftComponent: (componentId: string) => { canCraft: boolean; missingRequirements: string[] };
  craftTool: (toolId: string) => boolean;
  craftComponent: (componentId: string) => boolean;
  useTool: (instanceId: string, durabilityLoss: number) => void;
  repairTool: (instanceId: string) => boolean;

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

  const loadGame = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<GameState>;
        // Merge with initial state to handle missing fields from old saves
        setState({
          ...INITIAL_STATE,
          ...parsed,
          // Ensure nested objects have defaults
          inventory: { ...INITIAL_STATE.inventory, ...parsed.inventory },
          techProgress: { ...INITIAL_STATE.techProgress, ...parsed.techProgress },
          toolInventory: {
            ...INITIAL_STATE.toolInventory,
            ...(parsed.toolInventory || {}),
          },
          craftingQueue: parsed.craftingQueue || INITIAL_STATE.craftingQueue,
          village: { ...INITIAL_STATE.village, ...parsed.village },
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      console.error('Failed to save game:', error);
    }
  }, [state]);

  const resetGame = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setState(INITIAL_STATE);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to reset game:', error);
    }
  }, []);

  // Load game on mount
  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // Auto-save periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveGame();
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [saveGame]);

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

  // Tool inventory helpers
  const getOwnedTools = useCallback(
    (toolId: string): OwnedTool[] => {
      return state.toolInventory.ownedTools.filter((t) => t.toolId === toolId);
    },
    [state.toolInventory.ownedTools]
  );

  const hasTool = useCallback(
    (toolId: string, minTier?: MaterialTier): boolean => {
      const tool = getToolById(toolId);
      if (!tool) return false;

      const owned = getOwnedTools(toolId);
      if (owned.length === 0) return false;

      if (minTier) {
        return isTierAtLeast(tool.tier, minTier);
      }
      return true;
    },
    [getOwnedTools]
  );

  const getBestTool = useCallback(
    (toolId: string, minTier?: MaterialTier): OwnedTool | null => {
      const owned = getOwnedTools(toolId);
      if (owned.length === 0) return null;

      const tool = getToolById(toolId);
      if (!tool) return null;

      if (minTier && !isTierAtLeast(tool.tier, minTier)) {
        return null;
      }

      // Return the one with highest durability
      return owned.reduce((best, current) =>
        current.currentDurability > best.currentDurability ? current : best
      );
    },
    [getOwnedTools]
  );

  const canCraftComponent = useCallback(
    (componentId: string): { canCraft: boolean; missingRequirements: string[] } => {
      const component = getComponentById(componentId);
      if (!component) {
        return { canCraft: false, missingRequirements: [`Unknown component: ${componentId}`] };
      }

      const missing: string[] = [];

      // Check tech requirement
      if (!state.techProgress.unlockedTechs.includes(component.requiredTech)) {
        missing.push(`Tech: ${component.requiredTech}`);
      }

      // Check tool requirements
      for (const req of component.requiredTools) {
        if (!hasTool(req.toolId, req.minTier)) {
          missing.push(`Tool: ${req.toolId} (${req.minTier}+)`);
        }
      }

      // Check material requirements
      for (const mat of component.materials) {
        const category = getResourceCategory(mat.resourceId);
        if (!hasResource(category, mat.resourceId, mat.quantity)) {
          missing.push(`Material: ${mat.quantity}x ${mat.resourceId}`);
        }
      }

      return { canCraft: missing.length === 0, missingRequirements: missing };
    },
    [state.techProgress.unlockedTechs, hasTool, hasResource]
  );

  const canCraftTool = useCallback(
    (toolId: string): { canCraft: boolean; missingRequirements: string[] } => {
      const tool = getToolById(toolId);
      if (!tool) {
        return { canCraft: false, missingRequirements: [`Unknown tool: ${toolId}`] };
      }

      const missing: string[] = [];

      // Check tech requirement
      if (!state.techProgress.unlockedTechs.includes(tool.requiredTech)) {
        missing.push(`Tech: ${tool.requiredTech}`);
      }

      // Check tool requirements
      for (const req of tool.requiredTools) {
        if (!hasTool(req.toolId, req.minTier)) {
          missing.push(`Tool: ${req.toolId} (${req.minTier}+)`);
        }
      }

      // Check component requirements
      for (const comp of tool.requiredComponents) {
        const owned = state.toolInventory.componentInventory[comp.componentId] || 0;
        if (owned < comp.quantity) {
          missing.push(`Component: ${comp.quantity}x ${comp.componentId}`);
        }
      }

      // Check material requirements
      for (const mat of tool.materials) {
        const category = getResourceCategory(mat.resourceId);
        if (!hasResource(category, mat.resourceId, mat.quantity)) {
          missing.push(`Material: ${mat.quantity}x ${mat.resourceId}`);
        }
      }

      return { canCraft: missing.length === 0, missingRequirements: missing };
    },
    [state.techProgress.unlockedTechs, state.toolInventory.componentInventory, hasTool, hasResource]
  );

  const craftComponent = useCallback(
    (componentId: string): boolean => {
      const { canCraft } = canCraftComponent(componentId);
      if (!canCraft) return false;

      const component = getComponentById(componentId);
      if (!component) return false;

      setState((prev) => {
        // Consume materials (simplified - just update component inventory)
        const newComponentInventory = { ...prev.toolInventory.componentInventory };
        newComponentInventory[componentId] = (newComponentInventory[componentId] || 0) + 1;

        // Use durability from required tools
        const newOwnedTools = prev.toolInventory.ownedTools.map((t) => {
          const req = component.requiredTools.find((r: ToolRequirement) => r.toolId === t.toolId);
          if (req && req.consumesDurability > 0) {
            return { ...t, currentDurability: t.currentDurability - req.consumesDurability };
          }
          return t;
        });

        return {
          ...prev,
          toolInventory: {
            ...prev.toolInventory,
            ownedTools: newOwnedTools.filter((t) => t.currentDurability > 0),
            componentInventory: newComponentInventory,
          },
        };
      });

      return true;
    },
    [canCraftComponent]
  );

  const craftTool = useCallback(
    (toolId: string): boolean => {
      const { canCraft } = canCraftTool(toolId);
      if (!canCraft) return false;

      const tool = getToolById(toolId);
      if (!tool) return false;

      setState((prev) => {
        // Consume components
        const newComponentInventory = { ...prev.toolInventory.componentInventory };
        for (const comp of tool.requiredComponents) {
          newComponentInventory[comp.componentId] =
            (newComponentInventory[comp.componentId] || 0) - comp.quantity;
        }

        // Use durability from required tools
        let newOwnedTools = prev.toolInventory.ownedTools.map((t) => {
          const req = tool.requiredTools.find((r: ToolRequirement) => r.toolId === t.toolId);
          if (req && req.consumesDurability > 0) {
            return { ...t, currentDurability: t.currentDurability - req.consumesDurability };
          }
          return t;
        });

        // Determine quality (simple RNG for now)
        const qualityRoll = Math.random();
        let quality: OwnedTool['quality'] = 'normal';
        if (qualityRoll < 0.1) quality = 'poor';
        else if (qualityRoll > 0.9) quality = 'excellent';
        else if (qualityRoll > 0.75) quality = 'good';

        // Create the new tool
        const newTool: OwnedTool = {
          instanceId: `${toolId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          toolId,
          currentDurability: tool.stats.durability * QUALITY_MULTIPLIERS[quality],
          timesRepaired: 0,
          quality,
          createdAt: Date.now(),
        };

        // Remove broken tools, add new tool
        newOwnedTools = newOwnedTools.filter((t) => t.currentDurability > 0);
        newOwnedTools.push(newTool);

        return {
          ...prev,
          toolInventory: {
            ...prev.toolInventory,
            ownedTools: newOwnedTools,
            componentInventory: newComponentInventory,
          },
        };
      });

      return true;
    },
    [canCraftTool]
  );

  const useTool = useCallback((instanceId: string, durabilityLoss: number) => {
    setState((prev) => ({
      ...prev,
      toolInventory: {
        ...prev.toolInventory,
        ownedTools: prev.toolInventory.ownedTools
          .map((t) =>
            t.instanceId === instanceId
              ? { ...t, currentDurability: t.currentDurability - durabilityLoss }
              : t
          )
          .filter((t) => t.currentDurability > 0),
      },
    }));
  }, []);

  const repairTool = useCallback(
    (instanceId: string): boolean => {
      const owned = state.toolInventory.ownedTools.find((t) => t.instanceId === instanceId);
      if (!owned) return false;

      const tool = getToolById(owned.toolId);
      if (!tool || !tool.stats.canRepair || !tool.stats.repairMaterial) return false;

      // Check if we have repair material
      const repairMat = tool.stats.repairMaterial;
      const category = getResourceCategory(repairMat);
      if (!hasResource(category, repairMat, 1)) return false;

      setState((prev) => ({
        ...prev,
        toolInventory: {
          ...prev.toolInventory,
          ownedTools: prev.toolInventory.ownedTools.map((t) => {
            if (t.instanceId !== instanceId) return t;
            // Repair degrades max durability slightly over time
            const degradation = 0.95 ** t.timesRepaired;
            const maxDur = tool.stats.maxDurability * degradation * QUALITY_MULTIPLIERS[t.quality];
            return {
              ...t,
              currentDurability: maxDur,
              timesRepaired: t.timesRepaired + 1,
            };
          }),
        },
      }));

      return true;
    },
    [state.toolInventory.ownedTools, hasResource]
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
    hasTool,
    getOwnedTools,
    getBestTool,
    canCraftTool,
    canCraftComponent,
    craftTool,
    craftComponent,
    useTool,
    repairTool,
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
