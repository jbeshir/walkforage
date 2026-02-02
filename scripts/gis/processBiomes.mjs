/**
 * processBiomes.mjs - Process Resolve Ecoregions shapefile to build biome database
 *
 * Reads the Ecoregions2017 shapefile and builds a geohash-indexed biome database.
 *
 * Data source: https://ecoregions.appspot.com/
 * Input: scripts/gis/input/Ecoregions2017.shp (use gis:download-biomes to fetch)
 *
 * Usage: npm run gis:process-biomes
 *        node scripts/gis/processBiomes.mjs
 *
 * Output: scripts/gis/output/biomes_raw.json
 */

import * as shapefile from 'shapefile';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_SHP = path.join(__dirname, 'input', 'Ecoregions2017.shp');
const OUTPUT_JSON = path.join(__dirname, 'output', 'biomes_raw.json');

// Geohash encoding
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat, lng, precision = 6) {
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

function decodeGeohash(hash) {
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

// Resolve Ecoregions biome ID to game code mapping
const BIOME_MAP = {
  1: { code: 'tropical_moist_broadleaf', name: 'Tropical & Subtropical Moist Broadleaf Forests' },
  2: { code: 'tropical_dry_broadleaf', name: 'Tropical & Subtropical Dry Broadleaf Forests' },
  3: { code: 'tropical_conifer', name: 'Tropical & Subtropical Coniferous Forests' },
  4: { code: 'temperate_broadleaf_mixed', name: 'Temperate Broadleaf & Mixed Forests' },
  5: { code: 'temperate_conifer', name: 'Temperate Conifer Forests' },
  6: { code: 'boreal', name: 'Boreal Forests/Taiga' },
  7: { code: 'tropical_grassland', name: 'Tropical & Subtropical Grasslands, Savannas & Shrublands' },
  8: { code: 'temperate_grassland', name: 'Temperate Grasslands, Savannas & Shrublands' },
  9: { code: 'flooded_grassland', name: 'Flooded Grasslands & Savannas' },
  10: { code: 'montane', name: 'Montane Grasslands & Shrublands' },
  11: { code: 'tundra', name: 'Tundra' },
  12: { code: 'mediterranean', name: 'Mediterranean Forests, Woodlands & Scrub' },
  13: { code: 'desert', name: 'Deserts & Xeric Shrublands' },
  14: { code: 'mangrove', name: 'Mangroves' },
};

// Point in polygon test (ray casting algorithm)
function pointInPolygon(lat, lng, polygon) {
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

// Generate geohash grid for a bounding box
function generateGeohashGrid(latMin, latMax, lngMin, lngMax, precision) {
  const geohashes = new Set();
  // Geohash cells are NOT square - longitude gets more bits than latitude
  // Precision 3: 15 bits total, 8 lng (360/256 = 1.4°), 7 lat (180/128 = 1.4°)
  // Precision 4: 20 bits total, 10 lng (360/1024 = 0.35°), 10 lat (180/1024 = 0.18°)
  // Use steps at ~80% of cell size to ensure complete coverage
  const totalBits = precision * 5;
  const lngBits = Math.ceil(totalBits / 2);
  const latBits = Math.floor(totalBits / 2);
  const cellLngDegrees = 360 / Math.pow(2, lngBits);
  const cellLatDegrees = 180 / Math.pow(2, latBits);
  const latStep = cellLatDegrees * 0.8;
  const lngStep = cellLngDegrees * 0.8;

  for (let lat = latMin; lat <= latMax; lat += latStep) {
    for (let lng = lngMin; lng <= lngMax; lng += lngStep) {
      const hash = encodeGeohash(lat, lng, precision);
      geohashes.add(hash);
    }
  }

  return [...geohashes];
}

// Calculate bounding box for a polygon
function getBoundingBox(coordinates) {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const point of coordinates) {
    minLng = Math.min(minLng, point[0]);
    maxLng = Math.max(maxLng, point[0]);
    minLat = Math.min(minLat, point[1]);
    maxLat = Math.max(maxLat, point[1]);
  }

  return { minLng, maxLng, minLat, maxLat };
}

async function processShapefile() {
  console.log('Processing Resolve Ecoregions shapefile...');
  console.log(`Input: ${INPUT_SHP}`);
  console.log(`Output: ${OUTPUT_JSON}`);
  console.log();

  const records = new Map();
  const precision = 4; // ~39km cells
  let featureCount = 0;
  let processedGeohashes = 0;
  const biomeCounts = {};

  const source = await shapefile.open(INPUT_SHP);

  while (true) {
    const result = await source.read();
    if (result.done) break;

    featureCount++;
    const feature = result.value;
    const props = feature.properties;

    // Get biome info from properties
    const biomeNum = props.BIOME_NUM;
    const biomeInfo = BIOME_MAP[biomeNum];

    if (!biomeInfo) {
      console.log(`  Skipping feature ${featureCount}: unknown biome ${biomeNum}`);
      continue;
    }

    // Extract ecoregion data for realm+biome mapping
    const ecoregionId = props.ECO_ID || null;
    const realmBiome = props.ECO_BIOME_ || null;  // e.g., "PA04", "NT01"
    const realm = props.REALM || null;  // e.g., "Palearctic", "Neotropic"

    if (featureCount % 50 === 0) {
      process.stdout.write(`\rProcessing feature ${featureCount}... (${processedGeohashes} geohashes assigned)`);
    }

    // Process geometry
    const geometry = feature.geometry;
    if (!geometry) continue;

    const processPolygon = (polygon) => {
      const outerRing = polygon[0]; // First ring is outer boundary
      if (!outerRing || outerRing.length < 3) return;

      const bbox = getBoundingBox(outerRing);
      const geohashes = generateGeohashGrid(
        bbox.minLat, bbox.maxLat,
        bbox.minLng, bbox.maxLng,
        precision
      );

      for (const geohash of geohashes) {
        if (records.has(geohash)) continue; // First match wins

        const { lat, lng } = decodeGeohash(geohash);

        // Check if point is actually inside the polygon
        if (pointInPolygon(lat, lng, outerRing)) {
          records.set(geohash, {
            geohash,
            lat,
            lng,
            biomeCode: biomeInfo.code,
            biomeName: biomeInfo.name,
            ecoregionId,
            realmBiome,
            realm,
            confidence: 0.9,
            source: 'resolve_ecoregions',
          });
          processedGeohashes++;
          biomeCounts[biomeInfo.code] = (biomeCounts[biomeInfo.code] || 0) + 1;
        }
      }
    };

    if (geometry.type === 'Polygon') {
      processPolygon(geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates) {
        processPolygon(polygon);
      }
    }
  }

  console.log(`\n\nProcessed ${featureCount} features`);
  console.log(`Total geohash records: ${records.size}`);

  // Convert Map to array
  const recordsArray = Array.from(records.values());

  // Write output
  const output = {
    _meta: {
      source: 'Resolve Ecoregions 2017',
      generatedAt: new Date().toISOString(),
      totalRecords: recordsArray.length,
    },
    records: recordsArray,
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
  console.log(`\nSaved to ${OUTPUT_JSON}`);

  // Print biome distribution
  console.log('\nBiome distribution:');
  const sorted = Object.entries(biomeCounts).sort((a, b) => b[1] - a[1]);
  for (const [biome, count] of sorted) {
    const pct = ((count / recordsArray.length) * 100).toFixed(1);
    console.log(`  ${biome}: ${count} (${pct}%)`);
  }

  console.log(`\nTotal biome types: ${Object.keys(biomeCounts).length}`);
}

processShapefile().catch(console.error);
