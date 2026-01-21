// GIS Types for WalkForage
// Types for geological and biome data integration
// Based on Macrostrat API and Resolve Ecoregions 2017

import { BiomeCode } from './resources';

// ═══════════════════════════════════════════════════════════════════════════
// Geohash Types
// ═══════════════════════════════════════════════════════════════════════════

export type GeohashPrecision = 3 | 4 | 5; // ~156km, ~39km, ~5km cells

export interface GeohashBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tile Data Structures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Geological data for a geohash tile
 */
export interface GeologyData {
  primaryLithology: string; // Most common lithology (e.g., "sandstone", "granite")
  secondaryLithologies: string[]; // Other lithologies present
  lithClass?: string; // Macrostrat lith_class (sedimentary, igneous, metamorphic)
  age?: string; // Geological age/period
  confidence: number; // 0-1 data quality score
}

/**
 * Coarse geology index entry (minimal data for global coverage)
 */
export interface CoarseGeologyEntry {
  primaryLithology: string;
  confidence: number;
}

/**
 * Biome data for a geohash tile
 */
export interface BiomeData {
  type: BiomeCode; // Primary biome type
  ecoregionId?: number; // Resolve Ecoregions 2017 ID (1-847)
  realm?: string; // Biogeographic realm (e.g., "Palearctic")
  confidence: number; // 0-1 data quality score
}

/**
 * Pre-processed tile containing geology and biome data
 */
export interface GeoTile {
  geohash: string; // e.g., "u4pr" (precision 4)
  geology: GeologyData;
  biome: BiomeData;
}

/**
 * Index file structure for coarse global grid
 */
export interface GeoIndex {
  precision: GeohashPrecision;
  lastUpdated: string; // ISO date string
  tiles: Record<string, GeoTile>; // geohash -> tile data
}

// ═══════════════════════════════════════════════════════════════════════════
// Lookup Result Types
// ═══════════════════════════════════════════════════════════════════════════

export type DataSource = 'detailed' | 'coarse' | 'fallback';

/**
 * Result of looking up GIS data for a location
 */
export interface LocationGeoData {
  geology: {
    primaryLithology: string;
    secondaryLithologies: string[];
    confidence: number;
  };
  biome: {
    type: BiomeCode;
    ecoregionId?: number; // Resolve Ecoregions 2017 ID (1-847)
    realm?: string; // Biogeographic realm (e.g., "Palearctic")
    confidence: number;
  };
  dataSource: DataSource;
  geohash?: string; // The geohash used for lookup
}

// ═══════════════════════════════════════════════════════════════════════════
// Mapping Types (lithology -> stones, biome -> woods)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps a Macrostrat lithology to game stone types
 */
export interface LithologyMapping {
  lithology: string; // Macrostrat lithology name
  stoneIds: string[]; // Game stone IDs that can spawn
  weights: number[]; // Spawn probability weights (should sum to 1)
}

/**
 * Maps a realm+biome combination to game wood types
 * Uses realm+biome codes (e.g., "PA04") for continent-specific trees
 */
export interface RealmBiomeMapping {
  realmBiome: string; // e.g., "PA04", "NT01"
  realm: string; // e.g., "Palearctic", "Neotropic"
  biome: BiomeCode; // The biome type
  woodIds: string[]; // Game wood IDs that can spawn
  weights: number[]; // Spawn probability weights (should sum to 1)
}

/**
 * Complete mapping configuration
 */
export interface GeoMappings {
  lithologyToStones: Record<string, LithologyMapping>;
  realmBiomesToWoods: Record<string, RealmBiomeMapping>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Macrostrat API Types (for data fetching scripts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Response from Macrostrat /geologic_units/map endpoint
 */
export interface MacrostratMapResponse {
  success: {
    data: MacrostratUnit[];
  };
}

export interface MacrostratUnit {
  lith: string; // Lithology name
  lith_type: string; // Rock subtype
  lith_class: string; // Primary class (sedimentary/igneous/metamorphic)
  lith_id: number; // Macrostrat lithology ID
  age: string; // Geological age
  strat_name?: string; // Stratigraphic unit name
}

/**
 * Response from Macrostrat /defs/lithologies endpoint
 */
export interface MacrostratLithologyDef {
  lith_id: number;
  lith: string;
  lith_type: string;
  lith_class: string;
  color: string;
}
