// CraftingService - Unified crafting logic for tools and components
// Extracted from useGameState to enable testing and cleaner separation of concerns

import { Inventory, ResourceStack, isToolstone } from '../types/resources';
import {
  Tool,
  CraftedComponent,
  OwnedTool,
  OwnedComponent,
  UsedMaterials,
  MaterialRequirements,
  MaterialRequirement,
  isTool,
} from '../types/tools';
import { MaterialType, getMaterialConfig, getAllMaterialTypes } from '../config/materials';
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
  // Available materials keyed by material type
  availableMaterials: Partial<Record<MaterialType, string[]>>;
  // Available component instance IDs
  availableComponents: string[];
}

// Parameters for crafting
export interface CraftParams {
  // Selected materials keyed by material type
  selectedMaterials?: Partial<Record<MaterialType, string>>;
  // Selected component instance IDs
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

// Helper: Find materials in inventory that meet a requirement
function findAvailableMaterials(
  stacks: ResourceStack[],
  materialType: MaterialType,
  requirement: MaterialRequirement
): string[] {
  const available: string[] = [];
  const config = getMaterialConfig(materialType);

  for (const stack of stacks) {
    if (stack.quantity >= requirement.quantity) {
      const resource = config.getResourceById(stack.resourceId);
      if (resource) {
        // Check toolstone requirement if applicable
        if (requirement.requiresToolstone && config.hasToolstone) {
          if (isToolstone(resource)) {
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
  const availableMaterials: Partial<Record<MaterialType, string[]>> = {};

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

  // Check material requirements and find available options - now dynamic
  const { materials } = craftable;
  for (const materialType of getAllMaterialTypes()) {
    const requirement = materials[materialType];
    if (requirement) {
      const config = getMaterialConfig(materialType);
      const available = findAvailableMaterials(
        state.inventory[materialType],
        materialType,
        requirement
      );
      availableMaterials[materialType] = available;

      if (available.length === 0) {
        const toolstoneNote = requirement.requiresToolstone ? ' (toolstone)' : '';
        missing.push(
          `Material: ${requirement.quantity}x ${config.singularName.toLowerCase()}${toolstoneNote}`
        );
      }
    }
  }

  return {
    canCraft: missing.length === 0,
    missingRequirements: missing,
    availableMaterials,
    availableComponents: availableComponentIds,
  };
}

/**
 * Get selected material ID from params
 */
function getSelectedMaterial(params: CraftParams, materialType: MaterialType): string | undefined {
  return params.selectedMaterials?.[materialType];
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

  // Validate each required material type
  for (const materialType of getAllMaterialTypes()) {
    const requirement = materials[materialType];
    if (!requirement) continue;

    const config = getMaterialConfig(materialType);
    const selectedId = getSelectedMaterial(params, materialType);

    if (!selectedId) {
      return { error: `${config.singularName} material not selected` };
    }

    const count = getResourceCount(inventory[materialType], selectedId);
    if (count < requirement.quantity) {
      return { error: `Not enough ${selectedId}` };
    }

    // Check toolstone requirement if applicable
    if (requirement.requiresToolstone && config.hasToolstone) {
      const resource = config.getResourceById(selectedId);
      if (!resource || !isToolstone(resource)) {
        return { error: `${selectedId} is not a toolstone` };
      }
    }

    usedMaterials[materialType] = {
      resourceId: selectedId,
      quantity: requirement.quantity,
    };
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

  // Build new inventory (consume materials) - now dynamic
  const newInventory: Inventory = { ...state.inventory };
  for (const materialType of getAllMaterialTypes()) {
    const used = usedMaterials[materialType];
    if (used) {
      newInventory[materialType] = consumeFromStacks(
        state.inventory[materialType],
        used.resourceId,
        used.quantity
      );
    }
  }

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
