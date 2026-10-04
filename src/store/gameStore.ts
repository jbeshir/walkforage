import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Inventory, ResourceStack, createEmptyInventory } from '../types/resources';
import { MaterialType } from '../config/materials';
import { OwnedTool, OwnedComponent, CraftingJob, Tool, CraftedComponent } from '../types/tools';
import { CraftingService, CraftCheckResult, CraftParams } from '../services/CraftingService';
import {
  addResource as addResourcePure,
  removeResource as removeResourcePure,
  hasResource as hasResourcePure,
  getResourceCount as getResourceCountPure,
} from '../services/InventoryService';
import { hasTech as hasTechPure } from '../services/TechService';
import { ledgerSince } from '../services/stepLedger';
import { StepLedger } from '../types/health';

export const STORAGE_KEY = 'walkforage_gamestate';
export const SCHEMA_VERSION = 2;

export type PersistedObject = Record<string, unknown>;
export type Migration = (obj: PersistedObject) => PersistedObject;

// Ordered migrations keyed by the version they migrate FROM.
// v0 = unversioned legacy save. Identity/tag migration -> v1.
// v1 -> v2: the step watermark `lastSyncTimestamp` becomes the step ledger. A save that synced
// starts its ledger at the watermark, so the next sync credits exactly the steps since then; one
// that never synced (0) has no ledger, so its first sync is a new game's welcome credit.
export const migrations: Record<number, Migration> = {
  0: (obj) => ({ ...obj, schemaVersion: 1 }),
  1: ({ lastSyncTimestamp, ...obj }) => ({
    ...obj,
    stepLedger:
      typeof lastSyncTimestamp === 'number' &&
      Number.isFinite(lastSyncTimestamp) &&
      lastSyncTimestamp > 0
        ? ledgerSince(lastSyncTimestamp)
        : null,
    schemaVersion: 2,
  }),
};

export function toPersisted(s: GameData): GameData & { schemaVersion: number } {
  return { ...s, schemaVersion: SCHEMA_VERSION };
}

