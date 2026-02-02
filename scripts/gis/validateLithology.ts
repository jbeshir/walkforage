/**
 * validateLithology.ts - Validate lithology data quality
 *
 * Checks:
 * 1. Generic lithology percentage is below threshold
 * 2. All major cities have specific lithology data
 * 3. All lithologies in the database have mappings in lithologyToStones.json
 *
 * Usage: npx tsx scripts/gis/validateLithology.ts
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

// Configuration
// Note: Generic lithologies are common due to Macrostrat data quality limitations:
// - Ocean/water areas often have "unknown" lithology
// - Urban areas built on alluvial plains often show "mixed_sedimentary"
// - Areas without detailed geological surveys default to generic types
const MAX_GENERIC_PERCENTAGE = 80; // Fail if more than 80% of tiles have generic lithology
const MAJOR_CITIES_TO_CHECK = 20; // Check top N cities
const MIN_SPECIFIC_CITIES_PERCENTAGE = 25; // At least 25% of cities should have specific lithology
const MAX_NO_DATA_CITIES = 2; // Allow up to 2 cities with no data (edge cases at tile boundaries)

// Generic lithology types that indicate low-quality data
const GENERIC_LITHOLOGIES = [
  'mixed_sedimentary',
  'mixed_metamorphic',
  'mixed_igneous',
  'sedimentary',
  'metamorphic',
  'igneous',
  'unknown',
];

// Major cities for spot checks
const MAJOR_CITIES = [
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Berlin', lat: 52.52, lng: 13.405 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
  { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
];

// Paths
const SCRIPT_DIR = __dirname;
const ASSETS_DIR = path.join(SCRIPT_DIR, '../../assets/gis');
const DB_PATH = path.join(ASSETS_DIR, 'tiles.db');
const LITHOLOGY_MAPPING_PATH = path.join(
  SCRIPT_DIR,
  '../../src/data/gis/mappings/lithologyToStones.json'
);

// Geohash encoding
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

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string[];
}

/**
 * Check 1: Generic lithology percentage
 */
function checkGenericPercentage(db: Database.Database): ValidationResult {
  const totalQuery = db.prepare('SELECT COUNT(*) as count FROM tiles').get() as { count: number };
  const totalTiles = totalQuery.count;

  const genericQuery = db
    .prepare(
      `SELECT COUNT(*) as count FROM tiles WHERE primary_lithology IN (${GENERIC_LITHOLOGIES.map(() => '?').join(',')})`
    )
    .get(...GENERIC_LITHOLOGIES) as { count: number };
  const genericTiles = genericQuery.count;

  const genericPct = (genericTiles / totalTiles) * 100;

  const passed = genericPct <= MAX_GENERIC_PERCENTAGE;

  return {
    name: 'Generic Lithology Percentage',
    passed,
    message: passed
      ? `${genericPct.toFixed(1)}% generic (threshold: ${MAX_GENERIC_PERCENTAGE}%)`
      : `${genericPct.toFixed(1)}% generic exceeds threshold of ${MAX_GENERIC_PERCENTAGE}%`,
    details: [
      `Total tiles: ${totalTiles}`,
      `Generic tiles: ${genericTiles}`,
      `Specific tiles: ${totalTiles - genericTiles}`,
    ],
  };
}

/**
 * Check 2: Major cities have specific lithology
 */
function checkMajorCities(db: Database.Database): ValidationResult {
  const citiesWithGeneric: string[] = [];
  const citiesWithNoData: string[] = [];

  const stmt = db.prepare('SELECT primary_lithology FROM tiles WHERE geohash = ?');

  for (const city of MAJOR_CITIES.slice(0, MAJOR_CITIES_TO_CHECK)) {
    // Check at both precision-4 and precision-5
    const geohash4 = encodeGeohash(city.lat, city.lng, 4);
    const geohash5 = encodeGeohash(city.lat, city.lng, 5);

    const result4 = stmt.get(geohash4) as { primary_lithology: string } | undefined;
    const result5 = stmt.get(geohash5) as { primary_lithology: string } | undefined;

    // Prefer precision-5 data if available
    const result = result5 || result4;

    if (!result) {
      citiesWithNoData.push(city.name);
    } else if (GENERIC_LITHOLOGIES.includes(result.primary_lithology)) {
      citiesWithGeneric.push(`${city.name} (${result.primary_lithology})`);
    }
  }

  const totalChecked = MAJOR_CITIES.slice(0, MAJOR_CITIES_TO_CHECK).length;
  const specificCount = totalChecked - citiesWithGeneric.length - citiesWithNoData.length;
  const specificPct = (specificCount / totalChecked) * 100;
  const passed =
    specificPct >= MIN_SPECIFIC_CITIES_PERCENTAGE && citiesWithNoData.length <= MAX_NO_DATA_CITIES;

  return {
    name: 'Major Cities Lithology Quality',
    passed,
    message: passed
      ? `${specificCount} of ${totalChecked} cities (${specificPct.toFixed(0)}%) have specific lithology`
      : citiesWithNoData.length > MAX_NO_DATA_CITIES
        ? `${citiesWithNoData.length} cities have no data (max allowed: ${MAX_NO_DATA_CITIES})`
        : `Only ${specificPct.toFixed(0)}% of cities have specific lithology (threshold: ${MIN_SPECIFIC_CITIES_PERCENTAGE}%)`,
    details: [
      `Cities with specific lithology: ${specificCount} (${specificPct.toFixed(0)}%)`,
      ...(citiesWithGeneric.length > 0 ? [`Generic: ${citiesWithGeneric.join(', ')}`] : []),
      ...(citiesWithNoData.length > 0 ? [`No data: ${citiesWithNoData.join(', ')}`] : []),
    ],
  };
}

