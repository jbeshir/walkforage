/**
 * Unified Tile Fallback Logic
 *
 * Provides a consistent fallback chain for resolving unknown biome/geology data:
 * 1. Use the tile's own data if known
 * 2. Try coarse tile (precision 3)
 * 3. Search nearby tiles within max distance
 * 4. Estimate from latitude/coordinates
 *
 * Used by both GeoDataService (point lookups) and useMapOverlay (bulk tile loading).
 */

import { GeoTile, GeologyData, BiomeData } from '../types/gis';
import { TileLoader } from '../services/TileLoader';
import { decodeGeohash, geohashBounds, encodeGeohash, geohashCellSize } from './geohash';
import {
  estimateBiomeFromLatitude,
  estimateRealmFromCoordinates,
  getDefaultGeology,
  FALLBACK_CONFIDENCE,
} from './geoFallbacks';

// Maximum search distance for nearby tile fallback (in km)
const MAX_NEARBY_SEARCH_KM = 200;

// Maximum rings to search outward (2 rings balances coverage with performance)
const MAX_SEARCH_RINGS = 2;

/**
 * Check if biome data is known (not 'unknown')
 */
function hasBiome(tile: GeoTile | null): tile is GeoTile {
  return tile !== null && tile.biome.type !== 'unknown';
}

/**
 * Check if geology data is known (not 'unknown')
 */
function hasGeology(tile: GeoTile | null): tile is GeoTile {
  return tile !== null && tile.geology.primaryLithology !== 'unknown';
}

/**
 * Generate geohashes in expanding rings around a center point
 * Ring 1 = 8 immediate neighbors, Ring 2 = 16 tiles at distance 2, etc.
 */
function getGeohashRing(
  centerLat: number,
  centerLng: number,
  ring: number,
  precision: number,
  cellLatDelta: number,
  cellLngDelta: number
): string[] {
  const hashes = new Set<string>();

  // Walk the perimeter of the ring
  for (let i = -ring; i <= ring; i++) {
    for (let j = -ring; j <= ring; j++) {
      // Only include cells on the perimeter (edge of the square)
      if (Math.abs(i) === ring || Math.abs(j) === ring) {
        const lat = centerLat + i * cellLatDelta;
        const lng = centerLng + j * cellLngDelta;

        // Skip invalid latitudes
        if (lat < -90 || lat > 90) continue;

        // Wrap longitude
        const wrappedLng = ((((lng + 180) % 360) + 360) % 360) - 180;
        hashes.add(encodeGeohash(lat, wrappedLng, precision));
      }
    }
  }

  return Array.from(hashes);
}

/**
 * Find the nearest tile with known biome data within max distance/rings
 */
async function findNearbyBiome(geohash: string, tileLoader: TileLoader): Promise<BiomeData | null> {
  const precision = geohash.length;
  const { lat: centerLat, lng: centerLng } = decodeGeohash(geohash);
  const bounds = geohashBounds(geohash);
  const cellLatDelta = bounds.maxLat - bounds.minLat;
  const cellLngDelta = bounds.maxLng - bounds.minLng;
  const cellSize = geohashCellSize(precision);

  for (let ring = 1; ring <= MAX_SEARCH_RINGS; ring++) {
    // Check if this ring exceeds max distance
    const ringDistanceKm = ring * cellSize.heightKm;
    if (ringDistanceKm > MAX_NEARBY_SEARCH_KM) break;

    const ringHashes = getGeohashRing(
      centerLat,
      centerLng,
      ring,
      precision,
      cellLatDelta,
      cellLngDelta
    );

    if (ringHashes.length === 0) continue;

    const tiles = await tileLoader.getTiles(ringHashes);
    const knownTile = tiles.find((t) => t.biome.type !== 'unknown');

    if (knownTile) {
      return knownTile.biome;
    }
  }

  return null;
}

