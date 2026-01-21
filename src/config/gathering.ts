// Configuration constants for step-based resource gathering
// These values control how steps are converted to resources

import { MaterialType, getMaterialConfig } from './materials';
import { OwnedTool, calculateGatheringBonus } from '../types/tools';
import { getToolById } from '../data/tools';

/**
 * Steps required per gather action (stone or wood)
 * 1000 steps (~0.7-0.8 km) = 1 gather
 */
export const STEPS_PER_GATHER = 1000;

/**
 * Calculate how many gathers are available with current steps
 */
export function calculateGatherableAmount(availableSteps: number): number {
  return Math.floor(availableSteps / STEPS_PER_GATHER);
}

/**
 * Get the sum of gathering bonuses from the best tool of each tool type.
 * For example, if you have a Stone Knife and a Polished Axe, both for wood,
 * you get the bonus from the best Stone Knife + the bonus from the best Polished Axe.
 */
function getTotalToolBonusForMaterial(materialType: MaterialType, ownedTools: OwnedTool[]): number {
  // Group tools by toolId, keeping only the best (highest bonus) of each type
  const bestByToolType = new Map<string, number>(); // toolId -> best bonus

  for (const owned of ownedTools) {
    const tool = getToolById(owned.toolId);
    if (!tool || tool.gatheringMaterial !== materialType) continue;

    const bonus = calculateGatheringBonus(tool, owned.quality);
    const existingBest = bestByToolType.get(owned.toolId) || 0;
    if (bonus > existingBest) {
      bestByToolType.set(owned.toolId, bonus);
    }
  }

  // Sum the best bonus from each tool type
  let totalBonus = 0;
  for (const bonus of bestByToolType.values()) {
    totalBonus += bonus;
  }

  return totalBonus;
}

/**
 * Calculate the total gathering ability for a material type.
 * gatheringAbility = baseGatheringAbility + sum of best tool bonus per tool type
 *
 * If the total ability is < 1, returns 0 (gathering disabled).
 * This can happen if a material has baseGatheringAbility of 0 and the player
 * has no tools or very low quality tools for that material.
 */
export function calculateGatheringAbility(
  materialType: MaterialType,
  ownedTools: OwnedTool[]
): number {
  const config = getMaterialConfig(materialType);
  const baseAbility = config.baseGatheringAbility ?? 1;
  const toolBonus = getTotalToolBonusForMaterial(materialType, ownedTools);
  const totalAbility = baseAbility + toolBonus;

  // If ability < 1, gathering is disabled for this material
  return totalAbility < 1 ? 0 : totalAbility;
}

/**
 * Calculate the yield for a single gather action.
 * Returns a random value between 1 and (2 * gatheringAbility - 1).
 *
 * Examples:
 * - Ability 1 (no tools): always 1
 * - Ability 2 (basic tool): 1-3
 * - Ability 3: 1-5
 * - Ability 5: 1-9
 */
export function calculateGatherYield(gatheringAbility: number): number {
  const maxYield = Math.max(1, Math.floor(2 * gatheringAbility - 1));
  // Random between 1 and maxYield (inclusive)
  return Math.floor(Math.random() * maxYield) + 1;
}
