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

// ═══════════════════════════════════════════════════════════════════════════
// Lithology Specificity Ranking
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Specificity tiers for lithology types.
 * Higher values = more specific = prefer these over generic types.
 */
const LITHOLOGY_SPECIFICITY: Record<string, number> = {
  // Tier 3 - Specific rock types (prefer these)
  granite: 3,
  granodiorite: 3,
  diorite: 3,
  gabbro: 3,
  basalt: 3,
  andesite: 3,
  rhyolite: 3,
  dacite: 3,
  obsidian: 3,
  pumice: 3,
  tuff: 3,
  ignimbrite: 3,
  gneiss: 3,
  schist: 3,
  'pelitic schist': 3,
  slate: 3,
  phyllite: 3,
  marble: 3,
  quartzite: 3,
  amphibolite: 3,
  sandstone: 3,
  siltstone: 3,
  shale: 3,
  mudstone: 3,
  claystone: 3,
  limestone: 3,
  dolomite: 3,
  dolostone: 3,
  chalk: 3,
  marl: 3,
  chert: 3,
  novaculite: 3,
  conglomerate: 3,
  breccia: 3,

  // Tier 2 - Semi-specific (compositional/textural classes)
  'mafic volcanic': 2,
  'felsic volcanic': 2,
  'intermediate volcanic': 2,
  carbonate: 2,
  'carbonate rocks': 2,
  plutonic: 2,
  'plutonic rocks': 2,
  clastic: 2,
  'clastic rocks': 2,
  volcaniclastic: 2,
  evaporite: 2,
  'crystalline rocks': 2,

  // Tier 1 - Generic (avoid these when possible)
  sedimentary: 1,
  'sedimentary rocks': 1,
  metamorphic: 1,
  'metamorphic rocks': 1,
  igneous: 1,
  'igneous rocks': 1,
  volcanic: 1,
  'volcanic rocks': 1,
};

/**
 * Parse structured lithology fields like "Major:{granite,gneiss};Minor:{schist}"
 * Also handles variants without colon: "Major{...}" and "Minor{...}"
 */
function parseStructuredLith(lith: string): { major: string[]; minor: string[] } {
  const major: string[] = [];
  const minor: string[] = [];

  // Match both "Major:{...}" and "Major{...}" (some data has typos)
  const majorMatch = lith.match(/Major:?\{([^}]+)\}/i);
  if (majorMatch) {
    major.push(...majorMatch[1].split(',').map((s) => s.trim().toLowerCase()));
  }

  // Match both "Minor:{...}" and "Minor{...}"
  const minorMatch = lith.match(/Minor:?\{([^}]+)\}/i);
  if (minorMatch) {
    minor.push(...minorMatch[1].split(',').map((s) => s.trim().toLowerCase()));
  }

  return { major, minor };
}

/**
 * Get the specificity score for a lithology string.
 * Checks for specific rock names as substrings (e.g., "tuff group" contains "tuff").
 */
function getSpecificityScore(lith: string): { score: number; matchedRock: string | null } {
  const lower = lith.toLowerCase();

  // First check exact match
  if (LITHOLOGY_SPECIFICITY[lower] !== undefined) {
    return { score: LITHOLOGY_SPECIFICITY[lower], matchedRock: lower };
  }

  // Check for specific rock names as substrings
  // Sort by length descending to match longer names first (e.g., "pelitic schist" before "schist")
  const specificRocks = Object.keys(LITHOLOGY_SPECIFICITY).sort((a, b) => b.length - a.length);
  for (const rock of specificRocks) {
    if (LITHOLOGY_SPECIFICITY[rock] >= 2 && lower.includes(rock)) {
      return { score: LITHOLOGY_SPECIFICITY[rock], matchedRock: rock };
    }
  }

  return { score: 0, matchedRock: null };
}

/**
 * Select the best (most specific) lithology from a list.
 * Returns the most specific rock name found, extracting it from composite strings if needed.
 */
