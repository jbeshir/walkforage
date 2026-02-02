/**
 * fetchCityLithology.ts - Fetch precision-5 lithology data for major cities
 *
 * Creates a high-resolution (~5km) lithology overlay for top global cities,
 * querying EXACT grid point coordinates rather than geohash centers.
 *
 * This provides better data quality for urban areas where most players are.
 *
 * Usage: npm run gis:fetch-city-lithology
 *        npx tsx scripts/gis/fetchCityLithology.ts
 *
 * Output: scripts/gis/output/cities_lithology.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCitiesByPopulation } from './cities';
import { queryMacrostrat, selectBestLithology, GeologyRecord } from './fetchLithology';
import { encodeGeohash } from './geohashUtils';

// Configuration
const PRECISION = 5; // ~5km cells
const RADIUS_KM = 25; // 25km radius = 50km x 50km grid per city
const RATE_LIMIT_MS = 100; // 10 requests per second
const MAX_CITIES = 200; // Process top N cities by population

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a grid of lat/lng points around a center coordinate.
 * Returns exact grid point coordinates, NOT geohash centers.
 */
function generateGridAroundPoint(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  precision: number
): Array<{ lat: number; lng: number; geohash: string }> {
  const points: Array<{ lat: number; lng: number; geohash: string }> = [];
  const seenGeohashes = new Set<string>();

  // Approximate degrees per km at this latitude
  const latDegreesPerKm = 1 / 111.32;
  const lngDegreesPerKm = 1 / (111.32 * Math.cos((centerLat * Math.PI) / 180));

  // Step size based on precision (~5km for precision 5)
  const stepKm = precision === 5 ? 4.0 : precision === 4 ? 30.0 : 150.0;

  const latStep = stepKm * latDegreesPerKm;
  const lngStep = stepKm * lngDegreesPerKm;

  const latMin = centerLat - radiusKm * latDegreesPerKm;
  const latMax = centerLat + radiusKm * latDegreesPerKm;
  const lngMin = centerLng - radiusKm * lngDegreesPerKm;
  const lngMax = centerLng + radiusKm * lngDegreesPerKm;

  for (let lat = latMin; lat <= latMax; lat += latStep) {
    for (let lng = lngMin; lng <= lngMax; lng += lngStep) {
      const geohash = encodeGeohash(lat, lng, precision);

      // Only add unique geohashes
      if (!seenGeohashes.has(geohash)) {
        seenGeohashes.add(geohash);
        points.push({ lat, lng, geohash });
      }
    }
  }

  return points;
}

/**
 * Process a single grid point - query at EXACT coordinates
 */
async function processGridPoint(
  lat: number,
  lng: number,
  geohash: string
): Promise<GeologyRecord | null> {
  const lithologies = await queryMacrostrat(lat, lng);

  if (lithologies.length === 0) {
    return null;
  }

  const primaryLithology = selectBestLithology(lithologies);
  const secondaryLithologies = lithologies.filter((l) => l !== primaryLithology);

  return {
    geohash,
    lat,
    lng,
    primaryLithology,
    secondaryLithologies,
    confidence: Math.min(0.95, 0.6 + lithologies.length * 0.1), // Higher base confidence for city data
    source: 'macrostrat',
  };
}

interface CityProgress {
  city: string;
  totalPoints: number;
  processedPoints: number;
  recordsFound: number;
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
 * Main function - fetch high-resolution city geology data
 */
async function main() {
  const args = parseArgs();

  console.log('City Geology Fetcher (Precision-5)');
  console.log('===================================');
  if (args.resume) {
    console.log('Mode: RESUME (skipping existing geohashes)');
  }
  console.log('');

  // Create output directory
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'cities_lithology.json');

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

  // Get cities sorted by population
  const cities = getCitiesByPopulation(MAX_CITIES);
  console.log(`Processing top ${cities.length} cities by population`);
  console.log(`Precision: ${PRECISION} (~${PRECISION === 5 ? '5km' : '39km'} cells)`);
  console.log(`Radius: ${RADIUS_KM}km (${RADIUS_KM * 2}km x ${RADIUS_KM * 2}km grid per city)\n`);

  // Calculate total work (accounting for existing data)
  let totalGridPoints = 0;
  let alreadyFetched = 0;
  for (const city of cities) {
    const grid = generateGridAroundPoint(city.lat, city.lng, RADIUS_KM, PRECISION);
    for (const point of grid) {
      if (args.resume && existingGeohashes.has(point.geohash)) {
        alreadyFetched++;
      } else {
        totalGridPoints++;
      }
    }
  }

  if (args.resume) {
    console.log(`Grid points to query: ~${totalGridPoints} (${alreadyFetched} already fetched)`);
  } else {
    console.log(`Total grid points to query: ~${totalGridPoints}`);
  }
  console.log(
    `Estimated time: ~${Math.ceil((totalGridPoints * RATE_LIMIT_MS) / 1000 / 60)} minutes\n`
  );