/**
 * Find the nearest tile with known geology data within max distance/rings
 */
async function findNearbyGeology(
  geohash: string,
  tileLoader: TileLoader
): Promise<GeologyData | null> {
  const precision = geohash.length;
  const { lat: centerLat, lng: centerLng } = decodeGeohash(geohash);
  const bounds = geohashBounds(geohash);
  const cellLatDelta = bounds.maxLat - bounds.minLat;
  const cellLngDelta = bounds.maxLng - bounds.minLng;
  const cellSize = geohashCellSize(precision);

  for (let ring = 1; ring <= MAX_SEARCH_RINGS; ring++) {
    // Check if this ring exceeds max distance
    const ringDistanceKm = ring * cellSize.heightKm;
    if (ringDistanceKm > MAX_NEARBY_SEARCH_KM) break;

    const ringHashes = getGeohashRing(
      centerLat,
      centerLng,
      ring,
      precision,
      cellLatDelta,
      cellLngDelta
    );

    if (ringHashes.length === 0) continue;

    const tiles = await tileLoader.getTiles(ringHashes);
    const knownTile = tiles.find((t) => t.geology.primaryLithology !== 'unknown');

    if (knownTile) {
      return knownTile.geology;
    }
  }

  return null;
}

export interface ResolvedTileData {
  geology: GeologyData;
  biome: BiomeData;
}

export interface ResolveFallbacksOptions {
  tileLoader: TileLoader;
}

/**
 * Resolve unknown biome/geology in a tile using the fallback chain:
 * 1. Coarse tile (precision 3)
 * 2. Nearby tiles (up to 2 rings)
 * 3. Latitude-based estimation
 */
export async function resolveTileFallbacks(
  tile: GeoTile,
  options: ResolveFallbacksOptions
): Promise<ResolvedTileData> {
  const { tileLoader } = options;

  const needsBiomeFallback = tile.biome.type === 'unknown';
  const needsGeologyFallback = tile.geology.primaryLithology === 'unknown';

  // If nothing needs fallback, return as-is
  if (!needsBiomeFallback && !needsGeologyFallback) {
    return { geology: tile.geology, biome: tile.biome };
  }

  const { lat, lng } = decodeGeohash(tile.geohash);
  const coarseHash = tile.geohash.substring(0, 3);

  // Step 1: Try coarse tile
  let coarseTile: GeoTile | null = null;
  if (tile.geohash.length > 3) {
    coarseTile = await tileLoader.getTile(coarseHash);
  }

  let resolvedBiome: BiomeData = tile.biome;
  let resolvedGeology: GeologyData = tile.geology;

  // Resolve biome
  if (needsBiomeFallback) {
    if (hasBiome(coarseTile)) {
      resolvedBiome = coarseTile.biome;
    } else {
      const nearbyBiome = await findNearbyBiome(tile.geohash, tileLoader);
      if (nearbyBiome) {
        resolvedBiome = nearbyBiome;
      } else {
        resolvedBiome = {
          type: estimateBiomeFromLatitude(lat),
          realm: estimateRealmFromCoordinates(lat, lng),
          confidence: FALLBACK_CONFIDENCE,
        };
      }
    }
  }

  // Resolve geology
  if (needsGeologyFallback) {
    if (hasGeology(coarseTile)) {
      resolvedGeology = coarseTile.geology;
    } else {
      const nearbyGeology = await findNearbyGeology(tile.geohash, tileLoader);
      if (nearbyGeology) {
        resolvedGeology = nearbyGeology;
      } else {
        resolvedGeology = getDefaultGeology();
      }
    }
  }

  return { geology: resolvedGeology, biome: resolvedBiome };
}

/**
 * Resolve fallbacks for a location when no tile exists at all
 * Used when even the detailed tile lookup returns nothing
 */
