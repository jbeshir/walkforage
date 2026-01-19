// CraftingService - Unified crafting logic for tools and components
// Extracted from useGameState to enable testing and cleaner separation of concerns

import { Inventory, ResourceStack } from '../types/resources';
import {
  Tool,
  CraftedComponent,
  OwnedTool,
  OwnedComponent,
  UsedMaterials,
  MaterialRequirements,
  isTool,
} from '../types/tools';
import { STONES_BY_ID } from '../data/stones';
import { calculateCraftableQuality } from '../utils/qualityCalculation';

// State required for crafting operations
export interface CraftingState {
  inventory: Inventory;
  unlockedTechs: string[];
  ownedTools: OwnedTool[];
  ownedComponents: OwnedComponent[];
}

// Result of checking if something can be crafted
export interface CraftCheckResult {
  canCraft: boolean;
  missingRequirements: string[];
  availableStones: string[];
  availableWoods: string[];
  availableComponents: string[]; // Instance IDs of owned components
}

// Parameters for crafting
export interface CraftParams {
  selectedStoneId?: string;
  selectedWoodId?: string;
  selectedComponentIds?: string[];
}

// Successful craft result
interface CraftSuccessResult {
  success: true;
  newState: CraftingState;
  craftedItem: OwnedTool | OwnedComponent;
}

// Failed craft result
interface CraftFailureResult {
  success: false;
  error: string;
}

export type CraftResult = CraftSuccessResult | CraftFailureResult;

// Helper: Find stones in inventory that meet a requirement
function findAvailableStones(
  stones: ResourceStack[],
  quantity: number,
  requiresToolstone: boolean
): string[] {
  const available: string[] = [];
  for (const stack of stones) {
    if (stack.quantity >= quantity) {
      const stone = STONES_BY_ID[stack.resourceId];
      if (stone) {
        if (requiresToolstone) {
          if (stone.isToolstone) {
            available.push(stack.resourceId);
          }
        } else {
          available.push(stack.resourceId);
        }
      }
    }
  }
  return available;
}

// Helper: Find woods in inventory that meet a requirement
function findAvailableWoods(woods: ResourceStack[], quantity: number): string[] {
  const available: string[] = [];
  for (const stack of woods) {
    if (stack.quantity >= quantity) {
      available.push(stack.resourceId);
    }
  }
  return available;
}

// Helper: Check if player owns a specific tool
function hasTool(ownedTools: OwnedTool[], toolId: string): boolean {
  return ownedTools.some((t) => t.toolId === toolId);
}

// Helper: Get owned components by component ID
function getOwnedComponentsByType(
  ownedComponents: OwnedComponent[],
  componentId: string
): OwnedComponent[] {
  return ownedComponents.filter((c) => c.componentId === componentId);
}

// Helper: Get resource count from inventory
function getResourceCount(stacks: ResourceStack[], resourceId: string): number {
  const stack = stacks.find((s) => s.resourceId === resourceId);
  return stack?.quantity || 0;
}

// Helper: Consume resources from a stack array (returns new array)
function consumeFromStacks(
  stacks: ResourceStack[],
  resourceId: string,
  quantity: number
): ResourceStack[] {
  const newStacks = [...stacks];
  const idx = newStacks.findIndex((s) => s.resourceId === resourceId);
  if (idx >= 0) {
    newStacks[idx] = {
      ...newStacks[idx],
      quantity: newStacks[idx].quantity - quantity,
    };
    if (newStacks[idx].quantity === 0) {
      newStacks.splice(idx, 1);
    }
  }
  return newStacks;
}

