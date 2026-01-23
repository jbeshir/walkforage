import {
  WOODS,
  WOODS_BY_ID,
  getWoodsByBiome,
  getWoodsByRealmBiome,
  getWoodsByRealm,
  getWoodsByCategory,
  getWoodedBiomes,
  getMappedRealmBiomes,
} from '../src/data/woods';

describe('Woods Data', () => {
  describe('WOODS array', () => {
    it('should contain wood entries', () => {
      expect(WOODS.length).toBeGreaterThan(0);
    });

    it('should contain approximately 66 species', () => {
      // We created 66 species for the ecoregion system
      expect(WOODS.length).toBeGreaterThanOrEqual(60);
      expect(WOODS.length).toBeLessThanOrEqual(70);
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
        // Rarity is now a separate field
        expect(wood.rarity).toBeGreaterThanOrEqual(0);
        expect(wood.rarity).toBeLessThanOrEqual(1);
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

    it('should have scientific names for most woods', () => {
      const withScientificName = WOODS.filter((w) => w.scientificName);
      expect(withScientificName.length).toBeGreaterThan(WOODS.length * 0.8);
    });

    it('should have nativeRealms for realm-specific woods', () => {
      const withRealms = WOODS.filter((w) => w.nativeRealms && w.nativeRealms.length > 0);
      expect(withRealms.length).toBeGreaterThan(WOODS.length * 0.9);
    });
  });

  describe('WOODS_BY_ID', () => {
    it('should contain entries for all woods', () => {
      expect(Object.keys(WOODS_BY_ID).length).toBe(WOODS.length);
    });

    it('should allow lookup by id for European Oak', () => {
      const oak = WOODS_BY_ID['european_oak'];
      expect(oak).toBeDefined();
      expect(oak.name).toBe('European Oak');
      expect(oak.category).toBe('hardwood');
      expect(oak.nativeRealms).toContain('Palearctic');
    });

    it('should allow lookup by id for American Oak', () => {
      const oak = WOODS_BY_ID['american_oak'];
      expect(oak).toBeDefined();
      expect(oak.name).toBe('American Oak');
      expect(oak.nativeRealms).toContain('Nearctic');
    });

    it('should return undefined for non-existent id', () => {
      const nonExistent = WOODS_BY_ID['nonexistent_wood'];
      expect(nonExistent).toBeUndefined();
    });

    it('should not contain generic oak (replaced by regional variants)', () => {
      expect(WOODS_BY_ID['oak']).toBeUndefined();
    });
  });

  describe('getWoodsByBiome', () => {
    it('should return woods for temperate_broadleaf_mixed biome', () => {
      const temperate = getWoodsByBiome('temperate_broadleaf_mixed');
      expect(temperate.length).toBeGreaterThan(0);
      temperate.forEach((wood) => {
        expect(wood.biomes).toContain('temperate_broadleaf_mixed');
      });
    });

    it('should return woods for boreal biome', () => {
      const boreal = getWoodsByBiome('boreal');
      expect(boreal.length).toBeGreaterThan(0);
      expect(boreal.some((w) => w.id === 'scots_pine')).toBe(true);
      expect(boreal.some((w) => w.id === 'norway_spruce')).toBe(true);
    });

    it('should return woods for tropical_moist_broadleaf biome', () => {
      const tropical = getWoodsByBiome('tropical_moist_broadleaf');
      expect(tropical.length).toBeGreaterThan(0);
      expect(tropical.some((w) => w.id === 'teak')).toBe(true);
      expect(tropical.some((w) => w.id === 'mahogany')).toBe(true);
    });

    it('should return empty array for non-existent biome', () => {
      const invalid = getWoodsByBiome('invalid_biome');
      expect(invalid).toEqual([]);
    });
  });

  describe('getWoodsByRealmBiome', () => {
    it('should return Palearctic temperate woods for PA04', () => {
      const woods = getWoodsByRealmBiome('PA04');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'european_oak')).toBe(true);
      expect(woods.some((w) => w.id === 'european_beech')).toBe(true);
    });

    it('should return Nearctic temperate woods for NE04', () => {
      const woods = getWoodsByRealmBiome('NE04');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'american_oak')).toBe(true);
      expect(woods.some((w) => w.id === 'sugar_maple')).toBe(true);
    });

    it('should return Neotropic tropical woods for NO01', () => {
      const woods = getWoodsByRealmBiome('NO01');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'mahogany')).toBe(true);
      expect(woods.some((w) => w.id === 'brazil_nut')).toBe(true);
    });

    it('should return Australasian woods for AU04', () => {
      const woods = getWoodsByRealmBiome('AU04');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'eucalyptus')).toBe(true);
      expect(woods.some((w) => w.id === 'blackwood')).toBe(true);
    });

    it('should return empty array for unmapped realm-biome', () => {
      const woods = getWoodsByRealmBiome('XX99');
      expect(woods).toEqual([]);
    });

    it('should not mix European and American oaks', () => {
      const palearctic = getWoodsByRealmBiome('PA04');
      const nearctic = getWoodsByRealmBiome('NE04');

      expect(palearctic.some((w) => w.id === 'european_oak')).toBe(true);
      expect(palearctic.some((w) => w.id === 'american_oak')).toBe(false);

      expect(nearctic.some((w) => w.id === 'american_oak')).toBe(true);
      expect(nearctic.some((w) => w.id === 'european_oak')).toBe(false);
    });
  });

  describe('getWoodsByRealm', () => {
    it('should return Palearctic woods', () => {
      const woods = getWoodsByRealm('Palearctic');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'european_oak')).toBe(true);
      expect(woods.some((w) => w.id === 'scots_pine')).toBe(true);
    });

    it('should return Nearctic woods', () => {
      const woods = getWoodsByRealm('Nearctic');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'american_oak')).toBe(true);
      expect(woods.some((w) => w.id === 'douglas_fir')).toBe(true);
    });

    it('should return Neotropic woods', () => {
      const woods = getWoodsByRealm('Neotropic');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'mahogany')).toBe(true);
      expect(woods.some((w) => w.id === 'balsa')).toBe(true);
    });

    it('should return Afrotropic woods', () => {
      const woods = getWoodsByRealm('Afrotropic');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'african_mahogany')).toBe(true);
      expect(woods.some((w) => w.id === 'baobab')).toBe(true);
    });

    it('should return Indomalayan woods', () => {
      const woods = getWoodsByRealm('Indomalayan');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'teak')).toBe(true);
      expect(woods.some((w) => w.id === 'sandalwood')).toBe(true);
    });

    it('should return Australasia woods', () => {
      const woods = getWoodsByRealm('Australasia');
      expect(woods.length).toBeGreaterThan(0);
      expect(woods.some((w) => w.id === 'eucalyptus')).toBe(true);
      expect(woods.some((w) => w.id === 'jarrah')).toBe(true);
    });

    it('should return empty array for non-existent realm', () => {
      const woods = getWoodsByRealm('InvalidRealm');
      expect(woods).toEqual([]);
    });
  });

  describe('getWoodsByCategory', () => {
    it('should return softwoods', () => {
      const softwoods = getWoodsByCategory('softwood');
      expect(softwoods.length).toBeGreaterThan(0);
      softwoods.forEach((wood) => {
        expect(wood.category).toBe('softwood');
      });
      expect(softwoods.some((w) => w.id === 'scots_pine')).toBe(true);
    });

    it('should return hardwoods', () => {
      const hardwoods = getWoodsByCategory('hardwood');
      expect(hardwoods.length).toBeGreaterThan(0);
      hardwoods.forEach((wood) => {
        expect(wood.category).toBe('hardwood');
      });
      expect(hardwoods.some((w) => w.id === 'european_oak')).toBe(true);
    });

    it('should return tropical woods', () => {
      const tropical = getWoodsByCategory('tropical');
      expect(tropical.length).toBeGreaterThan(0);
      expect(tropical.some((w) => w.id === 'teak')).toBe(true);
    });

    it('should return fruit woods', () => {
      const fruitWoods = getWoodsByCategory('fruit');
      expect(fruitWoods.length).toBeGreaterThan(0);
      expect(fruitWoods.some((w) => w.id === 'olive')).toBe(true);
      expect(fruitWoods.some((w) => w.id === 'black_walnut')).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      const invalid = getWoodsByCategory('invalid_category');
      expect(invalid).toEqual([]);
    });
  });

  describe('getWoodedBiomes', () => {
    it('should return all biomes with wood-producing trees', () => {
      const biomes = getWoodedBiomes();
      expect(biomes.length).toBeGreaterThan(0);
      expect(biomes).toContain('temperate_broadleaf_mixed');
      expect(biomes).toContain('boreal');
      expect(biomes).toContain('tropical_moist_broadleaf');
    });
  });

  describe('getMappedRealmBiomes', () => {
    it('should return all realm-biome codes with mappings', () => {
      const realmBiomes = getMappedRealmBiomes();
      expect(realmBiomes.length).toBeGreaterThan(0);
      expect(realmBiomes).toContain('PA04');
      expect(realmBiomes).toContain('NE04');
      expect(realmBiomes).toContain('NO01');
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
      const hasRareWood = tropical.some((w) => w.rarity < 0.1);
      expect(hasRareWood).toBe(true);
    });
  });

  describe('Regional differentiation', () => {
    it('should have different oak species for different continents', () => {
      const europeanOak = WOODS_BY_ID['european_oak'];
      const americanOak = WOODS_BY_ID['american_oak'];

      expect(europeanOak).toBeDefined();
      expect(americanOak).toBeDefined();
      expect(europeanOak.scientificName).not.toBe(americanOak.scientificName);
      expect(europeanOak.nativeRealms).not.toEqual(americanOak.nativeRealms);
    });

    it('should have different mahogany species for different continents', () => {
      const americanMahogany = WOODS_BY_ID['mahogany'];
      const africanMahogany = WOODS_BY_ID['african_mahogany'];

      expect(americanMahogany).toBeDefined();
      expect(africanMahogany).toBeDefined();
      expect(americanMahogany.nativeRealms).toContain('Neotropic');
      expect(africanMahogany.nativeRealms).toContain('Afrotropic');
    });

    it('should have Australia-specific species', () => {
      const eucalyptus = WOODS_BY_ID['eucalyptus'];
      const jarrah = WOODS_BY_ID['jarrah'];
      const kauri = WOODS_BY_ID['kauri'];

      expect(eucalyptus?.nativeRealms).toContain('Australasia');
      expect(jarrah?.nativeRealms).toContain('Australasia');
      expect(kauri?.nativeRealms).toContain('Australasia');
    });

    it('should have cosmopolitan species spanning multiple realms', () => {
      const willow = WOODS_BY_ID['willow'];
      const mangrove = WOODS_BY_ID['mangrove'];

      expect(willow?.nativeRealms?.length).toBeGreaterThan(1);
      expect(mangrove?.nativeRealms?.length).toBeGreaterThan(1);
    });
  });
});
