import React, { useEffect, ReactNode } from 'react';
import { Inventory } from '../types/resources';
import { OwnedTool, OwnedComponent, Tool, CraftedComponent } from '../types/tools';
import { CraftCheckResult } from '../services/CraftingService';
import { useGameStore } from '../store/gameStore';
import { loadGame, saveGame, resetGame, startPersistence } from '../store/persistence';

import type { GameState, CraftItemParams } from '../store/gameStore';
export type { GameState, CraftItemParams };

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

export function GameStateProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void loadGame();
  }, []);

  useEffect(() => startPersistence(), []);

  return React.createElement(React.Fragment, null, children);
}

export function useGameState(): GameStateHook {
  const s = useGameStore();
  return {
    state: {
      inventory: s.inventory,
      unlockedTechs: s.unlockedTechs,
      ownedTools: s.ownedTools,
      ownedComponents: s.ownedComponents,
      craftingQueue: s.craftingQueue,
      explorationPoints: s.explorationPoints,
      availableSteps: s.availableSteps,
      lastSyncTimestamp: s.lastSyncTimestamp,
      totalStepsGathered: s.totalStepsGathered,
    },
    isLoading: s.isLoading,
    saveError: s.saveError,
    addResource: s.addResource,
    removeResource: s.removeResource,
    hasResource: s.hasResource,
    getResourceCount: s.getResourceCount,
    unlockTech: s.unlockTech,
    hasTech: s.hasTech,
    hasTool: s.hasTool,
    getOwnedTools: s.getOwnedTools,
    getBestTool: s.getBestTool,
    getOwnedComponents: s.getOwnedComponents,
    canCraft: s.canCraft,
    craft: s.craft,
    addExplorationPoints: s.addExplorationPoints,
    syncSteps: s.syncSteps,
    spendSteps: s.spendSteps,
    getStepGatheringState: s.getStepGatheringState,
    saveGame,
    loadGame,
    resetGame,
  };
}
