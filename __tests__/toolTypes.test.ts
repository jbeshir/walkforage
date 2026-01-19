import {
  ToolCategory,
  ComponentCategory,
  MaterialRequirements,
  UsedMaterials,
  QualityTier,
  getQualityTier,
  calculateGatheringBonus,
  QUALITY_TIER_THRESHOLDS,
} from '../src/types/tools';
import { LithicEra } from '../src/types/tech';
import { TOOLS } from '../src/data/tools';

describe('Tool Types', () => {
  describe('LithicEra type', () => {
    it('should have valid lithic era values', () => {
      const validEras: LithicEra[] = [
        'lower_paleolithic',
        'middle_paleolithic',
        'upper_paleolithic',
        'mesolithic',
      ];
      expect(validEras.length).toBe(4);
    });
  });

  describe('ToolCategory type', () => {
    it('should have valid tool categories for lithic era', () => {
      const validCategories: ToolCategory[] = [
        'knapping',
        'woodworking',
        'foraging',
        'cutting',
        'general',
      ];
      expect(validCategories.length).toBe(5);
    });
  });

  describe('ComponentCategory type', () => {
    it('should have valid component categories', () => {
      const validCategories: ComponentCategory[] = ['handle', 'binding'];
      expect(validCategories.length).toBe(2);
    });
  });

  describe('MaterialRequirements interface', () => {
    it('should accept valid stone material requirement', () => {
      const req: MaterialRequirements = {
        stone: { quantity: 2, requiresToolstone: true },
      };
      expect(req.stone?.quantity).toBe(2);
      expect(req.stone?.requiresToolstone).toBe(true);
    });

    it('should accept valid wood material requirement', () => {
      const req: MaterialRequirements = {
        wood: { quantity: 1 },
      };
      expect(req.wood?.quantity).toBe(1);
    });

    it('should accept both stone and wood requirements', () => {
      const req: MaterialRequirements = {
        stone: { quantity: 5 },
        wood: { quantity: 3 },
      };
      expect(req.stone?.quantity).toBe(5);
      expect(req.wood?.quantity).toBe(3);
    });
  });

  describe('UsedMaterials interface', () => {
    it('should accept stone-only materials', () => {
      const materials: UsedMaterials = {
        stoneId: 'flint',
        stoneQuantity: 2,
      };
      expect(materials.stoneId).toBe('flint');
      expect(materials.stoneQuantity).toBe(2);
      expect(materials.woodId).toBeUndefined();
    });

    it('should accept wood-only materials', () => {
      const materials: UsedMaterials = {
        woodId: 'european_ash',
        woodQuantity: 1,
      };
      expect(materials.woodId).toBe('european_ash');
      expect(materials.woodQuantity).toBe(1);
      expect(materials.stoneId).toBeUndefined();
    });

    it('should accept combined materials', () => {
      const materials: UsedMaterials = {
        stoneId: 'obsidian',
        stoneQuantity: 1,
        woodId: 'european_ash',
        woodQuantity: 1,
      };
      expect(materials.stoneId).toBe('obsidian');
      expect(materials.woodId).toBe('european_ash');
    });
  });

  describe('QualityTier type', () => {
    it('should have valid quality tier values', () => {
      const validTiers: QualityTier[] = ['poor', 'adequate', 'good', 'excellent', 'masterwork'];
      expect(validTiers.length).toBe(5);
    });
  });

  describe('getQualityTier function', () => {
    it('should return poor for low quality scores', () => {
      expect(getQualityTier(0)).toBe('poor');
      expect(getQualityTier(0.1)).toBe('poor');
      expect(getQualityTier(0.19)).toBe('poor');
    });

    it('should return adequate for scores between 0.2 and 0.4', () => {
      expect(getQualityTier(0.2)).toBe('adequate');
      expect(getQualityTier(0.3)).toBe('adequate');
      expect(getQualityTier(0.39)).toBe('adequate');
    });

    it('should return good for scores between 0.4 and 0.6', () => {
      expect(getQualityTier(0.4)).toBe('good');
      expect(getQualityTier(0.5)).toBe('good');
      expect(getQualityTier(0.59)).toBe('good');
    });

    it('should return excellent for scores between 0.6 and 0.8', () => {
      expect(getQualityTier(0.6)).toBe('excellent');
      expect(getQualityTier(0.7)).toBe('excellent');
      expect(getQualityTier(0.79)).toBe('excellent');
    });

    it('should return masterwork for scores 0.8 and above', () => {
      expect(getQualityTier(0.8)).toBe('masterwork');
      expect(getQualityTier(0.9)).toBe('masterwork');
      expect(getQualityTier(1.0)).toBe('masterwork');
    });
  });

  describe('QUALITY_TIER_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(QUALITY_TIER_THRESHOLDS.poor).toBe(0.2);
      expect(QUALITY_TIER_THRESHOLDS.adequate).toBe(0.4);
      expect(QUALITY_TIER_THRESHOLDS.good).toBe(0.6);
      expect(QUALITY_TIER_THRESHOLDS.excellent).toBe(0.8);
      expect(QUALITY_TIER_THRESHOLDS.masterwork).toBe(1.0);
    });
  });

  describe('calculateGatheringBonus function', () => {
    // Find a gathering tool with base bonus > 0 for meaningful tests
    const gatheringToolWithBonus = TOOLS.find(
      (t) => t.gatheringMaterial && t.baseStats.gatheringBonus > 0
    );

    it('should return 0 for tools without gathering material', () => {
      const toolWithoutGathering = TOOLS.find((t) => !t.gatheringMaterial);
      if (toolWithoutGathering) {
        expect(calculateGatheringBonus(toolWithoutGathering, 0.5)).toBe(0);
      }
    });

    it('should return 0 for quality 0 (no bonus at lowest quality)', () => {
      if (gatheringToolWithBonus) {
        const bonus = calculateGatheringBonus(gatheringToolWithBonus, 0);
        expect(bonus).toBe(0);
      }
    });

    it('should return positive bonus for high quality gathering tools', () => {
      if (gatheringToolWithBonus) {
        const bonus = calculateGatheringBonus(gatheringToolWithBonus, 1.0);
        expect(bonus).toBeGreaterThan(0);
      }
    });

    it('should scale linearly with quality', () => {
      if (gatheringToolWithBonus) {
        const lowQuality = calculateGatheringBonus(gatheringToolWithBonus, 0.25);
        const midQuality = calculateGatheringBonus(gatheringToolWithBonus, 0.5);
        const highQuality = calculateGatheringBonus(gatheringToolWithBonus, 1.0);
        // Mid quality should be half of high quality
        expect(midQuality).toBeCloseTo(highQuality / 2, 5);
        // Low quality should be quarter of high quality
        expect(lowQuality).toBeCloseTo(highQuality / 4, 5);
      }
    });

    it('should return full base bonus at quality 1.0', () => {
      if (gatheringToolWithBonus) {
        const bonus = calculateGatheringBonus(gatheringToolWithBonus, 1.0);
        expect(bonus).toBe(gatheringToolWithBonus.baseStats.gatheringBonus);
      }
    });

    it('should return 0 for any quality when base bonus is 0', () => {
      // Tools without gatheringMaterial should return 0 bonus
      const toolWithNoGatheringMaterial = TOOLS.find((t) => !t.gatheringMaterial);
      if (toolWithNoGatheringMaterial) {
        expect(calculateGatheringBonus(toolWithNoGatheringMaterial, 0)).toBe(0);
        expect(calculateGatheringBonus(toolWithNoGatheringMaterial, 0.5)).toBe(0);
        expect(calculateGatheringBonus(toolWithNoGatheringMaterial, 1.0)).toBe(0);
      }
    });
  });
});
