// GeoDataService - Provides geological and biome data for locations
// Uses geohash-indexed tiles for efficient spatial lookup
// Hierarchical lookup: detailed tile -> coarse index -> latitude-based fallback

import { LocationGeoData, GeoTile, BiomeData, GeologyData, CoarseGeologyEntry } from '../types/gis';
import { BiomeCode } from '../types/resources';
import { encodeGeohash } from '../utils/geohash';
import { getTile, clearTileCache, getTileCacheStats } from '../data/gis/tile-loader';

// Coarse index data (loaded on init) - uses minimal CoarseGeologyEntry type
let coarseGeologyIndex: Record<string, CoarseGeologyEntry> = {};
let coarseBiomeIndex: Record<string, BiomeData> = {};

class GeoDataService {
  private initialized = false;

  /**
   * Initialize the service (load coarse indexes)
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Try to load bundled index files
    try {
      const geologyIndex = await import('../data/gis/geology/index.json');
      if (geologyIndex?.data) {
        coarseGeologyIndex = geologyIndex.data as Record<string, CoarseGeologyEntry>;
        console.log(`Loaded geology index: ${Object.keys(coarseGeologyIndex).length} cells`);
      }
    } catch {
      // Geology index not yet bundled, will use fallback
    }

    try {
      const biomeIndex = await import('../data/gis/biomes/index.json');
      if (biomeIndex?.data) {
        coarseBiomeIndex = biomeIndex.data as Record<string, BiomeData>;
        console.log(`Loaded biome index: ${Object.keys(coarseBiomeIndex).length} cells`);
      }
    } catch {
      // Biome index not yet bundled, will use fallback
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
    const coarseHash = encodeGeohash(lat, lng, 3);   // ~156km precision

    // Get coarse index data (used as fallback for unknown fields)
    const coarseGeology = coarseGeologyIndex[coarseHash];
    const coarseBiome = coarseBiomeIndex[coarseHash];

    // Try detailed tile first
    const detailedTile = await this.loadDetailedTile(detailedHash);
    if (detailedTile) {
      // Check if detailed tile has unknown values that need fallback
      const hasUnknownGeology = detailedTile.geology.primaryLithology === 'unknown';
      const hasUnknownBiome = (detailedTile.biome.type as string) === 'unknown';

      // Use detailed data, falling back to coarse index for unknown fields
      return {
        geology: hasUnknownGeology && coarseGeology
          ? {
              primaryLithology: coarseGeology.primaryLithology,
              secondaryLithologies: [],
              confidence: coarseGeology.confidence,
            }
          : hasUnknownGeology
            ? this.getDefaultGeology()
            : {
                primaryLithology: detailedTile.geology.primaryLithology,
                secondaryLithologies: detailedTile.geology.secondaryLithologies,
                confidence: detailedTile.geology.confidence,
              },
        biome: hasUnknownBiome && coarseBiome
          ? {
              type: coarseBiome.type,
              ecoregionId: coarseBiome.ecoregionId,
              realmBiome: coarseBiome.realmBiome,
              realm: coarseBiome.realm,
              confidence: coarseBiome.confidence,
            }
          : hasUnknownBiome
            ? {
                type: this.getBiomeFromLatitude(lat),
                confidence: 0.3,
              }
            : {
                type: detailedTile.biome.type,
                ecoregionId: detailedTile.biome.ecoregionId,
                realmBiome: detailedTile.biome.realmBiome,
                realm: detailedTile.biome.realm,
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
          : this.getDefaultGeology(),
        biome: {
          type: coarseBiome?.type || this.getBiomeFromLatitude(lat),
          ecoregionId: coarseBiome?.ecoregionId,
          realmBiome: coarseBiome?.realmBiome,
          realm: coarseBiome?.realm,
          confidence: coarseBiome?.confidence || 0.5,
        },
        dataSource: 'coarse',
        geohash: coarseHash,
      };
    }

    // Ultimate fallback for unmapped areas
    return this.getFallbackData(lat, lng, coarseHash);
  }

  /**
   * Lazy-load detailed tile data from bundled assets
   * Uses expo-file-system Paths.bundle to read tile files dynamically
   */
  private async loadDetailedTile(geohash: string): Promise<GeoTile | null> {
    return getTile(geohash);
  }

  /**
   * Generate fallback data based on latitude (rough climate zones)
   */
  private getFallbackData(lat: number, lng: number, geohash: string): LocationGeoData {
    const biomeType = this.getBiomeFromLatitude(lat);

    return {
      geology: {
        primaryLithology: 'mixed_sedimentary',
        secondaryLithologies: ['sandstone', 'limestone', 'shale'],
        confidence: 0.3,
      },
      biome: {
        type: biomeType,
        confidence: 0.3,
      },
      dataSource: 'fallback',
      geohash,
    };
  }

  /**
   * Estimate biome from latitude (very rough approximation)
   */
  private getBiomeFromLatitude(lat: number): BiomeCode {
    const absLat = Math.abs(lat);

    if (absLat > 66) {
      return 'tundra';
    } else if (absLat > 55) {
      return 'boreal';
    } else if (absLat > 45) {
      return 'temperate_conifer';
    } else if (absLat > 35) {
      return 'temperate_broadleaf_mixed';
    } else if (absLat > 23) {
      return 'mediterranean';
    } else {
      return 'tropical_moist_broadleaf';
    }
  }

  /**
   * Get default geology for unknown areas
   */
  private getDefaultGeology(): GeologyData {
    return {
      primaryLithology: 'mixed_sedimentary',
      secondaryLithologies: ['sandstone', 'limestone'],
      confidence: 0.3,
    };
  }

  /**
   * Build LocationGeoData from a tile
   */
  private buildLocationData(
    tile: GeoTile,
    source: 'detailed' | 'coarse',
    geohash: string
  ): LocationGeoData {
    return {
      geology: {
        primaryLithology: tile.geology.primaryLithology,
        secondaryLithologies: tile.geology.secondaryLithologies,
        confidence: tile.geology.confidence,
      },
      biome: {
        type: tile.biome.type,
        ecoregionId: tile.biome.ecoregionId,
        realmBiome: tile.biome.realmBiome,
        realm: tile.biome.realm,
        confidence: tile.biome.confidence,
      },
      dataSource: source,
      geohash,
    };
  }

  /**
   * Clear the tile cache (useful for testing or memory management)
   */
  clearCache(): void {
    clearTileCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { filesCached: number; tilesCached: number } {
    return getTileCacheStats();
  }
}

// Export singleton instance
export const geoDataService = new GeoDataService();
export default geoDataService;
