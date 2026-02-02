/**
 * geohashUtils.ts - Shared geohash utilities for GIS scripts
 *
 * Provides geohash encoding, decoding, and grid generation for standalone
 * Node.js scripts. These are duplicated from src/utils/geohash.ts to avoid
 * importing React Native code in build scripts.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode latitude/longitude to a geohash string
 */
export function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let latMin = -90,
    latMax = 90;
  let lngMin = -180,
    lngMax = 180;
  let hash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isEven) {
      const lngMid = (lngMin + lngMax) / 2;
      if (lng >= lngMid) {
        ch |= 1 << (4 - bit);
        lngMin = lngMid;
      } else {
        lngMax = lngMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        ch |= 1 << (4 - bit);
        latMin = latMid;
      } else {
        latMax = latMid;
      }
    }

    isEven = !isEven;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Decode a geohash string to latitude/longitude (center point)
 */
export function decodeGeohash(hash: string): { lat: number; lng: number } {
  let latMin = -90,
    latMax = 90;
  let lngMin = -180,
    lngMax = 180;
  let isEven = true;

  for (const char of hash) {
    const idx = BASE32.indexOf(char.toLowerCase());
    if (idx === -1) continue;

    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (idx >> bit) & 1;
      if (isEven) {
        const lngMid = (lngMin + lngMax) / 2;
        if (bitValue) {
          lngMin = lngMid;
        } else {
          lngMax = lngMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if (bitValue) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      isEven = !isEven;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
  };
}

/**
 * Calculate step sizes for generating a geohash grid at a given precision.
 *
 * Geohash cells are NOT square - longitude gets more bits than latitude at
 * even precisions, making cells wider than they are tall.
 *
 * Precision bit distribution:
 *   - Precision 3: 15 bits total, 8 lng (360/256 = 1.41°), 7 lat (180/128 = 1.41°)
 *   - Precision 4: 20 bits total, 10 lng (360/1024 = 0.35°), 10 lat (180/1024 = 0.18°)
 *   - Precision 5: 25 bits total, 13 lng (360/8192 = 0.044°), 12 lat (180/4096 = 0.044°)
 *
 * Returns step sizes smaller than cell dimensions to ensure complete coverage.
 */
export function getGeohashStepSizes(precision: number): { latStep: number; lngStep: number } {
  const totalBits = precision * 5;
  const lngBits = Math.ceil(totalBits / 2);
  const latBits = Math.floor(totalBits / 2);

  // Cell dimensions in degrees
  const cellLngDegrees = 360 / Math.pow(2, lngBits);
  const cellLatDegrees = 180 / Math.pow(2, latBits);

  // Use steps at ~80% of cell size to ensure we hit every cell
  return {
    latStep: cellLatDegrees * 0.8,
    lngStep: cellLngDegrees * 0.8,
  };
}

/**
 * Generate all geohashes covering a bounding box at a given precision.
 *
 * Uses adaptive step sizes based on precision to ensure complete coverage
 * without excessive redundancy.
 */
export function generateGeohashGrid(
  latMin: number,
  latMax: number,
  lngMin: number,
  lngMax: number,
  precision: number
): string[] {
  const geohashes = new Set<string>();
  const { latStep, lngStep } = getGeohashStepSizes(precision);

  for (let lat = latMin; lat <= latMax; lat += latStep) {
    for (let lng = lngMin; lng <= lngMax; lng += lngStep) {
      const hash = encodeGeohash(lat, lng, precision);
      geohashes.add(hash);
    }
  }

  // Ensure corners are included
  geohashes.add(encodeGeohash(latMin, lngMin, precision));
  geohashes.add(encodeGeohash(latMin, lngMax, precision));
  geohashes.add(encodeGeohash(latMax, lngMin, precision));
  geohashes.add(encodeGeohash(latMax, lngMax, precision));

  return [...geohashes];
}
