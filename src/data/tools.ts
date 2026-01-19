// Tool and Component Definitions for WalkForage
// Lithic era (stone age) focused tool system
// All tools use generic material requirements - players choose specific materials when crafting

import { Tool, CraftedComponent, ToolCategory, QualityWeights } from '../types/tools';
import { TechEra } from '../types/tech';

// Quality weights by category - determines how material properties affect tool quality
const QUALITY_WEIGHTS: Record<ToolCategory, QualityWeights> = {
  knapping: { hardnessWeight: 0.5, workabilityWeight: 0.2, durabilityWeight: 0.3 },
  cutting: { hardnessWeight: 0.4, workabilityWeight: 0.4, durabilityWeight: 0.2 },
  woodworking: { hardnessWeight: 0.35, workabilityWeight: 0.25, durabilityWeight: 0.4 },
  foraging: { hardnessWeight: 0.2, workabilityWeight: 0.4, durabilityWeight: 0.4 },
  general: { hardnessWeight: 0.33, workabilityWeight: 0.33, durabilityWeight: 0.34 },
};

// Component quality weights (workability-focused)
const COMPONENT_QUALITY_WEIGHTS: QualityWeights = {
  hardnessWeight: 0.2,
  workabilityWeight: 0.5,
  durabilityWeight: 0.3,
};

// ===== COMPONENTS =====

export const COMPONENTS: CraftedComponent[] = [
  // ===== HANDLES =====
  {
    id: 'crude_handle',
    name: 'Crude Handle',
    category: 'handle',
    era: 'lower_paleolithic',
    description: 'A rough stick, barely shaped. Good enough for basic tools.',
    requiredTech: 'hafting',
    requiredTools: [],
    requiredComponents: [],
    materials: { wood: { quantity: 5 } },
    qualityWeights: COMPONENT_QUALITY_WEIGHTS,
    baseCraftTime: 30,
    properties: { durabilityBonus: 0, efficiencyBonus: 0, qualityTier: 1 },
  },
  {
    id: 'shaped_handle',
    name: 'Shaped Handle',
    category: 'handle',
    era: 'middle_paleolithic',
    description: 'A handle carved with stone tools. Fits the hand better.',
    requiredTech: 'hafting',
    requiredTools: [{ toolId: 'stone_knife' }],
    requiredComponents: [],
    materials: { wood: { quantity: 10 } },
    qualityWeights: COMPONENT_QUALITY_WEIGHTS,
    baseCraftTime: 120,
    properties: { durabilityBonus: 5, efficiencyBonus: 0.1, qualityTier: 2 },
  },

  // ===== BINDINGS =====
  {
    id: 'fiber_binding',
    name: 'Fiber Binding',
    category: 'binding',
    era: 'lower_paleolithic',
    description: 'Plant fibers twisted into cordage for binding tool parts together.',
    requiredTech: 'cordage_making',
    requiredTools: [],
    requiredComponents: [],
    materials: { wood: { quantity: 5 } }, // Using wood as proxy for plant fiber
    qualityWeights: COMPONENT_QUALITY_WEIGHTS,
    baseCraftTime: 60,
    properties: { durabilityBonus: 0, efficiencyBonus: 0, qualityTier: 1 },
  },
];

// ===== TOOLS =====

