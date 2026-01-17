/**
 * GIS Mappings Module
 * Provides realm+biome to wood species mappings
 */

import { RealmBiomeMapping } from '../../../types/gis';
import { BiomeCode } from '../../../types/resources';
import realmBiomeMappings from './realmBiomesToWoods.json';

// Realm name to code mapping
const REALM_CODES: Record<string, string> = {
  Palearctic: 'PA',
  Nearctic: 'NE',
  Neotropic: 'NO',
  Afrotropic: 'AF',
  Indomalayan: 'IN',
  Australasia: 'AU',
  Oceania: 'OC',
};

// Biome type to number mapping
const BIOME_NUMBERS: Record<BiomeCode, string> = {
  tropical_moist_broadleaf: '01',
  tropical_dry_broadleaf: '02',
  tropical_conifer: '03',
  temperate_broadleaf_mixed: '04',
  temperate_conifer: '05',
  boreal: '06',
  tropical_grassland: '07',
  temperate_grassland: '08',
  flooded_grassland: '09',
  montane: '10',
  tundra: '11',
  mediterranean: '12',
  desert: '13',
  mangrove: '14',
};

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
 * Build a realm+biome code from realm name and biome type (internal)
 * @param realm e.g., "Palearctic"
 * @param biome e.g., "temperate_broadleaf_mixed"
 * @returns e.g., "PA04" or null if invalid
 */
function buildRealmBiomeCode(realm: string, biome: BiomeCode): string | null {
  const realmCode = REALM_CODES[realm];
  const biomeNumber = BIOME_NUMBERS[biome];

  if (!realmCode || !biomeNumber) {
    return null;
  }

  return `${realmCode}${biomeNumber}`;
}

/**
 * Get mapping for a realm and biome type
 * @param realm e.g., "Palearctic"
 * @param biome e.g., "temperate_broadleaf_mixed"
 */
export function getRealmBiomeMapping(realm: string, biome: BiomeCode): RealmBiomeMapping | null {
  const code = buildRealmBiomeCode(realm, biome);
  if (!code) {
    return null;
  }
  const mappings = getRealmBiomeMappings();
  return mappings[code] || null;
}

/**
 * Check if a realm and biome type has a mapping
 */
export function hasRealmBiomeMapping(realm: string, biome: BiomeCode): boolean {
  return getRealmBiomeMapping(realm, biome) !== null;
}

/**
 * Get all available realm+biome codes
 */
export function getAvailableRealmBiomes(): string[] {
  const mappings = getRealmBiomeMappings();
  return Object.keys(mappings);
}
