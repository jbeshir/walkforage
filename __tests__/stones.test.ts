import { STONES, STONES_BY_ID, getStonesByCategory, getToolstones } from '../src/data/stones';

describe('Stones Data', () => {
  describe('STONES array', () => {
    it('should contain exactly 35 stones', () => {
      // 34 original - 5 removed + 6 added = 35
      expect(STONES.length).toBe(35);
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
      const validCategories = ['sedimentary', 'igneous_plutonic', 'igneous_volcanic', 'metamorphic', 'ore'];
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
      expect(flint.category).toBe('sedimentary');
      expect(flint.isToolstone).toBe(true);
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
      const toolstones = getToolstones();
      expect(toolstones.length).toBe(5); // flint, chert, obsidian, greenstone, quartzite
      expect(toolstones.some((s) => s.id === 'flint')).toBe(true);
      expect(toolstones.some((s) => s.id === 'chert')).toBe(true);
      expect(toolstones.some((s) => s.id === 'obsidian')).toBe(true);
      expect(toolstones.some((s) => s.id === 'greenstone')).toBe(true);
      expect(toolstones.some((s) => s.id === 'quartzite')).toBe(true);
      toolstones.forEach((stone) => {
        expect(stone.isToolstone).toBe(true);
      });
    });

    it('should return empty array for invalid category', () => {
      const invalid = getStonesByCategory('invalid_category');
      expect(invalid).toEqual([]);
    });
  });

  describe('New stones (lithography review)', () => {
    it('should have greenstone as metamorphic toolstone', () => {
      const greenstone = STONES_BY_ID['greenstone'];
      expect(greenstone).toBeDefined();
      expect(greenstone.category).toBe('metamorphic');
      expect(greenstone.isToolstone).toBe(true);
      expect(greenstone.lithologies).toContain('greenstone');
    });

    it('should have soapstone as metamorphic carving stone', () => {
      const soapstone = STONES_BY_ID['soapstone'];
      expect(soapstone).toBeDefined();
      expect(soapstone.category).toBe('metamorphic');
      expect(soapstone.properties.workability).toBeGreaterThan(7); // easily carved
    });

    it('should have travertine as sedimentary building stone', () => {
      const travertine = STONES_BY_ID['travertine'];
      expect(travertine).toBeDefined();
      expect(travertine.category).toBe('sedimentary');
      expect(travertine.lithologies).toContain('travertine');
    });

    it('should have serpentinite as metamorphic stone', () => {
      const serpentinite = STONES_BY_ID['serpentinite'];
      expect(serpentinite).toBeDefined();
      expect(serpentinite.category).toBe('metamorphic');
      expect(serpentinite.lithologies).toContain('serpentinite');
    });

    it('should have diabase as igneous plutonic stone', () => {
      const diabase = STONES_BY_ID['diabase'];
      expect(diabase).toBeDefined();
      expect(diabase.category).toBe('igneous_plutonic');
      expect(diabase.lithologies).toContain('diabase');
    });

    it('should have pegmatite as igneous plutonic stone', () => {
      const pegmatite = STONES_BY_ID['pegmatite'];
      expect(pegmatite).toBeDefined();
      expect(pegmatite.category).toBe('igneous_plutonic');
      expect(pegmatite.lithologies).toContain('pegmatite');
    });

    it('should have removed novaculite, jasper, pumice, cassiterite, galena', () => {
      expect(STONES_BY_ID['novaculite']).toBeUndefined();
      expect(STONES_BY_ID['jasper']).toBeUndefined();
      expect(STONES_BY_ID['pumice']).toBeUndefined();
      expect(STONES_BY_ID['cassiterite']).toBeUndefined();
      expect(STONES_BY_ID['galena']).toBeUndefined();
    });

    it('should have quartzite marked as toolstone', () => {
      const quartzite = STONES_BY_ID['quartzite'];
      expect(quartzite).toBeDefined();
      expect(quartzite.isToolstone).toBe(true);
    });
  });

  describe('Toolstone coverage by lithology class', () => {
    it('should have sedimentary toolstones (flint, chert)', () => {
      const sedimentaryToolstones = getToolstones().filter(s => s.category === 'sedimentary');
      expect(sedimentaryToolstones.length).toBeGreaterThanOrEqual(2);
      expect(sedimentaryToolstones.some(s => s.id === 'flint')).toBe(true);
      expect(sedimentaryToolstones.some(s => s.id === 'chert')).toBe(true);
    });

    it('should have volcanic toolstone (obsidian)', () => {
      const volcanicToolstones = getToolstones().filter(s => s.category === 'igneous_volcanic');
      expect(volcanicToolstones.length).toBeGreaterThanOrEqual(1);
      expect(volcanicToolstones.some(s => s.id === 'obsidian')).toBe(true);
    });

    it('should have metamorphic toolstones (greenstone, quartzite)', () => {
      const metamorphicToolstones = getToolstones().filter(s => s.category === 'metamorphic');
      expect(metamorphicToolstones.length).toBeGreaterThanOrEqual(2);
      expect(metamorphicToolstones.some(s => s.id === 'greenstone')).toBe(true);
      expect(metamorphicToolstones.some(s => s.id === 'quartzite')).toBe(true);
    });
  });
});