export const TOOLS: Tool[] = [
  // ========== LOWER PALEOLITHIC - CRAFTING TOOLS ==========
  {
    id: 'hammerstone',
    name: 'Hammerstone',
    category: 'knapping',
    era: 'lower_paleolithic',
    description:
      'A hard, rounded stone for striking other stones. The first tool - the foundation of all stone working.',
    requiredTech: 'basic_knapping',
    requiredTools: [],
    requiredComponents: [],
    materials: { stone: { quantity: 10 } },
    baseStats: { gatheringBonus: 0 },
    gatheringType: 'stone_harvesting',
    qualityWeights: QUALITY_WEIGHTS.knapping,
    baseCraftTime: 10,
  },
  {
    id: 'grinding_stone',
    name: 'Grinding Stone',
    category: 'knapping',
    era: 'lower_paleolithic',
    description:
      'A flat sandstone for grinding and shaping stone tools. Essential for creating polished tools.',
    requiredTech: 'grinding',
    requiredTools: [],
    requiredComponents: [],
    materials: { stone: { quantity: 15 } },
    baseStats: { gatheringBonus: 0 },
    qualityWeights: QUALITY_WEIGHTS.knapping,
    baseCraftTime: 30,
  },

  // ========== LOWER PALEOLITHIC - FORAGING TOOLS ==========
  {
    id: 'digging_stick',
    name: 'Digging Stick',
    category: 'foraging',
    era: 'lower_paleolithic',
    description:
      'A simple pointed stick for digging roots and tubers. One of the oldest known tools.',
    requiredTech: 'hafting',
    requiredTools: [],
    requiredComponents: [{ componentId: 'crude_handle', quantity: 1 }],
    materials: {},
    baseStats: { gatheringBonus: 0.3 },
    gatheringType: 'foraging',
    qualityWeights: QUALITY_WEIGHTS.foraging,
    baseCraftTime: 60,
  },

  // ========== LOWER PALEOLITHIC - WOODCUTTING TOOLS ==========
  {
    id: 'hand_axe',
    name: 'Hand Axe',
    category: 'woodworking',
    era: 'lower_paleolithic',
    description:
      'A bifacially flaked stone held in the hand. Useful for chopping wood and butchering.',
    requiredTech: 'basic_knapping',
    requiredTools: [{ toolId: 'hammerstone' }],
    requiredComponents: [],
    materials: { stone: { quantity: 15, requiresToolstone: true } },
    baseStats: { gatheringBonus: 0.2 },
    gatheringType: 'woodcutting',
    qualityWeights: QUALITY_WEIGHTS.woodworking,
    baseCraftTime: 300,
  },

  // ========== MIDDLE PALEOLITHIC - CUTTING TOOLS ==========
  {
    id: 'stone_knife',
    name: 'Stone Knife',
    category: 'cutting',
    era: 'middle_paleolithic',
    description:
      'A hafted flint blade. Essential for many crafts including hide working and food preparation.',
    requiredTech: 'hafting',
    requiredTools: [{ toolId: 'hammerstone' }],
    requiredComponents: [
      { componentId: 'crude_handle', quantity: 1 },
      { componentId: 'fiber_binding', quantity: 1 },
    ],
    materials: { stone: { quantity: 10, requiresToolstone: true } },
    baseStats: { gatheringBonus: 0.2 },
    gatheringType: 'foraging',
    qualityWeights: QUALITY_WEIGHTS.cutting,
    baseCraftTime: 180,
  },

  // ========== MIDDLE PALEOLITHIC - WOODCUTTING TOOLS ==========
  {
    id: 'hafted_axe',
    name: 'Hafted Axe',
    category: 'woodworking',
    era: 'middle_paleolithic',
    description:
      'A stone axe head bound to a wooden handle. More powerful than hand axes for felling trees.',
    requiredTech: 'hafting',
    requiredTools: [{ toolId: 'hammerstone' }],
    requiredComponents: [
      { componentId: 'shaped_handle', quantity: 1 },
      { componentId: 'fiber_binding', quantity: 1 },
    ],
    materials: { stone: { quantity: 12, requiresToolstone: true } },
    baseStats: { gatheringBonus: 0.5 },
    gatheringType: 'woodcutting',
    qualityWeights: QUALITY_WEIGHTS.woodworking,
    baseCraftTime: 600,
  },

  // ========== UPPER PALEOLITHIC - CRAFTING TOOLS ==========
  {
    id: 'pressure_flaker',
    name: 'Pressure Flaker',
    category: 'knapping',
    era: 'upper_paleolithic',
    description:
      'A pointed tool for precise pressure flaking. Enables crafting refined tools like adzes.',
    requiredTech: 'blade_technology',
    requiredTools: [{ toolId: 'stone_knife' }],
    requiredComponents: [],
    materials: {
      stone: { quantity: 8, requiresToolstone: true },
      wood: { quantity: 5 },
    },
    baseStats: { gatheringBonus: 0 },
    qualityWeights: QUALITY_WEIGHTS.knapping,
    baseCraftTime: 240,
  },

  // ========== UPPER PALEOLITHIC - WOODCUTTING TOOLS ==========
  {
    id: 'stone_adze',
    name: 'Stone Adze',
    category: 'woodworking',
    era: 'upper_paleolithic',
    description:
      'A transverse axe with blade perpendicular to handle. Excellent for hollowing and shaping wood.',
    requiredTech: 'composite_tools',
    requiredTools: [{ toolId: 'hammerstone' }, { toolId: 'pressure_flaker' }],
    requiredComponents: [
      { componentId: 'shaped_handle', quantity: 1 },
      { componentId: 'fiber_binding', quantity: 1 },
    ],
    materials: { stone: { quantity: 15, requiresToolstone: true } },
    baseStats: { gatheringBonus: 0.3 },
    gatheringType: 'woodcutting',
    qualityWeights: QUALITY_WEIGHTS.woodworking,
    baseCraftTime: 600,
  },

  // ========== MESOLITHIC - POLISHED STONE TOOLS ==========
  {
    id: 'polished_axe',
    name: 'Polished Axe',
    category: 'woodworking',
    era: 'mesolithic',
    description:
      'A ground and polished stone axe. The cutting edge is smoother and more durable than flaked axes.',
    requiredTech: 'polished_stone',
    requiredTools: [{ toolId: 'hammerstone' }, { toolId: 'grinding_stone' }],
    requiredComponents: [
      { componentId: 'shaped_handle', quantity: 1 },
      { componentId: 'fiber_binding', quantity: 1 },
    ],
    materials: { stone: { quantity: 25 } },
    baseStats: { gatheringBonus: 1.0 },
    gatheringType: 'woodcutting',
    qualityWeights: QUALITY_WEIGHTS.woodworking,
    baseCraftTime: 1200,
  },
];

