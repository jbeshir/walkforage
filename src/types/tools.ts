// Tool Crafting System Types for WalkForage
// Lithic era (stone age) focused tool system
// Tools track actual materials used, with quality derived from material properties

import { TechEra } from './tech';
import { MaterialType } from '../config/materials';

// Tool categories for organization and bonuses
export type ToolCategory =
  | 'knapping' // Stone tool making (hammerstone, pressure flaker)
  | 'woodworking' // Axes, adzes
  | 'cutting' // Knives
  | 'foraging' // Digging sticks, etc.
  | 'general'; // Multi-purpose tools

// Component types for intermediate crafting
export type ComponentCategory =
  | 'handle' // Wooden handles of various quality
  | 'binding'; // Fiber bindings

// Quality calculation weights - determines how material properties affect quality
export interface QualityWeights {
  hardnessWeight: number;
  workabilityWeight: number;
  durabilityWeight: number;
}

// Generic material requirement (works for any material type)
export interface MaterialRequirement {
  quantity: number;
  requiresToolstone?: boolean; // Only meaningful for materials with hasToolstone flag (stone)
}

// Material requirements for a craftable (partial record - each material type can appear once)
export type MaterialRequirements = Partial<Record<MaterialType, MaterialRequirement>>;

// Single used material entry (tracks actual material used)
export interface UsedMaterial {
  resourceId: string;
  quantity: number;
}

// Materials used in a crafted tool/component (partial record keyed by material type)
export type UsedMaterials = Partial<Record<MaterialType, UsedMaterial>>;

// Helper functions for UsedMaterials compatibility

/** Get the resource ID for a material type from UsedMaterials */
export function getUsedMaterialId(
  materials: UsedMaterials,
  type: MaterialType
): string | undefined {
  return materials[type]?.resourceId;
}

/** Get the quantity for a material type from UsedMaterials */
export function getUsedMaterialQuantity(
  materials: UsedMaterials,
  type: MaterialType
): number | undefined {
  return materials[type]?.quantity;
}

/** Create UsedMaterials from individual selections */
export function createUsedMaterials(
  selections: { type: MaterialType; resourceId: string; quantity: number }[]
): UsedMaterials {
  const materials: UsedMaterials = {};
  for (const { type, resourceId, quantity } of selections) {
    materials[type] = { resourceId, quantity };
  }
  return materials;
}

// Quality tier for display purposes
export type QualityTier = 'poor' | 'adequate' | 'good' | 'excellent' | 'masterwork';

// Component requirement for tools
export interface ComponentRequirement {
  componentId: string;
  quantity: number;
}

// A crafted component (intermediate item)
export interface CraftedComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  era: TechEra;
  description: string;

  // What tech must be unlocked to craft this
  requiredTech: string;

  // Tool IDs needed to craft this component
  requiredTools: string[];

  // Pre-crafted components needed (allows components to require other components)
  requiredComponents: ComponentRequirement[];

  // Materials consumed (player chooses specific materials)
  materials: MaterialRequirements;

  // Quality calculation weights for this component type
  qualityWeights: QualityWeights;

  // Crafting time in seconds (base, modified by tool quality)
  baseCraftTime: number;

  // Properties that affect final tool quality
  properties: {
    durabilityBonus: number; // Added to final tool durability
    efficiencyBonus: number; // Affects tool speed
    qualityTier: number; // 1-5, affects possible upgrades
  };
}

// Owned component instance with tracked materials
export interface OwnedComponent {
  instanceId: string;
  componentId: string;
  materials: UsedMaterials;
  quality: number; // 0-1, derived from materials
}

// Base stats for a tool before material modifiers
export interface ToolBaseStats {
  gatheringBonus: number; // Additive gathering bonus (0 = no change, 0.2 = +20%, etc.)
}

// The main Tool definition
export interface Tool {
  id: string;
  name: string;
  category: ToolCategory;
  era: TechEra;
  description: string;

  // Prerequisites
  requiredTech: string; // Tech that unlocks this recipe
  requiredTools: string[]; // Tool IDs needed to craft
  requiredComponents: ComponentRequirement[]; // Pre-crafted components needed
  materials: MaterialRequirements; // Raw materials consumed (player chooses specific)

  // Base stats before material quality modifiers
  baseStats: ToolBaseStats;

  // What material category this tool helps gather (must match an Inventory key)
  gatheringMaterial?: MaterialType;

  // Quality calculation weights for this tool type
  qualityWeights: QualityWeights;

  // Crafting
  baseCraftTime: number; // Base seconds to craft
}

// Player's owned tool instance
export interface OwnedTool {
  instanceId: string; // Unique ID for this specific tool
  toolId: string; // Reference to Tool definition
  materials: UsedMaterials; // What materials were used
  quality: number; // 0-1 scale quality score
}

// Crafting job in queue
export interface CraftingJob {
  id: string;
  recipeType: 'tool' | 'component';
  recipeId: string;
  startTime: number;
  duration: number; // seconds
  selectedMaterials: UsedMaterials;
}

// Quality tier thresholds for display
export const QUALITY_TIER_THRESHOLDS = {
  poor: 0.2,
  adequate: 0.4,
  good: 0.6,
  excellent: 0.8,
  masterwork: 1.0,
};

// Get quality tier from score (0-1)
// Score is rounded to nearest 1% to ensure consistency with displayed percentages
export function getQualityTier(score: number): QualityTier {
  // Round to 2 decimal places (1% precision) to match display rounding
  const roundedScore = Math.round(score * 100) / 100;
  if (roundedScore < QUALITY_TIER_THRESHOLDS.poor) return 'poor';
  if (roundedScore < QUALITY_TIER_THRESHOLDS.adequate) return 'adequate';
  if (roundedScore < QUALITY_TIER_THRESHOLDS.good) return 'good';
  if (roundedScore < QUALITY_TIER_THRESHOLDS.excellent) return 'excellent';
  return 'masterwork';
}

// Calculate gathering bonus for a tool based on its quality and base stats
// Returns an additive bonus (0 = no change, positive = help)
export function calculateGatheringBonus(tool: Tool, quality: number): number {
  // Only tools with gathering materials get a bonus
  if (!tool.gatheringMaterial) return 0;

  // Quality scales the bonus linearly from 0 to full bonus
  // At quality 0: no bonus (0)
  // At quality 1: full base bonus
  return tool.baseStats.gatheringBonus * quality;
}

// Interface for anything that can be crafted (Tool or CraftedComponent)
export interface Craftable {
  qualityWeights: QualityWeights;
  materials: MaterialRequirements;
  requiredComponents: ComponentRequirement[];
}

// Type guard to distinguish Tool from CraftedComponent
// Tool has baseStats which CraftedComponent doesn't
export function isTool(craftable: Tool | CraftedComponent): craftable is Tool {
  return 'baseStats' in craftable;
}