function selectBestLithology(lithologies: string[]): string {
  if (lithologies.length === 0) return '';
  if (lithologies.length === 1) {
    const { matchedRock } = getSpecificityScore(lithologies[0]);
    return matchedRock || lithologies[0];
  }

  // Find the lithology with the highest specificity score
  let bestLith = lithologies[0];
  let bestScore = 0;
  let bestRock: string | null = null;

  for (const lith of lithologies) {
    const { score, matchedRock } = getSpecificityScore(lith);
    if (score > bestScore) {
      bestScore = score;
      bestLith = lith;
      bestRock = matchedRock;
    }
  }

  // Return the matched specific rock name if we found one, otherwise the original
  return bestRock || bestLith;
}

// Rate limiting
const RATE_LIMIT_MS = 100; // 10 requests per second
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Query Macrostrat API for a specific location.
 * Returns lithologies sorted by specificity (most specific first).
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

    // Extract lithologies from map units, prioritizing structured fields
    const allLithologies: string[] = [];

    for (const unit of data.success.data) {
      if (unit.lith && unit.lith.trim()) {
        // First, try to parse structured fields like "Major:{granite,gneiss}"
        const structured = parseStructuredLith(unit.lith);

        if (structured.major.length > 0) {
          // Add major lithologies (high priority)
          allLithologies.push(...structured.major);
        }
        if (structured.minor.length > 0) {
          // Add minor lithologies (medium priority)
          allLithologies.push(...structured.minor);
        }

        // Also parse plain semicolon/comma-separated values for unstructured data
        // Remove structured fields first, then split on both ; and ,
        const plainText = unit.lith
          .replace(/Major:?\{[^}]+\}/gi, '')
          .replace(/Minor:?\{[^}]+\}/gi, '')
          .replace(/Incidental:?\{[^}]+\}/gi, '');

        // Split on semicolons first (major separator)
        for (const segment of plainText.split(';')) {
          // Then split on commas (for lists like "basalt, olivine basalt, tholeiite")
          const parts = segment.split(',').map((l) => l.trim().toLowerCase());
          for (const part of parts) {
            if (part && part.length > 1) {
              allLithologies.push(part);
            }
          }
        }
      }

      // Also check the name field for rock type hints if no lith data
      if (unit.name && !unit.lith) {
        const nameLower = unit.name.toLowerCase();
        const rockHints = [
          'granite',
          'limestone',
          'sandstone',
          'shale',
          'basalt',
          'gneiss',
          'schist',
          'marble',
          'quartzite',
          'slate',
          'dolomite',
        ];
        for (const hint of rockHints) {
          if (nameLower.includes(hint)) {
            allLithologies.push(hint);
          }
        }
      }
    }

    // Deduplicate and sort by specificity (most specific first)
    const unique = [...new Set(allLithologies)];
    return unique.sort((a, b) => {
      const aScore = getSpecificityScore(a).score;
      const bScore = getSpecificityScore(b).score;
      return bScore - aScore;
    });
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
 * Process a single geohash - query its center point.
 * Uses specificity ranking to select the best primary lithology.
 */
