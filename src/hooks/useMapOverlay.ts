// useMapOverlay - Hook for managing map overlay tile loading
// Loads tiles based on current map viewport with adaptive precision and debouncing

import { useState, useCallback, useRef, useEffect } from 'react';
import { Region } from 'react-native-maps';
import { GeoTile, GeohashBounds } from '../types/gis';
import { TileLoader } from '../services/TileLoader';
import { geohashesInBounds } from '../utils/geohash';
import { applyFallbacksToTiles } from '../utils/tileFallbacks';

const MAX_TILES = 500;
const DEBOUNCE_MS = 150;

interface UseMapOverlayOptions {
  tileLoader: TileLoader | null;
  enabled: boolean;
}

interface UseMapOverlayResult {
  tiles: GeoTile[];
  isLoading: boolean;
  precision: number;
  updateRegion: (region: Region) => void;
}

/**
 * Calculate the single best geohash precision for a zoom level
 * Database has tiles at precision 3 (coarse), 4 (base coverage), and 5 (city detail)
 * Uses a single precision per zoom to avoid tile count explosion from combining levels
 */
function getPrecisionForZoom(latitudeDelta: number): number {
  // Precision 3: ~156km cells, use for very zoomed out (latDelta > 5)
  // Precision 4: ~39km cells, use for moderate zoom (latDelta 0.3-5)
  // Precision 5: ~4.9km cells, use for zoomed in (latDelta < 0.3)
  if (latitudeDelta > 5) return 3;
  if (latitudeDelta > 0.3) return 4;
  return 5;
}

/**
 * Convert map Region to GeohashBounds
 */
function regionToBounds(region: Region): GeohashBounds {
  const halfLatDelta = region.latitudeDelta / 2;
  const halfLngDelta = region.longitudeDelta / 2;
  return {
    minLat: region.latitude - halfLatDelta,
    maxLat: region.latitude + halfLatDelta,
    minLng: region.longitude - halfLngDelta,
    maxLng: region.longitude + halfLngDelta,
  };
}

/**
 * Hook for managing map overlay tile loading based on viewport
 */
export function useMapOverlay({ tileLoader, enabled }: UseMapOverlayOptions): UseMapOverlayResult {
  const [tiles, setTiles] = useState<GeoTile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [precision, setPrecision] = useState(4);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRegionRef = useRef<Region | null>(null);

  // Load tiles for a region
  const loadTiles = useCallback(
    async (region: Region) => {
      if (!tileLoader || !enabled) {
        setTiles([]);
        return;
      }

      setIsLoading(true);

      try {
        const precision = getPrecisionForZoom(region.latitudeDelta);
        setPrecision(precision);

        const bounds = regionToBounds(region);
        let geohashes = geohashesInBounds(bounds, precision);

        // Cap number of tiles for performance
        if (geohashes.length > MAX_TILES) {
          geohashes = geohashes.slice(0, MAX_TILES);
        }

        const loadedTiles = await tileLoader.getTiles(geohashes);
        // Only update if we got results - keeps old tiles visible during panning
        if (loadedTiles.length > 0) {
          // Apply unified fallback logic for tiles with unknown biome/geology
          const tilesWithFallbacks = await applyFallbacksToTiles(loadedTiles, { tileLoader });
          setTiles(tilesWithFallbacks);
        }
      } catch (error) {
        console.warn('Failed to load overlay tiles:', error);
        // Don't clear tiles on error - keep showing what we have
      } finally {
        setIsLoading(false);
      }
    },
    [tileLoader, enabled]
  );

  // Debounced region update handler
  const updateRegion = useCallback(
    (region: Region) => {
      lastRegionRef.current = region;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        loadTiles(region);
      }, DEBOUNCE_MS);
    },
    [loadTiles]
  );

  // Clear tiles when disabled
  useEffect(() => {
    if (!enabled) {
      setTiles([]);
    } else if (lastRegionRef.current) {
      // Reload tiles if re-enabled and we have a previous region
      loadTiles(lastRegionRef.current);
    }
  }, [enabled, loadTiles]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    tiles,
    isLoading,
    precision,
    updateRegion,
  };
}
