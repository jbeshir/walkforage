/**
 * fetchMacrostrat.ts - Fetch geological data from Macrostrat API
 *
 * Queries Macrostrat's map API to build a geohash-indexed database
 * of lithology data for global coverage.
 *
 * Usage: npx ts-node scripts/gis/fetchMacrostrat.ts
 *
 * Output: scripts/gis/output/macrostrat_raw.json
 */

import * as fs from 'fs';
import * as path from 'path';

// Geohash encoding (copied from src/utils/geohash.ts for standalone use)
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let latMin = -90,
    latMax = 90;
  let lngMin = -180,
    lngMax = 180;
  let hash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isEven) {
      const lngMid = (lngMin + lngMax) / 2;
      if (lng >= lngMid) {
        ch |= 1 << (4 - bit);
        lngMin = lngMid;
      } else {
        lngMax = lngMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        ch |= 1 << (4 - bit);
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
  let latMin = -90,
    latMax = 90;
  let lngMin = -180,
    lngMax = 180;
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

// Macrostrat API types
interface MacrostratMapUnit {
  map_id: number;
  source_id: number;
  name: string;
  lith: string;
  descrip: string;
  strat_name: string;
  liths: number[];
  t_int_name: string | null;
  b_int_name: string | null;
  best_int_name: string | null;
}

interface MacrostratResponse {
  success: {
    data: MacrostratMapUnit[];
  };
}

interface GeologyRecord {
  geohash: string;
  lat: number;
  lng: number;
  primaryLithology: string;
  secondaryLithologies: string[];
  confidence: number;
  source: 'macrostrat';
}

// Rate limiting
const RATE_LIMIT_MS = 100; // 10 requests per second
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Query Macrostrat API for a specific location
 */
async function queryMacrostrat(lat: number, lng: number): Promise<string[]> {
  const url = `https://macrostrat.org/api/v2/geologic_units/map?lat=${lat}&lng=${lng}&adjacents=false`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`API error for ${lat},${lng}: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as MacrostratResponse;

    if (!data.success?.data || !Array.isArray(data.success.data)) {
      return [];
    }

    // Extract lithologies from map units
    const lithologies: string[] = [];
    for (const unit of data.success.data) {
      if (unit.lith && unit.lith.trim()) {
        // Macrostrat returns lithology as a string (may be semicolon-separated)
        const liths = unit.lith
          .split(';')
          .map((l) => l.trim().toLowerCase())
          .filter((l) => l);
        lithologies.push(...liths);
      }
      // Also check the name field for rock type hints
      if (unit.name && !unit.lith) {
        const nameLower = unit.name.toLowerCase();
        if (
          nameLower.includes('granite') ||
          nameLower.includes('limestone') ||
          nameLower.includes('sandstone') ||
          nameLower.includes('shale') ||
          nameLower.includes('basalt') ||
          nameLower.includes('sedimentary')
        ) {
          lithologies.push(nameLower);
        }
      }
    }

    return [...new Set(lithologies)]; // Deduplicate
  } catch (error) {
    console.warn(`Fetch error for ${lat},${lng}:`, error);
    return [];
  }
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

  // Calculate step size based on precision
  // Precision 3 = ~156km, Precision 4 = ~39km
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
 * Process a single geohash - query its center point
 */
async function processGeohash(geohash: string): Promise<GeologyRecord | null> {
  const { lat, lng } = decodeGeohash(geohash);
  const lithologies = await queryMacrostrat(lat, lng);

  if (lithologies.length === 0) {
    return null;
  }

  return {
    geohash,
    lat,
    lng,
    primaryLithology: lithologies[0],
    secondaryLithologies: lithologies.slice(1),
    confidence: Math.min(0.9, 0.5 + lithologies.length * 0.1),
    source: 'macrostrat',
  };
}

/**
 * Main function - fetch geology data for global grid
 */
async function main() {
  console.log('Macrostrat Geology Fetcher');
  console.log('==========================\n');

  // Create output directory
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Configuration
  const precision = 4; // ~39km resolution
  const batchSize = 50;

  // Define regions to fetch with global coverage
  const regions = [
    // North America (expanded coverage)
    { name: 'North America', latMin: 25, latMax: 55, lngMin: -130, lngMax: -60 },
    // Europe (expanded coverage)
    { name: 'Europe', latMin: 35, latMax: 65, lngMin: -10, lngMax: 45 },
    // East Asia (expanded and refetched)
    { name: 'East Asia', latMin: 20, latMax: 50, lngMin: 100, lngMax: 150 },
    // New regions for global coverage
    { name: 'South America', latMin: -55, latMax: 15, lngMin: -85, lngMax: -30 },
    { name: 'Africa', latMin: -35, latMax: 38, lngMin: -20, lngMax: 55 },
    { name: 'Australia', latMin: -45, latMax: -10, lngMin: 110, lngMax: 155 },
    { name: 'Southeast Asia', latMin: -10, latMax: 25, lngMin: 90, lngMax: 130 },
    { name: 'India', latMin: 5, latMax: 35, lngMin: 65, lngMax: 100 },
  ];

  const allRecords: GeologyRecord[] = [];

  for (const region of regions) {
    console.log(`\nProcessing ${region.name}...`);

    const geohashes = generateGeohashGrid(
      region.latMin,
      region.latMax,
      region.lngMin,
      region.lngMax,
      precision
    );

    console.log(`  Generated ${geohashes.length} geohashes`);

    // Process in batches
    for (let i = 0; i < geohashes.length; i += batchSize) {
      const batch = geohashes.slice(i, i + batchSize);
      const progress = ((i / geohashes.length) * 100).toFixed(1);
      process.stdout.write(`\r  Processing: ${progress}% (${i}/${geohashes.length})`);

      // Process batch sequentially with rate limiting
      for (const geohash of batch) {
        const record = await processGeohash(geohash);
        if (record) {
          allRecords.push(record);
        }
        await sleep(RATE_LIMIT_MS);
      }
    }

    console.log(`\n  Completed ${region.name}: ${allRecords.length} total records`);
  }

  // Save raw data
  const outputPath = path.join(outputDir, 'macrostrat_raw.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        _meta: {
          source: 'Macrostrat API',
          fetchedAt: new Date().toISOString(),
          precision,
          totalRecords: allRecords.length,
        },
        records: allRecords,
      },
      null,
      2
    )
  );

  console.log(`\nSaved ${allRecords.length} records to ${outputPath}`);

  // Generate summary statistics
  const lithCounts: Record<string, number> = {};
  for (const record of allRecords) {
    const lith = record.primaryLithology;
    lithCounts[lith] = (lithCounts[lith] || 0) + 1;
  }

  console.log('\nTop 10 lithologies found:');
  const sorted = Object.entries(lithCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [lith, count] of sorted) {
    console.log(`  ${lith}: ${count}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { queryMacrostrat, processGeohash, generateGeohashGrid, GeologyRecord };
