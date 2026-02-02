/**
 * buildSqliteBundle.ts - Build SQLite database from raw GIS data
 *
 * Creates a single SQLite database containing all tile data for efficient
 * runtime queries. This replaces the 19,000+ JSON tile files.
 *
 * Usage: npx tsx scripts/gis/buildSqliteBundle.ts
 *
 * Input:
 *   - scripts/gis/output/lithology_raw.json
 *   - scripts/gis/output/biomes_raw.json
 *
 * Output:
 *   - assets/gis/tiles.db (SQLite database)
 *   - src/data/gis/geology/index.json (coarse index, kept for fast init)
 *   - src/data/gis/biomes/index.json (coarse index, kept for fast init)
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Types
interface GeologyRecord {
  geohash: string;
  lat: number;
  lng: number;
  primaryLithology: string;
  secondaryLithologies: string[];
  confidence: number;
}

interface BiomeRecord {
  geohash: string;
  lat: number;
  lng: number;
  biomeCode: string;
  biomeName: string;
  ecoregionId: number | null;
  realmBiome: string | null;
  realm: string | null;
  confidence: number;
}

interface RawDataFile<T> {
  _meta: {
    source: string;
    totalRecords: number;
  };
  records: T[];
}

// Paths
const SCRIPT_DIR = __dirname;
const OUTPUT_DIR = path.join(SCRIPT_DIR, 'output');
const GIS_DIR = path.join(SCRIPT_DIR, '../../src/data/gis');
const ASSETS_DIR = path.join(SCRIPT_DIR, '../../assets/gis');
const DB_PATH = path.join(ASSETS_DIR, 'tiles.db');

// Use temp directory for building (avoids file locking issues on network filesystems)
const TEMP_DB_PATH = path.join(os.tmpdir(), `walkforage-tiles-${Date.now()}.db`);

/**
 * Complete list of specific rock types we can map to game resources.
 * Ordered roughly by specificity and commonality.
 */
const SPECIFIC_ROCKS = [
  // Igneous - Plutonic
  'granite',
  'granodiorite',
  'diorite',
  'gabbro',
  'syenite',
  'tonalite',
  'monzonite',
  'peridotite',
  'dunite',
  'pyroxenite',

  // Igneous - Volcanic
  'basalt',
  'andesite',
  'rhyolite',
  'dacite',
  'trachyte',
  'phonolite',
  'obsidian',
  'pumice',
  'tuff',
  'ignimbrite',

  // Sedimentary - Clastic
  'sandstone',
  'siltstone',
  'shale',
  'mudstone',
  'claystone',
  'conglomerate',
  'breccia',
  'greywacke',
  'arkose',

  // Sedimentary - Carbonate
  'limestone',
  'dolomite',
  'dolostone',
  'chalk',
  'marl',
  'travertine',
  'tufa',

  // Sedimentary - Chemical/Organic
  'chert',
  'novaculite',
  'flint',
  'jasper',
  'coal',
  'lignite',
  'peat',

  // Metamorphic - Foliated
  'slate',
  'phyllite',
  'schist',
  'gneiss',
  'migmatite',

  // Metamorphic - Non-foliated
  'marble',
  'quartzite',
  'amphibolite',
  'hornfels',
  'serpentinite',
  'soapstone',
  'greenstone',
  'blueschist',
  'eclogite',
  'granulite',
];

/**
 * Parse structured lithology fields like "Major:{granite,gneiss};Minor:{schist}"
 * Also handles variants without colon: "Major{...}" and "Minor{...}"
 */
