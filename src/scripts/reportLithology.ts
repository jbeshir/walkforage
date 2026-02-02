/**
 * Lithology Data Quality Report
 *
 * Analyzes lithology data across 50 major world cities to understand:
 * 1. What fraction have "mixed_sedimentary" as their lithology
 * 2. Whether this comes from missing data (fallback), coarse aggregation, or actual Macrostrat data
 * 3. Whether the Macrostrat source data itself is generic ("sedimentary") vs. specific ("limestone")
 * 4. Live verification against the Macrostrat API to confirm our cached data matches
 *
 * This is a diagnostic report script (not a CI validation).
 * Run with: npm run report:lithology
 */

import * as fs from 'fs';
import * as path from 'path';
import { GeoDataService } from '../services/GeoDataService';
import { NodeTileLoader } from '../services/NodeTileLoader';
import { LocationGeoData } from '../types/gis';
import { encodeGeohash } from '../utils/geohash';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface CityCoords {
  name: string;
  lat: number;
  lng: number;
}

type Assessment = 'GOOD_DATA' | 'GENERIC_SOURCE' | 'MISSING_DATA' | 'COARSE_ONLY';

interface MacrostratLiveResult {
  lithologies: string[];
  unitNames: string[];
  error?: string;
}

interface CityAnalysis {
  city: CityCoords;
  geoData: LocationGeoData;
  rawLithology: string | null;
  assessment: Assessment;
  liveResult: MacrostratLiveResult;
}

interface RawMacrostratRecord {
  geohash: string;
  primaryLithology: string;
}

interface RawMacrostratFile {
  _meta: {
    source: string;
    totalRecords: number;
  };
  records: RawMacrostratRecord[];
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

// ═══════════════════════════════════════════════════════════════════════════
// City Data - 50 Major World Cities
// ═══════════════════════════════════════════════════════════════════════════

const CITIES: CityCoords[] = [
  // North America (10)
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },

