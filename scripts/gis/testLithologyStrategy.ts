/**
 * testLithologyStrategy.ts - Test the lithology selection strategy
 *
 * Fetches live Macrostrat data for test locations and shows:
 * 1. Raw API response
 * 2. How structured fields are parsed
 * 3. How specificity ranking selects the best lithology
 * 4. Final database value after normalization
 * 5. Summary statistics showing % of cities with specific lithology
 *
 * Usage:
 *   npx tsx scripts/gis/testLithologyStrategy.ts              # Summary of top 50 cities
 *   npx tsx scripts/gis/testLithologyStrategy.ts --detail     # Detailed output for all
 *   npx tsx scripts/gis/testLithologyStrategy.ts --location "New York"  # Single city detail
 *   npx tsx scripts/gis/testLithologyStrategy.ts --coords 40.7,-74.0    # Custom coordinates
 */

import {
  queryMacrostrat,
  parseStructuredLith,
  selectBestLithology,
  getSpecificityScore,
} from './fetchLithology';
import { encodeGeohash, decodeGeohash } from './geohashUtils';
import { normalizeLithology } from './buildSqliteBundle';
import { getCitiesByPopulation } from './cities';

// Generic lithology types (what we want to avoid)
const GENERIC_LITHOLOGIES = ['mixed_sedimentary', 'mixed_metamorphic', 'mixed_igneous', 'unknown'];

// Result tracking for summary
interface CityResult {
  name: string;
  country: string;
  lat: number;
  lng: number;
  dbValue: string;
  isSpecific: boolean;
  hasData: boolean;
}

// Test locations with known geological diversity (for detailed single-location tests)
const TEST_LOCATIONS = [
  // Cities where we expect structured data with specific rocks
  { name: 'New York (Manhattan)', lat: 40.7831, lng: -73.9712, expected: 'schist or gneiss' },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194, expected: 'sandstone or serpentinite' },
  { name: 'Denver', lat: 39.7392, lng: -104.9903, expected: 'shale or sandstone' },
  { name: 'Edinburgh', lat: 55.9533, lng: -3.1883, expected: 'sandstone or basalt' },
  { name: 'Rome', lat: 41.9028, lng: 12.4964, expected: 'tuff or limestone' },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, expected: 'tuff or sedimentary' },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, expected: 'sandstone' },
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241, expected: 'granite or sandstone' },

  // Locations with known specific geology
  { name: 'Hawaii (Kilauea)', lat: 19.4069, lng: -155.2834, expected: 'basalt' },
  { name: 'Yosemite', lat: 37.8651, lng: -119.5383, expected: 'granite' },
  { name: 'Grand Canyon', lat: 36.0544, lng: -112.1401, expected: 'limestone or sandstone' },
  { name: 'Iceland (Reykjavik)', lat: 64.1466, lng: -21.9426, expected: 'basalt' },
];

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

const RATE_LIMIT_MS = 150;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch raw Macrostrat data (without our processing)
 */