// Helper: Generate unique instance ID
function generateInstanceId(baseId: string): string {
  return `${baseId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a craftable (Tool or CraftedComponent) can be crafted
 * Returns available material options and any missing requirements
 */
export function canCraft(
  craftable: Tool | CraftedComponent,
  state: CraftingState
): CraftCheckResult {
  const missing: string[] = [];
  const availableComponentIds: string[] = [];

  // Check tech requirement
  if (!state.unlockedTechs.includes(craftable.requiredTech)) {
    missing.push(`Tech: ${craftable.requiredTech}`);
  }

  // Check tool requirements
  for (const reqToolId of craftable.requiredTools) {
    if (!hasTool(state.ownedTools, reqToolId)) {
      missing.push(`Tool: ${reqToolId}`);
    }
  }

  // Check component requirements (both tools and components can require components)
  for (const comp of craftable.requiredComponents) {
    const ownedComps = getOwnedComponentsByType(state.ownedComponents, comp.componentId);
    if (ownedComps.length < comp.quantity) {
      missing.push(`Component: ${comp.quantity}x ${comp.componentId}`);
    } else {
      // Add available component instance IDs (up to required quantity)
      for (let i = 0; i < comp.quantity && i < ownedComps.length; i++) {
        availableComponentIds.push(ownedComps[i].instanceId);
      }
    }
  }

  // Check material requirements and find available options
  const { materials } = craftable;
  const availableStones = materials.stone
    ? findAvailableStones(
        state.inventory.stones,
        materials.stone.quantity,
        materials.stone.requiresToolstone ?? false
      )
    : [];
  const availableWoods = materials.wood
    ? findAvailableWoods(state.inventory.woods, materials.wood.quantity)
    : [];

  if (materials.stone && availableStones.length === 0) {
    const toolstoneNote = materials.stone.requiresToolstone ? ' (toolstone)' : '';
    missing.push(`Material: ${materials.stone.quantity}x stone${toolstoneNote}`);
  }
  if (materials.wood && availableWoods.length === 0) {
    missing.push(`Material: ${materials.wood.quantity}x wood`);
  }

  return {
    canCraft: missing.length === 0,
    missingRequirements: missing,
    availableStones,
    availableWoods,
    availableComponents: availableComponentIds,
  };
}

/**
 * Validate material selections against requirements
 * Returns UsedMaterials if valid, or an error message
 */
function validateMaterialSelection(
  materials: MaterialRequirements,
  params: CraftParams,
  inventory: Inventory
): { usedMaterials: UsedMaterials } | { error: string } {
  const usedMaterials: UsedMaterials = {};

  // Validate stone selection if required
  if (materials.stone) {
    if (!params.selectedStoneId) {
      return { error: 'Stone material not selected' };
    }
    const stoneCount = getResourceCount(inventory.stones, params.selectedStoneId);
    if (stoneCount < materials.stone.quantity) {
      return { error: `Not enough ${params.selectedStoneId}` };
    }
    if (materials.stone.requiresToolstone) {
      const stone = STONES_BY_ID[params.selectedStoneId];
      if (!stone?.isToolstone) {
        return { error: `${params.selectedStoneId} is not a toolstone` };
      }
    }
    usedMaterials.stoneId = params.selectedStoneId;
    usedMaterials.stoneQuantity = materials.stone.quantity;
  }

  // Validate wood selection if required
  if (materials.wood) {
    if (!params.selectedWoodId) {
      return { error: 'Wood material not selected' };
    }
    const woodCount = getResourceCount(inventory.woods, params.selectedWoodId);
    if (woodCount < materials.wood.quantity) {
      return { error: `Not enough ${params.selectedWoodId}` };
    }
    usedMaterials.woodId = params.selectedWoodId;
    usedMaterials.woodQuantity = materials.wood.quantity;
  }

  return { usedMaterials };
}

/**
 * Validate component selections against requirements
 */
function validateComponentSelection(
  requiredComponents: { componentId: string; quantity: number }[],
  selectedComponentIds: string[] | undefined,
  ownedComponents: OwnedComponent[]
): { error: string } | { valid: true } {
  if (requiredComponents.length === 0) {
    return { valid: true };
  }

  if (!selectedComponentIds || selectedComponentIds.length === 0) {
    return { error: 'Components not selected' };
  }

  // Verify each selected component exists and matches requirements
  for (const req of requiredComponents) {
    const matchingSelected = selectedComponentIds.filter((id) => {
      const owned = ownedComponents.find((c) => c.instanceId === id);
      return owned?.componentId === req.componentId;
    });
    if (matchingSelected.length < req.quantity) {
      return { error: `Not enough ${req.componentId} components selected` };
    }
  }

  return { valid: true };
}

/**
 * Craft a tool or component
 * Returns the new state and the crafted item, or an error
 */
export function craft(
  craftable: Tool | CraftedComponent,
  params: CraftParams,
  state: CraftingState
): CraftResult {
  // First check if crafting is possible
  const checkResult = canCraft(craftable, state);
  if (!checkResult.canCraft) {
    return { success: false, error: checkResult.missingRequirements.join(', ') };
  }

  // Validate material selection
  const materialValidation = validateMaterialSelection(
    craftable.materials,
    params,
    state.inventory
  );
  if ('error' in materialValidation) {
    return { success: false, error: materialValidation.error };
  }
  const { usedMaterials } = materialValidation;

  // Validate component selection
  const componentValidation = validateComponentSelection(
    craftable.requiredComponents,
    params.selectedComponentIds,
    state.ownedComponents
  );
  if ('error' in componentValidation) {
    return { success: false, error: componentValidation.error };
  }

  // Calculate quality from materials
  const quality = calculateCraftableQuality(craftable, usedMaterials);

  // Build new inventory (consume materials)
  let newStones = state.inventory.stones;
  let newWoods = state.inventory.woods;

  if (craftable.materials.stone && params.selectedStoneId) {
    newStones = consumeFromStacks(
      newStones,
      params.selectedStoneId,
      craftable.materials.stone.quantity
    );
  }
  if (craftable.materials.wood && params.selectedWoodId) {
    newWoods = consumeFromStacks(
      newWoods,
      params.selectedWoodId,
      craftable.materials.wood.quantity
    );
  }

  const newInventory: Inventory = {
    ...state.inventory,
    stones: newStones,
    woods: newWoods,
  };

  // Consume components
  let newOwnedComponents = state.ownedComponents;
  if (params.selectedComponentIds && params.selectedComponentIds.length > 0) {
    newOwnedComponents = newOwnedComponents.filter(
      (c) => !params.selectedComponentIds!.includes(c.instanceId)
    );
  }

  // Create the crafted item and update appropriate inventory
  if (isTool(craftable)) {
    const newTool: OwnedTool = {
      instanceId: generateInstanceId(craftable.id),
      toolId: craftable.id,
      materials: usedMaterials,
      quality,
    };

    const newState: CraftingState = {
      inventory: newInventory,
      unlockedTechs: state.unlockedTechs,
      ownedTools: [...state.ownedTools, newTool],
      ownedComponents: newOwnedComponents,
    };

    return { success: true, newState, craftedItem: newTool };
  } else {
    const newComponent: OwnedComponent = {
      instanceId: generateInstanceId(craftable.id),
      componentId: craftable.id,
      materials: usedMaterials,
      quality,
    };

    const newState: CraftingState = {
      inventory: newInventory,
      unlockedTechs: state.unlockedTechs,
      ownedTools: state.ownedTools,
      ownedComponents: [...newOwnedComponents, newComponent],
    };

    return { success: true, newState, craftedItem: newComponent };
  }
}

// Export the service as a namespace-like object
export const CraftingService = {
  canCraft,
  craft,
};
