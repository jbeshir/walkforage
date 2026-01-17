/**
 * fetchBiomes.ts - Process Resolve Ecoregions biome data
 *
 * Downloads and processes the Resolve Ecoregions 2017 dataset
 * to build a geohash-indexed database of biome data.
 *
 * Data source: https://ecoregions.appspot.com/
 * Format: GeoJSON with 14 terrestrial biomes
 *
 * Usage: npx ts-node scripts/gis/fetchBiomes.ts [path-to-geojson]
 *
 * If no GeoJSON path is provided, generates sample data based on
 * latitude-based biome estimation for testing.
 *
 * Output: scripts/gis/output/biomes_raw.json
 */

import * as fs from 'fs';
import * as path from 'path';

// Geohash encoding (copied from src/utils/geohash.ts for standalone use)
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let hash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isEven) {
      const lngMid = (lngMin + lngMax) / 2;
      if (lng >= lngMid) {
        ch |= (1 << (4 - bit));
        lngMin = lngMid;
      } else {
        lngMax = lngMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        ch |= (1 << (4 - bit));
        latMin = latMid;
      } else {
        latMax = latMid;
      }
    }

    isEven = !isEven;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

function decodeGeohash(hash: string): { lat: number; lng: number } {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let isEven = true;

  for (const char of hash) {
    const idx = BASE32.indexOf(char.toLowerCase());
    if (idx === -1) continue;

    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (idx >> bit) & 1;
      if (isEven) {
        const lngMid = (lngMin + lngMax) / 2;
        if (bitValue) {
          lngMin = lngMid;
        } else {
          lngMax = lngMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if (bitValue) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      isEven = !isEven;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
  };
}

// Biome type mappings (Resolve Ecoregions → Game codes)
type BiomeCode =
  | 'tropical_moist_broadleaf'
  | 'tropical_dry_broadleaf'
  | 'tropical_conifer'
  | 'temperate_broadleaf_mixed'
  | 'temperate_conifer'
  | 'boreal'
  | 'tropical_grassland'
  | 'temperate_grassland'
  | 'flooded_grassland'
  | 'montane'
  | 'tundra'
  | 'mediterranean'
  | 'desert'
  | 'mangrove';

// Resolve Ecoregions biome IDs to game codes
const RESOLVE_BIOME_MAP: Record<number, BiomeCode> = {
  1: 'tropical_moist_broadleaf',
  2: 'tropical_dry_broadleaf',
  3: 'tropical_conifer',
  4: 'temperate_broadleaf_mixed',
  5: 'temperate_conifer',
  6: 'boreal',
  7: 'tropical_grassland',
  8: 'temperate_grassland',
  9: 'flooded_grassland',
  10: 'montane',
  11: 'tundra',
  12: 'mediterranean',
  13: 'desert',
  14: 'mangrove',
};

// Resolve biome names to codes (for parsing GeoJSON properties)
const RESOLVE_BIOME_NAMES: Record<string, BiomeCode> = {
  'tropical & subtropical moist broadleaf forests': 'tropical_moist_broadleaf',
  'tropical & subtropical dry broadleaf forests': 'tropical_dry_broadleaf',
  'tropical & subtropical coniferous forests': 'tropical_conifer',
  'temperate broadleaf & mixed forests': 'temperate_broadleaf_mixed',
  'temperate conifer forests': 'temperate_conifer',
  'boreal forests/taiga': 'boreal',
  'tropical & subtropical grasslands, savannas & shrublands': 'tropical_grassland',
  'temperate grasslands, savannas & shrublands': 'temperate_grassland',
  'flooded grasslands & savannas': 'flooded_grassland',
  'montane grasslands & shrublands': 'montane',
  'tundra': 'tundra',
  'mediterranean forests, woodlands & scrub': 'mediterranean',
  'deserts & xeric shrublands': 'desert',
  'mangroves': 'mangrove',
};

interface BiomeRecord {
  geohash: string;
  lat: number;
  lng: number;
  biomeCode: BiomeCode;
  biomeName: string;
  confidence: number;
  source: 'resolve_ecoregions' | 'estimated';
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    BIOME_NUM?: number;
    BIOME_NAME?: string;
    ECO_NAME?: string;
    REALM?: string;
  };
}

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Estimate biome from latitude (fallback when no GeoJSON available)
 */
function estimateBiomeFromLatitude(lat: number, lng: number): { biomeCode: BiomeCode; biomeName: string } {
  const absLat = Math.abs(lat);

  // Simplified latitude-based biome estimation
  if (absLat > 66) {
    return { biomeCode: 'tundra', biomeName: 'Tundra' };
  } else if (absLat > 55) {
    return { biomeCode: 'boreal', biomeName: 'Boreal Forests/Taiga' };
  } else if (absLat > 45) {
    return { biomeCode: 'temperate_conifer', biomeName: 'Temperate Conifer Forests' };
  } else if (absLat > 35) {
    return { biomeCode: 'temperate_broadleaf_mixed', biomeName: 'Temperate Broadleaf & Mixed Forests' };
  } else if (absLat > 23) {
    // Subtropical - varies by region
    // Mediterranean on west coasts, dry on east
    if ((lng > -130 && lng < -115) || (lng > -10 && lng < 40) || (lng > 130 && lng < 150)) {
      return { biomeCode: 'mediterranean', biomeName: 'Mediterranean Forests' };
    }
    return { biomeCode: 'tropical_dry_broadleaf', biomeName: 'Tropical Dry Broadleaf' };
  } else {
    // Tropical
    return { biomeCode: 'tropical_moist_broadleaf', biomeName: 'Tropical Moist Broadleaf' };
  }
}

/**
 * Check if a point is inside a polygon
 */
function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    if (((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Generate geohash grid for a bounding box
 */
function generateGeohashGrid(
  latMin: number,
  latMax: number,
  lngMin: number,
  lngMax: number,
  precision: number
): string[] {
  const geohashes = new Set<string>();
  const latStep = precision === 3 ? 1.4 : 0.35;
  const lngStep = precision === 3 ? 1.4 : 0.35;

  for (let lat = latMin; lat <= latMax; lat += latStep) {
    for (let lng = lngMin; lng <= lngMax; lng += lngStep) {
      const hash = encodeGeohash(lat, lng, precision);
      geohashes.add(hash);
    }
  }

  return [...geohashes];
}

/**
 * Process GeoJSON file to extract biome data
 */
function processGeoJSON(geojsonPath: string): Map<string, BiomeRecord> {
  console.log(`Processing GeoJSON: ${geojsonPath}`);

  const content = fs.readFileSync(geojsonPath, 'utf-8');
  const geojson: GeoJSON = JSON.parse(content);

  console.log(`  Found ${geojson.features.length} features`);

  const records = new Map<string, BiomeRecord>();
  const precision = 4;

  // For each feature, find its bounding box and populate geohashes
  for (let i = 0; i < geojson.features.length; i++) {
    const feature = geojson.features[i];
    const progress = ((i / geojson.features.length) * 100).toFixed(1);
    process.stdout.write(`\r  Processing features: ${progress}%`);

    // Get biome info
    const biomeNum = feature.properties.BIOME_NUM;
    const biomeName = feature.properties.BIOME_NAME?.toLowerCase() || '';

    let biomeCode: BiomeCode | undefined;

    if (biomeNum && RESOLVE_BIOME_MAP[biomeNum]) {
      biomeCode = RESOLVE_BIOME_MAP[biomeNum];
    } else if (RESOLVE_BIOME_NAMES[biomeName]) {
      biomeCode = RESOLVE_BIOME_NAMES[biomeName];
    }

    if (!biomeCode) continue;

    // Get geometry bounds
    const coords = feature.geometry.coordinates;
    let allPoints: number[][] = [];

    if (feature.geometry.type === 'Polygon') {
      allPoints = (coords as number[][][])[0];
    } else if (feature.geometry.type === 'MultiPolygon') {
      for (const poly of coords as number[][][][]) {
        allPoints.push(...poly[0]);
      }
    }

    if (allPoints.length === 0) continue;

    // Calculate bounding box
    const lngs = allPoints.map(p => p[0]);
    const lats = allPoints.map(p => p[1]);
    const bbox = {
      lngMin: Math.min(...lngs),
      lngMax: Math.max(...lngs),
      latMin: Math.min(...lats),
      latMax: Math.max(...lats),
    };

    // Generate geohashes within bounding box
    const geohashes = generateGeohashGrid(
      bbox.latMin,
      bbox.latMax,
      bbox.lngMin,
      bbox.lngMax,
      precision
    );

    // Check which geohashes are actually inside the polygon
    for (const geohash of geohashes) {
      if (records.has(geohash)) continue; // First match wins

      const { lat, lng } = decodeGeohash(geohash);

      // Simple containment check for Polygon (skip for MultiPolygon due to complexity)
      if (feature.geometry.type === 'Polygon') {
        const polygon = (coords as number[][][])[0];
        if (!pointInPolygon(lat, lng, polygon)) continue;
      }

      records.set(geohash, {
        geohash,
        lat,
        lng,
        biomeCode,
        biomeName: feature.properties.BIOME_NAME || biomeCode,
        confidence: 0.9,
        source: 'resolve_ecoregions',
      });
    }
  }

  console.log(`\n  Processed ${records.size} geohash cells`);
  return records;
}

/**
 * Generate estimated biome data (when no GeoJSON available)
 */
function generateEstimatedData(): BiomeRecord[] {
  console.log('Generating estimated biome data based on latitude...');

  const records: BiomeRecord[] = [];
  const precision = 4;

  // Define regions to generate
  const regions = [
    // North America
    { name: 'North America', latMin: 25, latMax: 70, lngMin: -170, lngMax: -50 },
    // Europe
    { name: 'Europe', latMin: 35, latMax: 72, lngMin: -25, lngMax: 50 },
    // Asia
    { name: 'Asia', latMin: 5, latMax: 75, lngMin: 50, lngMax: 180 },
    // Africa
    { name: 'Africa', latMin: -35, latMax: 38, lngMin: -20, lngMax: 55 },
    // South America
    { name: 'South America', latMin: -55, latMax: 15, lngMin: -85, lngMax: -30 },
    // Australia
    { name: 'Australia', latMin: -45, latMax: -10, lngMin: 110, lngMax: 155 },
  ];

  for (const region of regions) {
    console.log(`  Processing ${region.name}...`);

    const geohashes = generateGeohashGrid(
      region.latMin,
      region.latMax,
      region.lngMin,
      region.lngMax,
      precision
    );

    for (const geohash of geohashes) {
      const { lat, lng } = decodeGeohash(geohash);
      const { biomeCode, biomeName } = estimateBiomeFromLatitude(lat, lng);

      records.push({
        geohash,
        lat,
        lng,
        biomeCode,
        biomeName,
        confidence: 0.5, // Lower confidence for estimated data
        source: 'estimated',
      });
    }
  }

  console.log(`  Generated ${records.length} records`);
  return records;
}

/**
 * Main function
 */
async function main() {
  console.log('Resolve Ecoregions Biome Processor');
  console.log('===================================\n');

  // Create output directory
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let records: BiomeRecord[];

  // Check for GeoJSON input
  const geojsonPath = process.argv[2];

  if (geojsonPath && fs.existsSync(geojsonPath)) {
    const recordsMap = processGeoJSON(geojsonPath);
    records = Array.from(recordsMap.values());
  } else {
    if (geojsonPath) {
      console.log(`GeoJSON file not found: ${geojsonPath}`);
    }
    console.log('No GeoJSON provided - generating estimated data.\n');
    console.log('To use actual Resolve Ecoregions data:');
    console.log('1. Download from https://ecoregions.appspot.com/');
    console.log('2. Run: npx ts-node scripts/gis/fetchBiomes.ts path/to/ecoregions.geojson\n');

    records = generateEstimatedData();
  }

  // Save raw data
  const outputPath = path.join(outputDir, 'biomes_raw.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    _meta: {
      source: records[0]?.source === 'resolve_ecoregions' ? 'Resolve Ecoregions 2017' : 'Latitude-based estimation',
      generatedAt: new Date().toISOString(),
      totalRecords: records.length,
    },
    records,
  }, null, 2));

  console.log(`\nSaved ${records.length} records to ${outputPath}`);

  // Generate summary statistics
  const biomeCounts: Record<string, number> = {};
  for (const record of records) {
    biomeCounts[record.biomeCode] = (biomeCounts[record.biomeCode] || 0) + 1;
  }

  console.log('\nBiome distribution:');
  const sorted = Object.entries(biomeCounts)
    .sort((a, b) => b[1] - a[1]);
  for (const [biome, count] of sorted) {
    const pct = ((count / records.length) * 100).toFixed(1);
    console.log(`  ${biome}: ${count} (${pct}%)`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { estimateBiomeFromLatitude, processGeoJSON, BiomeRecord, BiomeCode };
