import {
  FOODS,
  FOODS_BY_ID,
  getFoodsByBiome,
  getFoodsByRealmBiome,
  getFoodsByRealm,
  getFoodsByCategory,
  getFoodBiomes,
  getMappedFoodRealmBiomes,
} from '../src/data/foods';

describe('Foods Data', () => {
  describe('FOODS array', () => {
    it('should contain food entries', () => {
      expect(FOODS.length).toBeGreaterThan(0);
    });

    it('should contain approximately 55 species', () => {
      // We created ~55 species for the ecoregion system
      expect(FOODS.length).toBeGreaterThanOrEqual(50);
      expect(FOODS.length).toBeLessThanOrEqual(60);
    });

    it('should have unique ids for all foods', () => {
      const ids = FOODS.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have empty properties for all foods', () => {
      FOODS.forEach((food) => {
        expect(Object.keys(food.properties).length).toBe(0);
      });
    });

    it('should have valid rarity values', () => {
      FOODS.forEach((food) => {
        expect(food.rarity).toBeGreaterThanOrEqual(0);
        expect(food.rarity).toBeLessThanOrEqual(1);
      });
    });

    it('should have valid categories for all foods', () => {
      const validCategories = ['berry', 'fruit', 'nut', 'greens', 'root'];
      FOODS.forEach((food) => {
        expect(validCategories).toContain(food.category);
      });
    });

    it('should have at least one biome for each food', () => {
      FOODS.forEach((food) => {
        expect(food.biomes.length).toBeGreaterThan(0);
      });
    });

    it('should have valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      FOODS.forEach((food) => {
        expect(food.color).toMatch(hexColorRegex);
      });
    });

    it('should have scientific names for most foods', () => {
      const withScientificName = FOODS.filter((f) => f.scientificName);
      expect(withScientificName.length).toBeGreaterThan(FOODS.length * 0.8);
    });

    it('should have nativeRealms for realm-specific foods', () => {
      const withRealms = FOODS.filter((f) => f.nativeRealms && f.nativeRealms.length > 0);
      expect(withRealms.length).toBeGreaterThan(FOODS.length * 0.9);
    });
  });

  describe('FOODS_BY_ID', () => {
    it('should contain entries for all foods', () => {
      expect(Object.keys(FOODS_BY_ID).length).toBe(FOODS.length);
    });

    it('should allow lookup by id for Wild Garlic', () => {
      const garlic = FOODS_BY_ID['wild_garlic'];
      expect(garlic).toBeDefined();
      expect(garlic.name).toBe('Wild Garlic');
      expect(garlic.category).toBe('greens');
      expect(garlic.nativeRealms).toContain('Palearctic');
    });

    it('should allow lookup by id for Açaí', () => {
      const acai = FOODS_BY_ID['acai'];
      expect(acai).toBeDefined();
      expect(acai.name).toBe('Açaí');
      expect(acai.nativeRealms).toContain('Neotropic');
    });

    it('should return undefined for non-existent id', () => {
      const nonExistent = FOODS_BY_ID['nonexistent_food'];
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('getFoodsByBiome', () => {
    it('should return foods for temperate_broadleaf_mixed biome', () => {
      const temperate = getFoodsByBiome('temperate_broadleaf_mixed');
      expect(temperate.length).toBeGreaterThan(0);
      temperate.forEach((food) => {
        expect(food.biomes).toContain('temperate_broadleaf_mixed');
      });
    });

    it('should return foods for tropical_moist_broadleaf biome', () => {
      const tropical = getFoodsByBiome('tropical_moist_broadleaf');
      expect(tropical.length).toBeGreaterThan(0);
      expect(tropical.some((f) => f.id === 'acai')).toBe(true);
      expect(tropical.some((f) => f.id === 'durian')).toBe(true);
    });

    it('should return foods for boreal biome', () => {
      const boreal = getFoodsByBiome('boreal');
      expect(boreal.length).toBeGreaterThan(0);
      expect(boreal.some((f) => f.id === 'bilberry')).toBe(true);
      expect(boreal.some((f) => f.id === 'lingonberry')).toBe(true);
    });

    it('should return empty array for non-existent biome', () => {
      const invalid = getFoodsByBiome('invalid_biome');
      expect(invalid).toEqual([]);
    });
  });

  describe('getFoodsByRealmBiome', () => {
    it('should return Palearctic temperate foods for PA04', () => {
      const foods = getFoodsByRealmBiome('PA04');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'wild_garlic')).toBe(true);
      expect(foods.some((f) => f.id === 'elderberry')).toBe(true);
    });

    it('should return Nearctic temperate foods for NE04', () => {
      const foods = getFoodsByRealmBiome('NE04');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'blueberry')).toBe(true);
      expect(foods.some((f) => f.id === 'pawpaw')).toBe(true);
    });

    it('should return Neotropic tropical foods for NO01', () => {
      const foods = getFoodsByRealmBiome('NO01');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'acai')).toBe(true);
      expect(foods.some((f) => f.id === 'brazil_nut_food')).toBe(true);
    });

    it('should return Australasian foods for AU04', () => {
      const foods = getFoodsByRealmBiome('AU04');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'davidson_plum')).toBe(true);
      expect(foods.some((f) => f.id === 'macadamia')).toBe(true);
    });

    it('should return empty array for unmapped realm-biome', () => {
      const foods = getFoodsByRealmBiome('XX99');
      expect(foods).toEqual([]);
    });

    it('should not mix Palearctic and Nearctic berries', () => {
      const palearctic = getFoodsByRealmBiome('PA04');
      const nearctic = getFoodsByRealmBiome('NE04');

      // Wild strawberry PA should be in Palearctic
      expect(palearctic.some((f) => f.id === 'wild_strawberry_pa')).toBe(true);
      expect(palearctic.some((f) => f.id === 'wild_strawberry_ne')).toBe(false);

      // Virginia strawberry should be in Nearctic
      expect(nearctic.some((f) => f.id === 'wild_strawberry_ne')).toBe(true);
      expect(nearctic.some((f) => f.id === 'wild_strawberry_pa')).toBe(false);
    });
  });

  describe('getFoodsByRealm', () => {
    it('should return Palearctic foods', () => {
      const foods = getFoodsByRealm('Palearctic');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'wild_garlic')).toBe(true);
      expect(foods.some((f) => f.id === 'bilberry')).toBe(true);
    });

    it('should return Nearctic foods', () => {
      const foods = getFoodsByRealm('Nearctic');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'blueberry')).toBe(true);
      expect(foods.some((f) => f.id === 'pawpaw')).toBe(true);
    });

    it('should return Neotropic foods', () => {
      const foods = getFoodsByRealm('Neotropic');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'acai')).toBe(true);
      expect(foods.some((f) => f.id === 'passion_fruit')).toBe(true);
    });

    it('should return Afrotropic foods', () => {
      const foods = getFoodsByRealm('Afrotropic');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'baobab_fruit')).toBe(true);
      expect(foods.some((f) => f.id === 'moringa')).toBe(true);
    });

    it('should return Indomalayan foods', () => {
      const foods = getFoodsByRealm('Indomalayan');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'durian')).toBe(true);
      expect(foods.some((f) => f.id === 'mangosteen')).toBe(true);
    });

    it('should return Australasia foods', () => {
      const foods = getFoodsByRealm('Australasia');
      expect(foods.length).toBeGreaterThan(0);
      expect(foods.some((f) => f.id === 'quandong')).toBe(true);
      expect(foods.some((f) => f.id === 'kakadu_plum')).toBe(true);
    });

    it('should return empty array for non-existent realm', () => {
      const foods = getFoodsByRealm('InvalidRealm');
      expect(foods).toEqual([]);
    });
  });

  describe('getFoodsByCategory', () => {
    it('should return berries', () => {
      const berries = getFoodsByCategory('berry');
      expect(berries.length).toBeGreaterThan(0);
      berries.forEach((food) => {
        expect(food.category).toBe('berry');
      });
      expect(berries.some((f) => f.id === 'blueberry')).toBe(true);
      expect(berries.some((f) => f.id === 'elderberry')).toBe(true);
    });

    it('should return fruits', () => {
      const fruits = getFoodsByCategory('fruit');
      expect(fruits.length).toBeGreaterThan(0);
      fruits.forEach((food) => {
        expect(food.category).toBe('fruit');
      });
      expect(fruits.some((f) => f.id === 'pawpaw')).toBe(true);
    });

    it('should return nuts', () => {
      const nuts = getFoodsByCategory('nut');
      expect(nuts.length).toBeGreaterThan(0);
      nuts.forEach((food) => {
        expect(food.category).toBe('nut');
      });
      expect(nuts.some((f) => f.id === 'hazelnut')).toBe(true);
      expect(nuts.some((f) => f.id === 'macadamia')).toBe(true);
    });

    it('should return greens', () => {
      const greens = getFoodsByCategory('greens');
      expect(greens.length).toBeGreaterThan(0);
      greens.forEach((food) => {
        expect(food.category).toBe('greens');
      });
      expect(greens.some((f) => f.id === 'wild_garlic')).toBe(true);
      expect(greens.some((f) => f.id === 'moringa')).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      const invalid = getFoodsByCategory('invalid_category');
      expect(invalid).toEqual([]);
    });
  });

  describe('getFoodBiomes', () => {
    it('should return all biomes with forageable foods', () => {
      const biomes = getFoodBiomes();
      expect(biomes.length).toBeGreaterThan(0);
      expect(biomes).toContain('temperate_broadleaf_mixed');
      expect(biomes).toContain('tropical_moist_broadleaf');
      expect(biomes).toContain('boreal');
    });
  });

  describe('getMappedFoodRealmBiomes', () => {
    it('should return all realm-biome codes with mappings', () => {
      const realmBiomes = getMappedFoodRealmBiomes();
      expect(realmBiomes.length).toBeGreaterThan(0);
      expect(realmBiomes).toContain('PA04');
      expect(realmBiomes).toContain('NE04');
      expect(realmBiomes).toContain('NO01');
    });
  });

  describe('Regional differentiation', () => {
    it('should have different strawberry species for different continents', () => {
      const wildStrawberryPa = FOODS_BY_ID['wild_strawberry_pa'];
      const wildStrawberryNe = FOODS_BY_ID['wild_strawberry_ne'];

      expect(wildStrawberryPa).toBeDefined();
      expect(wildStrawberryNe).toBeDefined();
      expect(wildStrawberryPa.scientificName).not.toBe(wildStrawberryNe.scientificName);
      expect(wildStrawberryPa.nativeRealms).not.toEqual(wildStrawberryNe.nativeRealms);
    });

    it('should have different elderberry species for different continents', () => {
      const elderberry = FOODS_BY_ID['elderberry'];
      const elderberryNe = FOODS_BY_ID['elderberry_ne'];

      expect(elderberry).toBeDefined();
      expect(elderberryNe).toBeDefined();
      expect(elderberry.nativeRealms).toContain('Palearctic');
      expect(elderberryNe.nativeRealms).toContain('Nearctic');
    });

    it('should have Australia-specific species', () => {
      const quandong = FOODS_BY_ID['quandong'];
      const kakadu = FOODS_BY_ID['kakadu_plum'];
      const fingerLime = FOODS_BY_ID['finger_lime'];

      expect(quandong?.nativeRealms).toContain('Australasia');
      expect(kakadu?.nativeRealms).toContain('Australasia');
      expect(fingerLime?.nativeRealms).toContain('Australasia');
    });
  });

  describe('Category distribution', () => {
    it('should have reasonable distribution across categories', () => {
      const berries = getFoodsByCategory('berry');
      const fruits = getFoodsByCategory('fruit');
      const nuts = getFoodsByCategory('nut');
      const greens = getFoodsByCategory('greens');

      // Each category should have at least 4 entries
      expect(berries.length).toBeGreaterThanOrEqual(4);
      expect(fruits.length).toBeGreaterThanOrEqual(4);
      expect(nuts.length).toBeGreaterThanOrEqual(4);
      expect(greens.length).toBeGreaterThanOrEqual(4);
    });
  });
});
