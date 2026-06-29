/**
 * Tests for ResourceSpawnService
 * Tests resource selection based on geological and biome data
 */
import { resourceSpawnService } from '../src/services/ResourceSpawnService';
import { STONES_BY_ID } from '../src/data/stones';
import { WOODS_BY_ID } from '../src/data/woods';
import { getRealmBiomeCode } from '../src/data/gis/mappings';
import { LocationGeoData } from '../src/types/gis';

describe('ResourceSpawnService', () => {
  describe('getToolstones', () => {
    it('should return toolstone types', () => {
      const toolstones = resourceSpawnService.getToolstones();

      expect(toolstones).toBeInstanceOf(Array);
      expect(toolstones.length).toBeGreaterThan(0);

      // All returned stones should have isToolstone flag
      for (const stone of toolstones) {
        expect(stone.isToolstone).toBe(true);
      }
    });

    it('should include known toolstones', () => {
      const toolstones = resourceSpawnService.getToolstones();
      const toolstoneIds = toolstones.map((s) => s.id);

      // These should be marked as toolstones
      expect(toolstoneIds).toContain('flint');
      expect(toolstoneIds).toContain('chert');
      expect(toolstoneIds).toContain('obsidian');
    });
  });

  describe('getRandomStone', () => {
    it('should return a valid stone', () => {
      const stone = resourceSpawnService.getRandomStone();

      expect(stone).toBeDefined();
      expect(stone.id).toBeDefined();
      expect(STONES_BY_ID[stone.id]).toBeDefined();
    });

    it('should return different stones over multiple calls', () => {
      const stoneIds = new Set<string>();

      // Run many times to get variety
      for (let i = 0; i < 50; i++) {
        const stone = resourceSpawnService.getRandomStone();
        stoneIds.add(stone.id);
      }

      // Should have gotten multiple different stones
      expect(stoneIds.size).toBeGreaterThan(1);
    });
  });

  describe('getRandomWood', () => {
    it('should return a valid wood', () => {
      const wood = resourceSpawnService.getRandomWood();

      expect(wood).toBeDefined();
      expect(wood.id).toBeDefined();
      expect(WOODS_BY_ID[wood.id]).toBeDefined();
    });

    it('should return different woods over multiple calls', () => {
      const woodIds = new Set<string>();

      // Run many times to get variety
      for (let i = 0; i < 50; i++) {
        const wood = resourceSpawnService.getRandomWood();
        woodIds.add(wood.id);
      }

      // Should have gotten multiple different woods
      expect(woodIds.size).toBeGreaterThan(1);
    });
  });

  describe('getRandomStoneForLocation', () => {
    const mockGeoData: LocationGeoData = {
      geology: {
        primaryLithology: 'chalk',
        secondaryLithologies: ['limestone'],
        confidence: 0.8,
      },
      biome: {
        type: 'temperate_broadleaf_mixed',
        realm: 'Palearctic',
        confidence: 0.8,
      },
      dataSource: 'detailed',
      geohash: 'gcpv',
    };

    it('should return a valid stone for location', () => {
      const stone = resourceSpawnService.getRandomStoneForLocation(mockGeoData);

      expect(stone).toBeDefined();
      expect(stone!.id).toBeDefined();
      expect(STONES_BY_ID[stone!.id]).toBeDefined();
    });

    it('should prefer stones matching the geology', () => {
      // Chalk should give flint more often
      const stoneIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const stone = resourceSpawnService.getRandomStoneForLocation(mockGeoData);
        if (stone) stoneIds.push(stone.id);
      }

      // Flint is commonly found in chalk
      const flintCount = stoneIds.filter((id) => id === 'flint').length;
      expect(flintCount).toBeGreaterThan(0);
    });

    it('should fall back to random when confidence is low', () => {
      const lowConfidenceGeo: LocationGeoData = {
        ...mockGeoData,
        geology: {
          ...mockGeoData.geology,
          confidence: 0.1,
        },
      };

      // Should still return valid stones
      const stone = resourceSpawnService.getRandomStoneForLocation(lowConfidenceGeo);
      expect(stone).toBeDefined();
      expect(STONES_BY_ID[stone!.id]).toBeDefined();
    });
  });

  describe('getRandomWoodForLocation', () => {
    const mockGeoData: LocationGeoData = {
      geology: {
        primaryLithology: 'granite',
        secondaryLithologies: [],
        confidence: 0.8,
      },
      biome: {
        type: 'temperate_broadleaf_mixed',
        realm: 'Palearctic',
        confidence: 0.8,
      },
      dataSource: 'detailed',
      geohash: 'gcpv',
    };

    it('should return a valid wood for location', () => {
      const wood = resourceSpawnService.getRandomWoodForLocation(mockGeoData);

      expect(wood).toBeDefined();
      expect(wood!.id).toBeDefined();
      expect(WOODS_BY_ID[wood!.id]).toBeDefined();
    });

    it('should prefer woods matching the biome and realm', () => {
      const palearcticTemperateWoodIds = [
        'european_oak',
        'european_beech',
        'silver_birch',
        'european_ash',
        'willow',
        'poplar',
      ];
      const palearcticTemperateWoods = new Set(palearcticTemperateWoodIds);
      const heavilyWeightedWoods = new Set([
        'european_oak',
        'european_beech',
        'silver_birch',
        'european_ash',
      ]);
      const woodIds: string[] = [];
      const draws = 1000;

      for (let i = 0; i < draws; i++) {
        const wood = resourceSpawnService.getRandomWoodForLocation(mockGeoData);
        if (wood) woodIds.push(wood.id);
      }

      const palearcticTemperateCount = woodIds.filter((id) =>
        palearcticTemperateWoods.has(id)
      ).length;
      const heavilyWeightedCount = woodIds.filter((id) => heavilyWeightedWoods.has(id)).length;

      // PA04 is mapped to these species with 80% of weight on oak/beech/birch/ash.
      expect(woodIds).toHaveLength(draws);
      expect(palearcticTemperateCount / draws).toBeGreaterThan(0.95);
      expect(heavilyWeightedCount / draws).toBeGreaterThan(0.65);
      for (const expectedWood of palearcticTemperateWoodIds) {
        expect(woodIds).toContain(expectedWood);
      }
    });

    it('should fall back to random when confidence is low', () => {
      const lowConfidenceGeo: LocationGeoData = {
        ...mockGeoData,
        biome: {
          ...mockGeoData.biome,
          confidence: 0.1,
        },
      };

      // Should still return valid woods
      const wood = resourceSpawnService.getRandomWoodForLocation(lowConfidenceGeo);
      expect(wood).toBeDefined();
      expect(WOODS_BY_ID[wood!.id]).toBeDefined();
    });

    it('should return woods appropriate for different realms', () => {
      const australasianGeo: LocationGeoData = {
        geology: {
          primaryLithology: 'sandstone',
          secondaryLithologies: [],
          confidence: 0.8,
        },
        biome: {
          type: 'mediterranean',
          realm: 'Australasia',
          confidence: 0.8,
        },
        dataSource: 'detailed',
        geohash: 'r3gx',
      };

      const woodIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const wood = resourceSpawnService.getRandomWoodForLocation(australasianGeo);
        if (wood) woodIds.push(wood.id);
      }

      // AU12 is mapped to jarrah, eucalyptus, and manuka.
      expect(woodIds.length).toBeGreaterThan(0);
      for (const id of woodIds) {
        expect(['jarrah', 'eucalyptus', 'manuka']).toContain(id);
      }
    });
  });

  describe('realmBiomes biome weighting', () => {
    const pa04GeoData: LocationGeoData = {
      geology: {
        primaryLithology: 'granite',
        secondaryLithologies: [],
        confidence: 0.8,
      },
      biome: {
        type: 'temperate_broadleaf_mixed',
        realm: 'Palearctic',
        confidence: 0.8,
      },
      dataSource: 'detailed',
      geohash: 'gcpv',
    };

    it('should build realm-biome codes for mapped realm and biome pairs', () => {
      expect(getRealmBiomeCode('Palearctic', 'temperate_broadleaf_mixed')).toBe('PA04');
      expect(getRealmBiomeCode('Nowhere', 'desert')).toBeNull();
    });

    it('should boost PA04 realmBiomes carriers without starving non-carriers', () => {
      const draws = 2000;
      const counts: Record<string, number> = {};

      for (let i = 0; i < draws; i++) {
        const wood = resourceSpawnService.getRandomWoodForLocation(pa04GeoData);
        if (wood) {
          counts[wood.id] = (counts[wood.id] ?? 0) + 1;
        }
      }

      const carrierCount =
        (counts.european_oak ?? 0) +
        (counts.european_beech ?? 0) +
        (counts.silver_birch ?? 0) +
        (counts.european_ash ?? 0);

      expect(counts.european_ash ?? 0).toBeGreaterThan((counts.willow ?? 0) + (counts.poplar ?? 0));
      expect(counts.willow ?? 0).toBeGreaterThan(0);
      expect(counts.poplar ?? 0).toBeGreaterThan(0);
      expect(carrierCount / draws).toBeGreaterThan(0.85);
    });
  });
});