export function versionOf(obj: PersistedObject): number {
  const v = obj.schemaVersion;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

export function migratePersisted(obj: PersistedObject): PersistedObject {
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

export function sanitiseCount(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : fallback;
}

export function asArrayOr<T>(x: unknown, fallback: T[]): T[] {
  return Array.isArray(x) ? (x as T[]) : fallback;
}

export function sanitiseStacks(x: unknown): ResourceStack[] {
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

export interface GameData {
  inventory: Inventory;
  unlockedTechs: string[];
  ownedTools: OwnedTool[];
  ownedComponents: OwnedComponent[];
  craftingQueue: CraftingJob[];
  explorationPoints: number;
  availableSteps: number;
  totalStepsGathered: number;
  /** What has been credited from the health platform; null until a new game's first sync. */
  stepLedger: StepLedger | null;
}

// Alias for backward compatibility
export type GameState = GameData;

export function createInitialGameData(): GameData {
  return {
    inventory: createEmptyInventory(),
    unlockedTechs: [],
    ownedTools: [],
    ownedComponents: [],
    craftingQueue: [],
    explorationPoints: 0,
    availableSteps: 0,
    totalStepsGathered: 0,
    stepLedger: null,
  };
}

export interface GameStore extends GameData {
  isLoading: boolean;
  saveError: boolean;
  /** The stored game could not be read; saves are blocked so it is never overwritten. */
  loadFailed: boolean;

  // Mutating actions
  addResource: (category: keyof Inventory, resourceId: string, quantity: number) => void;
  removeResource: (category: keyof Inventory, resourceId: string, quantity: number) => boolean;
  unlockTech: (techId: string) => void;
  craft: (params: CraftItemParams) => { success: boolean; error?: string };
  addExplorationPoints: (points: number) => void;
  /** Credit synced steps and store the ledger they were credited against, in one update. */
  applyStepSync: (credited: number, stepLedger: StepLedger) => void;
  /** Add steps without touching the step ledger (cheat screen). */
  addBonusSteps: (amount: number) => void;
  spendSteps: (amount: number) => void;

  // Stable getter methods (read live state via get())
  hasResource: (category: keyof Inventory, resourceId: string, quantity: number) => boolean;
  getResourceCount: (category: keyof Inventory, resourceId: string) => number;
  hasTech: (techId: string) => boolean;
  hasTool: (toolId: string) => boolean;
  getOwnedTools: (toolId: string) => OwnedTool[];
  getBestTool: (toolId: string) => OwnedTool | null;
  getOwnedComponents: (componentId: string) => OwnedComponent[];
  getStepGatheringState: () => {
    availableSteps: number;
    totalStepsGathered: number;
  };
  canCraft: (craftable: Tool | CraftedComponent) => CraftCheckResult;

  // Internal setters used by persistence
  _hydrate: (data: GameData) => void;
  _setLoading: (b: boolean) => void;
  _setSaveError: (b: boolean) => void;
  _setLoadFailed: (b: boolean) => void;
  _reset: () => void;
}

export const selectData = (s: GameStore): GameData => ({
  inventory: s.inventory,
  unlockedTechs: s.unlockedTechs,
  ownedTools: s.ownedTools,
  ownedComponents: s.ownedComponents,
  craftingQueue: s.craftingQueue,
  explorationPoints: s.explorationPoints,
  availableSteps: s.availableSteps,
  totalStepsGathered: s.totalStepsGathered,
  stepLedger: s.stepLedger,
});

// Module-level canCraft memo cache — keyed by craftable, invalidated when any
// of the 4 input slices change.
let cache = new Map<Tool | CraftedComponent, CraftCheckResult>();
let lastDeps: readonly [Inventory, string[], OwnedTool[], OwnedComponent[]] | null = null;

export function __resetCanCraftCache(): void {
  cache = new Map();
  lastDeps = null;
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialGameData(),
    isLoading: true,
    saveError: false,
    loadFailed: false,

    addResource: (category, resourceId, quantity) =>
      set((s) => ({
        inventory: addResourcePure(s.inventory, category as MaterialType, resourceId, quantity),
      })),

    removeResource: (category, resourceId, quantity) => {
      const result = removeResourcePure(
        get().inventory,
        category as MaterialType,
        resourceId,
        quantity
      );
      if (result) {
        set({ inventory: result });
        return true;
      }
      return false;
    },

    unlockTech: (techId) => set((s) => ({ unlockedTechs: [...s.unlockedTechs, techId] })),

    craft: (params) => {
      const { craftable, selectedMaterials, selectedComponentIds, selectedFoods } = params;
      const s = get();
      const result = CraftingService.craft(
        craftable,
        { selectedMaterials, selectedComponentIds, selectedFoods },
        {
          inventory: s.inventory,
          unlockedTechs: s.unlockedTechs,
          ownedTools: s.ownedTools,
          ownedComponents: s.ownedComponents,
        }
      );
      if (!result.success) {
        return { success: false, error: result.error };
      }
      set({
        inventory: result.newState.inventory,
        ownedTools: result.newState.ownedTools,
        ownedComponents: result.newState.ownedComponents,
      });
      return { success: true };
    },

    addExplorationPoints: (points) =>
      set((s) => ({ explorationPoints: s.explorationPoints + points })),

    applyStepSync: (credited, stepLedger) =>
      set((s) => ({
        availableSteps: s.availableSteps + credited,
        stepLedger,
      })),

    addBonusSteps: (amount) => set((s) => ({ availableSteps: s.availableSteps + amount })),

    spendSteps: (amount) =>
      set((s) => ({
        availableSteps: Math.max(0, s.availableSteps - amount),
        totalStepsGathered: s.totalStepsGathered + amount,
      })),

    hasResource: (category, resourceId, quantity) =>
      hasResourcePure(get().inventory, category as MaterialType, resourceId, quantity),

    getResourceCount: (category, resourceId) =>
      getResourceCountPure(get().inventory, category as MaterialType, resourceId),

    hasTech: (techId) => hasTechPure(techId, get().unlockedTechs),

    hasTool: (toolId) => get().ownedTools.some((t) => t.toolId === toolId),

    getOwnedTools: (toolId) => get().ownedTools.filter((t) => t.toolId === toolId),

    getBestTool: (toolId) => {
      const owned = get().ownedTools.filter((t) => t.toolId === toolId);
      if (owned.length === 0) return null;
      return owned.reduce((best, current) => (current.quality > best.quality ? current : best));
    },

    getOwnedComponents: (componentId) =>
      get().ownedComponents.filter((c) => c.componentId === componentId),

    getStepGatheringState: () => {
      const s = get();
      return {
        availableSteps: s.availableSteps,
        totalStepsGathered: s.totalStepsGathered,
      };
    },

    canCraft: (craftable) => {
      const s = get();
      const deps = [s.inventory, s.unlockedTechs, s.ownedTools, s.ownedComponents] as const;
      if (!lastDeps || deps.some((d, i) => d !== lastDeps![i])) {
        cache = new Map();
        lastDeps = deps;
      }
      const hit = cache.get(craftable);
      if (hit) return hit;
      const res = CraftingService.canCraft(craftable, {
        inventory: s.inventory,
        unlockedTechs: s.unlockedTechs,
        ownedTools: s.ownedTools,
        ownedComponents: s.ownedComponents,
      });
      cache.set(craftable, res);
      return res;
    },

    _hydrate: (data) => {
      set(data);
      __resetCanCraftCache();
    },

    _setLoading: (b) => set({ isLoading: b }),

    _setSaveError: (b) => set({ saveError: b }),

    _setLoadFailed: (b) => set({ loadFailed: b }),

    _reset: () => {
      // The stored game has been deleted, so there is no save left for loadFailed to protect.
      set({ ...createInitialGameData(), loadFailed: false });
      __resetCanCraftCache();
    },
  }))
);