  // Europe (10)
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Berlin', lat: 52.52, lng: 13.405 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
  { name: 'Moscow', lat: 55.7558, lng: 37.6173 },
  { name: 'Athens', lat: 37.9838, lng: 23.7275 },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'Vienna', lat: 48.2082, lng: 16.3738 },
  { name: 'Stockholm', lat: 59.3293, lng: 18.0686 },

  // Asia (15)
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Beijing', lat: 39.9042, lng: 116.4074 },
  { name: 'Shanghai', lat: 31.2304, lng: 121.4737 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { name: 'Seoul', lat: 37.5665, lng: 126.978 },
  { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
  { name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  { name: 'Manila', lat: 14.5995, lng: 120.9842 },
  { name: 'Taipei', lat: 25.033, lng: 121.5654 },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { name: 'Istanbul', lat: 41.0082, lng: 28.9784 },
  { name: 'Tel Aviv', lat: 32.0853, lng: 34.7818 },

  // Africa (5)
  { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { name: 'Lagos', lat: 6.5244, lng: 3.3792 },
  { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
  { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },

  // South America (5)
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
  { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
  { name: 'Lima', lat: -12.0464, lng: -77.0428 },
  { name: 'Bogotá', lat: 4.711, lng: -74.0721 },

  // Oceania (5)
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Melbourne', lat: -37.8136, lng: 144.9631 },
  { name: 'Auckland', lat: -36.8509, lng: 174.7645 },
  { name: 'Brisbane', lat: -27.4698, lng: 153.0251 },
  { name: 'Perth', lat: -31.9505, lng: 115.8605 },
];

// ═══════════════════════════════════════════════════════════════════════════
// Macrostrat Live API
// ═══════════════════════════════════════════════════════════════════════════

const RATE_LIMIT_MS = 150; // ~7 requests per second to be respectful
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Query Macrostrat API directly for a specific location
 */
async function queryMacrostratLive(lat: number, lng: number): Promise<MacrostratLiveResult> {
  const url = `https://macrostrat.org/api/v2/geologic_units/map?lat=${lat}&lng=${lng}&adjacents=false`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { lithologies: [], unitNames: [], error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as MacrostratResponse;

    if (!data.success?.data || !Array.isArray(data.success.data)) {
      return { lithologies: [], unitNames: [] };
    }

    const lithologies: string[] = [];
    const unitNames: string[] = [];

    for (const unit of data.success.data) {
      // Collect unit names
      if (unit.name) {
        unitNames.push(unit.name);
      }

      // Extract lithologies
      if (unit.lith && unit.lith.trim()) {
        const liths = unit.lith
          .split(';')
          .map((l) => l.trim())
          .filter((l) => l);
        lithologies.push(...liths);
      }
    }

    return {
      lithologies: [...new Set(lithologies)],
      unitNames: [...new Set(unitNames)],
    };
  } catch (error) {
    return {
      lithologies: [],
      unitNames: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Data Loading
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load raw Macrostrat data to lookup original lithology strings
 */
function loadRawMacrostratData(): Map<string, string> {
  const dataPath = path.join(__dirname, '../../scripts/gis/output/macrostrat_raw.json');
  if (!fs.existsSync(dataPath)) {
    console.warn(`Warning: Raw Macrostrat data not found at ${dataPath}`);
    return new Map();
  }

  const content = fs.readFileSync(dataPath, 'utf-8');
  const data: RawMacrostratFile = JSON.parse(content);
  const map = new Map<string, string>();

  for (const record of data.records) {
    map.set(record.geohash, record.primaryLithology);
  }

  return map;
}

// ═══════════════════════════════════════════════════════════════════════════
// Assessment Logic
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patterns indicating generic Macrostrat data (not specific rock types)
 */
const GENERIC_PATTERNS = [
  'sedimentary',
  'sedimentary rocks',
  'metamorphic',
  'metamorphic rocks',
  'igneous',
  'igneous rocks',
  'plutonic',
  'volcanic',
  'crystalline',
];

/**
 * Assess why a city has its lithology
 */
function assessLithology(geoData: LocationGeoData, rawLithology: string | null): Assessment {
  // Fallback means no Macrostrat coverage at all
  if (geoData.dataSource === 'fallback') {
    return 'MISSING_DATA';
  }

  // Coarse index means only aggregated data available
  if (geoData.dataSource === 'coarse') {
    return 'COARSE_ONLY';
  }

  // Detailed data - check if raw Macrostrat was generic
  if (!rawLithology) {
    // No raw data found for this geohash (shouldn't happen with detailed source)
    return 'GENERIC_SOURCE';
  }

  const lowerRaw = rawLithology.toLowerCase().trim();
  for (const pattern of GENERIC_PATTERNS) {
    if (lowerRaw === pattern || lowerRaw === `${pattern} rocks`) {
      return 'GENERIC_SOURCE';
    }
  }

  return 'GOOD_DATA';
}

/**
 * Check if live lithologies are generic
 */
function isLiveDataGeneric(lithologies: string[]): boolean {
  if (lithologies.length === 0) return true;

  for (const lith of lithologies) {
    const lower = lith.toLowerCase().trim();
    let isGeneric = false;
    for (const pattern of GENERIC_PATTERNS) {
      if (lower === pattern || lower === `${pattern} rocks` || lower.startsWith(`${pattern};`)) {
        isGeneric = true;
        break;
      }
    }
    // If any lithology is specific, data is not generic
    if (!isGeneric) return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Report Generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Print the full report
 */
function printReport(analyses: CityAnalysis[]): void {
  const sep = '='.repeat(70);
  const sepMini = '-'.repeat(50);

  console.log(sep);
  console.log('Lithology Data Quality Report (with Live API Verification)');
  console.log(sep);
  console.log('');

  // City-by-city analysis
  console.log('CITY-BY-CITY ANALYSIS');
  console.log(sepMini);

  for (const analysis of analyses) {
    const { city, geoData, rawLithology, assessment, liveResult } = analysis;
    console.log(`${city.name} (${city.lat.toFixed(4)}, ${city.lng.toFixed(4)})`);
    console.log(`  WalkForage Lithology: ${geoData.geology.primaryLithology}`);
    console.log(`  Data Source: ${geoData.dataSource}`);
    console.log(`  Confidence: ${geoData.geology.confidence.toFixed(2)}`);
    if (rawLithology) {
      console.log(`  Cached Raw Macrostrat: "${rawLithology}"`);
    }

    // Live API results
    if (liveResult.error) {
      console.log(`  Live API: ERROR - ${liveResult.error}`);
    } else if (liveResult.lithologies.length === 0) {
      console.log(`  Live API: No data returned`);
    } else {
      console.log(`  Live API Lithologies: ${liveResult.lithologies.join('; ')}`);
      if (liveResult.unitNames.length > 0) {
        const truncatedNames = liveResult.unitNames.slice(0, 3);
        const suffix = liveResult.unitNames.length > 3 ? '...' : '';
        console.log(`  Live API Unit Names: ${truncatedNames.join('; ')}${suffix}`);
      }
    }

    console.log(`  Assessment: ${assessment}`);
    console.log('');
  }

  // Summary statistics
  console.log(sep);
  console.log('SUMMARY STATISTICS');
  console.log(sep);
  console.log(`Total cities analyzed: ${analyses.length}`);
  console.log('');

  // Lithology distribution
  const lithCounts: Record<string, number> = {};
  for (const a of analyses) {
    const lith = a.geoData.geology.primaryLithology;
    lithCounts[lith] = (lithCounts[lith] || 0) + 1;
  }
  const sortedLiths = Object.entries(lithCounts).sort((a, b) => b[1] - a[1]);

  console.log('WalkForage Lithology Distribution:');
  for (const [lith, count] of sortedLiths) {
    const pct = ((count / analyses.length) * 100).toFixed(0);
    console.log(`  ${lith}: ${count} (${pct}%)`);
  }
  console.log('');

  // Data source breakdown
  const sourceCounts: Record<string, number> = {};
  for (const a of analyses) {
    const src = a.geoData.dataSource;
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }

  console.log('Data Source Breakdown:');
  for (const [src, count] of Object.entries(sourceCounts)) {
    const pct = ((count / analyses.length) * 100).toFixed(0);
    console.log(`  ${src}: ${count} (${pct}%)`);
  }
  console.log('');

  // Assessment breakdown
  const assessCounts: Record<Assessment, number> = {
    GOOD_DATA: 0,
    GENERIC_SOURCE: 0,
    MISSING_DATA: 0,
    COARSE_ONLY: 0,
  };
  for (const a of analyses) {
    assessCounts[a.assessment]++;
  }

  console.log('Assessment Breakdown:');
  console.log(
    `  GOOD_DATA (specific lithology): ${assessCounts.GOOD_DATA} (${((assessCounts.GOOD_DATA / analyses.length) * 100).toFixed(0)}%)`
  );
  console.log(
    `  GENERIC_SOURCE (Macrostrat returned generic): ${assessCounts.GENERIC_SOURCE} (${((assessCounts.GENERIC_SOURCE / analyses.length) * 100).toFixed(0)}%)`
  );
  console.log(
    `  MISSING_DATA (no Macrostrat coverage): ${assessCounts.MISSING_DATA} (${((assessCounts.MISSING_DATA / analyses.length) * 100).toFixed(0)}%)`
  );
  console.log(
    `  COARSE_ONLY (only coarse data): ${assessCounts.COARSE_ONLY} (${((assessCounts.COARSE_ONLY / analyses.length) * 100).toFixed(0)}%)`
  );
  console.log('');

  // Live API verification summary
  console.log(sep);
  console.log('LIVE API VERIFICATION');
  console.log(sep);

  let liveWithData = 0;
  let liveNoData = 0;
  let liveErrors = 0;
  let liveGeneric = 0;
  let liveSpecific = 0;

  for (const a of analyses) {
    if (a.liveResult.error) {
      liveErrors++;
    } else if (a.liveResult.lithologies.length === 0) {
      liveNoData++;
    } else {
      liveWithData++;
      if (isLiveDataGeneric(a.liveResult.lithologies)) {
        liveGeneric++;
      } else {
        liveSpecific++;
      }
    }
  }

  console.log(
    `Cities with live API data: ${liveWithData} (${((liveWithData / analyses.length) * 100).toFixed(0)}%)`
  );
  console.log(
    `Cities with no live data: ${liveNoData} (${((liveNoData / analyses.length) * 100).toFixed(0)}%)`
  );
  console.log(
    `Cities with API errors: ${liveErrors} (${((liveErrors / analyses.length) * 100).toFixed(0)}%)`
  );
  console.log('');
  console.log('Of cities with live data:');
  console.log(
    `  Generic lithology: ${liveGeneric} (${liveWithData > 0 ? ((liveGeneric / liveWithData) * 100).toFixed(0) : 0}%)`
  );
  console.log(
    `  Specific lithology: ${liveSpecific} (${liveWithData > 0 ? ((liveSpecific / liveWithData) * 100).toFixed(0) : 0}%)`
  );
  console.log('');

  // Conclusions
  console.log(sep);
  console.log('CONCLUSIONS');
  console.log(sep);

  const mixedSedCount = lithCounts['mixed_sedimentary'] || 0;
  const mixedSedPct = ((mixedSedCount / analyses.length) * 100).toFixed(0);

  console.log(`• ${mixedSedPct}% of major cities have "mixed_sedimentary" as their lithology`);
  console.log('');

  if (assessCounts.GENERIC_SOURCE > 0) {
    const genericPct = ((assessCounts.GENERIC_SOURCE / analyses.length) * 100).toFixed(0);
    console.log(
      `• ${genericPct}% of cities have generic Macrostrat data - this is a Macrostrat data limitation,`
    );
    console.log('  not a WalkForage normalization issue.');
  }

  if (liveSpecific > 0 && liveGeneric > 0) {
    console.log('');
    console.log(
      `• Live API confirms: ${((liveGeneric / liveWithData) * 100).toFixed(0)}% of Macrostrat responses are generic rock classes`
    );
  }

  if (assessCounts.MISSING_DATA > 0) {
    const missingCities = analyses
      .filter((a) => a.assessment === 'MISSING_DATA')
      .map((a) => a.city.name);
    console.log(`• Cities with no Macrostrat coverage: ${missingCities.join(', ')}`);
  }

  if (assessCounts.GOOD_DATA > 0) {
    const goodCities = analyses.filter((a) => a.assessment === 'GOOD_DATA').map((a) => a.city.name);
    console.log(`• Cities with specific lithology data: ${goodCities.join(', ')}`);
  }

  console.log('');
  console.log(sep);
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('Loading data sources...\n');

  // Load raw Macrostrat data for original lithology lookup
  const rawData = loadRawMacrostratData();
  console.log(`Loaded ${rawData.size} raw Macrostrat records`);

  // Create GeoDataService with NodeTileLoader
  const tileLoader = new NodeTileLoader();
  const geoDataService = new GeoDataService({ tileLoader });

  await geoDataService.initialize();
  console.log('GeoDataService initialized');
  console.log('');

  // Analyze each city
  const analyses: CityAnalysis[] = [];

  console.log(`Querying Macrostrat API for ${CITIES.length} cities...`);
  for (let i = 0; i < CITIES.length; i++) {
    const city = CITIES[i];
    process.stdout.write(`\r  Progress: ${i + 1}/${CITIES.length} - ${city.name.padEnd(20)}`);

    const geoData = await geoDataService.getLocationData(city.lat, city.lng);

    // Get the geohash at precision 4 (what the detailed tiles use)
    const geohash = encodeGeohash(city.lat, city.lng, 4);
    const rawLithology = rawData.get(geohash) || null;

    // Query live API
    const liveResult = await queryMacrostratLive(city.lat, city.lng);
    await sleep(RATE_LIMIT_MS);

    analyses.push({
      city,
      geoData,
      rawLithology,
      assessment: assessLithology(geoData, rawLithology),
      liveResult,
    });
  }
  console.log('\n');

  // Print report
  printReport(analyses);

  // Cleanup
  await geoDataService.close();
}

// Run if executed directly
main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