export async function resolveLocationFallbacks(
  lat: number,
  lng: number,
  geohash: string,
  options: ResolveFallbacksOptions
): Promise<ResolvedTileData> {
  const { tileLoader } = options;

  // Try coarse tile first
  const coarseHash = geohash.substring(0, 3);
  const coarseTile = await tileLoader.getTile(coarseHash);

  let resolvedBiome: BiomeData;
  let resolvedGeology: GeologyData;

  // Resolve biome
  if (hasBiome(coarseTile)) {
    resolvedBiome = coarseTile.biome;
  } else {
    const nearbyBiome = await findNearbyBiome(geohash, tileLoader);
    if (nearbyBiome) {
      resolvedBiome = nearbyBiome;
    } else {
      resolvedBiome = {
        type: estimateBiomeFromLatitude(lat),
        realm: estimateRealmFromCoordinates(lat, lng),
        confidence: FALLBACK_CONFIDENCE,
      };
    }
  }

  // Resolve geology
  if (hasGeology(coarseTile)) {
    resolvedGeology = coarseTile.geology;
  } else {
    const nearbyGeology = await findNearbyGeology(geohash, tileLoader);
    if (nearbyGeology) {
      resolvedGeology = nearbyGeology;
    } else {
      resolvedGeology = getDefaultGeology();
    }
  }

  return { geology: resolvedGeology, biome: resolvedBiome };
}

/**
 * Apply fallbacks to multiple tiles efficiently
 * Batches all lookups to minimize database queries
 */
export async function applyFallbacksToTiles(
  tiles: GeoTile[],
  options: ResolveFallbacksOptions
): Promise<GeoTile[]> {
  const { tileLoader } = options;

  // Find tiles that need fallback
  const needsFallback = tiles.filter(
    (t) => t.biome.type === 'unknown' || t.geology.primaryLithology === 'unknown'
  );

  if (needsFallback.length === 0) return tiles;

  // Batch load all coarse tiles we might need
  const coarseHashes = new Set<string>();
  for (const tile of needsFallback) {
    if (tile.geohash.length > 3) {
      coarseHashes.add(tile.geohash.substring(0, 3));
    }
  }

  const coarseTiles = await tileLoader.getTiles(Array.from(coarseHashes));
  const coarseMap = new Map(coarseTiles.map((t) => [t.geohash, t]));

  // Identify tiles that still need nearby search (coarse tile didn't help)
  const needsNearbySearch: GeoTile[] = [];
  for (const tile of needsFallback) {
    const coarseTile =
      tile.geohash.length > 3 ? coarseMap.get(tile.geohash.substring(0, 3)) || null : null;

    const needsBiomeNearby = tile.biome.type === 'unknown' && !hasBiome(coarseTile);
    const needsGeologyNearby =
      tile.geology.primaryLithology === 'unknown' && !hasGeology(coarseTile);

    if (needsBiomeNearby || needsGeologyNearby) {
      needsNearbySearch.push(tile);
    }
  }

  // Batch collect all nearby geohashes needed across all tiles
  const allNearbyHashes = new Set<string>();
  for (const tile of needsNearbySearch) {
    const precision = tile.geohash.length;
    const { lat: centerLat, lng: centerLng } = decodeGeohash(tile.geohash);
    const bounds = geohashBounds(tile.geohash);
    const cellLatDelta = bounds.maxLat - bounds.minLat;
    const cellLngDelta = bounds.maxLng - bounds.minLng;

    for (let ring = 1; ring <= MAX_SEARCH_RINGS; ring++) {
      const ringHashes = getGeohashRing(
        centerLat,
        centerLng,
        ring,
        precision,
        cellLatDelta,
        cellLngDelta
      );
      for (const hash of ringHashes) {
        allNearbyHashes.add(hash);
      }
    }
  }

  // Single batch query for all nearby tiles
  const nearbyTiles =
    allNearbyHashes.size > 0 ? await tileLoader.getTiles(Array.from(allNearbyHashes)) : [];
  const nearbyMap = new Map(nearbyTiles.map((t) => [t.geohash, t]));

  // Apply fallbacks to each tile using pre-fetched data
  return tiles.map((tile) => {
    const needsBiomeFallback = tile.biome.type === 'unknown';
    const needsGeologyFallback = tile.geology.primaryLithology === 'unknown';

    if (!needsBiomeFallback && !needsGeologyFallback) return tile;

    const { lat, lng } = decodeGeohash(tile.geohash);
    const coarseTile =
      tile.geohash.length > 3 ? coarseMap.get(tile.geohash.substring(0, 3)) || null : null;

    let resolvedBiome: BiomeData = tile.biome;
    let resolvedGeology: GeologyData = tile.geology;

    // Resolve biome
    if (needsBiomeFallback) {
      if (hasBiome(coarseTile)) {
        resolvedBiome = coarseTile.biome;
      } else {
        // Search nearby tiles from pre-fetched batch
        const nearbyBiome = findNearbyBiomeFromBatch(tile.geohash, nearbyMap);
        if (nearbyBiome) {
          resolvedBiome = nearbyBiome;
        } else {
          resolvedBiome = {
            type: estimateBiomeFromLatitude(lat),
            realm: estimateRealmFromCoordinates(lat, lng),
            confidence: FALLBACK_CONFIDENCE,
          };
        }
      }
    }

    // Resolve geology
    if (needsGeologyFallback) {
      if (hasGeology(coarseTile)) {
        resolvedGeology = coarseTile.geology;
      } else {
        // Search nearby tiles from pre-fetched batch
        const nearbyGeology = findNearbyGeologyFromBatch(tile.geohash, nearbyMap);
        if (nearbyGeology) {
          resolvedGeology = nearbyGeology;
        } else {
          resolvedGeology = getDefaultGeology();
        }
      }
    }

    return {
      ...tile,
      geology: resolvedGeology,
      biome: resolvedBiome,
    };
  });
}

