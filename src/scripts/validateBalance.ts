/**
 * Balance Validation Script
 *
 * Simulates playthroughs at 6 geographic locations and validates that
 * progression pacing falls within acceptable bounds.
 *
 * Checks:
 * 1. Era completion gather counts are within bounds
 * 2. All locations can complete the game
 * 3. GIS data quality is acceptable
 *
 * Run with: npm run validate:balance
 */

import { LocationGeoData } from '../types/gis';
import { Inventory, createEmptyInventory, StoneType, WoodType, FoodType } from '../types/resources';
import { LithicEra, LITHIC_ERAS, ERA_NAMES } from '../types/tech';
import { Technology } from '../types/tech';
import { Tool, CraftedComponent, isTool } from '../types/tools';
import { MaterialType, getMaterialConfig } from '../config/materials';
import { TECHNOLOGIES, getTechsByEra, TECH_BY_ID } from '../data/techTree';
import { TOOLS_BY_ID, COMPONENTS_BY_ID } from '../data/tools';
import { STONES_BY_ID } from '../data/stones';
import { WOODS_BY_ID } from '../data/woods';
import { FOODS_BY_ID } from '../data/foods';
import { getLithologyMapping } from '../data/gis';
import { getRealmBiomeMapping, getRealmBiomeFoodMapping } from '../data/gis/mappings';
import {
  CraftingService,
  CraftingState,
  CraftParams,
  calculateFoodCost,
  selectFoodForCost,
} from '../services/CraftingService';
import { addResource, getTotalResourceCount } from '../services/InventoryService';
import { canUnlockTech, SelectedTechResources } from '../services/TechService';
import { GeoDataService } from '../services/GeoDataService';
import { NodeTileLoader } from '../services/NodeTileLoader';
import { CoarseGeologyEntry, BiomeData } from '../types/gis';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface ValidationResult {
  errors: string[];
  warnings: string[];
  info: string[];
}

interface LocationCoords {
  name: string;
  lat: number;
  lng: number;
}

interface Milestone {
  type: 'tech' | 'tool' | 'component' | 'era';
  id: string;
  gatherCount: number;
}

interface SimulationResult {
  location: string;
  geoData: LocationGeoData;
  milestones: Milestone[];
  eraCompletions: Partial<Record<LithicEra, number>>;
  finalGatherCount: number;
  success: boolean;
  error?: string;
}

interface EraBounds {
  minGathers: number;
  maxGathers: number;
}