function parseStructuredFields(lith: string): { major: string[]; minor: string[] } {
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
 * Find a specific rock type in a string.
 * Returns the first matching specific rock, or null if none found.
 */
function findSpecificRock(text: string): string | null {
  const lower = text.toLowerCase();
  for (const rock of SPECIFIC_ROCKS) {
    if (lower.includes(rock)) return rock;
  }
  return null;
}

/**
 * Normalize Macrostrat lithology names to simple mapping keys.
 *
 * Priority order:
 * 1. Parse structured Major:{...} fields first (most reliable)
 * 2. Direct matches for specific rock types
 * 3. Compositional inference (e.g., "mafic volcanic" → basalt)
 * 4. Generic fallback (LAST RESORT)
 */
function normalizeLithology(lith: string): string {
  const lower = lith.toLowerCase().trim();

  // PRIORITY 1: Parse structured fields like "Major:{granite,gneiss}"
  // These are the most reliable as they come from structured Macrostrat data
  const structured = parseStructuredFields(lith);

  // Check major lithologies first
  for (const majorLith of structured.major) {
    const specific = findSpecificRock(majorLith);
    if (specific) return specific;
  }

  // Check minor lithologies
  for (const minorLith of structured.minor) {
    const specific = findSpecificRock(minorLith);
    if (specific) return specific;
  }

  // PRIORITY 2: Direct matches for specific rock types in unstructured text
  const directMatch = findSpecificRock(lower);
  if (directMatch) return directMatch;

  // PRIORITY 3: Compositional/textural inference
  // Volcanic compositions
  if (lower.includes('mafic') && lower.includes('volcanic')) return 'basalt';
  if (lower.includes('felsic') && lower.includes('volcanic')) return 'rhyolite';
  if (lower.includes('intermediate') && lower.includes('volcanic')) return 'andesite';
  if (lower.includes('flood basalt') || lower.includes('basalt group')) return 'basalt';

  // Plutonic compositions
  if (lower.includes('mafic') && lower.includes('plutonic')) return 'gabbro';
  if (lower.includes('felsic') && lower.includes('plutonic')) return 'granite';
  if (lower.includes('intermediate') && lower.includes('plutonic')) return 'diorite';
  if (lower.includes('plutonic') && lower.includes('granit')) return 'granite';
  if (lower.includes('intrusive') && lower.includes('igneous')) return 'granite';

  // Metamorphic textures
  if (lower.includes('crystalline') && lower.includes('metamorphic')) return 'gneiss';
  if (lower.includes('foliated') && lower.includes('metamorphic')) return 'schist';
  if (lower.includes('high-grade') && lower.includes('metamorphic')) return 'gneiss';
  if (lower.includes('low-grade') && lower.includes('metamorphic')) return 'slate';

  // Sedimentary textures and compositions
  if (lower.includes('volcaniclastic')) return 'tuff';
  if (lower.includes('sedimentary') && lower.includes('volcanic')) return 'tuff';
  if (lower.includes('carbonate') && !lower.includes('non-carbonate')) return 'limestone';
  if (lower.includes('calcareous')) return 'limestone';

  // Unconsolidated sediments (map to consolidated equivalents)
  if (lower.includes('alluvium') || lower.includes('alluvial')) return 'conglomerate';
  if (lower.includes('glacial') || lower.includes('drift') || lower.includes('till'))
    return 'conglomerate';
  if (lower.includes('sand') && !lower.includes('sandstone')) return 'sandstone';
  if (lower.includes('gravel')) return 'conglomerate';
  if (lower.includes('silt') && !lower.includes('siltstone')) return 'siltstone';
  if (lower.includes('clay') && !lower.includes('claystone')) return 'clay';
  if (lower.includes('mud') && !lower.includes('mudstone')) return 'mudstone';

  // Iron-rich rocks
  if (
    lower.includes('iron formation') ||
    lower.includes('banded iron') ||
    lower.includes('hematite') ||
    lower.includes('magnetite')
  )
    return 'iron_formation';

  // PRIORITY 4: Generic fallback (LAST RESORT)
  // Only use these if we couldn't find anything more specific
  if (lower.includes('sedimentary')) return 'mixed_sedimentary';
  if (lower.includes('metamorphic')) return 'mixed_metamorphic';
  if (lower.includes('igneous')) return 'mixed_igneous';
  if (lower.includes('volcanic')) return 'tuff'; // Assume volcaniclastic

  return 'unknown';
}

/**
 * Load raw geology/lithology data
 */
function loadGeologyData(): GeologyRecord[] {
  const dataPath = path.join(OUTPUT_DIR, 'lithology_raw.json');
  if (!fs.existsSync(dataPath)) {
    console.log('  No lithology data found at', dataPath);
    return [];
  }

  console.log(`  Loading lithology data from ${path.basename(dataPath)}`);
  const content = fs.readFileSync(dataPath, 'utf-8');
  const data: RawDataFile<GeologyRecord> = JSON.parse(content);
  return data.records;
}

/**
 * Load raw biome data
 */
function loadBiomeData(): BiomeRecord[] {
  const dataPath = path.join(OUTPUT_DIR, 'biomes_raw.json');
  if (!fs.existsSync(dataPath)) {
    console.log('  No biome data found at', dataPath);
    return [];
  }

  const content = fs.readFileSync(dataPath, 'utf-8');
  const data: RawDataFile<BiomeRecord> = JSON.parse(content);
  return data.records;
}

/**
 * Load high-resolution city geology data (precision-5).
 * This data takes precedence over global precision-4 data.
 */
function loadCityGeologyData(): GeologyRecord[] {
  const dataPath = path.join(OUTPUT_DIR, 'cities_lithology.json');
  if (!fs.existsSync(dataPath)) {
    console.log('  No city geology data found at', dataPath);
    return [];
  }

  const content = fs.readFileSync(dataPath, 'utf-8');
  const data: RawDataFile<GeologyRecord> = JSON.parse(content);
  return data.records;
}

/**
 * Create SQLite database schema
 */
function createSchema(db: Database.Database): void {
  // Tiles table - stores combined geology + biome data per geohash
  db.exec(`
    CREATE TABLE IF NOT EXISTS tiles (
      geohash TEXT PRIMARY KEY,
      prefix TEXT NOT NULL,
      primary_lithology TEXT NOT NULL,
      secondary_lithologies TEXT,
      geology_confidence REAL NOT NULL,
      biome_type TEXT NOT NULL,
      biome_confidence REAL NOT NULL,
      ecoregion_id INTEGER,
      realm_biome TEXT,
      realm TEXT
    );

    -- Index on prefix for bulk loading by region
    CREATE INDEX IF NOT EXISTS idx_tiles_prefix ON tiles(prefix);

    -- Index on realm_biome for ecoregion-based wood lookups
    CREATE INDEX IF NOT EXISTS idx_tiles_realm_biome ON tiles(realm_biome);

    -- Metadata table
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/**
 * Main function
 */
async function main() {
  console.log('SQLite GIS Bundle Builder');
  console.log('=========================\n');

  // Ensure output directories exist
  for (const dir of [ASSETS_DIR, GIS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Load raw data
  console.log('Loading raw data...');
  const geologyRecords = loadGeologyData();
  const cityGeologyRecords = loadCityGeologyData();
  const biomeRecords = loadBiomeData();

  console.log(`  Global geology records (precision-4): ${geologyRecords.length}`);
  console.log(`  City geology records (precision-5): ${cityGeologyRecords.length}`);
  console.log(`  Biome records: ${biomeRecords.length}`);

  if (geologyRecords.length === 0 && cityGeologyRecords.length === 0 && biomeRecords.length === 0) {
    console.log('\nNo data to process. Run these scripts first:');
    console.log('  npx tsx scripts/gis/fetchMacrostrat.ts');
    console.log('  npx tsx scripts/gis/fetchCityGeology.ts (optional)');
    console.log('  node scripts/gis/processEcoregionsShapefile.mjs');
    return;
  }

  // Remove old database if exists
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  // Create database in temp directory (avoids file locking issues on network filesystems)
  console.log('\nCreating SQLite database...');
  console.log(`  Building in temp location: ${TEMP_DB_PATH}`);
  const db = new Database(TEMP_DB_PATH);

  // Enable WAL mode for better performance during bulk inserts
  // (works fine on local filesystem)
  db.pragma('journal_mode = WAL');

  // Create schema
  createSchema(db);

  // Prepare insert statement
  const insertTile = db.prepare(`
    INSERT OR REPLACE INTO tiles
    (geohash, prefix, primary_lithology, secondary_lithologies, geology_confidence, biome_type, biome_confidence, ecoregion_id, realm_biome, realm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Create lookup maps
  // Start with global geology data (precision-4)
  const geologyMap = new Map<string, GeologyRecord>();
  for (const record of geologyRecords) {
    geologyMap.set(record.geohash, record);
  }

  // Overlay city geology data (precision-5) - takes precedence
  // City data is more specific and queried at exact coordinates
  let cityOverrides = 0;
  for (const record of cityGeologyRecords) {
    if (geologyMap.has(record.geohash)) {
      cityOverrides++;
    }
    geologyMap.set(record.geohash, record);
  }

  if (cityGeologyRecords.length > 0) {
    console.log(
      `  City data: ${cityGeologyRecords.length} records (${cityOverrides} overriding global)`
    );
  }

  const biomeMap = new Map<string, BiomeRecord>();
  for (const record of biomeRecords) {
    biomeMap.set(record.geohash, record);
  }

  // Get all unique geohashes
  const allGeohashes = new Set([...geologyMap.keys(), ...biomeMap.keys()]);
  console.log(`  Total unique geohashes: ${allGeohashes.size}`);

  // Generate precision-3 tiles by aggregating precision-4 data
  console.log('\nGenerating precision-3 tiles from precision-4 data...');
  const precision3Groups = new Map<
    string,
    { geologies: Map<string, number>; biomes: Map<string, BiomeRecord[]> }
  >();

  for (const geohash of allGeohashes) {
    if (geohash.length < 3) continue;
    const prefix3 = geohash.substring(0, 3);

    if (!precision3Groups.has(prefix3)) {
      precision3Groups.set(prefix3, { geologies: new Map(), biomes: new Map() });
    }

    const group = precision3Groups.get(prefix3)!;

    // Aggregate geology
    const geology = geologyMap.get(geohash);
    if (geology) {
      const normalized = normalizeLithology(geology.primaryLithology);
      group.geologies.set(normalized, (group.geologies.get(normalized) || 0) + 1);
    }

    // Aggregate biomes
    const biome = biomeMap.get(geohash);
    if (biome) {
      const biomeList = group.biomes.get(biome.biomeCode) || [];
      biomeList.push(biome);
      group.biomes.set(biome.biomeCode, biomeList);
    }
  }

  // Create precision-3 tile records
  for (const [prefix3, group] of precision3Groups) {
    // Find most common geology
    let topGeology = 'unknown';
    let topGeologyCount = 0;
    let totalGeologyCount = 0;
    for (const [lith, count] of group.geologies) {
      totalGeologyCount += count;
      if (count > topGeologyCount) {
        topGeologyCount = count;
        topGeology = lith;
      }
    }

    // Find most common biome (preserving full biome record for realm info)
    let topBiome: BiomeRecord | null = null;
    let topBiomeCount = 0;
    let totalBiomeCount = 0;
    for (const [, records] of group.biomes) {
      totalBiomeCount += records.length;
      if (records.length > topBiomeCount) {
        topBiomeCount = records.length;
        topBiome = records[0]; // Use first record for realm info
      }
    }

    // Add to allGeohashes set (will be inserted alongside precision-4/5)
    allGeohashes.add(prefix3);

    // Create synthetic records for the precision-3 tile
    if (topGeology !== 'unknown') {
      geologyMap.set(prefix3, {
        geohash: prefix3,
        lat: 0, // Not needed for tiles
        lng: 0,
        primaryLithology: topGeology, // Already normalized
        secondaryLithologies: [],
        confidence: totalGeologyCount > 0 ? topGeologyCount / totalGeologyCount : 0,
      });
    }

    if (topBiome) {
      biomeMap.set(prefix3, {
        ...topBiome,
        geohash: prefix3,
        confidence: totalBiomeCount > 0 ? topBiomeCount / totalBiomeCount : 0,
      });
    }
  }

  console.log(`  Generated ${precision3Groups.size} precision-3 tiles`);
  console.log(`  Total tiles to insert: ${allGeohashes.size}`);

  // Insert tiles in a transaction for better performance
  console.log('\nInserting tiles into database...');
  const insertMany = db.transaction((geohashes: string[]) => {
    for (const geohash of geohashes) {
      const geology = geologyMap.get(geohash);
      const biome = biomeMap.get(geohash);
      const prefix = geohash.substring(0, 3);

      insertTile.run(
        geohash,
        prefix,
        geology ? normalizeLithology(geology.primaryLithology) : 'unknown',
        geology ? JSON.stringify(geology.secondaryLithologies.map(normalizeLithology)) : '[]',
        geology?.confidence ?? 0,
        biome?.biomeCode ?? 'unknown',
        biome?.confidence ?? 0,
        biome?.ecoregionId ?? null,
        biome?.realmBiome ?? null,
        biome?.realm ?? null
      );
    }
  });

  // Insert in batches
  const geohashArray = Array.from(allGeohashes);
  const batchSize = 10000;
  let inserted = 0;

  for (let i = 0; i < geohashArray.length; i += batchSize) {
    const batch = geohashArray.slice(i, i + batchSize);
    insertMany(batch);
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${geohashArray.length} tiles`);
  }
  console.log('');

  // Add metadata
  const insertMeta = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
  insertMeta.run('version', '1.0.0');
  insertMeta.run('generatedAt', new Date().toISOString());
  insertMeta.run('geologySource', 'Macrostrat API');
  insertMeta.run('biomeSource', 'Resolve Ecoregions 2017');
  insertMeta.run('totalTiles', String(allGeohashes.size));

  // Checkpoint and close WAL
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();

  // Copy from temp to final location
  console.log(`\nCopying database to final location...`);
  fs.copyFileSync(TEMP_DB_PATH, DB_PATH);

  // Clean up temp file and any WAL/SHM files
  fs.unlinkSync(TEMP_DB_PATH);
  const walPath = TEMP_DB_PATH + '-wal';
  const shmPath = TEMP_DB_PATH + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  // Get database size
  const dbStats = fs.statSync(DB_PATH);
  console.log(`\nDatabase created: ${DB_PATH}`);
  console.log(`  Size: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`);

  // Write manifest
  const manifestPath = path.join(GIS_DIR, 'manifest.json');
  const manifestContent = JSON.stringify(
    {
      version: '2.0.0',
      format: 'sqlite',
      generatedAt: new Date().toISOString(),
      sources: {
        geology: geologyRecords.length > 0 ? 'Macrostrat API' : null,
        biomes: biomeRecords.length > 0 ? 'Resolve Ecoregions 2017' : null,
      },
      statistics: {
        geologyRecords: geologyRecords.length,
        biomeRecords: biomeRecords.length,
        totalTiles: allGeohashes.size,
        precision3Tiles: precision3Groups.size,
        databaseSizeBytes: dbStats.size,
        databaseSizeMB: Math.round((dbStats.size / 1024 / 1024) * 100) / 100,
      },
      files: {
        database: 'assets/gis/tiles.db',
      },
    },
    null,
    2
  );
  fs.writeFileSync(manifestPath, manifestContent);

  console.log('\n=========================');
  console.log('Build Complete!');
  console.log('=========================');
  console.log(`Database: ${DB_PATH} (${(dbStats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Tiles: ${allGeohashes.size} (including ${precision3Groups.size} precision-3)`);
  console.log('\nThe database will be bundled with the app via expo-asset.');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for testing
export { normalizeLithology, SPECIFIC_ROCKS };
