// Material Type Configuration
// Central registry for all material types - makes adding new materials (e.g., fiber, bone) data-driven
// Adding a new material type only requires:
// 1. Creating the data file (e.g., src/data/fibers.ts)
// 2. Adding ResourceSpawnService methods if gatherable
// 3. Adding an entry here

import { StoneType, WoodType, FoodType, ResourceProperties } from '../types/resources';
import { STONES, STONES_BY_ID } from '../data/stones';
import { WOODS, WOODS_BY_ID } from '../data/woods';
import { FOODS, FOODS_BY_ID } from '../data/foods';
import { LocationGeoData } from '../types/gis';
import { resourceSpawnService } from '../services/ResourceSpawnService';

// Property definition for material types
export interface PropertyDefinition {
  id: string; // Property identifier (e.g., 'hardness')
  abbreviation: string; // Short display name (e.g., 'H')
  displayName: string; // Full display name (e.g., 'Hardness')
  description: string; // Description of what this property affects
  color: string; // Color for UI bars/display
  minValue: number; // Minimum value (usually 1)
  maxValue: number; // Maximum value (usually 10)
}

// Base resource type that all materials share
export interface BaseResourceType {
  id: string;
  name: string;
  description: string;
  properties: ResourceProperties;
  rarity: number;
  color: string;
}

// Gathering functions for a material type
export interface MaterialGatheringConfig<T extends BaseResourceType = BaseResourceType> {
  getRandomResource: () => T;
  getRandomResourceForLocation: (geoData: LocationGeoData) => T | null;
}

// Material type configuration
export interface MaterialTypeConfig<T extends BaseResourceType = BaseResourceType> {
  // Identity
  id: string; // 'stone', 'wood', etc.

  // Display
  icon: string; // '🪨', '🪵'
  singularName: string; // 'Stone', 'Wood'
  pluralName: string; // 'Stones', 'Woods'
  buttonColor: string; // Color for gather buttons in UI

  // Data access
  getAllResources: () => T[];
  getResourceById: (id: string) => T | undefined;

  // Property schema - defines what properties this material type has
  propertySchema: PropertyDefinition[];

  // Default quality weights for tools that don't specify per-material weights
  defaultQualityWeights: Record<string, number>;

  // Gathering (optional - some materials may not be gatherable)
  gathering?: MaterialGatheringConfig<T>;

  // Base gathering ability without tools (default 1)
  // If total ability (base + tool bonuses) < 1, gathering is disabled
  baseGatheringAbility?: number;

  // Material-specific flags (extensible)
  hasToolstone?: boolean; // stone has isToolstone flag
}

// Common property schema for stone and wood (same properties)
const COMMON_PROPERTY_SCHEMA: PropertyDefinition[] = [
  {
    id: 'hardness',
    abbreviation: 'H',
    displayName: 'Hardness',
    description: 'Tool edge sharpness and cutting ability',
    color: '#F44336',
    minValue: 1,
    maxValue: 10,
  },
  {
    id: 'workability',
    abbreviation: 'W',
    displayName: 'Workability',
    description: 'Ease of shaping and crafting',
    color: '#2196F3',
    minValue: 1,
    maxValue: 10,
  },
  {
    id: 'durability',
    abbreviation: 'D',
    displayName: 'Durability',
    description: 'Resistance to wear and breakage',
    color: '#4CAF50',
    minValue: 1,
    maxValue: 10,
  },
];

// Default quality weights (balanced)
const DEFAULT_QUALITY_WEIGHTS: Record<string, number> = {
  hardness: 0.33,
  workability: 0.34,
  durability: 0.33,
};

// Registry of all material types
export const MATERIAL_TYPES = {
  stone: {
    id: 'stone',
    icon: '🪨',
    singularName: 'Stone',
    pluralName: 'Stones',
    buttonColor: '#78909C',
    getAllResources: () => STONES,
    getResourceById: (id: string) => STONES_BY_ID[id],
    propertySchema: COMMON_PROPERTY_SCHEMA,
    defaultQualityWeights: DEFAULT_QUALITY_WEIGHTS,
    gathering: {
      getRandomResource: () => resourceSpawnService.getRandomStone(),
      getRandomResourceForLocation: (geo: LocationGeoData) =>
        resourceSpawnService.getRandomStoneForLocation(geo),
    },
    baseGatheringAbility: 1,
    hasToolstone: true,
  } as MaterialTypeConfig<StoneType>,

  wood: {
    id: 'wood',
    icon: '🪵',
    singularName: 'Wood',
    pluralName: 'Woods',
    buttonColor: '#8D6E63',
    getAllResources: () => WOODS,
    getResourceById: (id: string) => WOODS_BY_ID[id],
    propertySchema: COMMON_PROPERTY_SCHEMA,
    defaultQualityWeights: DEFAULT_QUALITY_WEIGHTS,
    gathering: {
      getRandomResource: () => resourceSpawnService.getRandomWood(),
      getRandomResourceForLocation: (geo: LocationGeoData) =>
        resourceSpawnService.getRandomWoodForLocation(geo),
    },
    baseGatheringAbility: 1,
  } as MaterialTypeConfig<WoodType>,

  food: {
    id: 'food',
    icon: '🍎',
    singularName: 'Food',
    pluralName: 'Foods',
    buttonColor: '#66BB6A',
    getAllResources: () => FOODS,
    getResourceById: (id: string) => FOODS_BY_ID[id],
    propertySchema: [], // Food has no properties
    defaultQualityWeights: {},
    gathering: {
      getRandomResource: () => resourceSpawnService.getRandomFood(),
      getRandomResourceForLocation: (geo: LocationGeoData) =>
        resourceSpawnService.getRandomFoodForLocation(geo),
    },
    baseGatheringAbility: 1,
  } as MaterialTypeConfig<FoodType>,
} as const;

// Derived type from registry keys
export type MaterialType = keyof typeof MATERIAL_TYPES;

// Helper functions
export function getMaterialConfig(type: MaterialType): MaterialTypeConfig {
  return MATERIAL_TYPES[type];
}

export function getMaterialIcon(type: MaterialType): string {
  return MATERIAL_TYPES[type].icon;
}

export function getMaterialPluralName(type: MaterialType): string {
  return MATERIAL_TYPES[type].pluralName;
}

export function getMaterialSingularName(type: MaterialType): string {
  return MATERIAL_TYPES[type].singularName;
}

export function getGatherableMaterialTypes(): MaterialType[] {
  return (Object.keys(MATERIAL_TYPES) as MaterialType[]).filter(
    (type) => MATERIAL_TYPES[type].gathering !== undefined
  );
}

export function getAllMaterialTypes(): MaterialType[] {
  return Object.keys(MATERIAL_TYPES) as MaterialType[];
}
