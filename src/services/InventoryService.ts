// InventoryService - Pure inventory operations
// Extracted from useGameState for reuse in validation scripts and tests

import { Inventory, ResourceStack, createEmptyInventory } from '../types/resources';
import { MaterialType, getAllMaterialTypes } from '../config/materials';

/**
 * Add a resource to an inventory (pure function)
 * Returns a new inventory with the resource added
 */
export function addResource(
  inventory: Inventory,
  category: MaterialType,
  resourceId: string,
  quantity: number
): Inventory {
  const stacks = [...inventory[category]];
  const index = stacks.findIndex((s) => s.resourceId === resourceId);

  if (index >= 0) {
    stacks[index] = {
      ...stacks[index],
      quantity: stacks[index].quantity + quantity,
    };
  } else {
    stacks.push({ resourceId, quantity });
  }

  return { ...inventory, [category]: stacks };
}

/**
 * Remove a resource from an inventory (pure function)
 * Returns a new inventory with the resource removed, or null if insufficient quantity
 */
export function removeResource(
  inventory: Inventory,
  category: MaterialType,
  resourceId: string,
  quantity: number
): Inventory | null {
  const stacks = [...inventory[category]];
  const index = stacks.findIndex((s) => s.resourceId === resourceId);

  if (index < 0 || stacks[index].quantity < quantity) {
    return null;
  }

  stacks[index] = {
    ...stacks[index],
    quantity: stacks[index].quantity - quantity,
  };

  if (stacks[index].quantity === 0) {
    stacks.splice(index, 1);
  }

  return { ...inventory, [category]: stacks };
}

/**
 * Get the quantity of a specific resource in an inventory
 */
export function getResourceCount(
  inventory: Inventory,
  category: MaterialType,
  resourceId: string
): number {
  const stack = inventory[category].find((s) => s.resourceId === resourceId);
  return stack?.quantity ?? 0;
}

/**
 * Get the total quantity of all resources in a category
 */
export function getTotalResourceCount(inventory: Inventory, category: MaterialType): number {
  return inventory[category].reduce((sum, s) => sum + s.quantity, 0);
}

/**
 * Check if an inventory has at least a certain quantity of a resource
 */
export function hasResource(
  inventory: Inventory,
  category: MaterialType,
  resourceId: string,
  quantity: number
): boolean {
  return getResourceCount(inventory, category, resourceId) >= quantity;
}

/**
 * Get all resources of a specific category from inventory
 */
export function getResourcesInCategory(
  inventory: Inventory,
  category: MaterialType
): ResourceStack[] {
  return inventory[category];
}

/**
 * Merge two inventories (adds all resources from source to target)
 * Returns a new inventory
 */
export function mergeInventories(target: Inventory, source: Inventory): Inventory {
  let result = { ...target };

  for (const category of getAllMaterialTypes()) {
    for (const stack of source[category]) {
      result = addResource(result, category, stack.resourceId, stack.quantity);
    }
  }

  return result;
}

// Export the service as a namespace-like object for consistency with CraftingService
export const InventoryService = {
  addResource,
  removeResource,
  getResourceCount,
  getTotalResourceCount,
  hasResource,
  getResourcesInCategory,
  mergeInventories,
  createEmptyInventory,
};
