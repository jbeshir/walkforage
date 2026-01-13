import {
  calculateOfflineProduction,
  Building,
  PlacedBuilding,
  BuildingLevel,
} from '../src/types/village';

describe('Village Utilities', () => {
  // Helper to create test building definitions
  const createMockBuildingDef = (overrides?: Partial<Building>): Building => ({
    id: 'test_building',
    name: 'Test Building',
    category: 'production',
    description: 'A test building',
    requiredTech: 'stone_tools',
    buildCost: [{ resourceId: 'wood', quantity: 10 }],
    produces: 'test_resource',
    levels: [
      {
        level: 1,
        productionRate: 3600, // 1 per second (3600 per hour)
        storageCapacity: 100,
        workerSlots: 2,
        upgradeCost: [],
      },
      {
        level: 2,
        productionRate: 7200, // 2 per second (7200 per hour)
        storageCapacity: 200,
        workerSlots: 4,
        upgradeCost: [{ resourceId: 'wood', quantity: 20 }],
      },
    ],
    maxLevel: 2,
    icon: 'building',
    size: { width: 2, height: 2 },
    ...overrides,
  });

  // Helper to create test placed building
  const createMockPlacedBuilding = (overrides?: Partial<PlacedBuilding>): PlacedBuilding => ({
    id: 'placed_test',
    buildingId: 'test_building',
    level: 1,
    position: { x: 0, y: 0 },
    assignedWorkers: 2, // Full worker slots
    lastCollected: Date.now() - 3600 * 1000, // 1 hour ago
    accumulatedProduction: 0,
    ...overrides,
  });

  describe('calculateOfflineProduction', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return null for non-producing buildings', () => {
      const buildingDef = createMockBuildingDef({ produces: undefined });
      const placed = createMockPlacedBuilding();

      const result = calculateOfflineProduction(placed, buildingDef, 1.0);
      expect(result).toBeNull();
    });

    it('should calculate basic production for 1 hour offline', () => {
      const buildingDef = createMockBuildingDef();
      const oneHourAgo = Date.now() - 3600 * 1000;
      const placed = createMockPlacedBuilding({
        lastCollected: oneHourAgo,
        assignedWorkers: 2, // Full slots
      });

      const result = calculateOfflineProduction(placed, buildingDef, 1.0);

      expect(result).not.toBeNull();
      expect(result?.buildingId).toBe('placed_test');
      expect(result?.resourceId).toBe('test_resource');
      // 1 hour * 3600 per hour * 1.0 tool multiplier * 1.0 worker bonus = 3600
      expect(result?.amountProduced).toBe(3600);
      expect(result?.timeElapsed).toBeCloseTo(3600, 0);
    });

    it('should apply tool multiplier correctly', () => {
      const buildingDef = createMockBuildingDef();
      const oneHourAgo = Date.now() - 3600 * 1000;
      const placed = createMockPlacedBuilding({
        lastCollected: oneHourAgo,
        assignedWorkers: 2,
      });

      const result = calculateOfflineProduction(placed, buildingDef, 2.0);

      expect(result).not.toBeNull();
      // 1 hour * 3600 per hour * 2.0 tool multiplier * 1.0 worker bonus = 7200
      expect(result?.amountProduced).toBe(7200);
    });

    it('should apply worker bonus correctly', () => {
      const buildingDef = createMockBuildingDef();
      const oneHourAgo = Date.now() - 3600 * 1000;
      const placed = createMockPlacedBuilding({
        lastCollected: oneHourAgo,
        assignedWorkers: 1, // Half of worker slots (2)
      });

      const result = calculateOfflineProduction(placed, buildingDef, 1.0);

      expect(result).not.toBeNull();
      // 1 hour * 3600 per hour * 1.0 tool multiplier * 0.5 worker bonus = 1800
      expect(result?.amountProduced).toBe(1800);
    });

    it('should cap offline time at maxOfflineHours', () => {
      const buildingDef = createMockBuildingDef();
      const twoDaysAgo = Date.now() - 48 * 3600 * 1000; // 48 hours ago
      const placed = createMockPlacedBuilding({
        lastCollected: twoDaysAgo,
        assignedWorkers: 2,
      });

      // Default max is 24 hours
      const result = calculateOfflineProduction(placed, buildingDef, 1.0);

      expect(result).not.toBeNull();
      // Should be capped at 24 hours, not 48
      // 24 hours * 3600 per hour = 86400
      expect(result?.amountProduced).toBe(86400);
      expect(result?.timeElapsed).toBe(24 * 3600);
    });

    it('should respect custom maxOfflineHours', () => {
      const buildingDef = createMockBuildingDef();
      const twoDaysAgo = Date.now() - 48 * 3600 * 1000;
      const placed = createMockPlacedBuilding({
        lastCollected: twoDaysAgo,
        assignedWorkers: 2,
      });

      // Custom max of 12 hours
      const result = calculateOfflineProduction(placed, buildingDef, 1.0, 12);

      expect(result).not.toBeNull();
      // 12 hours * 3600 per hour = 43200
      expect(result?.amountProduced).toBe(43200);
      expect(result?.timeElapsed).toBe(12 * 3600);
    });

    it('should use correct production rate for building level', () => {
      const buildingDef = createMockBuildingDef();
      const oneHourAgo = Date.now() - 3600 * 1000;
      const placed = createMockPlacedBuilding({
        lastCollected: oneHourAgo,
        level: 2,
        assignedWorkers: 4, // Full slots for level 2
      });

      const result = calculateOfflineProduction(placed, buildingDef, 1.0);

      expect(result).not.toBeNull();
      // Level 2 has 7200 per hour rate
      // 1 hour * 7200 per hour * 1.0 tool multiplier * 1.0 worker bonus = 7200
      expect(result?.amountProduced).toBe(7200);
    });

    it('should floor production amount', () => {
      const buildingDef = createMockBuildingDef({
        levels: [
          {
            level: 1,
            productionRate: 100, // Not evenly divisible
            storageCapacity: 100,
            workerSlots: 3,
            upgradeCost: [],
          },
        ],
      });
      const tenMinutesAgo = Date.now() - 600 * 1000; // 10 minutes
      const placed = createMockPlacedBuilding({
        lastCollected: tenMinutesAgo,
        assignedWorkers: 3,
      });

      const result = calculateOfflineProduction(placed, buildingDef, 1.0);

      expect(result).not.toBeNull();
      // 600 seconds * (100/3600) per second = 16.67, floored to 16
      expect(result?.amountProduced).toBe(16);
    });

    it('should handle zero assigned workers', () => {
      const buildingDef = createMockBuildingDef();
      const oneHourAgo = Date.now() - 3600 * 1000;
      const placed = createMockPlacedBuilding({
        lastCollected: oneHourAgo,
        assignedWorkers: 0,
      });

      const result = calculateOfflineProduction(placed, buildingDef, 1.0);

      expect(result).not.toBeNull();
      // 0 workers means 0 production
      expect(result?.amountProduced).toBe(0);
    });

    it('should calculate production for short time periods', () => {
      const buildingDef = createMockBuildingDef();
      const oneMinuteAgo = Date.now() - 60 * 1000; // 1 minute
      const placed = createMockPlacedBuilding({
        lastCollected: oneMinuteAgo,
        assignedWorkers: 2,
      });

      const result = calculateOfflineProduction(placed, buildingDef, 1.0);

      expect(result).not.toBeNull();
      // 60 seconds * 1 per second = 60
      expect(result?.amountProduced).toBe(60);
      expect(result?.timeElapsed).toBeCloseTo(60, 0);
    });

    it('should calculate production for long time periods within cap', () => {
      const buildingDef = createMockBuildingDef();
      const twelveHoursAgo = Date.now() - 12 * 3600 * 1000;
      const placed = createMockPlacedBuilding({
        lastCollected: twelveHoursAgo,
        assignedWorkers: 2,
      });

      const result = calculateOfflineProduction(placed, buildingDef, 1.0);

      expect(result).not.toBeNull();
      // 12 hours * 3600 per hour = 43200
      expect(result?.amountProduced).toBe(43200);
      expect(result?.timeElapsed).toBeCloseTo(12 * 3600, 0);
    });

    it('should combine all multipliers correctly', () => {
      const buildingDef = createMockBuildingDef({
        levels: [
          {
            level: 1,
            productionRate: 1000, // per hour
            storageCapacity: 100,
            workerSlots: 4,
            upgradeCost: [],
          },
        ],
      });
      const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
      const placed = createMockPlacedBuilding({
        lastCollected: twoHoursAgo,
        assignedWorkers: 2, // 50% of slots
      });

      // Tool multiplier of 1.5
      const result = calculateOfflineProduction(placed, buildingDef, 1.5);

      expect(result).not.toBeNull();
      // 2 hours = 7200 seconds
      // Base rate = 1000/3600 per second
      // Effective rate = (1000/3600) * 1.5 * 0.5 = 0.208333...
      // Amount = 7200 * 0.208333 = 1500
      expect(result?.amountProduced).toBe(1500);
    });
  });
});
