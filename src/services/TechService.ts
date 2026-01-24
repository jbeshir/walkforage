// TechService - Pure tech unlock operations
// Extracted from useGameState for reuse in validation scripts and tests

import { Technology } from '../types/tech';
import { Inventory } from '../types/resources';
import { TECH_BY_ID } from '../data/techTree';
import { MaterialType } from '../config/materials';
import { getTotalResourceCount, removeResource } from './InventoryService';

/**
 * Result of checking if a tech can be unlocked
 */
export interface TechUnlockCheck {
  canUnlock: boolean;
  missingPrereqs: string[];
  missingResources: { resourceType: MaterialType; needed: number; have: number }[];
}

/**
 * Result of unlocking a tech
 */
export interface TechUnlockResult {
  success: boolean;
  newInventory?: Inventory;
  newUnlockedTechs?: string[];
  error?: string;
}

/**
 * Selected resources for unlocking a tech
 * Maps resource type to array of { resourceId, quantity }
 */
export type SelectedTechResources = Partial<
  Record<MaterialType, { resourceId: string; quantity: number }[]>
>;

/**
 * Check if a tech can be unlocked with current state
 */
export function canUnlockTech(
  tech: Technology,
  unlockedTechs: string[],
  inventory: Inventory
): TechUnlockCheck {
  // Check prerequisites
  const missingPrereqs = tech.prerequisites.filter((id) => !unlockedTechs.includes(id));

  // Check resource requirements
  const missingResources: { resourceType: MaterialType; needed: number; have: number }[] = [];
  for (const cost of tech.resourceCost) {
    const have = getTotalResourceCount(inventory, cost.resourceType);
    if (have < cost.quantity) {
      missingResources.push({
        resourceType: cost.resourceType,
        needed: cost.quantity,
        have,
      });
    }
  }

  return {
    canUnlock: missingPrereqs.length === 0 && missingResources.length === 0,
    missingPrereqs,
    missingResources,
  };
}

/**
 * Get the next tech cost for a resource type
 */
export function getTechResourceCost(tech: Technology, resourceType: MaterialType): number {
  const cost = tech.resourceCost.find((c) => c.resourceType === resourceType);
  return cost?.quantity ?? 0;
}

/**
 * Unlock a tech, consuming resources
 * Returns the new state or an error
 */
export function unlockTech(
  tech: Technology,
  unlockedTechs: string[],
  inventory: Inventory,
  selectedResources: SelectedTechResources
): TechUnlockResult {
  // Check if already unlocked
  if (unlockedTechs.includes(tech.id)) {
    return { success: false, error: `Tech "${tech.id}" is already unlocked` };
  }

  // Check prerequisites
  const check = canUnlockTech(tech, unlockedTechs, inventory);
  if (check.missingPrereqs.length > 0) {
    return {
      success: false,
      error: `Missing prerequisites: ${check.missingPrereqs.join(', ')}`,
    };
  }

  // Validate and consume selected resources
  let newInventory = { ...inventory };

  for (const cost of tech.resourceCost) {
    const selections = selectedResources[cost.resourceType];
    if (!selections || selections.length === 0) {
      return {
        success: false,
        error: `No ${cost.resourceType} selected for tech unlock`,
      };
    }

    // Check total quantity
    const totalSelected = selections.reduce((sum, s) => sum + s.quantity, 0);
    if (totalSelected < cost.quantity) {
      return {
        success: false,
        error: `Not enough ${cost.resourceType} selected (need ${cost.quantity}, selected ${totalSelected})`,
      };
    }

    // Consume resources
    for (const selection of selections) {
      if (selection.quantity > 0) {
        const result = removeResource(
          newInventory,
          cost.resourceType,
          selection.resourceId,
          selection.quantity
        );
        if (!result) {
          return {
            success: false,
            error: `Not enough ${selection.resourceId} in inventory`,
          };
        }
        newInventory = result;
      }
    }
  }

  // Add tech to unlocked list
  const newUnlockedTechs = [...unlockedTechs, tech.id];

  return {
    success: true,
    newInventory,
    newUnlockedTechs,
  };
}

/**
 * Check if a tech is unlocked
 */
export function hasTech(techId: string, unlockedTechs: string[]): boolean {
  return unlockedTechs.includes(techId);
}

/**
 * Get a tech by ID
 */
export function getTechById(techId: string): Technology | undefined {
  return TECH_BY_ID[techId];
}

/**
 * Get all available techs (unlocked prerequisites, not yet unlocked)
 */
export function getAvailableTechs(unlockedTechs: string[], allTechs: Technology[]): Technology[] {
  return allTechs.filter((tech) => {
    // Not already unlocked
    if (unlockedTechs.includes(tech.id)) return false;
    // All prerequisites met
    return tech.prerequisites.every((prereq) => unlockedTechs.includes(prereq));
  });
}

// Export the service as a namespace-like object for consistency
export const TechService = {
  canUnlockTech,
  unlockTech,
  hasTech,
  getTechById,
  getAvailableTechs,
  getTechResourceCost,
};
