/**
 * buildSqliteBundle.ts - Build SQLite database from raw GIS data
 *
 * Creates a single SQLite database containing all tile data for efficient
 * runtime queries. This replaces the 19,000+ JSON tile files.
 *
 * Usage: npx tsx scripts/gis/buildSqliteBundle.ts
 *
 * Input:
 *   - scripts/gis/output/macrostrat_raw.json
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
 * Normalize Macrostrat lithology names to simple mapping keys.
 */
function normalizeLithology(lith: string): string {
  const lower = lith.toLowerCase().trim();

  const directMatches = [
    'sandstone',
    'siltstone',
    'shale',
    'mudstone',
    'claystone',
    'conglomerate',
    'breccia',
    'limestone',
    'dolomite',
    'dolostone',
    'chalk',
    'marl',
    'chert',
    'novaculite',
    'granite',
    'granodiorite',
    'diorite',
    'gabbro',
    'basalt',
    'andesite',
    'rhyolite',
    'dacite',
    'tuff',
    'pumice',
    'obsidian',
    'ignimbrite',
    'marble',
    'slate',
    'phyllite',
    'schist',
    'gneiss',
    'quartzite',
    'amphibolite',
  ];

  for (const match of directMatches) {
    if (lower.includes(match)) return match;
  }

  if (lower.includes('volcanic') && lower.includes('mafic')) return 'basalt';
  if (lower.includes('volcanic') && lower.includes('felsic')) return 'rhyolite';
  if (lower.includes('volcanic') && lower.includes('intermediate')) return 'andesite';
  if (lower.includes('mafic volcanic') || lower.includes('mafic-volcanic')) return 'basalt';
  if (lower.includes('felsic volcanic') || lower.includes('felsic-volcanic')) return 'rhyolite';
  if (lower.includes('flood basalt')) return 'basalt';
  if (lower.includes('basalt group')) return 'basalt';
  if (lower.includes('plutonic') && lower.includes('granit')) return 'granite';
  if (lower.includes('intrusive') && lower.includes('igneous')) return 'granite';
  if (lower.includes('crystalline') && lower.includes('metamorphic')) return 'gneiss';
  if (lower.includes('sedimentary') && lower.includes('volcanic')) return 'tuff';
  if (lower.includes('volcaniclastic')) return 'tuff';
  if (lower.includes('alluvium') || lower.includes('alluvial')) return 'conglomerate';
  if (lower.includes('glacial') || lower.includes('drift') || lower.includes('till'))
    return 'conglomerate';
  if (lower.includes('sand') && !lower.includes('sandstone')) return 'sandstone';
  if (lower.includes('clay') && !lower.includes('claystone')) return 'clay';
  if (lower.includes('iron') || lower.includes('hematite') || lower.includes('magnetite'))
    return 'iron_formation';
  if (lower.includes('sedimentary')) return 'mixed_sedimentary';
  if (lower.includes('metamorphic')) return 'mixed_metamorphic';
  if (lower.includes('igneous')) return 'mixed_igneous';
  if (lower.includes('volcanic')) return 'tuff';

  const majorMatch = lower.match(/major:\{([^}]+)\}/);
  if (majorMatch) {
    const majorRock = majorMatch[1].split(',')[0].trim();
    for (const match of directMatches) {
      if (majorRock.includes(match)) return match;
    }
    if (majorRock.includes('sand')) return 'sandstone';
    if (majorRock.includes('clay')) return 'clay';
    if (majorRock.includes('lime')) return 'limestone';
    if (majorRock.includes('alluvium')) return 'conglomerate';
  }

  return 'unknown';
}

/**
 * Load raw geology data
 */
function loadGeologyData(): GeologyRecord[] {
  const dataPath = path.join(OUTPUT_DIR, 'macrostrat_raw.json');
  if (!fs.existsSync(dataPath)) {
    console.log('  No geology data found at', dataPath);
    return [];
  }

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
 * Build coarse index for quick initialization
 */
function buildCoarseIndex(
  records: Array<{ geohash: string; value: string; confidence: number }>,
  prefixLength: number
): Record<string, { value: string; confidence: number }> {
  const groups = new Map<string, Array<{ value: string; confidence: number }>>();

  for (const record of records) {
    const prefix = record.geohash.substring(0, prefixLength);
    const existing = groups.get(prefix) || [];
    existing.push({ value: record.value, confidence: record.confidence });
    groups.set(prefix, existing);
  }

  const index: Record<string, { value: string; confidence: number }> = {};

  for (const [prefix, groupRecords] of groups) {
    const counts: Record<string, number> = {};
    for (const r of groupRecords) {
      counts[r.value] = (counts[r.value] || 0) + 1;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topValue, topCount] = sorted[0];
      index[prefix] = {
        value: topValue,
        confidence: Math.round((topCount / groupRecords.length) * 100) / 100,
      };
    }
  }

  return index;
}

