import {
  getQualityTier,
  calculateGatheringBonus,
  QUALITY_TIER_THRESHOLDS,
} from '../src/types/tools';
import { TOOLS } from '../src/data/tools';

describe('Tool Types', () => {
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
      expect(toolWithoutGathering).toBeDefined();
      expect(calculateGatheringBonus(toolWithoutGathering!, 0.5)).toBe(0);
    });

    it('should return 0 for quality 0 (no bonus at lowest quality)', () => {
      expect(gatheringToolWithBonus).toBeDefined();
      const bonus = calculateGatheringBonus(gatheringToolWithBonus!, 0);
      expect(bonus).toBe(0);
    });

    it('should return positive bonus for high quality gathering tools', () => {
      expect(gatheringToolWithBonus).toBeDefined();
      const bonus = calculateGatheringBonus(gatheringToolWithBonus!, 1.0);
      expect(bonus).toBeGreaterThan(0);
    });

    it('should scale linearly with quality', () => {
      expect(gatheringToolWithBonus).toBeDefined();
      const lowQuality = calculateGatheringBonus(gatheringToolWithBonus!, 0.25);
      const midQuality = calculateGatheringBonus(gatheringToolWithBonus!, 0.5);
      const highQuality = calculateGatheringBonus(gatheringToolWithBonus!, 1.0);
      // Mid quality should be half of high quality
      expect(midQuality).toBeCloseTo(highQuality / 2, 5);
      // Low quality should be quarter of high quality
      expect(lowQuality).toBeCloseTo(highQuality / 4, 5);
    });

    it('should return full base bonus at quality 1.0', () => {
      expect(gatheringToolWithBonus).toBeDefined();
      const bonus = calculateGatheringBonus(gatheringToolWithBonus!, 1.0);
      expect(bonus).toBe(gatheringToolWithBonus!.baseStats.gatheringBonus);
    });

    it('should return 0 for any quality when base bonus is 0', () => {
      // Tools without gatheringMaterial should return 0 bonus
      const toolWithNoGatheringMaterial = TOOLS.find((t) => !t.gatheringMaterial);
      expect(toolWithNoGatheringMaterial).toBeDefined();
      expect(calculateGatheringBonus(toolWithNoGatheringMaterial!, 0)).toBe(0);
      expect(calculateGatheringBonus(toolWithNoGatheringMaterial!, 0.5)).toBe(0);
      expect(calculateGatheringBonus(toolWithNoGatheringMaterial!, 1.0)).toBe(0);
    });
  });
});