  // Start with existing records if resuming
  const allRecords: GeologyRecord[] = args.resume ? [...existingRecords] : [];
  const seenGeohashes = new Set<string>(existingGeohashes); // Track globally to avoid duplicate queries
  const cityProgress: CityProgress[] = [];
  let newRecords = 0;

  let totalProcessed = 0;

  for (let cityIdx = 0; cityIdx < cities.length; cityIdx++) {
    const city = cities[cityIdx];
    const progress: CityProgress = {
      city: city.name,
      totalPoints: 0,
      processedPoints: 0,
      recordsFound: 0,
    };

    // Generate grid for this city
    const gridPoints = generateGridAroundPoint(city.lat, city.lng, RADIUS_KM, PRECISION);

    // Filter out already-seen geohashes (from overlapping cities)
    const newPoints = gridPoints.filter((p) => !seenGeohashes.has(p.geohash));
    progress.totalPoints = newPoints.length;

    if (newPoints.length === 0) {
      console.log(
        `[${cityIdx + 1}/${cities.length}] ${city.name}: Skipped (all points covered by nearby cities)`
      );
      cityProgress.push(progress);
      continue;
    }

    console.log(
      `[${cityIdx + 1}/${cities.length}] ${city.name} (${city.country}): ${newPoints.length} new grid points`
    );

    // Process grid points
    for (const point of newPoints) {
      seenGeohashes.add(point.geohash);

      const record = await processGridPoint(point.lat, point.lng, point.geohash);
      if (record) {
        allRecords.push(record);
        progress.recordsFound++;
        newRecords++;
      }
      progress.processedPoints++;
      totalProcessed++;

      // Progress indicator every 100 points
      if (totalProcessed % 100 === 0) {
        const pct = ((totalProcessed / totalGridPoints) * 100).toFixed(1);
        process.stdout.write(`\r  Progress: ${pct}% (${totalProcessed}/${totalGridPoints})`);
      }

      await sleep(RATE_LIMIT_MS);
    }

    console.log(`\n  → Found ${progress.recordsFound} geology records`);
    cityProgress.push(progress);

    // Save checkpoint every 10 cities
    if ((cityIdx + 1) % 10 === 0) {
      const checkpointPath = path.join(outputDir, 'cities_lithology_checkpoint.json');
      fs.writeFileSync(
        checkpointPath,
        JSON.stringify(
          {
            _meta: {
              checkpoint: true,
              citiesProcessed: cityIdx + 1,
              totalRecords: allRecords.length,
            },
            records: allRecords,
          },
          null,
          2
        )
      );
      console.log(`  [Checkpoint saved: ${allRecords.length} records]`);
    }
  }

  // Save final results
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        _meta: {
          source: 'Macrostrat API',
          fetchedAt: new Date().toISOString(),
          precision: PRECISION,
          radiusKm: RADIUS_KM,
          citiesProcessed: cities.length,
          totalRecords: allRecords.length,
          uniqueGeohashes: seenGeohashes.size,
        },
        records: allRecords,
      },
      null,
      2
    )
  );

  console.log('\n===================================');
  console.log('Fetch Complete!');
  console.log('===================================');
  console.log(`Output: ${outputPath}`);
  console.log(`Cities processed: ${cities.length}`);
  console.log(`Unique geohashes: ${seenGeohashes.size}`);
  console.log(`Total records: ${allRecords.length}`);
  if (args.resume) {
    console.log(`  - Existing: ${existingRecords.length}`);
    console.log(`  - New: ${newRecords}`);
  }
  console.log(`Coverage rate: ${((allRecords.length / seenGeohashes.size) * 100).toFixed(1)}%`);

  // Summary statistics
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
    const pct = ((count / allRecords.length) * 100).toFixed(1);
    console.log(`  ${lith}: ${count} (${pct}%)`);
  }

  // Count generic vs specific
  const genericTypes = [
    'sedimentary',
    'metamorphic',
    'igneous',
    'mixed_sedimentary',
    'mixed_metamorphic',
    'mixed_igneous',
  ];
  let genericCount = 0;
  for (const record of allRecords) {
    if (genericTypes.includes(record.primaryLithology.toLowerCase())) {
      genericCount++;
    }
  }

  console.log(
    `\nGeneric lithology rate: ${((genericCount / allRecords.length) * 100).toFixed(1)}%`
  );
  console.log(
    `Specific lithology rate: ${(((allRecords.length - genericCount) / allRecords.length) * 100).toFixed(1)}%`
  );

  console.log('\nUsage:');
  console.log('  npx tsx scripts/gis/fetchCityGeology.ts          # Full fetch');
  console.log('  npx tsx scripts/gis/fetchCityGeology.ts --resume # Retry missing only');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { generateGridAroundPoint, processGridPoint };
