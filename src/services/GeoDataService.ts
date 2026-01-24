// GeoDataService - Provides geological and biome data for locations
// Uses geohash-indexed tiles for efficient spatial lookup
// Hierarchical lookup: detailed tile -> coarse index -> latitude-based fallback

import { LocationGeoData, BiomeData, CoarseGeologyEntry } from '../types/gis';
import { encodeGeohash } from '../utils/geohash';
import { TileLoader } from './TileLoader';
import {
  estimateRealmFromCoordinates,
  estimateBiomeFromLatitude,
  getDefaultGeology,
  FALLBACK_CONFIDENCE,
} from '../utils/geoFallbacks';

/**
 * Options for creating a GeoDataService
 */
export interface GeoDataServiceOptions {
  tileLoader: TileLoader;
  /**
   * Optional function to load coarse indexes.
   * If not provided, uses dynamic import (Expo-compatible).
   */
  loadCoarseIndexes?: () => Promise<{
    geology: Record<string, CoarseGeologyEntry>;
    biome: Record<string, BiomeData>;
  }>;
}

/**
 * GeoDataService - Provides geological and biome data for locations
 *
 * Usage:
 * - In React Native app: Use GeoDataProvider to create and provide the service
 * - In scripts/tests: Create directly with NodeTileLoader
 */
export class GeoDataService {
  private initialized = false;
  private tileLoader: TileLoader;
  private loadCoarseIndexes?: GeoDataServiceOptions['loadCoarseIndexes'];
  private coarseGeologyIndex: Record<string, CoarseGeologyEntry> = {};
  private coarseBiomeIndex: Record<string, BiomeData> = {};

  constructor(options: GeoDataServiceOptions) {
    this.tileLoader = options.tileLoader;
    this.loadCoarseIndexes = options.loadCoarseIndexes;
  }

  /**
   * Initialize the service (load coarse indexes and tile loader)
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize tile loader
    await this.tileLoader.initialize();

    // Load coarse indexes
    if (this.loadCoarseIndexes) {
      const indexes = await this.loadCoarseIndexes();
      this.coarseGeologyIndex = indexes.geology;
      this.coarseBiomeIndex = indexes.biome;
    } else {
      // Default: use dynamic import (Expo-compatible)
      try {
        const geologyIndex = await import('../data/gis/geology/index.json');
        if (geologyIndex?.data) {
          this.coarseGeologyIndex = geologyIndex.data as Record<string, CoarseGeologyEntry>;
          console.log(`Loaded geology index: ${Object.keys(this.coarseGeologyIndex).length} cells`);
        }
      } catch {
        // Geology index not yet bundled, will use fallback
      }

      try {
        const biomeIndex = await import('../data/gis/biomes/index.json');
        if (biomeIndex?.data) {
          this.coarseBiomeIndex = biomeIndex.data as Record<string, BiomeData>;
          console.log(`Loaded biome index: ${Object.keys(this.coarseBiomeIndex).length} cells`);
        }
      } catch {
        // Biome index not yet bundled, will use fallback
      }
    }

    this.initialized = true;
  }

  /**
   * Look up geological and biome data for a location
   * Uses hierarchical lookup: detailed tile -> coarse index -> fallback
   * Falls back to coarse index for individual fields when detailed tile has "unknown" values
   */
  async getLocationData(lat: number, lng: number): Promise<LocationGeoData> {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate geohashes at different precisions
    const detailedHash = encodeGeohash(lat, lng, 4); // ~39km precision
    const coarseHash = encodeGeohash(lat, lng, 3); // ~156km precision

    // Get coarse index data (used as fallback for unknown fields)
    const coarseGeology = this.coarseGeologyIndex[coarseHash];
    const coarseBiome = this.coarseBiomeIndex[coarseHash];

    // Try detailed tile first
    const detailedTile = await this.tileLoader.getTile(detailedHash);
    if (detailedTile) {
      // Check if detailed tile has unknown values that need fallback
      const hasUnknownGeology = detailedTile.geology.primaryLithology === 'unknown';
      const hasUnknownBiome = detailedTile.biome.type === 'unknown';

      // Use detailed data, falling back to coarse index for unknown fields
      return {
        geology:
          hasUnknownGeology && coarseGeology
            ? {
                primaryLithology: coarseGeology.primaryLithology,
                secondaryLithologies: [],
                confidence: coarseGeology.confidence,
              }
            : hasUnknownGeology
              ? getDefaultGeology()
              : {
                  primaryLithology: detailedTile.geology.primaryLithology,
                  secondaryLithologies: detailedTile.geology.secondaryLithologies,
                  confidence: detailedTile.geology.confidence,
                },
        biome:
          hasUnknownBiome && coarseBiome
            ? {
                type: coarseBiome.type,
                ecoregionId: coarseBiome.ecoregionId,
                realm: coarseBiome.realm || estimateRealmFromCoordinates(lat, lng),
                confidence: coarseBiome.confidence,
              }
            : hasUnknownBiome
              ? {
                  type: estimateBiomeFromLatitude(lat),
                  realm: estimateRealmFromCoordinates(lat, lng),
                  confidence: FALLBACK_CONFIDENCE,
                }
              : {
                  type: detailedTile.biome.type,
                  ecoregionId: detailedTile.biome.ecoregionId,
                  realm: detailedTile.biome.realm || estimateRealmFromCoordinates(lat, lng),
                  confidence: detailedTile.biome.confidence,
                },
        dataSource: 'detailed',
        geohash: detailedHash,
      };
    }

    // Fall back to coarse index when no detailed tile exists
    if (coarseGeology || coarseBiome) {
      return {
        // Coarse index only has primaryLithology + confidence, not secondaryLithologies
        geology: coarseGeology
          ? {
              primaryLithology: coarseGeology.primaryLithology,
              secondaryLithologies: [], // Not stored in coarse index
              confidence: coarseGeology.confidence,
            }
          : getDefaultGeology(),
        biome: {
          type: coarseBiome?.type || estimateBiomeFromLatitude(lat),
          ecoregionId: coarseBiome?.ecoregionId,
          realm: coarseBiome?.realm || estimateRealmFromCoordinates(lat, lng),
          confidence: coarseBiome?.confidence || 0.5,
        },
        dataSource: 'coarse',
        geohash: coarseHash,
      };
    }

    // Ultimate fallback for unmapped areas
    return {
      geology: getDefaultGeology(),
      biome: {
        type: estimateBiomeFromLatitude(lat),
        realm: estimateRealmFromCoordinates(lat, lng),
        confidence: FALLBACK_CONFIDENCE,
      },
      dataSource: 'fallback',
      geohash: coarseHash,
    };
  }

  /**
   * Close the service and release resources
   */
  async close(): Promise<void> {
    await this.tileLoader.close();
    this.initialized = false;
  }
}
