// Map Overlay Color Configuration
// Color schemes for biome and lithology overlay layers

import { BiomeCode } from '../types/resources';

// Biome colors based on typical map representations
export const BIOME_COLORS: Record<BiomeCode, string> = {
  tropical_moist_broadleaf: '#228B22', // Forest green
  tropical_dry_broadleaf: '#6B8E23', // Olive drab
  tropical_conifer: '#2E8B57', // Sea green
  temperate_broadleaf_mixed: '#32CD32', // Lime green
  temperate_conifer: '#006400', // Dark green
  boreal: '#3CB371', // Medium sea green
  tropical_grassland: '#DAA520', // Goldenrod
  temperate_grassland: '#BDB76B', // Dark khaki
  flooded_grassland: '#87CEEB', // Sky blue
  montane: '#9370DB', // Medium purple
  tundra: '#E6E6FA', // Lavender
  mediterranean: '#CD853F', // Peru (tan brown)
  desert: '#F4A460', // Sandy brown
  mangrove: '#20B2AA', // Light sea green
  unknown: '#808080', // Gray
};

// Lithology colors based on geological map conventions
// Colors loosely follow USGS/Macrostrat conventions
export const LITHOLOGY_COLORS: Record<string, string> = {
  // Sedimentary - Yellows, Browns, Blues
  sandstone: '#F5DEB3', // Wheat
  siltstone: '#D2B48C', // Tan
  mudstone: '#8B7355', // Burlywood dark
  shale: '#696969', // Dim gray
  claystone: '#A0522D', // Sienna
  limestone: '#ADD8E6', // Light blue
  doloite: '#87CEEB', // Sky blue
  chalk: '#F0FFFF', // Azure
  marl: '#B0C4DE', // Light steel blue
  conglomerate: '#CD853F', // Peru
  breccia: '#D2691E', // Chocolate
  chert: '#BC8F8F', // Rosy brown
  flint: '#778899', // Light slate gray
  coal: '#2F4F4F', // Dark slate gray
  evaporite: '#FFB6C1', // Light pink
  gypsum: '#FFF8DC', // Cornsilk
  salt: '#FFFAFA', // Snow
  travertine: '#FAEBD7', // Antique white
  tufa: '#EEE8AA', // Pale goldenrod

  // Igneous Plutonic - Pinks, Reds
  granite: '#FFC0CB', // Pink
  granodiorite: '#FFB6C1', // Light pink
  diorite: '#DDA0DD', // Plum
  gabbro: '#DA70D6', // Orchid
  peridotite: '#BA55D3', // Medium orchid
  syenite: '#FF69B4', // Hot pink
  tonalite: '#DB7093', // Pale violet red
  monzonite: '#C71585', // Medium violet red
  anorthosite: '#F5F5F5', // White smoke
  dunite: '#9ACD32', // Yellow green
  pyroxenite: '#556B2F', // Dark olive green

  // Igneous Volcanic - Purples, Dark colors
  basalt: '#4B0082', // Indigo
  andesite: '#8B008B', // Dark magenta
  rhyolite: '#9932CC', // Dark orchid
  dacite: '#8A2BE2', // Blue violet
  obsidian: '#1C1C1C', // Near black
  pumice: '#D3D3D3', // Light gray
  tuff: '#E0B0FF', // Mauve
  scoria: '#800000', // Maroon
  ignimbrite: '#9370DB', // Medium purple
  phonolite: '#7B68EE', // Medium slate blue
  trachyte: '#6A5ACD', // Slate blue

  // Metamorphic - Greens, Blues, Grays
  gneiss: '#708090', // Slate gray
  schist: '#2F4F4F', // Dark slate gray
  slate: '#5F9EA0', // Cadet blue
  phyllite: '#66CDAA', // Medium aquamarine
  marble: '#FFFAF0', // Floral white
  quartzite: '#F0E68C', // Khaki
  amphibolite: '#228B22', // Forest green
  granulite: '#8FBC8F', // Dark sea green
  eclogite: '#006400', // Dark green
  migmatite: '#FF8C00', // Dark orange
  hornfels: '#808000', // Olive
  serpentinite: '#3CB371', // Medium sea green
  greenschist: '#90EE90', // Light green
  blueschist: '#4169E1', // Royal blue
  mylonite: '#A9A9A9', // Dark gray

  // Mixed/Other
  volcanic: '#9932CC', // Dark orchid (generic volcanic)
  plutonic: '#FFC0CB', // Pink (generic plutonic)
  sedimentary: '#DEB887', // Burlywood (generic sedimentary)
  metamorphic: '#708090', // Slate gray (generic metamorphic)
  unconsolidated: '#FFDEAD', // Navajo white
  alluvium: '#FFE4B5', // Moccasin
  till: '#D2B48C', // Tan
  loess: '#F5F5DC', // Beige
  glacial: '#E0FFFF', // Light cyan
  colluvium: '#DEB887', // Burlywood
  unknown: '#808080', // Gray
};

// Default opacity values for overlays
export const BIOME_OVERLAY_OPACITY = 0.45;
export const LITHOLOGY_OVERLAY_OPACITY = 0.5;

/**
 * Get the color for a lithology type, with fallback to category colors
 */
export function getLithologyColor(lithology: string): string {
  const normalized = lithology.toLowerCase().replace(/[_-]/g, '');

  // Direct match
  if (LITHOLOGY_COLORS[normalized]) {
    return LITHOLOGY_COLORS[normalized];
  }

  // Try partial matches for common variations
  for (const [key, color] of Object.entries(LITHOLOGY_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return color;
    }
  }

  // Fallback to unknown
  return LITHOLOGY_COLORS.unknown;
}

/**
 * Get the color for a biome type
 */
export function getBiomeColor(biome: BiomeCode): string {
  return BIOME_COLORS[biome] || BIOME_COLORS.unknown;
}
