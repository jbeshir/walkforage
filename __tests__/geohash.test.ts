/**
 * Tests for geohash utility functions
 */
import {
  encodeGeohash,
  decodeGeohash,
  geohashBounds,
  geohashNeighbors,
} from '../src/utils/geohash';

describe('Geohash Utilities', () => {
  describe('encodeGeohash', () => {
    it('should encode known coordinates correctly', () => {
      // New York City
      const nyc = encodeGeohash(40.7128, -74.006, 6);
      expect(nyc).toBe('dr5reg');

      // London
      const london = encodeGeohash(51.5074, -0.1278, 6);
      expect(london).toBe('gcpvj0');

      // Tokyo
      const tokyo = encodeGeohash(35.6762, 139.6503, 6);
      expect(tokyo).toBe('xn76cy');

      // Sydney
      const sydney = encodeGeohash(-33.8688, 151.2093, 6);
      expect(sydney).toBe('r3gx2f');
    });

    it('should respect precision parameter', () => {
      const lat = 40.7128;
      const lng = -74.006;

      expect(encodeGeohash(lat, lng, 1).length).toBe(1);
      expect(encodeGeohash(lat, lng, 4).length).toBe(4);
      expect(encodeGeohash(lat, lng, 8).length).toBe(8);
    });

    it('should handle edge cases', () => {
      // North Pole
      expect(() => encodeGeohash(90, 0, 4)).not.toThrow();

      // South Pole
      expect(() => encodeGeohash(-90, 0, 4)).not.toThrow();

      // Date line
      expect(() => encodeGeohash(0, 180, 4)).not.toThrow();
      expect(() => encodeGeohash(0, -180, 4)).not.toThrow();
    });
  });

  describe('decodeGeohash', () => {
    it('should decode to center of geohash cell', () => {
      const hash = 'dr5reg';
      const { lat, lng } = decodeGeohash(hash);

      // Should be close to NYC
      expect(lat).toBeCloseTo(40.7128, 1);
      expect(lng).toBeCloseTo(-74.006, 1);
    });

    it('should be reversible with encode', () => {
      const testPoints = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 51.5074, lng: -0.1278 },
        { lat: -33.8688, lng: 151.2093 },
        { lat: 0, lng: 0 },
      ];

      for (const point of testPoints) {
        const hash = encodeGeohash(point.lat, point.lng, 8);
        const decoded = decodeGeohash(hash);

        // Should be very close (within precision of geohash)
        expect(decoded.lat).toBeCloseTo(point.lat, 3);
        expect(decoded.lng).toBeCloseTo(point.lng, 3);
      }
    });
  });

  describe('geohashBounds', () => {
    it('should return valid bounding box', () => {
      const bounds = geohashBounds('dr5r');

      expect(bounds.minLat).toBeLessThan(bounds.maxLat);
      expect(bounds.minLng).toBeLessThan(bounds.maxLng);
    });

    it('should contain the decoded center point', () => {
      const hash = 'dr5reg';
      const bounds = geohashBounds(hash);
      const center = decodeGeohash(hash);

      expect(center.lat).toBeGreaterThanOrEqual(bounds.minLat);
      expect(center.lat).toBeLessThanOrEqual(bounds.maxLat);
      expect(center.lng).toBeGreaterThanOrEqual(bounds.minLng);
      expect(center.lng).toBeLessThanOrEqual(bounds.maxLng);
    });

    it('should have smaller bounds for higher precision', () => {
      const bounds4 = geohashBounds('dr5r');
      const bounds6 = geohashBounds('dr5reg');

      const size4 = (bounds4.maxLat - bounds4.minLat) * (bounds4.maxLng - bounds4.minLng);
      const size6 = (bounds6.maxLat - bounds6.minLat) * (bounds6.maxLng - bounds6.minLng);

      expect(size6).toBeLessThan(size4);
    });
  });

  describe('geohashNeighbors', () => {
    // geohashNeighbors returns an array in order: [sw, s, se, w, e, nw, n, ne]
    // Based on directions: [-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]
    const NEIGHBOR_INDEX = { sw: 0, s: 1, se: 2, w: 3, e: 4, nw: 5, n: 6, ne: 7 };

    it('should return 8 neighbors', () => {
      const neighbors = geohashNeighbors('dr5r');

      expect(neighbors).toHaveLength(8);
      expect(neighbors[NEIGHBOR_INDEX.n]).toBeDefined();
      expect(neighbors[NEIGHBOR_INDEX.ne]).toBeDefined();
      expect(neighbors[NEIGHBOR_INDEX.e]).toBeDefined();
      expect(neighbors[NEIGHBOR_INDEX.se]).toBeDefined();
      expect(neighbors[NEIGHBOR_INDEX.s]).toBeDefined();
      expect(neighbors[NEIGHBOR_INDEX.sw]).toBeDefined();
      expect(neighbors[NEIGHBOR_INDEX.w]).toBeDefined();
      expect(neighbors[NEIGHBOR_INDEX.nw]).toBeDefined();
    });

    it('should return geohashes of same length', () => {
      const hash = 'dr5reg';
      const neighbors = geohashNeighbors(hash);

      for (const neighbor of neighbors) {
        expect(neighbor.length).toBe(hash.length);
      }
    });

    it('should return adjacent cells', () => {
      const hash = 'dr5r';
      const neighbors = geohashNeighbors(hash);
      const centerBounds = geohashBounds(hash);
      const northBounds = geohashBounds(neighbors[NEIGHBOR_INDEX.n]);

      // North neighbor should be directly above
      expect(northBounds.minLat).toBeCloseTo(centerBounds.maxLat, 5);
    });
  });
});
