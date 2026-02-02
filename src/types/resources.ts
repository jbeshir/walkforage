// Resource Types for WalkForage
// Based on real geological and botanical data
// Geology: Macrostrat API (221 lithologies) - CC-BY-4.0
// Biomes: Resolve Ecoregions 2017 (14 biomes)

// Stone categories aligned with Macrostrat lithology classes
export type StoneCategory =
  | 'sedimentary'
  | 'igneous_plutonic'
  | 'igneous_volcanic'
  | 'metamorphic'
  | 'ore';
export type WoodCategory = 'softwood' | 'hardwood' | 'tropical' | 'fruit';
export type FoodCategory = 'berry' | 'fruit' | 'nut' | 'greens' | 'root';

// Resolve Ecoregions 2017 biome codes
export type BiomeCode =
  | 'tropical_moist_broadleaf' // 1: Tropical & Subtropical Moist Broadleaf Forests
  | 'tropical_dry_broadleaf' // 2: Tropical & Subtropical Dry Broadleaf Forests
  | 'tropical_conifer' // 3: Tropical & Subtropical Coniferous Forests
  | 'temperate_broadleaf_mixed' // 4: Temperate Broadleaf & Mixed Forests
  | 'temperate_conifer' // 5: Temperate Conifer Forests
  | 'boreal' // 6: Boreal Forests/Taiga
  | 'tropical_grassland' // 7: Tropical & Subtropical Grasslands/Savannas
  | 'temperate_grassland' // 8: Temperate Grasslands/Savannas
  | 'flooded_grassland' // 9: Flooded Grasslands & Savannas
  | 'montane' // 10: Montane Grasslands & Shrublands
  | 'tundra' // 11: Tundra
  | 'mediterranean' // 12: Mediterranean Forests, Woodlands & Scrub
  | 'desert' // 13: Deserts & Xeric Shrublands
  | 'mangrove' // 14: Mangroves
  | 'unknown'; // Sentinel for unmapped areas

// Quality-affecting properties - dynamic per material type
// Each material type defines its own property schema in config/materials.ts
export type ResourceProperties = Record<string, number>;

/**
 * Altitude preference for a resource type
 * Defines optimal and viable altitude ranges in meters
 */
export interface AltitudePreference {
  optimal: [number, number]; // [min, max] altitude in meters where spawn rate is highest
  viable: [number, number]; // [min, max] altitude in meters where resource can spawn
}

export interface StoneType {
  id: string;
  name: string;
  category: StoneCategory;
  description: string;
  properties: ResourceProperties;
  rarity: number; // 0-1 probability weight for spawning
  lithologies: string[]; // Macrostrat lithology names this stone maps to
  isToolstone?: boolean; // Can be knapped for tools (flint, chert, obsidian, etc.)
  color: string; // Display color
}

export interface WoodType {
  id: string;
  name: string;
  scientificName?: string; // Latin/botanical name
  category: WoodCategory;
  description: string;
  properties: ResourceProperties;
  rarity: number; // 0-1 probability weight for spawning
  biomes: BiomeCode[]; // Resolve Ecoregions 2017 biome codes (fallback)
  realmBiomes?: string[]; // Realm+biome codes (e.g., ["PA04", "PA05"])
  nativeRealms?: string[]; // Biogeographic realms (e.g., ["Palearctic"])
  altitudePreference?: AltitudePreference; // Optimal and viable altitude ranges
  color: string;
}

export interface FoodType {
  id: string;
  name: string;
  scientificName?: string; // Latin/botanical name
  category: FoodCategory;
  description: string;
  properties: ResourceProperties; // Empty for food: {}
  rarity: number; // 0-1 probability weight for spawning
  biomes: BiomeCode[]; // Resolve Ecoregions 2017 biome codes (fallback)
  realmBiomes?: string[]; // Realm+biome codes (e.g., ["PA04", "PA05"])
  nativeRealms?: string[]; // Biogeographic realms (e.g., ["Palearctic"])
  altitudePreference?: AltitudePreference; // Optimal and viable altitude ranges
  color: string;
}

export interface ResourceStack {
  resourceId: string;
  quantity: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Material Type System
// ═══════════════════════════════════════════════════════════════════════════

import { MaterialType, getAllMaterialTypes } from '../config/materials';

// Inventory is a record keyed by material type - automatically supports new material types
export type Inventory = Record<MaterialType, ResourceStack[]>;

// Create an empty inventory with all material types initialized to empty arrays
export function createEmptyInventory(): Inventory {
  const inventory = {} as Inventory;
  for (const type of getAllMaterialTypes()) {
    inventory[type] = [];
  }
  return inventory;
}

// Geological zone data from real-world datasets
/**
 * Type guard to check if a resource is a toolstone (can be knapped for tools).
 * Only stones can have the isToolstone property.
 * Accepts any object to work with MaterialTypeConfig's generic getResourceById.
 */
export function isToolstone(resource: object): resource is StoneType & { isToolstone: true } {
  return 'isToolstone' in resource && (resource as StoneType).isToolstone === true;
}

export interface GeologicalZone {
  id: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  primaryStone: string; // Most common stone type
  secondaryStones: string[]; // Other available stones
  oreDeposits: string[]; // Available ores
  biome: string; // Vegetation biome
  woodTypes: string[]; // Available wood types
}