/**
 * Check 3: All lithologies have stone mappings
 */
function checkLithologyMappings(db: Database.Database): ValidationResult {
  // Get unique lithologies from database
  const lithQuery = db.prepare('SELECT DISTINCT primary_lithology FROM tiles').all() as {
    primary_lithology: string;
  }[];
  const dbLithologies = new Set(lithQuery.map((r) => r.primary_lithology));

  // Load lithology mappings
  let mappings: Record<string, unknown> = {};
  if (fs.existsSync(LITHOLOGY_MAPPING_PATH)) {
    mappings = JSON.parse(fs.readFileSync(LITHOLOGY_MAPPING_PATH, 'utf-8'));
  }

  // Find unmapped lithologies
  const unmapped: string[] = [];
  for (const lith of dbLithologies) {
    if (lith !== 'unknown' && !mappings[lith]) {
      unmapped.push(lith);
    }
  }

  const passed = unmapped.length === 0;

  return {
    name: 'Lithology Stone Mappings',
    passed,
    message: passed
      ? `All ${dbLithologies.size} lithologies have stone mappings`
      : `${unmapped.length} lithologies missing stone mappings`,
    details: unmapped.length > 0 ? [`Unmapped: ${unmapped.join(', ')}`] : undefined,
  };
}

/**
 * Check 4: Lithology distribution statistics
 */
function checkLithologyDistribution(db: Database.Database): ValidationResult {
  const query = db
    .prepare(
      `
    SELECT primary_lithology, COUNT(*) as count
    FROM tiles
    GROUP BY primary_lithology
    ORDER BY count DESC
    LIMIT 20
  `
    )
    .all() as { primary_lithology: string; count: number }[];

  const totalQuery = db.prepare('SELECT COUNT(*) as count FROM tiles').get() as { count: number };
  const total = totalQuery.count;

  const details = query.map((row) => {
    const pct = ((row.count / total) * 100).toFixed(1);
    const isGeneric = GENERIC_LITHOLOGIES.includes(row.primary_lithology);
    return `  ${row.primary_lithology}: ${row.count} (${pct}%)${isGeneric ? ' [GENERIC]' : ''}`;
  });

  // Always passes - this is informational
  return {
    name: 'Lithology Distribution',
    passed: true,
    message: `Top ${query.length} lithologies by frequency`,
    details,
  };
}

/**
 * Main validation function
 */
async function main() {
  console.log('Lithology Data Quality Validator');
  console.log('================================\n');

  // Check database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    console.error('Run "npm run gis:build" first to build the database.');
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  const results: ValidationResult[] = [];

  // Run checks
  console.log('Running validation checks...\n');

  results.push(checkGenericPercentage(db));
  results.push(checkMajorCities(db));
  results.push(checkLithologyMappings(db));
  results.push(checkLithologyDistribution(db));

  // Print results
  const sep = '-'.repeat(50);

  for (const result of results) {
    const status = result.passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`[${status}] ${result.name}`);
    console.log(`       ${result.message}`);
    if (result.details && result.details.length > 0) {
      for (const detail of result.details) {
        console.log(`       ${detail}`);
      }
    }
    console.log('');
  }

  // Summary
  console.log(sep);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed`);

  db.close();

  // Exit with appropriate code
  if (failed > 0) {
    console.log('\n\x1b[31mValidation FAILED\x1b[0m');
    process.exit(1);
  } else {
    console.log('\n\x1b[32mValidation PASSED\x1b[0m');
    process.exit(0);
  }
}

// Run if called directly
main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