/**
 * Find nearby biome from pre-fetched tile batch
 */
function findNearbyBiomeFromBatch(
  geohash: string,
  nearbyMap: Map<string, GeoTile>
): BiomeData | null {
  const precision = geohash.length;
  const { lat: centerLat, lng: centerLng } = decodeGeohash(geohash);
  const bounds = geohashBounds(geohash);
  const cellLatDelta = bounds.maxLat - bounds.minLat;
  const cellLngDelta = bounds.maxLng - bounds.minLng;

  for (let ring = 1; ring <= MAX_SEARCH_RINGS; ring++) {
    const ringHashes = getGeohashRing(
      centerLat,
      centerLng,
      ring,
      precision,
      cellLatDelta,
      cellLngDelta
    );

    for (const hash of ringHashes) {
      const tile = nearbyMap.get(hash);
      if (tile && tile.biome.type !== 'unknown') {
        return tile.biome;
      }
    }
  }

  return null;
}

/**
 * Find nearby geology from pre-fetched tile batch
 */
function findNearbyGeologyFromBatch(
  geohash: string,
  nearbyMap: Map<string, GeoTile>
): GeologyData | null {
  const precision = geohash.length;
  const { lat: centerLat, lng: centerLng } = decodeGeohash(geohash);
  const bounds = geohashBounds(geohash);
  const cellLatDelta = bounds.maxLat - bounds.minLat;
  const cellLngDelta = bounds.maxLng - bounds.minLng;

  for (let ring = 1; ring <= MAX_SEARCH_RINGS; ring++) {
    const ringHashes = getGeohashRing(
      centerLat,
      centerLng,
      ring,
      precision,
      cellLatDelta,
      cellLngDelta
    );

    for (const hash of ringHashes) {
      const tile = nearbyMap.get(hash);
      if (tile && tile.geology.primaryLithology !== 'unknown') {
        return tile.geology;
      }
    }
  }

  return null;
}
