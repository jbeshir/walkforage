// Quality Calculation Utility for WalkForage
// Calculates tool quality based on material properties
// Quality is a single 0-1 score; gathering modifiers are calculated at display/usage time

import {
  UsedMaterials,
  QualityTier,
  QualityWeights,
  Craftable,
  MaterialQualityWeights,
} from '../types/tools';
import {
  getMaterialConfig,
  getAllMaterialTypes,
  MaterialType,
  PropertyDefinition,
} from '../config/materials';
import { ResourceProperties } from '../types/resources';
import { capitalizeFirst } from './strings';

// Normalize a property value using the schema's min/max values
function normalizeProperty(value: number, schema: PropertyDefinition): number {
  const range = schema.maxValue - schema.minValue;
  if (range === 0) return 0;
  return (value - schema.minValue) / range;
}

// Get material properties, returning null if not found
function getMaterialProperties(
  materialId: string,
  materialType: MaterialType
): ResourceProperties | null {
  const config = getMaterialConfig(materialType);
  const resource = config.getResourceById(materialId);
  return resource?.properties || null;
}

// Calculate weighted quality score for a single material using its property schema
function calculateMaterialScore(
  properties: ResourceProperties,
  weights: MaterialQualityWeights,
  schema: PropertyDefinition[]
): number {
  let score = 0;
  for (const prop of schema) {
    const value = properties[prop.id] ?? 0;
    const weight = weights[prop.id] ?? 0;
    const normalized = normalizeProperty(value, prop);
    score += normalized * weight;
  }
  return score;
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
  return capitalizeFirst(tier);
}

/**
 * Get the quality weights for a specific material type from a QualityWeights object.
 * Falls back to the material type's default weights if not specified.
 */
function getWeightsForMaterial(
  qualityWeights: QualityWeights,
  materialType: MaterialType
): MaterialQualityWeights {
  const explicitWeights = qualityWeights[materialType];
  if (explicitWeights) return explicitWeights;

  // Fall back to material type's default weights
  const config = getMaterialConfig(materialType);
  return config.defaultQualityWeights;
}

/**
 * Calculate quality score for a craftable item (Tool or CraftedComponent)
 * Uses the item's own qualityWeights (per material type) instead of requiring category to be passed
 */
export function calculateCraftableQuality(craftable: Craftable, materials: UsedMaterials): number {
  const qualityWeights = craftable.qualityWeights;
  let totalScore = 0;
  let materialCount = 0;

  // Iterate over all material types dynamically
  for (const materialType of getAllMaterialTypes()) {
    const usedMaterial = materials[materialType];
    if (usedMaterial) {
      const props = getMaterialProperties(usedMaterial.resourceId, materialType);
      if (props) {
        const config = getMaterialConfig(materialType);
        const weights = getWeightsForMaterial(qualityWeights, materialType);
        totalScore += calculateMaterialScore(props, weights, config.propertySchema);
        materialCount++;
      }
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
  qualityWeights: QualityWeights
): number {
  const props = getMaterialProperties(materialId, materialType);
  if (!props) return 0;

  const config = getMaterialConfig(materialType);
  const weights = getWeightsForMaterial(qualityWeights, materialType);
  return calculateMaterialScore(props, weights, config.propertySchema);
}