async function fetchRawMacrostrat(
  lat: number,
  lng: number
): Promise<{ units: MacrostratMapUnit[]; error?: string }> {
  const url = `https://macrostrat.org/api/v2/geologic_units/map?lat=${lat}&lng=${lng}&adjacents=false`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { units: [], error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as MacrostratResponse;

    if (!data.success?.data || !Array.isArray(data.success.data)) {
      return { units: [] };
    }

    return { units: data.success.data };
  } catch (error) {
    return { units: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Old approach: just take the first lithology
 */
function oldApproach(units: MacrostratMapUnit[]): string {
  for (const unit of units) {
    if (unit.lith && unit.lith.trim()) {
      const liths = unit.lith
        .split(';')
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l);
      if (liths.length > 0) {
        return liths[0];
      }
    }
  }
  return '(no data)';
}

/**
 * Analyze a single location
 */
async function analyzeLocation(
  name: string,
  lat: number,
  lng: number,
  expected?: string
): Promise<void> {
  const sep = '─'.repeat(70);
  const doubleSep = '═'.repeat(70);

  console.log(doubleSep);
  console.log(`📍 ${name}`);
  console.log(`   Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  if (expected) {
    console.log(`   Expected: ${expected}`);
  }
  console.log(sep);

  // Fetch raw data
  const { units, error } = await fetchRawMacrostrat(lat, lng);

  if (error) {
    console.log(`   ❌ API Error: ${error}`);
    return;
  }

  if (units.length === 0) {
    console.log(`   ⚠️  No Macrostrat data for this location`);
    return;
  }

  // Show raw API data
  console.log(`\n📦 RAW API RESPONSE (${units.length} units):`);
  for (const unit of units.slice(0, 3)) {
    // Show first 3 units
    console.log(`   Unit: "${unit.name || '(unnamed)'}"`);
    console.log(`   Lith: "${unit.lith || '(none)'}"`);
    if (unit.liths && unit.liths.length > 0) {
      console.log(`   Lith IDs: [${unit.liths.join(', ')}]`);
    }
    console.log('');
  }
  if (units.length > 3) {
    console.log(`   ... and ${units.length - 3} more units`);
  }

  // Parse structured fields
  console.log(`\n🔍 STRUCTURED FIELD PARSING:`);
  const allParsed: { major: string[]; minor: string[] } = { major: [], minor: [] };

  for (const unit of units) {
    if (unit.lith) {
      const parsed = parseStructuredLith(unit.lith);
      if (parsed.major.length > 0 || parsed.minor.length > 0) {
        console.log(
          `   From "${unit.lith.substring(0, 60)}${unit.lith.length > 60 ? '...' : ''}":`
        );
        if (parsed.major.length > 0) {
          console.log(`      Major: ${parsed.major.join(', ')}`);
          allParsed.major.push(...parsed.major);
        }
        if (parsed.minor.length > 0) {
          console.log(`      Minor: ${parsed.minor.join(', ')}`);
          allParsed.minor.push(...parsed.minor);
        }
      }
    }
  }

  if (allParsed.major.length === 0 && allParsed.minor.length === 0) {
    console.log(`   (No structured Major:{...} or Minor:{...} fields found)`);
  }

  // Get all lithologies using new approach
  const newLithologies = await queryMacrostrat(lat, lng);

  // Show specificity ranking
  console.log(`\n📊 SPECIFICITY RANKING:`);
  if (newLithologies.length > 0) {
    for (const lith of newLithologies.slice(0, 8)) {
      const { score, matchedRock } = getSpecificityScore(lith);
      const tier = score === 3 ? '★★★ specific' : score === 2 ? '★★☆ semi' : '★☆☆ generic';
      const rockNote =
        matchedRock && matchedRock !== lith.toLowerCase() ? ` → "${matchedRock}"` : '';
      console.log(`   ${lith}: ${tier} (${score})${rockNote}`);
    }
    if (newLithologies.length > 8) {
      console.log(`   ... and ${newLithologies.length - 8} more`);
    }
  } else {
    console.log(`   (No lithologies extracted)`);
  }

  // Compare old vs new
  console.log(`\n⚖️  COMPARISON:`);
  const oldResult = oldApproach(units);
  const newResult = selectBestLithology(newLithologies);

  const oldScore = getSpecificityScore(oldResult).score;
  const newScore = getSpecificityScore(newResult).score;

  console.log(`   OLD approach (first lithology): "${oldResult}" (score: ${oldScore})`);
  console.log(`   NEW approach (best specificity): "${newResult}" (score: ${newScore})`);

  if (newScore > oldScore) {
    console.log(`   ✅ NEW is better (+${newScore - oldScore} specificity)`);
  } else if (newScore === oldScore && oldResult !== newResult) {
    console.log(`   ➡️  Same tier, different rock`);
  } else if (oldResult === newResult) {
    console.log(`   ➡️  Same result`);
  } else {
    console.log(`   ⚠️  OLD was more specific (unusual)`);
  }

  // Show final database value
  console.log(`\n💾 DATABASE VALUE:`);
  const oldNormalized = normalizeLithology(oldResult);
  const newNormalized = normalizeLithology(newResult);

  console.log(
    `   OLD → normalizeLithology("${oldResult.substring(0, 40)}${oldResult.length > 40 ? '...' : ''}")`
  );
  console.log(`       = "${oldNormalized}"`);
  console.log(`   NEW → normalizeLithology("${newResult}")`);
  console.log(`       = "${newNormalized}"`);

  if (oldNormalized !== newNormalized) {
    const isOldGeneric = [
      'mixed_sedimentary',
      'mixed_metamorphic',
      'mixed_igneous',
      'unknown',
    ].includes(oldNormalized);
    const isNewGeneric = [
      'mixed_sedimentary',
      'mixed_metamorphic',
      'mixed_igneous',
      'unknown',
    ].includes(newNormalized);

    if (isOldGeneric && !isNewGeneric) {
      console.log(`   ✅ Improved: generic → specific`);
    } else if (!isOldGeneric && isNewGeneric) {
      console.log(`   ⚠️  Regression: specific → generic`);
    } else {
      console.log(`   ➡️  Different rock type`);
    }
  } else {
    console.log(`   ➡️  Same database value`);
  }

  // Check against expected
  if (expected) {
    const expectedParts = expected.toLowerCase().split(' or ');
    const matchesExpected = expectedParts.some(
      (e) => newNormalized.toLowerCase().includes(e) || e.includes(newNormalized.toLowerCase())
    );
    if (matchesExpected) {
      console.log(`   ✅ Matches expected: "${expected}"`);
    } else {
      console.log(`   ⚠️  Doesn't match expected: "${expected}"`);
    }
  }

  // Show geohash info
  const geohash4 = encodeGeohash(lat, lng, 4);
  const geohash5 = encodeGeohash(lat, lng, 5);
  const center4 = decodeGeohash(geohash4);
  const center5 = decodeGeohash(geohash5);

  console.log(`\n📐 GEOHASH INFO:`);
  console.log(
    `   Precision-4: ${geohash4} (center: ${center4.lat.toFixed(4)}, ${center4.lng.toFixed(4)})`
  );
  console.log(
    `   Precision-5: ${geohash5} (center: ${center5.lat.toFixed(4)}, ${center5.lng.toFixed(4)})`
  );

  // Calculate offset from actual coordinates to geohash center
  const offset4Km = Math.sqrt(
    Math.pow((lat - center4.lat) * 111, 2) +
      Math.pow((lng - center4.lng) * 111 * Math.cos((lat * Math.PI) / 180), 2)
  );
  const offset5Km = Math.sqrt(
    Math.pow((lat - center5.lat) * 111, 2) +
      Math.pow((lng - center5.lng) * 111 * Math.cos((lat * Math.PI) / 180), 2)
  );

  console.log(`   Offset from p4 center: ${offset4Km.toFixed(1)} km`);
  console.log(`   Offset from p5 center: ${offset5Km.toFixed(1)} km`);

  console.log('');
}

/**
 * Get the final database value for a location (quick version without full output)
 */
async function getDbValue(lat: number, lng: number): Promise<string | null> {
  const lithologies = await queryMacrostrat(lat, lng);
  if (lithologies.length === 0) return null;

  const bestLith = selectBestLithology(lithologies);
  return normalizeLithology(bestLith);
}

/**
 * Run summary analysis on top N cities
 */
async function runSummary(count: number): Promise<void> {
  const cities = getCitiesByPopulation(count);

  console.log(`\n📊 Testing top ${cities.length} cities by population...\n`);

  const results: CityResult[] = [];
  const lithologyCounts: Record<string, number> = {};

  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    process.stdout.write(`\r   Processing: ${i + 1}/${cities.length} - ${city.name.padEnd(25)}`);

    const dbValue = await getDbValue(city.lat, city.lng);
    const hasData = dbValue !== null;
    const finalValue = dbValue || 'no_data';
    const isSpecific = hasData && !GENERIC_LITHOLOGIES.includes(finalValue);

    results.push({
      name: city.name,
      country: city.country,
      lat: city.lat,
      lng: city.lng,
      dbValue: finalValue,
      isSpecific,
      hasData,
    });

    lithologyCounts[finalValue] = (lithologyCounts[finalValue] || 0) + 1;

    await sleep(RATE_LIMIT_MS);
  }

  console.log('\n');

  // Calculate statistics
  const totalWithData = results.filter((r) => r.hasData).length;
  const totalSpecific = results.filter((r) => r.isSpecific).length;
  const totalGeneric = results.filter((r) => r.hasData && !r.isSpecific).length;
  const totalNoData = results.filter((r) => !r.hasData).length;

  const specificPct = totalWithData > 0 ? ((totalSpecific / totalWithData) * 100).toFixed(1) : '0';
  const genericPct = totalWithData > 0 ? ((totalGeneric / totalWithData) * 100).toFixed(1) : '0';

  // Print summary
  const sep = '═'.repeat(70);
  const sepLight = '─'.repeat(70);

  console.log(sep);
  console.log('📈 LITHOLOGY DATA QUALITY SUMMARY');
  console.log(sep);
  console.log('');
  console.log(`Cities tested: ${results.length}`);
  console.log(
    `Cities with Macrostrat data: ${totalWithData} (${((totalWithData / results.length) * 100).toFixed(0)}%)`
  );
  console.log(`Cities with no data: ${totalNoData}`);
  console.log('');
  console.log(sepLight);
  console.log('OF CITIES WITH DATA:');
  console.log(sepLight);
  console.log(`   ✅ Specific lithology: ${totalSpecific} (${specificPct}%)`);
  console.log(`   ⚠️  Generic lithology:  ${totalGeneric} (${genericPct}%)`);
  console.log('');

  // Show lithology distribution
  console.log(sepLight);
  console.log('LITHOLOGY DISTRIBUTION:');
  console.log(sepLight);

  const sortedLiths = Object.entries(lithologyCounts).sort((a, b) => b[1] - a[1]);
  for (const [lith, count] of sortedLiths.slice(0, 15)) {
    const pct = ((count / results.length) * 100).toFixed(1);
    const marker = GENERIC_LITHOLOGIES.includes(lith) ? '⚠️ ' : '✅';
    console.log(`   ${marker} ${lith.padEnd(20)} ${count.toString().padStart(3)} (${pct}%)`);
  }
  if (sortedLiths.length > 15) {
    console.log(`   ... and ${sortedLiths.length - 15} more`);
  }
  console.log('');

  // Show cities with specific lithology
  console.log(sepLight);
  console.log('CITIES WITH SPECIFIC LITHOLOGY:');
  console.log(sepLight);
  const specificCities = results.filter((r) => r.isSpecific).slice(0, 20);
  for (const city of specificCities) {
    console.log(`   ${city.name.padEnd(20)} ${city.country.padEnd(12)} → ${city.dbValue}`);
  }
  if (results.filter((r) => r.isSpecific).length > 20) {
    console.log(`   ... and ${results.filter((r) => r.isSpecific).length - 20} more`);
  }
  console.log('');

  // Show cities with generic lithology
  console.log(sepLight);
  console.log('CITIES WITH GENERIC LITHOLOGY:');
  console.log(sepLight);
  const genericCities = results.filter((r) => r.hasData && !r.isSpecific).slice(0, 15);
  for (const city of genericCities) {
    console.log(`   ${city.name.padEnd(20)} ${city.country.padEnd(12)} → ${city.dbValue}`);
  }
  if (results.filter((r) => r.hasData && !r.isSpecific).length > 15) {
    console.log(`   ... and ${results.filter((r) => r.hasData && !r.isSpecific).length - 15} more`);
  }
  console.log('');

  console.log(sep);
  console.log(`RESULT: ${specificPct}% of cities have specific lithology data`);
  console.log(sep);
}

