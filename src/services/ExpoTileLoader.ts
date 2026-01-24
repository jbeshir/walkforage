/**
 * Expo Tile Loader
 *
 * TileLoader implementation using expo-sqlite for the React Native app.
 * Uses a pre-bundled SQLite database containing all geology and biome tile data.
 */

import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
import { File, Directory, Paths } from 'expo-file-system';
import { TileLoader } from './TileLoader';
import { GeoTile, BiomeData, GeologyData } from '../types/gis';
import { BiomeCode } from '../types/resources';

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
 * Expo-based tile loader using expo-sqlite
 */
export class ExpoTileLoader implements TileLoader {
  private db: SQLite.SQLiteDatabase | null = null;
  private dbInitialized = false;
  private tileCache = new Map<string, GeoTile | null>();

  async getTile(geohash: string): Promise<GeoTile | null> {
    // Check cache first
    if (this.tileCache.has(geohash)) {
      return this.tileCache.get(geohash) || null;
    }

    try {
      const database = await this.initDatabase();

      const row = await database.getFirstAsync<TileRow>('SELECT * FROM tiles WHERE geohash = ?', [
        geohash,
      ]);

      if (!row) {
        this.tileCache.set(geohash, null);
        return null;
      }

      const tile = this.rowToTile(row);
      this.tileCache.set(geohash, tile);
      return tile;
    } catch (error) {
      console.warn(`Failed to get tile ${geohash}:`, error);
      this.tileCache.set(geohash, null);
      return null;
    }
  }

  async initialize(): Promise<void> {
    await this.initDatabase();
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.dbInitialized = false;
    }
  }

  clearCache(): void {
    this.tileCache.clear();
  }

  getCacheStats(): { filesCached: number; tilesCached: number } {
    return {
      filesCached: 0,
      tilesCached: this.tileCache.size,
    };
  }

  /**
   * Initialize the database by copying from assets if needed
   */
  private async initDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.db && this.dbInitialized) {
      return this.db;
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
      const asset = Asset.fromModule(require('../../assets/gis/tiles.db'));
      await asset.downloadAsync();

      // Copy asset to SQLite directory
      if (asset.localUri) {
        const assetFile = new File(asset.localUri);
        assetFile.copy(dbFile);
      }
    }

    // Open the database from the SQLite directory
    const dbDirectory = new Directory(Paths.document, 'SQLite');
    this.db = await SQLite.openDatabaseAsync(dbName, {}, dbDirectory.uri);
    this.dbInitialized = true;

    return this.db;
  }

  /**
   * Convert database row to GeoTile object
   */
  private rowToTile(row: TileRow): GeoTile {
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
}
