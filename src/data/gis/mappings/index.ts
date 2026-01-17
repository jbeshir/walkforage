/**
 * GIS Mappings Module
 * Provides realm+biome to wood species mappings
 */

import { RealmBiomeMapping } from '../../../types/gis';
import { BiomeCode } from '../../../types/resources';
import realmBiomeMappings from './realmBiomesToWoods.json';

// Type for the raw JSON structure
interface RawRealmBiomeMapping {
  realm: string;
  biome: string;
  woodIds: string[];
  weights: number[];
}

// Cache the processed mappings
let processedMappings: Record<string, RealmBiomeMapping> | null = null;

/**
 * Get all realm-biome mappings
 */
export function getRealmBiomeMappings(): Record<string, RealmBiomeMapping> {
  if (processedMappings) {
    return processedMappings;
  }

  processedMappings = {};

  for (const [key, value] of Object.entries(realmBiomeMappings)) {
    // Skip metadata
    if (key === '_meta') continue;

    const raw = value as RawRealmBiomeMapping;
    processedMappings[key] = {
      realmBiome: key,
      realm: raw.realm,
      biome: raw.biome as BiomeCode,
      woodIds: raw.woodIds,
      weights: raw.weights,
    };
  }

  return processedMappings;
}

/**
 * Get mapping for a specific realm+biome code
 * @param realmBiome e.g., "PA04", "NT01"
 */
export function getRealmBiomeMapping(realmBiome: string): RealmBiomeMapping | null {
  const mappings = getRealmBiomeMappings();
  return mappings[realmBiome] || null;
}

/**
 * Check if a realm+biome code has a mapping
 */
export function hasRealmBiomeMapping(realmBiome: string): boolean {
  const mappings = getRealmBiomeMappings();
  return realmBiome in mappings;
}

/**
 * Get all available realm+biome codes
 */
export function getAvailableRealmBiomes(): string[] {
  const mappings = getRealmBiomeMappings();
  return Object.keys(mappings);
}
