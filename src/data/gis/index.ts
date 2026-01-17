// GIS Data exports
// Data for geological lookups

import lithologyToStones from './mappings/lithologyToStones.json';
import { LithologyMapping } from '../../types/gis';

// Filter out metadata fields (_comment, _source) and cast to proper types
const filterMetadata = <T>(obj: Record<string, unknown>): Record<string, T> => {
  const filtered: Record<string, T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith('_')) {
      filtered[key] = value as T;
    }
  }
  return filtered;
};

// Type-safe mapping exports
export const LITHOLOGY_MAPPINGS: Record<string, LithologyMapping> = filterMetadata<LithologyMapping>(lithologyToStones);

// Helper to get stone mapping for a lithology
export function getLithologyMapping(lithology: string): LithologyMapping | null {
  const key = lithology.toLowerCase().replace(/\s+/g, '_');
  return LITHOLOGY_MAPPINGS[key] || LITHOLOGY_MAPPINGS['unknown'] || null;
}

// Get all known lithologies
export function getKnownLithologies(): string[] {
  return Object.keys(LITHOLOGY_MAPPINGS).filter(k => !k.startsWith('_'));
}