interface SimulationState extends CraftingState {
  gatherCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

// Era completion bounds (cumulative from game start)
// Assuming 10 gathers per day
const ERA_BOUNDS: Record<LithicEra, EraBounds> = {
  lower_paleolithic: { minGathers: 70, maxGathers: 300 },
  middle_paleolithic: { minGathers: 140, maxGathers: 450 },
  upper_paleolithic: { minGathers: 210, maxGathers: 750 },
  mesolithic: { minGathers: 280, maxGathers: 950 },
};

// Test locations chosen for geographic diversity
const LOCATIONS: LocationCoords[] = [
  { name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
  { name: 'Nairobi', lat: -1.2864, lng: 36.8172 },
  { name: 'Reykjavik', lat: 64.1355, lng: -21.8954 },
  { name: 'Athens', lat: 37.9838, lng: 23.7275 },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Lima', lat: -12.0464, lng: -77.0428 },
];

// Maximum gathers before we consider simulation stuck
const MAX_GATHERS = 10000;

// ═══════════════════════════════════════════════════════════════════════════
// Seeded Random Number Generator (Mulberry32)
// ═══════════════════════════════════════════════════════════════════════════

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function createSeededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GIS Data Access (uses GeoDataService with NodeTileLoader)
// ═══════════════════════════════════════════════════════════════════════════

async function getLocationGeoData(
  geoDataService: GeoDataService,
  location: LocationCoords
): Promise<LocationGeoData> {
  return geoDataService.getLocationData(location.lat, location.lng);
}

// ═══════════════════════════════════════════════════════════════════════════
// Resource Selection (mirrors ResourceSpawnService logic)
// ═══════════════════════════════════════════════════════════════════════════

function weightedRandomSelect<T>(items: T[], weights: number[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error('Cannot select from empty array');
  }

  if (items.length !== weights.length) {
    return items[Math.floor(rng() * items.length)];
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) {
    return items[Math.floor(rng() * items.length)];
  }

  let random = rng() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

function selectStoneForLocation(geoData: LocationGeoData, rng: () => number): StoneType | null {
  const { primaryLithology, confidence } = geoData.geology;

  // Low confidence = random stone
  if (confidence < 0.2) {
    const config = getMaterialConfig('stone');
    const allStones = config.getAllResources() as StoneType[];
    const weights = allStones.map((s) => s.rarity);
    return weightedRandomSelect(allStones, weights, rng);
  }

  // Get mapping for primary lithology
  const mapping = getLithologyMapping(primaryLithology);
  if (mapping && mapping.stoneIds.length > 0) {
    const stoneId = weightedRandomSelect(mapping.stoneIds, mapping.weights, rng);
    return STONES_BY_ID[stoneId] || null;
  }

  // Fallback to random
  const config = getMaterialConfig('stone');
  const allStones = config.getAllResources() as StoneType[];
  const weights = allStones.map((s) => s.rarity);
  return weightedRandomSelect(allStones, weights, rng);
}

function selectWoodForLocation(geoData: LocationGeoData, rng: () => number): WoodType | null {
  const { type: biomeType, realm, confidence } = geoData.biome;

  // Low confidence = random wood
  if (confidence < 0.2) {
    const config = getMaterialConfig('wood');
    const allWoods = config.getAllResources() as WoodType[];
    const weights = allWoods.map((w) => w.rarity);
    return weightedRandomSelect(allWoods, weights, rng);
  }

  // Try realm+biome mapping
  if (realm) {
    const mapping = getRealmBiomeMapping(realm, biomeType);
    if (mapping && mapping.woodIds.length > 0) {
      const woodId = weightedRandomSelect(mapping.woodIds, mapping.weights, rng);
      return WOODS_BY_ID[woodId] || null;
    }
  }

  // Fallback to random
  const config = getMaterialConfig('wood');
  const allWoods = config.getAllResources() as WoodType[];
  const weights = allWoods.map((w) => w.rarity);
  return weightedRandomSelect(allWoods, weights, rng);
}

function selectFoodForLocation(geoData: LocationGeoData, rng: () => number): FoodType | null {
  const { type: biomeType, realm, confidence } = geoData.biome;

  // Low confidence = random food
  if (confidence < 0.2) {
    const config = getMaterialConfig('food');
    const allFoods = config.getAllResources() as FoodType[];
    const weights = allFoods.map((f) => f.rarity);
    return weightedRandomSelect(allFoods, weights, rng);
  }

  // Try realm+biome mapping
  if (realm) {
    const mapping = getRealmBiomeFoodMapping(realm, biomeType);
    if (mapping && mapping.foodIds.length > 0) {
      const foodId = weightedRandomSelect(mapping.foodIds, mapping.weights, rng);
      return FOODS_BY_ID[foodId] || null;
    }
  }

  // Fallback to random
  const config = getMaterialConfig('food');
  const allFoods = config.getAllResources() as FoodType[];
  const weights = allFoods.map((f) => f.rarity);
  return weightedRandomSelect(allFoods, weights, rng);
}

// ═══════════════════════════════════════════════════════════════════════════
// Gathering Simulation
// ═══════════════════════════════════════════════════════════════════════════

function calculateGatheringAbility(state: SimulationState, materialType: MaterialType): number {
  // Base ability from config
  const config = getMaterialConfig(materialType);
  let ability = config.baseGatheringAbility ?? 1;

  // Add tool bonuses
  for (const ownedTool of state.ownedTools) {
    const tool = TOOLS_BY_ID[ownedTool.toolId];
    if (tool && tool.gatheringMaterial === materialType) {
      // Quality scales the bonus
      const bonus = tool.baseStats.gatheringBonus * ownedTool.quality;
      ability += bonus;
    }
  }

  return ability;
}

function gatherResource(
  state: SimulationState,
  materialType: MaterialType,
  geoData: LocationGeoData,
  rng: () => number
): void {
  let resource: { id: string } | null = null;

  switch (materialType) {
    case 'stone':
      resource = selectStoneForLocation(geoData, rng);
      break;
    case 'wood':
      resource = selectWoodForLocation(geoData, rng);
      break;
    case 'food':
      resource = selectFoodForLocation(geoData, rng);
      break;
  }

  if (!resource) {
    // Fallback if no resource selected
    const config = getMaterialConfig(materialType);
    const allResources = config.getAllResources();
    if (allResources.length > 0) {
      resource = allResources[Math.floor(rng() * allResources.length)];
    }
  }

  if (resource) {
    // Calculate yield based on gathering ability
    const ability = calculateGatheringAbility(state, materialType);
    const maxYield = Math.max(1, Math.floor(2 * ability - 1));
    const quantity = 1 + Math.floor(rng() * maxYield);

    state.inventory = addResource(state.inventory, materialType, resource.id, quantity);
  }

  state.gatherCount++;
}

// ═══════════════════════════════════════════════════════════════════════════
// Simulation Logic
// ═══════════════════════════════════════════════════════════════════════════

function createInitialState(): SimulationState {
  return {
    inventory: createEmptyInventory(),
    unlockedTechs: [],
    ownedTools: [],
    ownedComponents: [],
    gatherCount: 0,
  };
}

function allTechsUnlocked(state: SimulationState): boolean {
  return TECHNOLOGIES.every((tech) => state.unlockedTechs.includes(tech.id));
}

function isEraComplete(state: SimulationState, era: LithicEra): boolean {
  const eraTechs = getTechsByEra(era);
  return eraTechs.every((tech) => state.unlockedTechs.includes(tech.id));
}

/**
 * Check if we have the required tools to craft something
 */
function hasRequiredTools(craftable: Tool | CraftedComponent, state: SimulationState): boolean {
  return craftable.requiredTools.every((toolId) =>
    state.ownedTools.some((t) => t.toolId === toolId)
  );
}

/**
 * Check if we have enough of a specific component
 */
function hasEnoughComponents(
  componentId: string,
  quantity: number,
  state: SimulationState
): boolean {
  const owned = state.ownedComponents.filter((c) => c.componentId === componentId);
  return owned.length >= quantity;
}

/**
 * Check if we have all required components for a craftable
 */
function hasRequiredComponents(
  craftable: Tool | CraftedComponent,
  state: SimulationState
): boolean {
  return craftable.requiredComponents.every((req) =>
    hasEnoughComponents(req.componentId, req.quantity, state)
  );
}

/**
 * Find a tool or component that we should target next, considering dependencies
 */
function findNextCraftTarget(
  state: SimulationState
): { type: 'tool' | 'component'; item: Tool | CraftedComponent } | null {
  // Collect all recipes enabled by current techs
  const enabledRecipes: string[] = [];
  for (const techId of state.unlockedTechs) {
    const tech = TECH_BY_ID[techId];
    if (tech) {
      enabledRecipes.push(...tech.enablesRecipes);
    }
  }

  // First priority: Find tools we can craft RIGHT NOW (all prereqs met, all materials available)
  for (const recipeId of enabledRecipes) {
    const tool = TOOLS_BY_ID[recipeId];
    if (tool && !state.ownedTools.some((t) => t.toolId === tool.id)) {
      const checkResult = CraftingService.canCraft(tool, state);
      if (checkResult.canCraft) {
        return { type: 'tool', item: tool };
      }
    }
  }

  // Second priority: Find tools we're working towards
  for (const recipeId of enabledRecipes) {
    const tool = TOOLS_BY_ID[recipeId];
    if (tool && !state.ownedTools.some((t) => t.toolId === tool.id)) {
      // Check if we're missing required tools
      for (const reqToolId of tool.requiredTools) {
        if (!state.ownedTools.some((t) => t.toolId === reqToolId)) {
          const reqTool = TOOLS_BY_ID[reqToolId];
          if (reqTool && state.unlockedTechs.includes(reqTool.requiredTech)) {
            // Recursively check if we can craft or should work toward this tool
            const reqToolCheck = CraftingService.canCraft(reqTool, state);
            if (reqToolCheck.canCraft) {
              return { type: 'tool', item: reqTool };
            }
            // Check if we need components for the required tool
            for (const compReq of reqTool.requiredComponents) {
              const owned = state.ownedComponents.filter(
                (c) => c.componentId === compReq.componentId
              );
              if (owned.length < compReq.quantity) {
                const component = COMPONENTS_BY_ID[compReq.componentId];
                if (component && state.unlockedTechs.includes(component.requiredTech)) {
                  const compCheck = CraftingService.canCraft(component, state);
                  if (compCheck.canCraft) {
                    return { type: 'component', item: component };
                  }
                  // Need to gather for this component
                  return { type: 'component', item: component };
                }
              }
            }
            // Need to gather for the required tool
            return { type: 'tool', item: reqTool };
          }
        }
      }

      // Check if we're missing required components for the main tool
      for (const compReq of tool.requiredComponents) {
        const owned = state.ownedComponents.filter((c) => c.componentId === compReq.componentId);
        if (owned.length < compReq.quantity) {
          const component = COMPONENTS_BY_ID[compReq.componentId];
          if (component && state.unlockedTechs.includes(component.requiredTech)) {
            // Check if component needs tools we don't have
            for (const reqToolId of component.requiredTools) {
              if (!state.ownedTools.some((t) => t.toolId === reqToolId)) {
                const reqTool = TOOLS_BY_ID[reqToolId];
                if (reqTool && state.unlockedTechs.includes(reqTool.requiredTech)) {
                  return { type: 'tool', item: reqTool };
                }
              }
            }
            const compCheck = CraftingService.canCraft(component, state);
            if (compCheck.canCraft) {
              return { type: 'component', item: component };
            }
            // Need to gather for this component
            return { type: 'component', item: component };
          }
        }
      }

      // If we have required tools and components, target this tool (need to gather materials)
      if (hasRequiredTools(tool, state) && hasRequiredComponents(tool, state)) {
        return { type: 'tool', item: tool };
      }

      // Otherwise, just target this tool anyway for material gathering
      if (hasRequiredTools(tool, state)) {
        return { type: 'tool', item: tool };
      }
    }
  }

  return null;
}

/**
 * Identify the next target to work towards
 * Priority: tools/components needed for current progression > available techs
 */
function identifyNextTarget(
  state: SimulationState
): { type: 'tech' | 'tool' | 'component'; item: Technology | Tool | CraftedComponent } | null {
  // Find available techs (prerequisites met, not yet unlocked)
  const availableTechs = TECHNOLOGIES.filter((tech) => {
    if (state.unlockedTechs.includes(tech.id)) return false;
    return tech.prerequisites.every((prereq) => state.unlockedTechs.includes(prereq));
  });

  // First try to find craftable targets (tools/components)
  const craftTarget = findNextCraftTarget(state);
  if (craftTarget) {
    return craftTarget;
  }

  // If no craftable targets, target an available tech
  if (availableTechs.length > 0) {
    return { type: 'tech', item: availableTechs[0] };
  }

  return null;
}

/**
 * Get the maximum toolstone stack quantity in inventory
 */
function getMaxToolstoneQuantity(state: SimulationState): number {
  const toolstones = ['flint', 'chert', 'obsidian', 'quartzite', 'greenstone'];
  let maxQuantity = 0;

  for (const stack of state.inventory.stone) {
    if (toolstones.includes(stack.resourceId) && stack.quantity > maxQuantity) {
      maxQuantity = stack.quantity;
    }
  }

  return maxQuantity;
}

/**
 * Get the amount of toolstone still needed for a requirement.
 * Checks if ANY single toolstone stack meets the requirement.
 */
function getToolstoneNeeded(state: SimulationState, requirement: { quantity: number }): number {
  const maxQuantity = getMaxToolstoneQuantity(state);
  return Math.max(0, requirement.quantity - maxQuantity);
}

/**
 * Get the maximum stack quantity for a material type in inventory.
 * For crafting, we need a SINGLE stack with enough quantity.
 */
function getMaxStackQuantity(inventory: Inventory, materialType: MaterialType): number {
  let maxQuantity = 0;
  for (const stack of inventory[materialType]) {
    if (stack.quantity > maxQuantity) {
      maxQuantity = stack.quantity;
    }
  }
  return maxQuantity;
}

/**
 * Determine what materials are needed for a target
 */
function getMaterialsNeeded(
  target: Technology | Tool | CraftedComponent,
  state: SimulationState
): { materialType: MaterialType; needed: number; requiresToolstone?: boolean }[] {
  const needs: { materialType: MaterialType; needed: number; requiresToolstone?: boolean }[] = [];

  if ('resourceCost' in target) {
    // It's a Technology
    if (DEBUG && state.gatherCount < 5) {
      console.log(
        `  [DEBUG getMaterialsNeeded] Tech ${target.id}: resourceCost = ${JSON.stringify(target.resourceCost)}`
      );
    }
    // It's a Technology
    for (const cost of target.resourceCost) {
      const have = getTotalResourceCount(state.inventory, cost.resourceType);
      if (have < cost.quantity) {
        needs.push({ materialType: cost.resourceType, needed: cost.quantity - have });
      }
    }
  } else {
    // It's a Tool or Component
    const craftable = target as Tool | CraftedComponent;

    if (DEBUG && state.gatherCount < 30) {
      console.log(
        `  [DEBUG getMaterialsNeeded] ${isTool(craftable) ? 'Tool' : 'Component'} ${craftable.id}: materials = ${JSON.stringify(craftable.materials)}`
      );
    }

    // Check material requirements
    // Note: Crafting requires a SINGLE stack with enough quantity (can't mix resources)
    for (const [matType, req] of Object.entries(craftable.materials)) {
      if (req) {
        if (matType === 'stone' && req.requiresToolstone) {
          // For toolstone requirements, check specifically for toolstone
          const toolstoneNeeded = getToolstoneNeeded(state, req);
          if (toolstoneNeeded > 0) {
            needs.push({ materialType: 'stone', needed: toolstoneNeeded, requiresToolstone: true });
          }
        } else {
          // Check max stack quantity, not total (need a single stack with enough)
          const maxStack = getMaxStackQuantity(state.inventory, matType as MaterialType);
          if (maxStack < req.quantity) {
            needs.push({ materialType: matType as MaterialType, needed: req.quantity - maxStack });
          }
        }
      }
    }

    // Check food cost (estimate using WORST case workability of 1 for conservative estimate)
    // Food cost = sum of (quantity * (11 - workability) / 10)
    // We use worst case to ensure we gather enough food
    let estimatedFoodCost = 0;
    for (const [matType, req] of Object.entries(craftable.materials)) {
      if (req && matType !== 'food') {
        // Use worst case workability of 1 for conservative food estimate
        // Quartzite has workability: 1, which is the worst case
        const workabilityFactor = (11 - 1) / 10; // 1.0
        estimatedFoodCost += req.quantity * workabilityFactor;
      }
    }
    estimatedFoodCost = Math.ceil(estimatedFoodCost);

    if (estimatedFoodCost > 0) {
      // Food CAN be mixed from multiple types (unlike stone/wood)
      const totalFood = getTotalResourceCount(state.inventory, 'food');
      if (totalFood < estimatedFoodCost) {
        needs.push({ materialType: 'food', needed: estimatedFoodCost - totalFood });
      }
    }

    // Check required components' material needs
    for (const compReq of craftable.requiredComponents) {
      const owned = state.ownedComponents.filter((c) => c.componentId === compReq.componentId);
      if (owned.length < compReq.quantity) {
        const component = COMPONENTS_BY_ID[compReq.componentId];
        if (component) {
          // Add materials needed for component
          const compNeeds = getMaterialsNeeded(component, state);
          for (const need of compNeeds) {
            const existing = needs.find((n) => n.materialType === need.materialType);
            if (existing) {
              existing.needed += need.needed;
            } else {
              needs.push({ ...need });
            }
          }
        }
      }
    }

    // Check required tools' material needs (if we don't have the tool yet)
    for (const reqToolId of craftable.requiredTools) {
      if (!state.ownedTools.some((t) => t.toolId === reqToolId)) {
        const reqTool = TOOLS_BY_ID[reqToolId];
        if (reqTool) {
          const toolNeeds = getMaterialsNeeded(reqTool, state);
          for (const need of toolNeeds) {
            const existing = needs.find((n) => n.materialType === need.materialType);
            if (existing) {
              existing.needed += need.needed;
            } else {
              needs.push({ ...need });
            }
          }
        }
      }
    }
  }

  return needs;
}

/**
 * Try to craft a tool or component
 */
function tryCraft(
  state: SimulationState,
  craftable: Tool | CraftedComponent,
  rng: () => number
): boolean {
  const checkResult = CraftingService.canCraft(craftable, state);
  if (!checkResult.canCraft) {
    // Debug for stuck situations
    if (state.gatherCount > 100 && state.gatherCount % 1000 === 0) {
      console.log(
        `  [TRCRAFT] Can't craft ${craftable.id}: ${checkResult.missingRequirements.join(', ')}`
      );
      console.log(
        `  [TRCRAFT] Available materials: ${JSON.stringify(checkResult.availableMaterials)}`
      );
      const maxStone = state.inventory.stone.reduce((max, s) => Math.max(max, s.quantity), 0);
      console.log(
        `  [TRCRAFT] Max stone stack: ${maxStone}, total stacks: ${state.inventory.stone.length}`
      );
      console.log(`  [TRCRAFT] Unlocked techs: ${state.unlockedTechs.join(', ')}`);
    }
    return false;
  }

  // Select materials (use first available for each type)
  const selectedMaterials: Partial<Record<MaterialType, string>> = {};
  for (const [matType, available] of Object.entries(checkResult.availableMaterials)) {
    if (available && available.length > 0) {
      // Select randomly among available
      selectedMaterials[matType as MaterialType] = available[Math.floor(rng() * available.length)];
    }
  }

  // Calculate food cost using CraftingService and select food from inventory
  const actualFoodCost = calculateFoodCost(craftable.materials, selectedMaterials);
  const selectedFoods = selectFoodForCost(state.inventory.food, actualFoodCost) || {};

  // Select components
  const selectedComponentIds = checkResult.availableComponents;

  const params: CraftParams = {
    selectedMaterials,
    selectedComponentIds,
    selectedFoods,
  };

  const result = CraftingService.craft(craftable, params, state);
  if (result.success) {
    state.inventory = result.newState.inventory;
    state.ownedTools = result.newState.ownedTools;
    state.ownedComponents = result.newState.ownedComponents;
    return true;
  }

  // Debug for stuck situations
  if (state.gatherCount > 100 && state.gatherCount % 1000 === 0) {
    console.log(
      `  [CRAFT] Failed for ${craftable.id}: ${result.success === false ? result.error : 'unknown'}`
    );
    console.log(`  [CRAFT] Selected materials: ${JSON.stringify(selectedMaterials)}`);
    console.log(`  [CRAFT] Selected foods: ${JSON.stringify(selectedFoods)}`);
    console.log(
      `  [CRAFT] Available in checkResult: ${JSON.stringify(checkResult.availableMaterials)}`
    );
  }
  return false;
}

/**
 * Try to unlock a tech
 */
function tryUnlockTech(state: SimulationState, tech: Technology): boolean {
  const check = canUnlockTech(tech, state.unlockedTechs, state.inventory);
  if (!check.canUnlock) {
    return false;
  }

  // Select resources for each cost
  const selectedResources: SelectedTechResources = {};
  for (const cost of tech.resourceCost) {
    const stacks = state.inventory[cost.resourceType];
    const selections: { resourceId: string; quantity: number }[] = [];
    let remaining = cost.quantity;

    for (const stack of stacks) {
      if (remaining <= 0) break;
      const take = Math.min(stack.quantity, remaining);
      selections.push({ resourceId: stack.resourceId, quantity: take });
      remaining -= take;
    }

    selectedResources[cost.resourceType] = selections;
  }

  // Consume resources manually (simplified version of TechService.unlockTech)
  for (const cost of tech.resourceCost) {
    const selections = selectedResources[cost.resourceType] || [];
    for (const selection of selections) {
      const stacks = [...state.inventory[cost.resourceType]];
      const idx = stacks.findIndex((s) => s.resourceId === selection.resourceId);
      if (idx >= 0) {
        stacks[idx] = {
          ...stacks[idx],
          quantity: stacks[idx].quantity - selection.quantity,
        };
        if (stacks[idx].quantity === 0) {
          stacks.splice(idx, 1);
        }
        state.inventory = { ...state.inventory, [cost.resourceType]: stacks };
      }
    }
  }

  state.unlockedTechs.push(tech.id);
  return true;
}

// Debug flag
const DEBUG = false;

// Verify stone data is loaded
const stoneConfig = getMaterialConfig('stone');
if (DEBUG) {
  console.log(`[DEBUG] Stone config has ${stoneConfig.getAllResources().length} stones`);
  console.log(
    `[DEBUG] STONES_BY_ID has basalt: ${stoneConfig.getResourceById('basalt') !== undefined}`
  );
}

/**
 * Run a full simulation for a location
 */
function simulatePlaythrough(location: LocationCoords, geoData: LocationGeoData): SimulationResult {
  const state = createInitialState();
  const milestones: Milestone[] = [];
  const eraCompletions: Partial<Record<LithicEra, number>> = {};
  const rng = createSeededRandom(hashString(location.name));

  // Track completed eras
  const completedEras = new Set<LithicEra>();

  // Debug: track last target to detect loops
  let lastTargetId = '';
  let stuckCounter = 0;

  while (!allTechsUnlocked(state) && state.gatherCount < MAX_GATHERS) {
    // Check for era completions
    for (const era of LITHIC_ERAS) {
      if (!completedEras.has(era) && isEraComplete(state, era)) {
        completedEras.add(era);
        eraCompletions[era] = state.gatherCount;
        milestones.push({ type: 'era', id: era, gatherCount: state.gatherCount });
      }
    }

    // Identify next target
    const target = identifyNextTarget(state);
    if (!target) {
      // No more targets - might be stuck
      if (DEBUG) {
        console.log(`  [DEBUG] No target found at gather ${state.gatherCount}`);
        console.log(`  [DEBUG] Unlocked techs: ${state.unlockedTechs.join(', ')}`);
        console.log(`  [DEBUG] Owned tools: ${state.ownedTools.map((t) => t.toolId).join(', ')}`);
      }
      break;
    }

    // Track if we're stuck on the same target
    const currentTargetId = target.item.id;
    if (currentTargetId === lastTargetId) {
      stuckCounter++;
    } else {
      stuckCounter = 0;
      lastTargetId = currentTargetId;
    }

    // Debug output for stuck situations (always output this near MAX_GATHERS)
    if (stuckCounter > 0 && stuckCounter % 1000 === 0) {
      console.log(
        `  [STUCK] on ${target.type} "${target.item.id}" for ${stuckCounter} gathers at gather ${state.gatherCount}`
      );
      const needs = getMaterialsNeeded(target.item, state);
      console.log(`  [STUCK] Needs: ${JSON.stringify(needs)}`);
      console.log(
        `  [STUCK] Stone (max 5): ${JSON.stringify(state.inventory.stone.slice(0, 5).map((s) => `${s.resourceId}:${s.quantity}`))}`
      );
      console.log(
        `  [STUCK] Wood (max 5): ${JSON.stringify(state.inventory.wood.slice(0, 5).map((s) => `${s.resourceId}:${s.quantity}`))}`
      );
      console.log(
        `  [STUCK] Food (max 5): ${JSON.stringify(state.inventory.food.slice(0, 5).map((s) => `${s.resourceId}:${s.quantity}`))}`
      );
      console.log(`  [STUCK] Owned tools: ${state.ownedTools.map((t) => t.toolId).join(', ')}`);
    }

    // Try to complete target directly
    if (target.type === 'tech') {
      if (tryUnlockTech(state, target.item as Technology)) {
        milestones.push({ type: 'tech', id: target.item.id, gatherCount: state.gatherCount });
        continue;
      }
    } else if (target.type === 'tool') {
      if (tryCraft(state, target.item as Tool, rng)) {
        milestones.push({ type: 'tool', id: target.item.id, gatherCount: state.gatherCount });
        continue;
      }
    } else if (target.type === 'component') {
      if (tryCraft(state, target.item as CraftedComponent, rng)) {
        milestones.push({ type: 'component', id: target.item.id, gatherCount: state.gatherCount });
        continue;
      }
    }

    // Need to gather more resources
    const needs = getMaterialsNeeded(target.item, state);

    if (DEBUG && state.gatherCount < 30) {
      console.log(
        `  [DEBUG] Target: ${target.type} ${target.item.id}, Needs: ${JSON.stringify(needs)}`
      );
    }

    // Gather one resource (prefer what we need most)
    if (needs.length > 0) {
      // Sort by need (descending)
      needs.sort((a, b) => b.needed - a.needed);
      if (DEBUG && state.gatherCount < 30) {
        console.log(`  [DEBUG] Gathering ${needs[0].materialType} (need ${needs[0].needed})`);
      }
      gatherResource(state, needs[0].materialType, geoData, rng);
    } else {
      // Gather stone as default (always useful)
      if (DEBUG && state.gatherCount < 30) {
        console.log(`  [DEBUG] No needs - gathering stone by default`);
      }
      gatherResource(state, 'stone', geoData, rng);
    }
  }

  // Final era check
  for (const era of LITHIC_ERAS) {
    if (!completedEras.has(era) && isEraComplete(state, era)) {
      completedEras.add(era);
      eraCompletions[era] = state.gatherCount;
      milestones.push({ type: 'era', id: era, gatherCount: state.gatherCount });
    }
  }

  const success = allTechsUnlocked(state);
  const error = !success
    ? state.gatherCount >= MAX_GATHERS
      ? 'Simulation reached maximum gathers'
      : 'Simulation stuck - no valid targets'
    : undefined;

  return {
    location: location.name,
    geoData,
    milestones,
    eraCompletions,
    finalGatherCount: state.gatherCount,
    success,
    error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════

function validateBalance(results: SimulationResult[]): ValidationResult {
  const result: ValidationResult = {
    errors: [],
    warnings: [],
    info: [],
  };

  // Analyze results
  const eraRanges: Record<LithicEra, { min: number; max: number; locations: string[] }> = {
    lower_paleolithic: { min: Infinity, max: 0, locations: [] },
    middle_paleolithic: { min: Infinity, max: 0, locations: [] },
    upper_paleolithic: { min: Infinity, max: 0, locations: [] },
    mesolithic: { min: Infinity, max: 0, locations: [] },
  };

  for (const simResult of results) {
    // Check for simulation failures
    if (!simResult.success) {
      result.errors.push(`${simResult.location}: Simulation failed - ${simResult.error}`);
      continue;
    }

    // Check GIS data quality
    if (simResult.geoData.geology.confidence < 0.3) {
      result.warnings.push(
        `${simResult.location}: Low geology confidence (${simResult.geoData.geology.confidence.toFixed(2)})`
      );
    }
    if (simResult.geoData.biome.confidence < 0.3) {
      result.warnings.push(
        `${simResult.location}: Low biome confidence (${simResult.geoData.biome.confidence.toFixed(2)})`
      );
    }

    // Track era completion ranges
    for (const era of LITHIC_ERAS) {
      const gatherCount = simResult.eraCompletions[era];
      if (gatherCount !== undefined) {
        if (gatherCount < eraRanges[era].min) {
          eraRanges[era].min = gatherCount;
        }
        if (gatherCount > eraRanges[era].max) {
          eraRanges[era].max = gatherCount;
        }
        eraRanges[era].locations.push(simResult.location);

        // Check bounds
        const bounds = ERA_BOUNDS[era];
        if (gatherCount < bounds.minGathers) {
          result.errors.push(
            `${simResult.location}: ${ERA_NAMES[era]} completed at ${gatherCount} gathers (min ${bounds.minGathers})`
          );
        }
        if (gatherCount > bounds.maxGathers) {
          result.errors.push(
            `${simResult.location}: ${ERA_NAMES[era]} completed at ${gatherCount} gathers (max ${bounds.maxGathers})`
          );
        }
      } else {
        result.errors.push(`${simResult.location}: ${ERA_NAMES[era]} never completed`);
      }
    }
  }

  // Summary info
  for (const era of LITHIC_ERAS) {
    const range = eraRanges[era];
    const bounds = ERA_BOUNDS[era];
    if (range.min !== Infinity) {
      result.info.push(
        `${ERA_NAMES[era]}: ${range.min}-${range.max} gathers across locations (bounds: ${bounds.minGathers}-${bounds.maxGathers})`
      );
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

function createNodeGeoDataService(): GeoDataService {
  const tileLoader = new NodeTileLoader();
  return new GeoDataService({
    tileLoader,
    loadCoarseIndexes: async (): Promise<{
      geology: Record<string, CoarseGeologyEntry>;
      biome: Record<string, BiomeData>;
    }> => {
      let geology: Record<string, CoarseGeologyEntry> = {};
      let biome: Record<string, BiomeData> = {};

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const geologyIndex = require('../data/gis/geology/index.json');
        if (geologyIndex?.data) {
          geology = geologyIndex.data;
        }
      } catch {
        // Geology index not available
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const biomeIndex = require('../data/gis/biomes/index.json');
        if (biomeIndex?.data) {
          biome = biomeIndex.data;
        }
      } catch {
        // Biome index not available
      }

      return { geology, biome };
    },
  });
}

async function main() {
  // Initialize GIS service
  const geoDataService = createNodeGeoDataService();
  await geoDataService.initialize();

  console.log('='.repeat(60));
  console.log('Balance Validation Report');
  console.log('='.repeat(60));
  console.log('');

  // Run simulations and print detailed results
  const simResults: SimulationResult[] = [];
  for (const location of LOCATIONS) {
    const geoData = await getLocationGeoData(geoDataService, location);
    const simResult = simulatePlaythrough(location, geoData);
    simResults.push(simResult);

    console.log(
      `LOCATION: ${location.name} (${location.lat.toFixed(2)}, ${location.lng.toFixed(2)})`
    );
    console.log(
      `  GIS Lookup: ${geoData.biome.realm}, ${geoData.biome.type}, ${geoData.geology.primaryLithology} (confidence: ${geoData.geology.confidence.toFixed(2)})`
    );
    console.log('-'.repeat(40));

    // Print milestones
    for (const milestone of simResult.milestones) {
      if (milestone.type === 'era') {
        console.log(
          `  ERA COMPLETE: ${ERA_NAMES[milestone.id as LithicEra]} at gather ${milestone.gatherCount}`
        );
      } else {
        const typeLabel = milestone.type.charAt(0).toUpperCase() + milestone.type.slice(1);
        console.log(`  ${typeLabel}: ${milestone.id} at gather ${milestone.gatherCount}`);
      }
    }

    if (!simResult.success) {
      console.log(`  [FAILED] ${simResult.error}`);
    }
    console.log('');
  }

  // Run validation on collected results
  const validationResult = validateBalance(simResults);

  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));

  for (const info of validationResult.info) {
    console.log(`  ${info}`);
  }
  console.log('');

  if (validationResult.errors.length > 0) {
    console.log('ERRORS:');
    for (const error of validationResult.errors) {
      console.log(`  [ERROR] ${error}`);
    }
    console.log('');
  }

  if (validationResult.warnings.length > 0) {
    console.log('WARNINGS:');
    for (const warning of validationResult.warnings) {
      console.log(`  [WARN]  ${warning}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(
    `Summary: ${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings`
  );
  console.log('='.repeat(60));

  // Clean up GIS service
  await geoDataService.close();

  // Exit with error code if there are errors
  if (validationResult.errors.length > 0) {
    process.exit(1);
  }
}

// Export for use as module
export { validateBalance, ValidationResult };

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}