// ===== HELPER FUNCTIONS =====

export const TOOLS_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<string, Tool>;

export const COMPONENTS_BY_ID = Object.fromEntries(COMPONENTS.map((c) => [c.id, c])) as Record<
  string,
  CraftedComponent
>;

export function getToolById(toolId: string): Tool | undefined {
  return TOOLS_BY_ID[toolId];
}

export function getComponentById(componentId: string): CraftedComponent | undefined {
  return COMPONENTS_BY_ID[componentId];
}

export function getToolsByEra(era: TechEra): Tool[] {
  return TOOLS.filter((t) => t.era === era);
}

export function getToolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

export function getToolPrerequisites(toolId: string): string[] {
  const tool = TOOLS_BY_ID[toolId];
  if (!tool) return [];
  return tool.requiredTools.map((rt) => rt.toolId);
}

export function getAllToolDependencies(toolId: string): string[] {
  const deps = new Set<string>();
  const queue = [toolId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const tool = TOOLS_BY_ID[current];
    if (!tool) continue;

    for (const req of tool.requiredTools) {
      if (!deps.has(req.toolId)) {
        deps.add(req.toolId);
        queue.push(req.toolId);
      }
    }
  }

  return Array.from(deps);
}

// ===== TOOL TYPE HELPERS =====

// Tools that are used as prerequisites for other tools or components
const CRAFTING_TOOL_IDS = new Set<string>();

// Build the set of crafting tool IDs on module load
(() => {
  // Check tools that require other tools
  for (const tool of TOOLS) {
    for (const req of tool.requiredTools) {
      CRAFTING_TOOL_IDS.add(req.toolId);
    }
  }
  // Check components that require tools
  for (const component of COMPONENTS) {
    for (const req of component.requiredTools) {
      CRAFTING_TOOL_IDS.add(req.toolId);
    }
  }
})();

/** Returns true if this tool is used as a prerequisite for crafting other tools/components */
export function isCraftingTool(toolId: string): boolean {
  return CRAFTING_TOOL_IDS.has(toolId);
}

/** Returns true if this tool provides a gathering bonus */
export function isGatheringTool(toolId: string): boolean {
  const tool = TOOLS_BY_ID[toolId];
  return tool ? tool.baseStats.gatheringBonus > 0 : false;
}

/** Get the tool type label(s) for display */
export function getToolTypeLabels(toolId: string): ('Crafting' | 'Gathering')[] {
  const labels: ('Crafting' | 'Gathering')[] = [];
  if (isCraftingTool(toolId)) labels.push('Crafting');
  if (isGatheringTool(toolId)) labels.push('Gathering');
  return labels;
}