/**
 * Write JSON file
 */
function writeJsonFile(filePath: string, data: unknown): number {
  const content = JSON.stringify(data);
  fs.writeFileSync(filePath, content);
  return content.length;
}

/**
 * Main function
 */
async function main() {
  console.log('SQLite GIS Bundle Builder');
  console.log('=========================\n');

  // Ensure output directories exist
  for (const dir of [ASSETS_DIR, path.join(GIS_DIR, 'geology'), path.join(GIS_DIR, 'biomes')]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Load raw data
  console.log('Loading raw data...');
  const geologyRecords = loadGeologyData();
  const biomeRecords = loadBiomeData();

  console.log(`  Geology records: ${geologyRecords.length}`);
  console.log(`  Biome records: ${biomeRecords.length}`);

  if (geologyRecords.length === 0 && biomeRecords.length === 0) {
    console.log('\nNo data to process. Run these scripts first:');
    console.log('  npx tsx scripts/gis/fetchMacrostrat.ts');
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
  const geologyMap = new Map<string, GeologyRecord>();
  for (const record of geologyRecords) {
    geologyMap.set(record.geohash, record);
  }

  const biomeMap = new Map<string, BiomeRecord>();
  for (const record of biomeRecords) {
    biomeMap.set(record.geohash, record);
  }

  // Get all unique geohashes
  const allGeohashes = new Set([...geologyMap.keys(), ...biomeMap.keys()]);
  console.log(`  Total unique geohashes: ${allGeohashes.size}`);

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

  // Build and write coarse indexes (kept for fast app initialization)
  console.log('\nBuilding coarse indexes...');

  if (geologyRecords.length > 0) {
    const geologyIndexData = geologyRecords.map((r) => ({
      geohash: r.geohash,
      value: normalizeLithology(r.primaryLithology),
      confidence: r.confidence,
    }));
    const geologyIndex = buildCoarseIndex(geologyIndexData, 3);

    const indexPath = path.join(GIS_DIR, 'geology', 'index.json');
    const bytes = writeJsonFile(indexPath, {
      _meta: {
        type: 'coarse_geology_index',
        precision: 3,
        cellCount: Object.keys(geologyIndex).length,
        generatedAt: new Date().toISOString(),
      },
      data: Object.fromEntries(
        Object.entries(geologyIndex).map(([k, v]) => [
          k,
          { primaryLithology: v.value, confidence: v.confidence },
        ])
      ),
    });
    console.log(
      `  Geology index: ${(bytes / 1024).toFixed(1)} KB (${Object.keys(geologyIndex).length} cells)`
    );
  }

  if (biomeRecords.length > 0) {
    const biomeIndexData = biomeRecords.map((r) => ({
      geohash: r.geohash,
      value: r.biomeCode,
      confidence: r.confidence,
    }));
    const biomeIndex = buildCoarseIndex(biomeIndexData, 3);

    const indexPath = path.join(GIS_DIR, 'biomes', 'index.json');
    const bytes = writeJsonFile(indexPath, {
      _meta: {
        type: 'coarse_biome_index',
        precision: 3,
        cellCount: Object.keys(biomeIndex).length,
        generatedAt: new Date().toISOString(),
      },
      data: Object.fromEntries(
        Object.entries(biomeIndex).map(([k, v]) => [k, { type: v.value, confidence: v.confidence }])
      ),
    });
    console.log(
      `  Biome index: ${(bytes / 1024).toFixed(1)} KB (${Object.keys(biomeIndex).length} cells)`
    );
  }

  // Write manifest
  const manifestPath = path.join(GIS_DIR, 'manifest.json');
  writeJsonFile(manifestPath, {
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
      databaseSizeBytes: dbStats.size,
      databaseSizeMB: Math.round((dbStats.size / 1024 / 1024) * 100) / 100,
    },
    files: {
      database: 'assets/gis/tiles.db',
      geologyIndex: 'src/data/gis/geology/index.json',
      biomeIndex: 'src/data/gis/biomes/index.json',
    },
  });

  console.log('\n=========================');
  console.log('Build Complete!');
  console.log('=========================');
  console.log(`Database: ${DB_PATH} (${(dbStats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Tiles: ${allGeohashes.size}`);
  console.log('\nThe database will be bundled with the app via expo-asset.');
}

// Run if called directly
main().catch(console.error);
