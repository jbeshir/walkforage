// GeoDataService - Provides geological and biome data for locations
// Uses geohash-indexed tiles for efficient spatial lookup
// Hierarchical lookup: detailed tile -> coarse tile -> nearby tiles -> latitude estimation

import { LocationGeoData, AltitudeData } from '../types/gis';
import { encodeGeohash } from '../utils/geohash';
import { TileLoader } from './TileLoader';
import { resolveTileFallbacks, resolveLocationFallbacks } from '../utils/tileFallbacks';
import { estimateRealmFromCoordinates } from '../utils/geoFallbacks';
import { calculateAltitudeConfidence } from '../config/altitude';

/**
 * Options for creating a GeoDataService
 */
export interface GeoDataServiceOptions {
  tileLoader: TileLoader;
}

/**
 * Options for altitude data to include in location lookup
 */
export interface AltitudeOptions {
  altitude: number | null;
  altitudeAccuracy: number | null;
}

/**
 * GeoDataService - Provides geological and biome data for locations
 *
 * Usage:
 * - In React Native app: Use GeoDataProvider to create and provide the service
 * - In scripts/tests: Create directly with NodeTileLoader
 */
/**
 * Build AltitudeData from raw GPS values
 */
function buildAltitudeData(options?: AltitudeOptions): AltitudeData | undefined {
  if (!options || options.altitude === null) {
    return undefined;
  }

  return {
    value: options.altitude,
    accuracy: options.altitudeAccuracy,
    confidence: calculateAltitudeConfidence(options.altitudeAccuracy),
  };
}

export class GeoDataService {
  private initialized = false;
  private tileLoader: TileLoader;

  constructor(options: GeoDataServiceOptions) {
    this.tileLoader = options.tileLoader;
  }

  /**
   * Initialize the service (tile loader)
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.tileLoader.initialize();
    this.initialized = true;
  }

  /**
   * Look up geological and biome data for a location
   * Uses hierarchical lookup with unified fallback chain:
   * 1. Detailed tile (precision-4)
   * 2. Coarse tile (precision-3)
   * 3. Nearby tiles within max distance
   * 4. Latitude-based estimation
   *
   * @param lat Latitude
   * @param lng Longitude
   * @param altitudeOptions Optional altitude data from GPS
   */
  async getLocationData(
    lat: number,
    lng: number,
    altitudeOptions?: AltitudeOptions
  ): Promise<LocationGeoData> {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate geohash at detailed precision
    const detailedHash = encodeGeohash(lat, lng, 4); // ~39km precision

    // Try detailed tile first
    const detailedTile = await this.tileLoader.getTile(detailedHash);

    if (detailedTile) {
      // Use unified fallback logic for unknown values
      const resolved = await resolveTileFallbacks(detailedTile, {
        tileLoader: this.tileLoader,
      });

      return {
        geology: {
          primaryLithology: resolved.geology.primaryLithology,
          secondaryLithologies: resolved.geology.secondaryLithologies,
          confidence: resolved.geology.confidence,
        },
        biome: {
          type: resolved.biome.type,
          ecoregionId: resolved.biome.ecoregionId,
          realm: resolved.biome.realm || estimateRealmFromCoordinates(lat, lng),
          confidence: resolved.biome.confidence,
        },
        altitude: buildAltitudeData(altitudeOptions),
        dataSource: 'detailed',
        geohash: detailedHash,
      };
    }

    // No detailed tile - use location fallback (coarse -> nearby -> estimation)
    const resolved = await resolveLocationFallbacks(lat, lng, detailedHash, {
      tileLoader: this.tileLoader,
    });

    return {
      geology: {
        primaryLithology: resolved.geology.primaryLithology,
        secondaryLithologies: resolved.geology.secondaryLithologies,
        confidence: resolved.geology.confidence,
      },
      biome: {
        type: resolved.biome.type,
        ecoregionId: resolved.biome.ecoregionId,
        realm: resolved.biome.realm || estimateRealmFromCoordinates(lat, lng),
        confidence: resolved.biome.confidence,
      },
      altitude: buildAltitudeData(altitudeOptions),
      dataSource: 'fallback',
      geohash: detailedHash,
    };
  }

  /**
   * Close the service and release resources
   */
  async close(): Promise<void> {
    await this.tileLoader.close();
    this.initialized = false;
  }

  /**
   * Get the underlying tile loader for direct tile queries
   */
  getTileLoader(): TileLoader {
    return this.tileLoader;
  }
}
