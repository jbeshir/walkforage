import {
  MaterialTier,
  TIER_ORDER,
  compareTiers,
  isTierAtLeast,
  QUALITY_MULTIPLIERS,
} from '../src/types/tools';

describe('Tool Types Utilities', () => {
  describe('TIER_ORDER', () => {
    it('should contain all material tiers', () => {
      expect(TIER_ORDER).toContain('primitive');
      expect(TIER_ORDER).toContain('stone');
      expect(TIER_ORDER).toContain('copper');
      expect(TIER_ORDER).toContain('bronze');
      expect(TIER_ORDER).toContain('iron');
      expect(TIER_ORDER).toContain('steel');
    });

    it('should have exactly 6 tiers', () => {
      expect(TIER_ORDER.length).toBe(6);
    });

    it('should be in correct progression order', () => {
      expect(TIER_ORDER[0]).toBe('primitive');
      expect(TIER_ORDER[1]).toBe('stone');
      expect(TIER_ORDER[2]).toBe('copper');
      expect(TIER_ORDER[3]).toBe('bronze');
      expect(TIER_ORDER[4]).toBe('iron');
      expect(TIER_ORDER[5]).toBe('steel');
    });
  });

  describe('compareTiers', () => {
    it('should return 0 for same tier', () => {
      expect(compareTiers('primitive', 'primitive')).toBe(0);
      expect(compareTiers('stone', 'stone')).toBe(0);
      expect(compareTiers('copper', 'copper')).toBe(0);
      expect(compareTiers('bronze', 'bronze')).toBe(0);
      expect(compareTiers('iron', 'iron')).toBe(0);
      expect(compareTiers('steel', 'steel')).toBe(0);
    });

    it('should return negative when first tier is lower', () => {
      expect(compareTiers('primitive', 'stone')).toBeLessThan(0);
      expect(compareTiers('stone', 'copper')).toBeLessThan(0);
      expect(compareTiers('copper', 'bronze')).toBeLessThan(0);
      expect(compareTiers('bronze', 'iron')).toBeLessThan(0);
      expect(compareTiers('iron', 'steel')).toBeLessThan(0);
    });

    it('should return positive when first tier is higher', () => {
      expect(compareTiers('stone', 'primitive')).toBeGreaterThan(0);
      expect(compareTiers('copper', 'stone')).toBeGreaterThan(0);
      expect(compareTiers('bronze', 'copper')).toBeGreaterThan(0);
      expect(compareTiers('iron', 'bronze')).toBeGreaterThan(0);
      expect(compareTiers('steel', 'iron')).toBeGreaterThan(0);
    });

    it('should handle multi-step differences', () => {
      expect(compareTiers('primitive', 'steel')).toBeLessThan(0);
      expect(compareTiers('steel', 'primitive')).toBeGreaterThan(0);
      expect(compareTiers('stone', 'iron')).toBeLessThan(0);
      expect(compareTiers('iron', 'stone')).toBeGreaterThan(0);
    });

    it('should return correct index difference', () => {
      // primitive (0) vs steel (5) = -5
      expect(compareTiers('primitive', 'steel')).toBe(-5);
      // steel (5) vs primitive (0) = 5
      expect(compareTiers('steel', 'primitive')).toBe(5);
      // stone (1) vs bronze (3) = -2
      expect(compareTiers('stone', 'bronze')).toBe(-2);
    });
  });

  describe('isTierAtLeast', () => {
    it('should return true when tier equals required', () => {
      expect(isTierAtLeast('primitive', 'primitive')).toBe(true);
      expect(isTierAtLeast('stone', 'stone')).toBe(true);
      expect(isTierAtLeast('copper', 'copper')).toBe(true);
      expect(isTierAtLeast('bronze', 'bronze')).toBe(true);
      expect(isTierAtLeast('iron', 'iron')).toBe(true);
      expect(isTierAtLeast('steel', 'steel')).toBe(true);
    });

    it('should return true when tier exceeds required', () => {
      expect(isTierAtLeast('stone', 'primitive')).toBe(true);
      expect(isTierAtLeast('copper', 'stone')).toBe(true);
      expect(isTierAtLeast('bronze', 'copper')).toBe(true);
      expect(isTierAtLeast('iron', 'bronze')).toBe(true);
      expect(isTierAtLeast('steel', 'iron')).toBe(true);
    });

    it('should return false when tier is below required', () => {
      expect(isTierAtLeast('primitive', 'stone')).toBe(false);
      expect(isTierAtLeast('stone', 'copper')).toBe(false);
      expect(isTierAtLeast('copper', 'bronze')).toBe(false);
      expect(isTierAtLeast('bronze', 'iron')).toBe(false);
      expect(isTierAtLeast('iron', 'steel')).toBe(false);
    });

    it('should handle multi-step comparisons', () => {
      expect(isTierAtLeast('steel', 'primitive')).toBe(true);
      expect(isTierAtLeast('primitive', 'steel')).toBe(false);
      expect(isTierAtLeast('iron', 'stone')).toBe(true);
      expect(isTierAtLeast('stone', 'iron')).toBe(false);
    });

    it('should work for typical tool requirement checks', () => {
      // Stone knife requires hammerstone (primitive tier)
      expect(isTierAtLeast('primitive', 'primitive')).toBe(true);
      expect(isTierAtLeast('stone', 'primitive')).toBe(true);

      // Copper tools require stone hammer (stone tier)
      expect(isTierAtLeast('stone', 'stone')).toBe(true);
      expect(isTierAtLeast('copper', 'stone')).toBe(true);
      expect(isTierAtLeast('primitive', 'stone')).toBe(false);

      // Iron tools require bronze hammer (bronze tier)
      expect(isTierAtLeast('bronze', 'bronze')).toBe(true);
      expect(isTierAtLeast('iron', 'bronze')).toBe(true);
      expect(isTierAtLeast('copper', 'bronze')).toBe(false);
    });
  });

  describe('QUALITY_MULTIPLIERS', () => {
    it('should have all quality levels', () => {
      expect(QUALITY_MULTIPLIERS).toHaveProperty('poor');
      expect(QUALITY_MULTIPLIERS).toHaveProperty('normal');
      expect(QUALITY_MULTIPLIERS).toHaveProperty('good');
      expect(QUALITY_MULTIPLIERS).toHaveProperty('excellent');
    });

    it('should have correct multiplier values', () => {
      expect(QUALITY_MULTIPLIERS.poor).toBe(0.75);
      expect(QUALITY_MULTIPLIERS.normal).toBe(1.0);
      expect(QUALITY_MULTIPLIERS.good).toBe(1.25);
      expect(QUALITY_MULTIPLIERS.excellent).toBe(1.5);
    });

    it('should have increasing multipliers for better quality', () => {
      expect(QUALITY_MULTIPLIERS.poor).toBeLessThan(QUALITY_MULTIPLIERS.normal);
      expect(QUALITY_MULTIPLIERS.normal).toBeLessThan(QUALITY_MULTIPLIERS.good);
      expect(QUALITY_MULTIPLIERS.good).toBeLessThan(QUALITY_MULTIPLIERS.excellent);
    });

    it('normal quality should have 1.0 multiplier (baseline)', () => {
      expect(QUALITY_MULTIPLIERS.normal).toBe(1.0);
    });
  });

  describe('Type definitions consistency', () => {
    it('MaterialTier type should match TIER_ORDER values', () => {
      // This is more of a type-level test - verify all TIER_ORDER elements
      // can be used as MaterialTier
      const tiers: MaterialTier[] = [...TIER_ORDER];
      expect(tiers.length).toBe(6);
    });
  });
});
