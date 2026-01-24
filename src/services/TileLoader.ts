/**
 * TileLoader Interface
 *
 * Defines the contract for loading GIS tile data. Implementations can use
 * different backends (expo-sqlite for the app, better-sqlite3 for scripts/tests).
 */

import { GeoTile } from '../types/gis';

/**
 * Interface for tile loading operations
 */
export interface TileLoader {
  /**
   * Get a specific tile by full geohash
   * @param geohash 4-character geohash (e.g., "9q5c", "u4pr")
   * @returns GeoTile data or null if not found
   */
  getTile(geohash: string): Promise<GeoTile | null> | GeoTile | null;

  /**
   * Initialize the loader (load database, etc.)
   */
  initialize(): Promise<void> | void;

  /**
   * Close the loader and release resources
   */
  close(): Promise<void> | void;

  /**
   * Clear the tile cache (if any)
   */
  clearCache(): void;

  /**
   * Get cache statistics
   */
  getCacheStats(): { filesCached: number; tilesCached: number };
}