/**
 * Parse command line arguments
 */
function parseArgs(): {
  location?: string;
  coords?: { lat: number; lng: number };
  detail?: boolean;
  count?: number;
} {
  const args = process.argv.slice(2);
  const result: {
    location?: string;
    coords?: { lat: number; lng: number };
    detail?: boolean;
    count?: number;
  } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--location' && args[i + 1]) {
      result.location = args[i + 1];
      i++;
    } else if (args[i] === '--coords' && args[i + 1]) {
      const [lat, lng] = args[i + 1].split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        result.coords = { lat, lng };
      }
      i++;
    } else if (args[i] === '--detail') {
      result.detail = true;
    } else if (args[i] === '--count' && args[i + 1]) {
      result.count = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return result;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('');
  console.log('🧪 Lithology Strategy Test');
  console.log('══════════════════════════════════════════════════════════════════════');

  const args = parseArgs();

  if (args.coords) {
    // Test specific coordinates
    console.log('');
    console.log('Testing custom coordinates with detailed output...');
    console.log('');
    await analyzeLocation(`Custom location`, args.coords.lat, args.coords.lng);
  } else if (args.location) {
    // Find matching location in cities list or test locations
    const cities = getCitiesByPopulation(200);
    const cityMatch = cities.find((c) =>
      c.name.toLowerCase().includes(args.location!.toLowerCase())
    );
    const testMatch = TEST_LOCATIONS.find((loc) =>
      loc.name.toLowerCase().includes(args.location!.toLowerCase())
    );

    if (cityMatch) {
      console.log('');
      console.log('Testing single location with detailed output...');
      console.log('');
      await analyzeLocation(
        `${cityMatch.name} (${cityMatch.country})`,
        cityMatch.lat,
        cityMatch.lng
      );
    } else if (testMatch) {
      console.log('');
      console.log('Testing single location with detailed output...');
      console.log('');
      await analyzeLocation(testMatch.name, testMatch.lat, testMatch.lng, testMatch.expected);
    } else {
      console.log(`\nLocation "${args.location}" not found.`);
      console.log('\nUse --coords lat,lng to test any location.');
    }
  } else if (args.detail) {
    // Detailed output for test locations
    console.log('');
    console.log('Running detailed analysis on test locations...');
    console.log('');

    for (const loc of TEST_LOCATIONS) {
      await analyzeLocation(loc.name, loc.lat, loc.lng, loc.expected);
      await sleep(RATE_LIMIT_MS);
    }

    console.log('══════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Use --location "City" for single location detail.');
    console.log('Use --count N for summary of top N cities.');
  } else {
    // Default: run summary on top 50 cities
    const count = args.count || 50;
    await runSummary(count);

    console.log('');
    console.log('Options:');
    console.log('  --location "City"  Detailed analysis of a single city');
    console.log('  --coords lat,lng   Detailed analysis of custom coordinates');
    console.log('  --detail           Detailed analysis of 12 test locations');
    console.log('  --count N          Summary of top N cities (default: 50)');
  }
}

// Run
main().catch(console.error);
