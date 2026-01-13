// Tool Crafting System Types for WalkForage
// Realistic tool hierarchy where tools require other tools to craft

import { TechEra } from './tech';
import { ResourceRequirement } from './tech';

// Tool categories for organization and bonuses
export type ToolCategory =
  | 'knapping'      // Stone tool making
  | 'woodworking'   // Axes, saws, adzes, chisels
  | 'metalworking'  // Hammers, tongs, anvils
  | 'mining'        // Pickaxes, shovels
  | 'masonry'       // Stone chisels, mallets
  | 'fire'          // Fire bows, bellows
  | 'general';      // Multi-purpose tools

// Component types for intermediate crafting
export type ComponentCategory =
  | 'handle'        // Wooden handles of various quality
  | 'binding'       // Fiber, leather, metal bands
  | 'head'          // Stone, copper, bronze, iron, steel heads
  | 'fixture'       // Rivets, wedges, sockets
  | 'container';    // Crucibles, molds

// Material tiers that determine tool quality
export type MaterialTier = 'primitive' | 'stone' | 'copper' | 'bronze' | 'iron' | 'steel';

// Requirement for a specific tool (with minimum tier)
export interface ToolRequirement {
  toolId: string;
  minTier: MaterialTier;
  consumesDurability: number; // How much durability this uses (0 = none)
}

// Requirement for a component
export interface ComponentRequirement {
  componentId: string;
  quantity: number;
}

// Tool stats that affect gameplay
export interface ToolStats {
  durability: number;           // How many uses before breaking
  maxDurability: number;        // Maximum durability (for repairs)
  efficiency: number;           // Speed multiplier (1.0 = base)
  gatheringBonus: number;       // Multiplier for resource gathering
  craftingBonus: number;        // Multiplier for crafting speed
  hardnessRating: number;       // What hardness materials it can work (1-10)
  canRepair: boolean;           // Can this tool be repaired?
  repairMaterial: string | null;  // What material repairs it
  specialAbilities: string[];   // e.g., 'fire_starting', 'precision_cutting'
}

// A crafted component (intermediate item)
export interface CraftedComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  tier: MaterialTier;
  description: string;

  // What tech must be unlocked to craft this
  requiredTech: string;

  // Tools needed to craft this component
  requiredTools: ToolRequirement[];

  // Materials consumed
  materials: ResourceRequirement[];

  // Crafting time in seconds (base, modified by tool quality)
  baseCraftTime: number;

  // Which building/workstation is needed (null = can craft anywhere)
  requiredWorkstation: string | null;

  // Properties that affect final tool quality
  properties: {
    durabilityBonus: number;  // Added to final tool durability
    efficiencyBonus: number;  // Affects tool speed
    qualityTier: number;      // 1-5, affects possible upgrades
  };
}

// The main Tool definition
export interface Tool {
  id: string;
  name: string;
  category: ToolCategory;
  tier: MaterialTier;
  era: TechEra;
  description: string;

  // Prerequisites
  requiredTech: string;                    // Tech that unlocks this recipe
  requiredTools: ToolRequirement[];        // Other tools needed to craft
  requiredComponents: ComponentRequirement[]; // Pre-crafted components needed
  materials: ResourceRequirement[];        // Raw materials consumed

  // Crafting
  baseCraftTime: number;                   // Base seconds to craft
  requiredWorkstation: string | null;      // Building needed (null = anywhere)

  // Tool properties
  stats: ToolStats;

  // What this tool enables
  enablesCrafting: string[];     // Recipe IDs this tool unlocks
  enablesGathering: string[];    // Resource types this helps gather

  // Upgrade path (if any)
  upgradesTo: string | null;     // Tool ID of upgraded version
  upgradesFrom: string | null;   // Tool ID this upgrades from
}

// Player's owned tool instance (with current durability, etc.)
export interface OwnedTool {
  instanceId: string;           // Unique ID for this specific tool
  toolId: string;               // Reference to Tool definition
  currentDurability: number;
  timesRepaired: number;        // Affects max durability over time
  quality: 'poor' | 'normal' | 'good' | 'excellent'; // Crafting RNG result
  createdAt: number;            // Timestamp
}

// Player's tool inventory (replaces simple ToolSet)
export interface PlayerToolInventory {
  ownedTools: OwnedTool[];
  componentInventory: Record<string, number>; // Component ID -> count
}

// Crafting job in queue
export interface CraftingJob {
  id: string;
  recipeType: 'tool' | 'component';
  recipeId: string;
  startTime: number;
  duration: number;  // seconds
  workstationId: string | null;
  toolsUsed: { instanceId: string; durabilityLoss: number }[];
}

// Tier ordering for comparisons
export const TIER_ORDER: MaterialTier[] = [
  'primitive', 'stone', 'copper', 'bronze', 'iron', 'steel'
];

export function compareTiers(a: MaterialTier, b: MaterialTier): number {
  return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b);
}

export function isTierAtLeast(tool: MaterialTier, required: MaterialTier): boolean {
  return compareTiers(tool, required) >= 0;
}

// Quality multipliers
export const QUALITY_MULTIPLIERS: Record<OwnedTool['quality'], number> = {
  poor: 0.75,
  normal: 1.0,
  good: 1.25,
  excellent: 1.5,
};
