// Technology Tree Types for WalkForage
// Based on real historical material progression

export type TechEra = 'stone' | 'copper' | 'bronze' | 'iron' | 'advanced';

export interface TechRequirement {
  techId: string;
  type: 'prerequisite';
}

export interface ResourceRequirement {
  resourceId: string;
  quantity: number;
}

export interface Technology {
  id: string;
  name: string;
  era: TechEra;
  description: string;

  // What's needed to unlock this tech
  prerequisites: TechRequirement[];
  resourceCost: ResourceRequirement[];

  // What this tech enables
  unlocks: string[];           // Other tech IDs
  enablesBuildings: string[];  // Building IDs
  enablesRecipes: string[];    // Recipe IDs

  // Gameplay modifiers
  gatheringBonus?: {
    resourceType: string;
    multiplier: number;
  };
  craftingBonus?: {
    category: string;
    speedMultiplier: number;
  };

  // Display
  icon: string;
  position: { x: number; y: number };  // For tech tree visualization
}

export interface TechProgress {
  unlockedTechs: string[];
  currentResearch: string | null;
  researchProgress: number;  // 0-100%
}

// Tool quality affects gathering and crafting
export type ToolTier = 'none' | 'stone' | 'copper' | 'bronze' | 'iron' | 'steel';

export interface ToolSet {
  pickaxe: ToolTier;
  axe: ToolTier;
  hammer: ToolTier;
  saw: ToolTier;
  chisel: ToolTier;
}

export const TOOL_MULTIPLIERS: Record<ToolTier, number> = {
  none: 0.25,
  stone: 1.0,
  copper: 1.5,
  bronze: 2.0,
  iron: 3.0,
  steel: 4.0,
};
