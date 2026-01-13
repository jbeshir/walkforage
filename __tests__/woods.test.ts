import { WOODS, WOODS_BY_ID, getWoodsByBiome, getWoodsByCategory } from '../src/data/woods';

describe('Woods Data', () => {
  describe('WOODS array', () => {
    it('should contain wood entries', () => {
      expect(WOODS.length).toBeGreaterThan(0);
    });

    it('should have unique ids for all woods', () => {
      const ids = WOODS.map((w) => w.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid property ranges for all woods', () => {
      WOODS.forEach((wood) => {
        expect(wood.properties.hardness).toBeGreaterThanOrEqual(1);
        expect(wood.properties.hardness).toBeLessThanOrEqual(10);
        expect(wood.properties.workability).toBeGreaterThanOrEqual(1);
        expect(wood.properties.workability).toBeLessThanOrEqual(10);
        expect(wood.properties.durability).toBeGreaterThanOrEqual(1);
        expect(wood.properties.durability).toBeLessThanOrEqual(10);
        expect(wood.properties.rarity).toBeGreaterThanOrEqual(0);
        expect(wood.properties.rarity).toBeLessThanOrEqual(1);
      });
    });

    it('should have valid categories for all woods', () => {
      const validCategories = ['softwood', 'hardwood', 'tropical', 'fruit'];
      WOODS.forEach((wood) => {
        expect(validCategories).toContain(wood.category);
      });
    });

    it('should have at least one biome for each wood', () => {
      WOODS.forEach((wood) => {
        expect(wood.biomes.length).toBeGreaterThan(0);
      });
    });

    it('should have valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      WOODS.forEach((wood) => {
        expect(wood.color).toMatch(hexColorRegex);
      });
    });
  });

  describe('WOODS_BY_ID', () => {
    it('should contain entries for all woods', () => {
      expect(Object.keys(WOODS_BY_ID).length).toBe(WOODS.length);
    });

    it('should allow lookup by id', () => {
      const oak = WOODS_BY_ID['oak'];
      expect(oak).toBeDefined();
      expect(oak.name).toBe('Oak');
      expect(oak.category).toBe('hardwood');
    });

    it('should return undefined for non-existent id', () => {
      const nonExistent = WOODS_BY_ID['nonexistent_wood'];
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('getWoodsByBiome', () => {
    it('should return woods for temperate_broadleaf biome', () => {
      const temperate = getWoodsByBiome('temperate_broadleaf');
      expect(temperate.length).toBeGreaterThan(0);
      temperate.forEach((wood) => {
        expect(wood.biomes).toContain('temperate_broadleaf');
      });
    });

    it('should return woods for boreal biome', () => {
      const boreal = getWoodsByBiome('boreal');
      expect(boreal.length).toBeGreaterThan(0);
      expect(boreal.some((w) => w.id === 'pine')).toBe(true);
      expect(boreal.some((w) => w.id === 'spruce')).toBe(true);
    });

    it('should return woods for tropical_moist biome', () => {
      const tropical = getWoodsByBiome('tropical_moist');
      expect(tropical.length).toBeGreaterThan(0);
      expect(tropical.some((w) => w.id === 'teak')).toBe(true);
      expect(tropical.some((w) => w.id === 'mahogany')).toBe(true);
    });

    it('should return empty array for non-existent biome', () => {
      const invalid = getWoodsByBiome('invalid_biome');
      expect(invalid).toEqual([]);
    });
  });

  describe('getWoodsByCategory', () => {
    it('should return softwoods', () => {
      const softwoods = getWoodsByCategory('softwood');
      expect(softwoods.length).toBeGreaterThan(0);
      softwoods.forEach((wood) => {
        expect(wood.category).toBe('softwood');
      });
      expect(softwoods.some((w) => w.id === 'pine')).toBe(true);
    });

    it('should return hardwoods', () => {
      const hardwoods = getWoodsByCategory('hardwood');
      expect(hardwoods.length).toBeGreaterThan(0);
      hardwoods.forEach((wood) => {
        expect(wood.category).toBe('hardwood');
      });
      expect(hardwoods.some((w) => w.id === 'oak')).toBe(true);
    });

    it('should return tropical woods', () => {
      const tropical = getWoodsByCategory('tropical');
      expect(tropical.length).toBeGreaterThan(0);
      expect(tropical.some((w) => w.id === 'teak')).toBe(true);
    });

    it('should return fruit woods', () => {
      const fruitWoods = getWoodsByCategory('fruit');
      expect(fruitWoods.length).toBeGreaterThan(0);
      expect(fruitWoods.some((w) => w.id === 'apple')).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      const invalid = getWoodsByCategory('invalid_category');
      expect(invalid).toEqual([]);
    });
  });

  describe('Wood property consistency', () => {
    it('should have hardwoods generally harder than softwoods', () => {
      const softwoods = getWoodsByCategory('softwood');
      const hardwoods = getWoodsByCategory('hardwood');

      const avgSoftwoodHardness =
        softwoods.reduce((sum, w) => sum + w.properties.hardness, 0) / softwoods.length;
      const avgHardwoodHardness =
        hardwoods.reduce((sum, w) => sum + w.properties.hardness, 0) / hardwoods.length;

      expect(avgHardwoodHardness).toBeGreaterThan(avgSoftwoodHardness);
    });

    it('should have tropical woods include rare specimens', () => {
      const tropical = getWoodsByCategory('tropical');
      const hasRareWood = tropical.some((w) => w.properties.rarity < 0.1);
      expect(hasRareWood).toBe(true);
    });
  });
});
