// Geohash encoding/decoding utilities for spatial indexing
// Based on the standard geohash algorithm (https://en.wikipedia.org/wiki/Geohash)
//
// Geohash precision levels:
//   1: ~5000km x 5000km
//   2: ~1250km x 625km
//   3: ~156km x 156km
//   4: ~39km x 19.5km
//   5: ~4.9km x 4.9km
//   6: ~1.2km x 610m

import { GeohashBounds, GeohashPrecision } from '../types/gis';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode latitude/longitude to a geohash string
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 * @param precision Number of characters (1-12, default 5)
 * @returns Geohash string
 */
export function encodeGeohash(lat: number, lng: number, precision: number = 5): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      // Bisect longitude
      const lngMid = (lngMin + lngMax) / 2;
      if (lng >= lngMid) {
        idx = idx * 2 + 1;
        lngMin = lngMid;
      } else {
        idx = idx * 2;
        lngMax = lngMid;
      }
    } else {
      // Bisect latitude
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

/**
 * Decode a geohash string to latitude/longitude (center point)
 * @param geohash Geohash string
 * @returns Object with lat and lng of the center point
 */
export function decodeGeohash(geohash: string): { lat: number; lng: number } {
  const bounds = geohashBounds(geohash);
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

/**
 * Get the bounding box for a geohash
 * @param geohash Geohash string
 * @returns Bounding box with minLat, maxLat, minLng, maxLng
 */
export function geohashBounds(geohash: string): GeohashBounds {
  let evenBit = true;
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  for (const char of geohash.toLowerCase()) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) {
      throw new Error(`Invalid geohash character: ${char}`);
    }

    for (let i = 4; i >= 0; i--) {
      const bitN = (idx >> i) & 1;
      if (evenBit) {
        const lngMid = (lngMin + lngMax) / 2;
        if (bitN === 1) {
          lngMin = lngMid;
        } else {
          lngMax = lngMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if (bitN === 1) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      evenBit = !evenBit;
    }
  }

  return { minLat: latMin, maxLat: latMax, minLng: lngMin, maxLng: lngMax };
}

/**
 * Get the 8 neighboring geohashes
 * @param geohash Center geohash
 * @returns Array of 8 neighboring geohash strings
 */
export function geohashNeighbors(geohash: string): string[] {
  const bounds = geohashBounds(geohash);
  const precision = geohash.length;

  const latDelta = (bounds.maxLat - bounds.minLat) / 2;
  const lngDelta = (bounds.maxLng - bounds.minLng) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;

  const neighbors: string[] = [];
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  for (const [dLat, dLng] of directions) {
    const newLat = centerLat + dLat * latDelta * 2;
    const newLng = centerLng + dLng * lngDelta * 2;

    // Handle edge cases at poles and date line
    if (newLat >= -90 && newLat <= 90) {
      const wrappedLng = ((newLng + 180) % 360 + 360) % 360 - 180;
      neighbors.push(encodeGeohash(newLat, wrappedLng, precision));
    }
  }

  return neighbors;
}

/**
 * Check if a point is within a geohash cell
 * @param lat Latitude
 * @param lng Longitude
 * @param geohash Geohash to check against
 * @returns True if point is within the geohash bounds
 */
export function pointInGeohash(lat: number, lng: number, geohash: string): boolean {
  const bounds = geohashBounds(geohash);
  return (
    lat >= bounds.minLat &&
    lat < bounds.maxLat &&
    lng >= bounds.minLng &&
    lng < bounds.maxLng
  );
}

/**
 * Get approximate cell dimensions for a geohash precision level
 * @param precision Geohash precision (1-12)
 * @returns Object with approximate width and height in kilometers
 */
export function geohashCellSize(precision: GeohashPrecision | number): { widthKm: number; heightKm: number } {
  // Approximate cell sizes at equator
  const sizes: Record<number, { widthKm: number; heightKm: number }> = {
    1: { widthKm: 5000, heightKm: 5000 },
    2: { widthKm: 1250, heightKm: 625 },
    3: { widthKm: 156, heightKm: 156 },
    4: { widthKm: 39, heightKm: 19.5 },
    5: { widthKm: 4.9, heightKm: 4.9 },
    6: { widthKm: 1.2, heightKm: 0.61 },
    7: { widthKm: 0.15, heightKm: 0.15 },
    8: { widthKm: 0.038, heightKm: 0.019 },
  };

  return sizes[precision] || { widthKm: 0, heightKm: 0 };
}

/**
 * Generate all geohashes covering a bounding box at a given precision
 * @param bounds Bounding box
 * @param precision Geohash precision
 * @returns Array of geohashes covering the area
 */
export function geohashesInBounds(bounds: GeohashBounds, precision: number): string[] {
  const geohashes = new Set<string>();

  const cellSize = geohashCellSize(precision);
  // Convert km to approximate degrees (very rough, varies by latitude)
  const latStep = cellSize.heightKm / 111; // ~111km per degree latitude
  const lngStep = cellSize.widthKm / 111;  // Varies by latitude, approximation

  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latStep) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngStep) {
      geohashes.add(encodeGeohash(lat, lng, precision));
    }
  }

  return Array.from(geohashes);
}
