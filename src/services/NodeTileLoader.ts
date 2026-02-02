/**
 * Node.js Tile Loader
 *
 * TileLoader implementation using better-sqlite3 for Node.js scripts and tests.
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';
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
 * Node.js-based tile loader using better-sqlite3
 */
export class NodeTileLoader implements TileLoader {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Default path relative to this file's location
    this.dbPath = dbPath || resolve(__dirname, '../../assets/gis/tiles.db');
  }

  getTile(geohash: string): GeoTile | null {
    if (!this.db) {
      this.initialize();
    }

    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM tiles WHERE geohash = ?');
      const row = stmt.get(geohash) as TileRow | undefined;

      if (!row) return null;
      return this.rowToTile(row);
    } catch {
      return null;
    }
  }

  getTiles(geohashes: string[]): GeoTile[] {
    if (geohashes.length === 0) return [];

    if (!this.db) {
      this.initialize();
    }

    if (!this.db) return [];

    try {
      const placeholders = geohashes.map(() => '?').join(',');
      const stmt = this.db.prepare(`SELECT * FROM tiles WHERE geohash IN (${placeholders})`);
      const rows = stmt.all(...geohashes) as TileRow[];
      return rows.map((row) => this.rowToTile(row));
    } catch {
      return [];
    }
  }

  initialize(): void {
    if (this.db) return;

    try {
      this.db = new Database(this.dbPath, { readonly: true });
    } catch (error) {
      console.warn(`Failed to open GIS database at ${this.dbPath}:`, error);
      this.db = null;
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  clearCache(): void {
    // No caching in NodeTileLoader - prepared statements are reused but not cached
  }

  getCacheStats(): { filesCached: number; tilesCached: number } {
    // No caching in NodeTileLoader
    return { filesCached: 0, tilesCached: 0 };
  }

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

/**
 * Create a new NodeTileLoader instance
 */
export function createNodeTileLoader(dbPath?: string): TileLoader {
  return new NodeTileLoader(dbPath);
}
