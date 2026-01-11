// Resource Types for WalkForage
// Based on real geological and botanical data

export type StoneCategory = 'sedimentary' | 'igneous' | 'metamorphic' | 'ore' | 'toolstone';
export type WoodCategory = 'softwood' | 'hardwood' | 'tropical' | 'fruit';

export interface ResourceProperties {
  hardness: number;      // 1-10 scale (Mohs-inspired)
  workability: number;   // 1-10 scale (ease of working)
  durability: number;    // 1-10 scale
  rarity: number;        // 0-1 probability weight
}

export interface StoneType {
  id: string;
  name: string;
  category: StoneCategory;
  description: string;
  properties: ResourceProperties;
  usgsCode?: string;     // USGS rock type code for mapping
  color: string;         // Display color
}

export interface WoodType {
  id: string;
  name: string;
  category: WoodCategory;
  description: string;
  properties: ResourceProperties;
  biomes: string[];      // OpenLandMap biome codes
  color: string;
}

export interface ResourceStack {
  resourceId: string;
  quantity: number;
}

export interface Inventory {
  stones: ResourceStack[];
  woods: ResourceStack[];
  ores: ResourceStack[];
  other: ResourceStack[];
}

// Geological zone data from real-world datasets
export interface GeologicalZone {
  id: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  primaryStone: string;      // Most common stone type
  secondaryStones: string[]; // Other available stones
  oreDeposits: string[];     // Available ores
  biome: string;             // Vegetation biome
  woodTypes: string[];       // Available wood types
}

// Player location and exploration state
export interface ExplorationState {
  currentZone: GeologicalZone | null;
  discoveredZones: string[];
  totalDistanceWalked: number;  // meters
  explorationPoints: number;
}
