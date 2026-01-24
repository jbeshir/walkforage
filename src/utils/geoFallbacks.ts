/**
 * GIS Fallback Utilities
 *
 * Shared functions for estimating geographic data when detailed GIS data
 * is unavailable. Used by both GeoDataService (Expo) and node-gis-loader (Node.js).
 */

import { GeologyData } from '../types/gis';
import { BiomeCode } from '../types/resources';

/**
 * Estimate biogeographic realm from coordinates (rough approximation)
 * Based on major continental boundaries
 */
export function estimateRealmFromCoordinates(lat: number, lng: number): string {
  // Palearctic: Europe, North Africa, Northern Asia
  if (lat > 23 && lng >= -30 && lng <= 170) {
    if (lat > 35 || (lat > 23 && lng >= 30)) {
      return 'Palearctic';
    }
  }

  // Nearctic: North America
  if (lat > 23 && lng >= -170 && lng <= -30) {
    return 'Nearctic';
  }

  // Neotropic: Central and South America
  if (lng >= -120 && lng <= -30 && lat <= 30) {
    return 'Neotropic';
  }

  // Afrotropic: Sub-Saharan Africa
  if (lat <= 23 && lng >= -20 && lng <= 55) {
    return 'Afrotropic';
  }

  // Indomalayan: South and Southeast Asia
  if (lat <= 35 && lat > -10 && lng >= 60 && lng <= 150) {
    return 'Indomalayan';
  }

  // Australasia: Australia, New Zealand, New Guinea
  if (lat <= 0 && lng >= 110 && lng <= 180) {
    return 'Australasia';
  }
  if (lat <= -10 && lng >= 165) {
    return 'Australasia';
  }

  // Oceania: Pacific Islands
  if (lat >= -30 && lat <= 30 && lng >= 150) {
    return 'Oceania';
  }

  // Default to Palearctic for unmapped areas
  return 'Palearctic';
}

/**
 * Estimate biome from latitude (very rough approximation)
 * Based on climate zones
 */
export function estimateBiomeFromLatitude(lat: number): BiomeCode {
  const absLat = Math.abs(lat);

  if (absLat > 66) {
    return 'tundra';
  } else if (absLat > 55) {
    return 'boreal';
  } else if (absLat > 45) {
    return 'temperate_conifer';
  } else if (absLat > 35) {
    return 'temperate_broadleaf_mixed';
  } else if (absLat > 23) {
    return 'mediterranean';
  } else {
    return 'tropical_moist_broadleaf';
  }
}

/**
 * Default geology for unknown areas
 * Used when no GIS data is available
 */
export function getDefaultGeology(): GeologyData {
  return {
    primaryLithology: 'mixed_sedimentary',
    secondaryLithologies: ['sandstone', 'limestone', 'shale'],
    confidence: 0.3,
  };
}

/**
 * Default confidence for fallback estimates
 */
export const FALLBACK_CONFIDENCE = 0.3;
