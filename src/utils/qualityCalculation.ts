// Quality Calculation Utility for WalkForage
// Calculates tool quality based on material properties (hardness, workability, durability)
// Quality is a single 0-1 score; gathering modifiers are calculated at display/usage time

import {
  UsedMaterials,
  QualityTier,
  QualityWeights,
  MaterialType,
  Craftable,
  getQualityTier,
} from '../types/tools';
import { STONES_BY_ID } from '../data/stones';
import { WOODS_BY_ID } from '../data/woods';
import { ResourceProperties } from '../types/resources';

// Re-export QualityWeights for convenience
export type { QualityWeights };

// Normalize a property value (1-10) to 0-1 scale
function normalizeProperty(value: number): number {
  return (value - 1) / 9;
}

// Get material properties, returning null if not found
function getMaterialProperties(
  materialId: string,
  materialType: MaterialType
): ResourceProperties | null {
  if (materialType === 'stone') {
    const stone = STONES_BY_ID[materialId];
    return stone?.properties || null;
  } else {
    const wood = WOODS_BY_ID[materialId];
    return wood?.properties || null;
  }
}

// Calculate weighted quality score for a single material
export function calculateMaterialScore(
  properties: ResourceProperties,
  weights: QualityWeights
): number {
  const normHardness = normalizeProperty(properties.hardness);
  const normWorkability = normalizeProperty(properties.workability);
  const normDurability = normalizeProperty(properties.durability);

  return (
    normHardness * weights.hardnessWeight +
    normWorkability * weights.workabilityWeight +
    normDurability * weights.durabilityWeight
  );
}

// Get display color for quality tier
export function getQualityColor(tier: QualityTier): string {
  switch (tier) {
    case 'poor':
      return '#9E9E9E'; // Gray
    case 'adequate':
      return '#8BC34A'; // Light green
    case 'good':
      return '#4CAF50'; // Green
    case 'excellent':
      return '#2196F3'; // Blue
    case 'masterwork':
      return '#9C27B0'; // Purple
    default:
      return '#9E9E9E';
  }
}

// Get display name for quality tier
export function getQualityDisplayName(tier: QualityTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

// Re-export getQualityTier for convenience
export { getQualityTier };

/**
 * Calculate quality score for a craftable item (Tool or CraftedComponent)
 * Uses the item's own qualityWeights instead of requiring category to be passed
 */
export function calculateCraftableQuality(craftable: Craftable, materials: UsedMaterials): number {
  const weights = craftable.qualityWeights;
  let totalScore = 0;
  let materialCount = 0;

  if (materials.stoneId) {
    const stoneProps = getMaterialProperties(materials.stoneId, 'stone');
    if (stoneProps) {
      totalScore += calculateMaterialScore(stoneProps, weights);
      materialCount++;
    }
  }

  if (materials.woodId) {
    const woodProps = getMaterialProperties(materials.woodId, 'wood');
    if (woodProps) {
      totalScore += calculateMaterialScore(woodProps, weights);
      materialCount++;
    }
  }

  if (materialCount === 0) return 0.1;
  return Math.min(1, Math.max(0, totalScore / materialCount));
}

/**
 * Calculate expected quality for a single material given quality weights
 * Used for sorting materials in crafting UI
 */
export function calculateMaterialQualityWithWeights(
  materialId: string,
  materialType: MaterialType,
  weights: QualityWeights
): number {
  const props = getMaterialProperties(materialId, materialType);
  if (!props) return 0;
  return calculateMaterialScore(props, weights);
}
