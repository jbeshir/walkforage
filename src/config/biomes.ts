// Biome Configuration
// Human-readable display names for Resolve Ecoregions 2017 biome codes

import { BiomeCode } from '../types/resources';

// Human-readable biome names for display
export const BIOME_DISPLAY_NAMES: Record<BiomeCode, string> = {
  tropical_moist_broadleaf: 'Tropical Rainforest',
  tropical_dry_broadleaf: 'Tropical Dry Forest',
  tropical_conifer: 'Tropical Conifer Forest',
  temperate_broadleaf_mixed: 'Temperate Forest',
  temperate_conifer: 'Conifer Forest',
  boreal: 'Boreal Forest',
  tropical_grassland: 'Savanna',
  temperate_grassland: 'Grassland',
  flooded_grassland: 'Wetland',
  montane: 'Mountain Shrubland',
  tundra: 'Tundra',
  mediterranean: 'Mediterranean',
  desert: 'Desert',
  mangrove: 'Mangrove',
  unknown: 'Unknown',
};

/**
 * Get the display name for a biome code.
 * Returns the code itself if no display name is defined.
 */
export function getBiomeDisplayName(biomeCode: BiomeCode): string {
  return BIOME_DISPLAY_NAMES[biomeCode] || biomeCode;
}
