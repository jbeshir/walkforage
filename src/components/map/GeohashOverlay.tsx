// GeohashOverlay - Renders colored polygon overlays for geohash tiles
// Used to visualize biome and lithology data on the map

import React, { useMemo } from 'react';
import { Polygon } from 'react-native-maps';
import { GeoTile } from '../../types/gis';
import { geohashBounds } from '../../utils/geohash';
import {
  getBiomeColor,
  getLithologyColor,
  BIOME_OVERLAY_OPACITY,
  LITHOLOGY_OVERLAY_OPACITY,
} from '../../config/overlayColors';

export type OverlayType = 'biome' | 'lithology';

interface GeohashOverlayProps {
  tiles: GeoTile[];
  type: OverlayType;
}

interface PolygonData {
  key: string;
  coordinates: { latitude: number; longitude: number }[];
  fillColor: string;
}

/**
 * Convert geohash bounds to polygon coordinates
 */
function boundsToCoordinates(geohash: string): { latitude: number; longitude: number }[] {
  const bounds = geohashBounds(geohash);
  return [
    { latitude: bounds.minLat, longitude: bounds.minLng },
    { latitude: bounds.minLat, longitude: bounds.maxLng },
    { latitude: bounds.maxLat, longitude: bounds.maxLng },
    { latitude: bounds.maxLat, longitude: bounds.minLng },
  ];
}

/**
 * Convert hex color to rgba with opacity
 */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Renders polygon overlays for an array of geohash tiles
 */
export function GeohashOverlay({ tiles, type }: GeohashOverlayProps) {
  const polygons = useMemo((): PolygonData[] => {
    const opacity = type === 'biome' ? BIOME_OVERLAY_OPACITY : LITHOLOGY_OVERLAY_OPACITY;

    return tiles.map((tile) => {
      const baseColor =
        type === 'biome'
          ? getBiomeColor(tile.biome.type)
          : getLithologyColor(tile.geology.primaryLithology);

      return {
        key: `${tile.geohash}-${type}`,
        coordinates: boundsToCoordinates(tile.geohash),
        fillColor: hexToRgba(baseColor, opacity),
      };
    });
  }, [tiles, type]);

  return (
    <>
      {polygons.map((polygon) => (
        <Polygon
          key={polygon.key}
          coordinates={polygon.coordinates}
          fillColor={polygon.fillColor}
          strokeWidth={0}
        />
      ))}
    </>
  );
}
