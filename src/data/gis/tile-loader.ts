/**
 * Tile Loader - Loads GIS tile data from SQLite database
 *
 * Uses expo-sqlite to query a pre-bundled SQLite database containing
 * all geology and biome tile data. This replaces the 19,000+ JSON tile files.
 *
 * The database is bundled via expo-asset and copied to the app's
 * SQLite directory on first access.
 */

import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
import { File, Directory, Paths } from 'expo-file-system';
import { GeoTile, BiomeData, GeologyData } from '../../types/gis';
import { BiomeCode } from '../../types/resources';

// Database instance (lazy initialized)
let db: SQLite.SQLiteDatabase | null = null;

// Cache for individual tile lookups
const tileCache = new Map<string, GeoTile | null>();

// Track if database has been initialized
let dbInitialized = false;

/**
 * Database row type from tiles table
 */
interface TileRow {
  geohash: string;
  prefix: string;
  primary_lithology: string;
  secondary_lithologies: string;
  geology_confidence: number;
  biome_type: string;
  biome_confidence: number;
  ecoregion_id: number | null;
  realm_biome: string | null;
  realm: string | null;
}

/**
 * Initialize the database by copying from assets if needed
 */
async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db && dbInitialized) {
    return db;
  }

  const dbName = 'tiles.db';

  // Get the default database directory from expo-sqlite
  const sqliteDir = new Directory(Paths.document, 'SQLite');
  const dbFile = new File(sqliteDir, dbName);

  // Check if database already exists in SQLite directory
  if (!dbFile.exists) {
    // Ensure SQLite directory exists
    if (!sqliteDir.exists) {
      sqliteDir.create();
    }

    // Load the asset
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Required for expo-asset Metro bundling
    const asset = Asset.fromModule(require('../../../assets/gis/tiles.db'));
    await asset.downloadAsync();

    // Copy asset to SQLite directory
    if (asset.localUri) {
      const assetFile = new File(asset.localUri);
      assetFile.copy(dbFile);
    }
  }

  // Open the database from the SQLite directory
  const dbDirectory = new Directory(Paths.document, 'SQLite');
  db = await SQLite.openDatabaseAsync(dbName, {}, dbDirectory.uri);
  dbInitialized = true;

  return db;
}

/**
 * Convert database row to GeoTile object
 */
function rowToTile(row: TileRow): GeoTile {
  const geology: GeologyData = {
    primaryLithology: row.primary_lithology,
    secondaryLithologies: JSON.parse(row.secondary_lithologies || '[]'),
    confidence: row.geology_confidence,
  };

  const biome: BiomeData = {
    type: row.biome_type as BiomeCode,
    confidence: row.biome_confidence,
    ...(row.ecoregion_id != null && { ecoregionId: row.ecoregion_id }),
    ...(row.realm != null && { realm: row.realm }),
  };

  return {
    geohash: row.geohash,
    geology,
    biome,
  };
}

/**
 * Get a specific tile by full geohash
 * @param geohash 4-character geohash (e.g., "9q5c", "u4pr")
 * @returns GeoTile data or null if not found
 */
export async function getTile(geohash: string): Promise<GeoTile | null> {
  // Check cache first
  if (tileCache.has(geohash)) {
    return tileCache.get(geohash) || null;
  }

  try {
    const database = await initDatabase();

    const row = await database.getFirstAsync<TileRow>('SELECT * FROM tiles WHERE geohash = ?', [
      geohash,
    ]);

    if (!row) {
      tileCache.set(geohash, null);
      return null;
    }

    const tile = rowToTile(row);
    tileCache.set(geohash, tile);
    return tile;
  } catch (error) {
    console.warn(`Failed to get tile ${geohash}:`, error);
    tileCache.set(geohash, null);
    return null;
  }
}

/**
 * Load all tiles for a given prefix (for bulk loading a region)
 * @param prefix 3-character geohash prefix (e.g., "9q5", "u4p")
 * @returns Map of geohash -> GeoTile, or null if no tiles found
 */
export async function loadTilesByPrefix(prefix: string): Promise<Record<string, GeoTile> | null> {
  try {
    const database = await initDatabase();

    const rows = await database.getAllAsync<TileRow>('SELECT * FROM tiles WHERE prefix = ?', [
      prefix,
    ]);

    if (!rows || rows.length === 0) {
      return null;
    }

    const tiles: Record<string, GeoTile> = {};
    for (const row of rows) {
      const tile = rowToTile(row);
      tiles[row.geohash] = tile;
      // Also populate the cache
      tileCache.set(row.geohash, tile);
    }

    return tiles;
  } catch (error) {
    console.warn(`Failed to load tiles for prefix ${prefix}:`, error);
    return null;
  }
}

/**
 * Clear all tile caches
 * Useful for testing or memory management
 */
export function clearTileCache(): void {
  tileCache.clear();
}

/**
 * Get cache statistics
 */
export function getTileCacheStats(): { filesCached: number; tilesCached: number } {
  return {
    filesCached: 0, // No longer using file cache with SQLite
    tilesCached: tileCache.size,
  };
}

/**
 * Close the database connection
 * Call this when the app is shutting down or to free resources
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    dbInitialized = false;
  }
}

/**
 * Get database metadata
 */
export async function getDatabaseMetadata(): Promise<Record<string, string> | null> {
  try {
    const database = await initDatabase();

    const rows = await database.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM metadata'
    );

    if (!rows) {
      return null;
    }

    const metadata: Record<string, string> = {};
    for (const row of rows) {
      metadata[row.key] = row.value;
    }

    return metadata;
  } catch (error) {
    console.warn('Failed to get database metadata:', error);
    return null;
  }
}
