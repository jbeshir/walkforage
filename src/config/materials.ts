// Material Type Configuration
// Central registry for all material types - makes adding new materials (e.g., fiber, bone) data-driven
// Adding a new material type only requires:
// 1. Creating the data file (e.g., src/data/fibers.ts)
// 2. Adding ResourceSpawnService methods if gatherable
// 3. Adding an entry here

import { StoneType, WoodType, ResourceProperties } from '../types/resources';
import { STONES, STONES_BY_ID } from '../data/stones';
import { WOODS, WOODS_BY_ID } from '../data/woods';
import { LocationGeoData } from '../types/gis';
import { resourceSpawnService } from '../services/ResourceSpawnService';

// Base resource type that all materials share
export interface BaseResourceType {
  id: string;
  name: string;
  description: string;
  properties: ResourceProperties;
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

  // Gathering (optional - some materials may not be gatherable)
  gathering?: MaterialGatheringConfig<T>;

  // Base gathering ability without tools (default 1)
  // If total ability (base + tool bonuses) < 1, gathering is disabled
  baseGatheringAbility?: number;

  // Material-specific flags (extensible)
  hasToolstone?: boolean; // stone has isToolstone flag
}

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
    gathering: {
      getRandomResource: () => resourceSpawnService.getRandomWood(),
      getRandomResourceForLocation: (geo: LocationGeoData) =>
        resourceSpawnService.getRandomWoodForLocation(geo),
    },
    baseGatheringAbility: 1,
  } as MaterialTypeConfig<WoodType>,
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
