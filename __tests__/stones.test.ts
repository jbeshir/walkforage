import { STONES, STONES_BY_ID, getStonesByCategory } from '../src/data/stones';

describe('Stones Data', () => {
  describe('STONES array', () => {
    it('should contain stone entries', () => {
      expect(STONES.length).toBeGreaterThan(0);
    });

    it('should have unique ids for all stones', () => {
      const ids = STONES.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid property ranges for all stones', () => {
      STONES.forEach((stone) => {
        expect(stone.properties.hardness).toBeGreaterThanOrEqual(1);
        expect(stone.properties.hardness).toBeLessThanOrEqual(10);
        expect(stone.properties.workability).toBeGreaterThanOrEqual(1);
        expect(stone.properties.workability).toBeLessThanOrEqual(10);
        expect(stone.properties.durability).toBeGreaterThanOrEqual(1);
        expect(stone.properties.durability).toBeLessThanOrEqual(10);
        expect(stone.properties.rarity).toBeGreaterThanOrEqual(0);
        expect(stone.properties.rarity).toBeLessThanOrEqual(1);
      });
    });

    it('should have valid categories for all stones', () => {
      const validCategories = ['sedimentary', 'igneous', 'metamorphic', 'ore', 'toolstone'];
      STONES.forEach((stone) => {
        expect(validCategories).toContain(stone.category);
      });
    });
  });

  describe('STONES_BY_ID', () => {
    it('should contain entries for all stones', () => {
      expect(Object.keys(STONES_BY_ID).length).toBe(STONES.length);
    });

    it('should allow lookup by id', () => {
      const flint = STONES_BY_ID['flint'];
      expect(flint).toBeDefined();
      expect(flint.name).toBe('Flint');
      expect(flint.category).toBe('toolstone');
    });
  });

  describe('getStonesByCategory', () => {
    it('should return sedimentary stones', () => {
      const sedimentary = getStonesByCategory('sedimentary');
      expect(sedimentary.length).toBeGreaterThan(0);
      sedimentary.forEach((stone) => {
        expect(stone.category).toBe('sedimentary');
      });
    });

    it('should return toolstones', () => {
      const toolstones = getStonesByCategory('toolstone');
      expect(toolstones.length).toBeGreaterThan(0);
      expect(toolstones.some((s) => s.id === 'flint')).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      const invalid = getStonesByCategory('invalid_category');
      expect(invalid).toEqual([]);
    });
  });
});
