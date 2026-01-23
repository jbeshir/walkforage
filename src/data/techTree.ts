// Technology Tree - Lithic Era (Stone Age) Technologies
// Focused on realistic stone age tool progression

import { Technology, LithicEra } from '../types/tech';
import { createByIdMap } from '../utils/collections';

export const TECHNOLOGIES: Technology[] = [
  // ===== LOWER PALEOLITHIC (~3.3M - 300K years ago) =====
  // The earliest stone tool traditions
  {
    id: 'basic_knapping',
    name: 'Basic Knapping',
    era: 'lower_paleolithic',
    description:
      'The fundamental skill of striking stone to create sharp edges. The foundation of all stone tool technology.',
    prerequisites: [],
    resourceCost: [
      { resourceType: 'stone', quantity: 10 },
      { resourceType: 'food', quantity: 5 },
    ],
    unlocks: ['grinding', 'cordage_making'],
    enablesRecipes: ['hammerstone', 'hand_axe'],
  },
  {
    id: 'grinding',
    name: 'Grinding',
    era: 'lower_paleolithic',
    description:
      'Using abrasive stones to smooth and shape other stones. Essential for creating certain tool types.',
    prerequisites: ['basic_knapping'],
    resourceCost: [
      { resourceType: 'stone', quantity: 15 },
      { resourceType: 'food', quantity: 5 },
    ],
    unlocks: [],
    enablesRecipes: ['grinding_stone'],
  },
  {
    id: 'cordage_making',
    name: 'Cordage Making',
    era: 'lower_paleolithic',
    description:
      'Twisting plant fibers into cordage. Essential for binding tools and creating complex items.',
    prerequisites: ['basic_knapping'],
    resourceCost: [
      { resourceType: 'wood', quantity: 10 },
      { resourceType: 'food', quantity: 5 },
    ],
    unlocks: ['hafting'],
    enablesRecipes: ['fiber_binding'],
  },

  // ===== MIDDLE PALEOLITHIC (~300K - 50K years ago) =====
  // More refined stone tool techniques
  {
    id: 'hafting',
    name: 'Hafting',
    era: 'middle_paleolithic',
    description:
      'Attaching stone heads to wooden handles. Creates more powerful and versatile tools.',
    prerequisites: ['cordage_making'],
    resourceCost: [
      { resourceType: 'stone', quantity: 25 },
      { resourceType: 'wood', quantity: 15 },
      { resourceType: 'food', quantity: 10 },
    ],
    unlocks: ['blade_technology'],
    enablesRecipes: ['crude_handle', 'shaped_handle', 'stone_knife', 'hafted_axe', 'digging_stick'],
  },

  // ===== UPPER PALEOLITHIC (~50K - 12K years ago) =====
  // Advanced stone working and composite tools
  {
    id: 'blade_technology',
    name: 'Blade Technology',
    era: 'upper_paleolithic',
    description:
      'Precision flaking to create long, thin blades. A revolution in stone tool efficiency.',
    prerequisites: ['hafting'],
    resourceCost: [
      { resourceType: 'stone', quantity: 40 },
      { resourceType: 'wood', quantity: 10 },
      { resourceType: 'food', quantity: 20 },
    ],
    unlocks: ['composite_tools'],
    enablesRecipes: ['pressure_flaker'],
  },
  {
    id: 'composite_tools',
    name: 'Composite Tools',
    era: 'upper_paleolithic',
    description:
      'Creating tools from multiple materials and components. The height of stone age ingenuity.',
    prerequisites: ['blade_technology'],
    resourceCost: [
      { resourceType: 'stone', quantity: 60 },
      { resourceType: 'wood', quantity: 25 },
      { resourceType: 'food', quantity: 20 },
    ],
    unlocks: ['polished_stone'],
    enablesRecipes: ['stone_adze'],
  },

  // ===== MESOLITHIC (~12K - 6K years ago) =====
  // Transition to polished stone tools
  {
    id: 'polished_stone',
    name: 'Polished Stone',
    era: 'mesolithic',
    description:
      'Grinding and polishing stone to create stronger, more refined tools. The precursor to the Neolithic.',
    prerequisites: ['composite_tools'],
    resourceCost: [
      { resourceType: 'stone', quantity: 100 },
      { resourceType: 'wood', quantity: 40 },
      { resourceType: 'food', quantity: 40 },
    ],
    unlocks: [],
    enablesRecipes: ['polished_axe'],
  },
];

export const TECH_BY_ID = createByIdMap(TECHNOLOGIES);

export function getTechsByEra(era: LithicEra): Technology[] {
  return TECHNOLOGIES.filter((t) => t.era === era);
}

export function getAvailableTechs(unlockedTechs: string[]): Technology[] {
  return TECHNOLOGIES.filter((tech) => {
    // Already unlocked
    if (unlockedTechs.includes(tech.id)) return false;

    // Check all prerequisites are met
    return tech.prerequisites.every((prereqId) => unlockedTechs.includes(prereqId));
  });
}
