// Technology Tree Types for WalkForage
// Supports multiple tech eras, currently focused on lithic (stone age)

import { MaterialType } from '../config/materials';

// Lithic era subdivisions
export type LithicEra =
  | 'lower_paleolithic' // ~3.3M - 300K years ago
  | 'middle_paleolithic' // ~300K - 50K years ago
  | 'upper_paleolithic' // ~50K - 12K years ago
  | 'mesolithic'; // ~12K - 6K years ago

// Future eras can be added here
// export type MetalEra = 'copper' | 'bronze' | 'iron';

// Union of all tech eras - extend as new eras are added
export type TechEra = LithicEra; // | MetalEra | ...

// All lithic eras in chronological order
export const LITHIC_ERAS: LithicEra[] = [
  'lower_paleolithic',
  'middle_paleolithic',
  'upper_paleolithic',
  'mesolithic',
];

// Display colors for each era
export const ERA_COLORS: Record<LithicEra, string> = {
  lower_paleolithic: '#8B7355',
  middle_paleolithic: '#708090',
  upper_paleolithic: '#CD7F32',
  mesolithic: '#4A6741',
};

// Full display names for each era
export const ERA_NAMES: Record<LithicEra, string> = {
  lower_paleolithic: 'Lower Paleolithic',
  middle_paleolithic: 'Middle Paleolithic',
  upper_paleolithic: 'Upper Paleolithic',
  mesolithic: 'Mesolithic',
};

// Short labels for compact display
export const ERA_LABELS: Record<LithicEra, string> = {
  lower_paleolithic: 'LP',
  middle_paleolithic: 'MP',
  upper_paleolithic: 'UP',
  mesolithic: 'MS',
};

// Resource cost for technologies - uses generic types (any stone, any wood)
export interface TechResourceCost {
  resourceType: MaterialType; // Generic resource category
  quantity: number;
}

export interface Technology {
  id: string;
  name: string;
  era: TechEra;
  description: string;

  // What's needed to unlock this tech
  prerequisites: string[]; // Tech IDs that must be unlocked first
  resourceCost: TechResourceCost[];

  // What this tech enables
  unlocks: string[]; // Other tech IDs
  enablesRecipes: string[]; // Recipe IDs
}
