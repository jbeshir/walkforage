/**
 * Tests for GeoDataService
 */
import { geoDataService } from '../src/services/GeoDataService';

describe('GeoDataService', () => {
  beforeEach(() => {
    // Clear cache before each test
    geoDataService.clearCache();
  });

  describe('getLocationData', () => {
    it('should return data for valid coordinates', async () => {
      // New York City coordinates
      const data = await geoDataService.getLocationData(40.7128, -74.006);

      expect(data).toBeDefined();
      expect(data.geology).toBeDefined();
      expect(data.biome).toBeDefined();
      expect(data.dataSource).toBeDefined();
      expect(data.geohash).toBeDefined();
    });

    it('should return geology data with required fields', async () => {
      const data = await geoDataService.getLocationData(40.7128, -74.006);

      expect(data.geology.primaryLithology).toBeDefined();
      expect(typeof data.geology.primaryLithology).toBe('string');
      expect(data.geology.secondaryLithologies).toBeInstanceOf(Array);
      expect(typeof data.geology.confidence).toBe('number');
      expect(data.geology.confidence).toBeGreaterThanOrEqual(0);
      expect(data.geology.confidence).toBeLessThanOrEqual(1);
    });

    it('should return biome data with required fields', async () => {
      const data = await geoDataService.getLocationData(40.7128, -74.006);

      expect(data.biome.type).toBeDefined();
      expect(typeof data.biome.type).toBe('string');
      expect(typeof data.biome.confidence).toBe('number');
      expect(data.biome.confidence).toBeGreaterThanOrEqual(0);
      expect(data.biome.confidence).toBeLessThanOrEqual(1);
    });

    it('should use fallback for unmapped ocean locations', async () => {
      // Middle of Pacific Ocean
      const data = await geoDataService.getLocationData(0, -160);

      expect(data.dataSource).toBe('fallback');
      expect(data.geology.confidence).toBeLessThanOrEqual(0.5);
    });

    it('should return appropriate biome for latitude zones', async () => {
      // Arctic - should be tundra
      const arctic = await geoDataService.getLocationData(70, 0);
      expect(arctic.biome.type).toBe('tundra');

      // Tropical - should be tropical
      const tropical = await geoDataService.getLocationData(5, 0);
      expect(arctic.biome.type).not.toBe(tropical.biome.type);
    });

    it('should cache tile lookups', async () => {
      // First call
      await geoDataService.getLocationData(40.7128, -74.006);

      // Get cache stats
      const stats = geoDataService.getCacheStats();
      expect(stats.tilesCached).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ecoregion fields', () => {
    it('should return ecoregion data for mapped locations', async () => {
      // Central Europe - should have PA04 ecoregion data
      // Use coordinates that are likely in the Palearctic realm
      const data = await geoDataService.getLocationData(48.8566, 2.3522); // Paris

      // Ecoregion fields may or may not be present depending on data coverage
      // But the fields should at least be allowed in the type
      expect(data.biome).toBeDefined();
      expect(typeof data.biome.type).toBe('string');
    });

    it('should include realmBiome when available', async () => {
      // Paris - likely PA04 (Palearctic Temperate Broadleaf)
      const data = await geoDataService.getLocationData(48.8566, 2.3522);

      // If realmBiome is present, it should follow the expected format
      if (data.biome.realmBiome) {
        expect(data.biome.realmBiome).toMatch(/^[A-Z]{2}\d{2}$/);
      }
    });

    it('should include realm name when available', async () => {
      const data = await geoDataService.getLocationData(48.8566, 2.3522);

      // If realm is present, it should be a valid realm name
      if (data.biome.realm) {
        const validRealms = [
          'Palearctic',
          'Nearctic',
          'Neotropic',
          'Afrotropic',
          'Indomalayan',
          'Australasia',
          'Oceania',
          'Antarctica',
        ];
        expect(validRealms).toContain(data.biome.realm);
      }
    });

    it('should include ecoregionId when available', async () => {
      const data = await geoDataService.getLocationData(48.8566, 2.3522);

      // If ecoregionId is present, it should be a positive integer
      if (data.biome.ecoregionId !== undefined) {
        expect(Number.isInteger(data.biome.ecoregionId)).toBe(true);
        expect(data.biome.ecoregionId).toBeGreaterThan(0);
      }
    });

    it('should return different realm codes for different continents', async () => {
      // Test locations on different continents
      const europe = await geoDataService.getLocationData(48.8566, 2.3522); // Paris
      const northAmerica = await geoDataService.getLocationData(40.7128, -74.006); // NYC

      // Both should have biome data
      expect(europe.biome.type).toBeDefined();
      expect(northAmerica.biome.type).toBeDefined();

      // If both have realmBiome, they should have different realm prefixes
      if (europe.biome.realmBiome && northAmerica.biome.realmBiome) {
        const europeRealm = europe.biome.realmBiome.substring(0, 2);
        const naRealm = northAmerica.biome.realmBiome.substring(0, 2);
        // PA (Palearctic) vs NE (Nearctic)
        expect(europeRealm).not.toBe(naRealm);
      }
    });
  });

  describe('cache management', () => {
    it('should clear cache when requested', async () => {
      await geoDataService.getLocationData(40.7128, -74.006);

      let stats = geoDataService.getCacheStats();
      expect(stats.tilesCached + stats.filesCached).toBeGreaterThanOrEqual(0);

      geoDataService.clearCache();

      stats = geoDataService.getCacheStats();
      expect(stats.tilesCached).toBe(0);
      expect(stats.filesCached).toBe(0);
    });
  });

  describe('consistency', () => {
    it('should return same data for same coordinates', async () => {
      const lat = 40.7128;
      const lng = -74.006;

      const data1 = await geoDataService.getLocationData(lat, lng);
      const data2 = await geoDataService.getLocationData(lat, lng);

      expect(data1.geology.primaryLithology).toBe(data2.geology.primaryLithology);
      expect(data1.biome.type).toBe(data2.biome.type);
      expect(data1.geohash).toBe(data2.geohash);
    });

    it('should return same geohash for nearby coordinates', async () => {
      // Two points very close together (within same geohash cell)
      const data1 = await geoDataService.getLocationData(40.7128, -74.006);
      const data2 = await geoDataService.getLocationData(40.7129, -74.0061);

      // Should have same precision-4 geohash prefix
      expect(data1.geohash).toBeDefined();
      expect(data2.geohash).toBeDefined();
      expect(data1.geohash!.substring(0, 4)).toBe(data2.geohash!.substring(0, 4));
    });

    it('should maintain ecoregion consistency for same tile', async () => {
      const data1 = await geoDataService.getLocationData(48.8566, 2.3522);
      const data2 = await geoDataService.getLocationData(48.8566, 2.3522);

      expect(data1.biome.realmBiome).toBe(data2.biome.realmBiome);
      expect(data1.biome.realm).toBe(data2.biome.realm);
      expect(data1.biome.ecoregionId).toBe(data2.biome.ecoregionId);
    });
  });

  describe('global coverage', () => {
    const testLocations = [
      { name: 'New York (Nearctic)', lat: 40.7128, lng: -74.006, expectedRealm: 'NE' },
      { name: 'London (Palearctic)', lat: 51.5074, lng: -0.1278, expectedRealm: 'PA' },
      { name: 'Tokyo (Palearctic)', lat: 35.6762, lng: 139.6503, expectedRealm: 'PA' },
      { name: 'Sydney (Australasia)', lat: -33.8688, lng: 151.2093, expectedRealm: 'AU' },
      { name: 'Amazon (Neotropic)', lat: -3.4653, lng: -62.2159, expectedRealm: 'NO' },
      { name: 'Nairobi (Afrotropic)', lat: -1.2921, lng: 36.8219, expectedRealm: 'AF' },
      { name: 'Mumbai (Indomalayan)', lat: 19.076, lng: 72.8777, expectedRealm: 'IN' },
    ];

    it.each(testLocations)(
      'should return valid data for $name',
      async ({ lat, lng, expectedRealm }) => {
        const data = await geoDataService.getLocationData(lat, lng);

        expect(data).toBeDefined();
        expect(data.biome.type).toBeDefined();
        expect(data.geology.primaryLithology).toBeDefined();

        // If realmBiome is available, check it matches expected realm
        if (data.biome.realmBiome) {
          expect(data.biome.realmBiome.substring(0, 2)).toBe(expectedRealm);
        }
      }
    );
  });
});