async function processGeohash(geohash: string): Promise<GeologyRecord | null> {
  const { lat, lng } = decodeGeohash(geohash);
  const lithologies = await queryMacrostrat(lat, lng);

  if (lithologies.length === 0) {
    return null;
  }

  // lithologies are already sorted by specificity from queryMacrostrat
  const primaryLithology = selectBestLithology(lithologies);
  const secondaryLithologies = lithologies.filter((l) => l !== primaryLithology);

  return {
    geohash,
    lat,
    lng,
    primaryLithology,
    secondaryLithologies,
    confidence: Math.min(0.9, 0.5 + lithologies.length * 0.1),
    source: 'macrostrat',
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): { resume: boolean } {
  const args = process.argv.slice(2);
  return {
    resume: args.includes('--resume'),
  };
}

/**
 * Load existing records from output file
 */
function loadExistingRecords(outputPath: string): GeologyRecord[] {
  if (!fs.existsSync(outputPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(outputPath, 'utf-8');
    const data = JSON.parse(content);
    return data.records || [];
  } catch (error) {
    console.warn('Warning: Could not load existing data:', error);
    return [];
  }
}

/**
 * Main function - fetch geology data for global grid
 */
async function main() {
  const args = parseArgs();

  console.log('Macrostrat Geology Fetcher');
  console.log('==========================');
  if (args.resume) {
    console.log('Mode: RESUME (skipping existing geohashes)');
  }
  console.log('');

  // Create output directory
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'macrostrat_raw.json');

  // Configuration
  const precision = 4; // ~39km resolution
  const batchSize = 50;

  // Load existing records if resuming
  let existingRecords: GeologyRecord[] = [];
  const existingGeohashes = new Set<string>();

  if (args.resume) {
    existingRecords = loadExistingRecords(outputPath);
    for (const record of existingRecords) {
      existingGeohashes.add(record.geohash);
    }
    console.log(`Loaded ${existingRecords.length} existing records`);
    console.log(`Will skip ${existingGeohashes.size} already-fetched geohashes\n`);
  }

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

  // Start with existing records if resuming
  const allRecords: GeologyRecord[] = args.resume ? [...existingRecords] : [];
  let newRecords = 0;
  let skippedRecords = 0;

  for (const region of regions) {
    console.log(`\nProcessing ${region.name}...`);

    const geohashes = generateGeohashGrid(
      region.latMin,
      region.latMax,
      region.lngMin,
      region.lngMax,
      precision
    );

    // Filter out already-fetched geohashes if resuming
    const toFetch = args.resume ? geohashes.filter((gh) => !existingGeohashes.has(gh)) : geohashes;

    const skipped = geohashes.length - toFetch.length;
    skippedRecords += skipped;

    console.log(`  Generated ${geohashes.length} geohashes`);
    if (args.resume && skipped > 0) {
      console.log(`  Skipping ${skipped} already-fetched, fetching ${toFetch.length} new`);
    }

    if (toFetch.length === 0) {
      console.log(`  All geohashes already fetched, skipping region`);
      continue;
    }

    // Process in batches
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      const progress = ((i / toFetch.length) * 100).toFixed(1);
      process.stdout.write(`\r  Processing: ${progress}% (${i}/${toFetch.length})`);

      // Process batch sequentially with rate limiting
      for (const geohash of batch) {
        const record = await processGeohash(geohash);
        if (record) {
          allRecords.push(record);
          newRecords++;
        }
        await sleep(RATE_LIMIT_MS);
      }

      // Save checkpoint every 500 new records
      if (newRecords > 0 && newRecords % 500 === 0) {
        fs.writeFileSync(
          outputPath,
          JSON.stringify(
            {
              _meta: {
                source: 'Macrostrat API',
                fetchedAt: new Date().toISOString(),
                precision,
                totalRecords: allRecords.length,
                checkpoint: true,
              },
              records: allRecords,
            },
            null,
            2
          )
        );
      }
    }

    console.log(
      `\n  Completed ${region.name}: ${allRecords.length} total records (${newRecords} new)`
    );
  }

  // Save final data
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

  // Summary
  console.log('\n==========================');
  console.log('Fetch Complete!');
  console.log('==========================');
  console.log(`Output: ${outputPath}`);
  console.log(`Total records: ${allRecords.length}`);
  if (args.resume) {
    console.log(`  - Existing: ${existingRecords.length}`);
    console.log(`  - New: ${newRecords}`);
    console.log(`  - Skipped (already fetched): ${skippedRecords}`);
  }

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

  console.log('\nUsage:');
  console.log('  npx tsx scripts/gis/fetchMacrostrat.ts          # Full fetch');
  console.log('  npx tsx scripts/gis/fetchMacrostrat.ts --resume # Retry missing only');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  queryMacrostrat,
  processGeohash,
  generateGeohashGrid,
  encodeGeohash,
  decodeGeohash,
  parseStructuredLith,
  selectBestLithology,
  getSpecificityScore,
  LITHOLOGY_SPECIFICITY,
  GeologyRecord,
};
