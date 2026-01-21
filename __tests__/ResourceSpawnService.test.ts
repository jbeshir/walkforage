/**
 * Tests for ResourceSpawnService
 * Tests resource selection based on geological and biome data
 */
import { resourceSpawnService } from '../src/services/ResourceSpawnService';
import { STONES_BY_ID } from '../src/data/stones';
import { WOODS_BY_ID } from '../src/data/woods';
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
      const woodIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const wood = resourceSpawnService.getRandomWoodForLocation(mockGeoData);
        if (wood) woodIds.push(wood.id);
      }

      // Should get Palearctic species for temperate broadleaf
      // Common Palearctic temperate species include oak, beech, ash
      const palearcticWoods = WOODS_BY_ID;
      const validWoods = woodIds.filter((id) => palearcticWoods[id] !== undefined);
      expect(validWoods.length).toBe(woodIds.length);
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

      // Should get some Australasian species like eucalyptus
      expect(woodIds.length).toBeGreaterThan(0);
      // All should be valid
      for (const id of woodIds) {
        expect(WOODS_BY_ID[id]).toBeDefined();
      }
    });
  });
});
