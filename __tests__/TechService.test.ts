// Tests for TechService
// Tests tech unlock validation, prerequisite checking, resource consumption

import {
  TechService,
  canUnlockTech,
  unlockTech,
  hasTech,
  getTechById,
  getAvailableTechs,
  getTechResourceCost,
  SelectedTechResources,
} from '../src/services/TechService';
import { TECHNOLOGIES, TECH_BY_ID } from '../src/data/techTree';
import { Inventory, createEmptyInventory } from '../src/types/resources';

describe('TechService', () => {
  // Helper to create inventory with specific resources
  function createInventory(resources: { stone?: number; wood?: number; food?: number }): Inventory {
    const inventory = createEmptyInventory();
    if (resources.stone) {
      inventory.stone.push({ resourceId: 'granite', quantity: resources.stone });
    }
    if (resources.wood) {
      inventory.wood.push({ resourceId: 'european_ash', quantity: resources.wood });
    }
    if (resources.food) {
      inventory.food.push({ resourceId: 'wild_garlic', quantity: resources.food });
    }
    return inventory;
  }

  // Helper to create resource selections for unlocking
  function createSelections(resources: {
    stone?: number;
    wood?: number;
    food?: number;
  }): SelectedTechResources {
    const selections: SelectedTechResources = {};
    if (resources.stone) {
      selections.stone = [{ resourceId: 'granite', quantity: resources.stone }];
    }
    if (resources.wood) {
      selections.wood = [{ resourceId: 'european_ash', quantity: resources.wood }];
    }
    if (resources.food) {
      selections.food = [{ resourceId: 'wild_garlic', quantity: resources.food }];
    }
    return selections;
  }

  describe('canUnlockTech', () => {
    const basicKnapping = TECH_BY_ID['basic_knapping'];
    const grinding = TECH_BY_ID['grinding'];
    const hafting = TECH_BY_ID['hafting'];

    it('should allow unlocking tech with no prerequisites', () => {
      const inventory = createInventory({ stone: 20, food: 10 });

      const result = canUnlockTech(basicKnapping, [], inventory);

      expect(result.canUnlock).toBe(true);
      expect(result.missingPrereqs).toEqual([]);
      expect(result.missingResources).toEqual([]);
    });

    it('should require prerequisites to be unlocked', () => {
      const inventory = createInventory({ stone: 50, food: 20 });

      const result = canUnlockTech(grinding, [], inventory);

      expect(result.canUnlock).toBe(false);
      expect(result.missingPrereqs).toContain('basic_knapping');
    });

    it('should pass when prerequisites are met', () => {
      const inventory = createInventory({ stone: 50, food: 20 });

      const result = canUnlockTech(grinding, ['basic_knapping'], inventory);

      expect(result.canUnlock).toBe(true);
      expect(result.missingPrereqs).toEqual([]);
    });

    it('should check for missing resources', () => {
      const inventory = createInventory({ stone: 5, food: 1 }); // Not enough

      const result = canUnlockTech(basicKnapping, [], inventory);

      expect(result.canUnlock).toBe(false);
      expect(result.missingResources.length).toBeGreaterThan(0);
      expect(result.missingResources.some((r) => r.resourceType === 'stone')).toBe(true);
    });

    it('should report specific missing quantities', () => {
      const inventory = createInventory({ stone: 3, food: 1 }); // Need 10 stone, 5 food

      const result = canUnlockTech(basicKnapping, [], inventory);

      const stoneMissing = result.missingResources.find((r) => r.resourceType === 'stone');
      expect(stoneMissing).toBeDefined();
      expect(stoneMissing!.have).toBe(3);
      expect(stoneMissing!.needed).toBe(10);
    });

    it('should handle multi-resource requirements', () => {
      // Hafting requires stone, wood, and food
      const inventory = createInventory({ stone: 100, wood: 100, food: 100 });

      const result = canUnlockTech(
        hafting,
        ['basic_knapping', 'cordage_making'], // Prerequisites
        inventory
      );

      expect(result.canUnlock).toBe(true);
    });

    it('should fail when one resource is missing in multi-resource tech', () => {
      const inventory = createInventory({ stone: 100, wood: 0, food: 100 });

      const result = canUnlockTech(hafting, ['basic_knapping', 'cordage_making'], inventory);

      expect(result.canUnlock).toBe(false);
      expect(result.missingResources.some((r) => r.resourceType === 'wood')).toBe(true);
    });
  });

  describe('unlockTech', () => {
    const basicKnapping = TECH_BY_ID['basic_knapping'];

    it('should fail if tech is already unlocked', () => {
      const inventory = createInventory({ stone: 20, food: 10 });
      const selections = createSelections({ stone: 10, food: 5 });

      const result = unlockTech(basicKnapping, ['basic_knapping'], inventory, selections);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already unlocked');
    });

    it('should fail if prerequisites not met', () => {
      const grinding = TECH_BY_ID['grinding'];
      const inventory = createInventory({ stone: 50, food: 20 });
      const selections = createSelections({ stone: 15, food: 5 });

      const result = unlockTech(grinding, [], inventory, selections);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing prerequisites');
    });

    it('should fail if no resources selected', () => {
      const inventory = createInventory({ stone: 20, food: 10 });

      const result = unlockTech(basicKnapping, [], inventory, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('selected');
    });

    it('should fail if insufficient resources selected', () => {
      const inventory = createInventory({ stone: 20, food: 10 });
      const selections = createSelections({ stone: 5, food: 5 }); // Need 10 stone

      const result = unlockTech(basicKnapping, [], inventory, selections);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough');
    });

    it('should succeed and consume resources', () => {
      const inventory = createInventory({ stone: 20, food: 10 });
      const selections = createSelections({ stone: 10, food: 5 });

      const result = unlockTech(basicKnapping, [], inventory, selections);

      expect(result.success).toBe(true);
      expect(result.newInventory).toBeDefined();
      expect(result.newUnlockedTechs).toContain('basic_knapping');

      // Check resources were consumed
      const stoneRemaining = result.newInventory!.stone.find((s) => s.resourceId === 'granite');
      expect(stoneRemaining?.quantity).toBe(10); // 20 - 10

      const foodRemaining = result.newInventory!.food.find((s) => s.resourceId === 'wild_garlic');
      expect(foodRemaining?.quantity).toBe(5); // 10 - 5
    });

    it('should support multiple resource stacks for selection', () => {
      const inventory = createEmptyInventory();
      inventory.stone.push({ resourceId: 'granite', quantity: 5 });
      inventory.stone.push({ resourceId: 'basalt', quantity: 10 });
      inventory.food.push({ resourceId: 'wild_garlic', quantity: 10 });

      // Select from both stone stacks
      const selections: SelectedTechResources = {
        stone: [
          { resourceId: 'granite', quantity: 5 },
          { resourceId: 'basalt', quantity: 5 },
        ],
        food: [{ resourceId: 'wild_garlic', quantity: 5 }],
      };

      const result = unlockTech(basicKnapping, [], inventory, selections);

      expect(result.success).toBe(true);
      // Both stone types should be partially consumed
      const graniteRemaining = result.newInventory!.stone.find((s) => s.resourceId === 'granite');
      expect(graniteRemaining).toBeUndefined(); // Fully consumed (5 - 5 = 0, removed)

      const basaltRemaining = result.newInventory!.stone.find((s) => s.resourceId === 'basalt');
      expect(basaltRemaining?.quantity).toBe(5); // 10 - 5
    });

    it('should fail if selected resource not in inventory', () => {
      const inventory = createInventory({ stone: 5, food: 10 }); // Only 5 stone
      const selections = createSelections({ stone: 10, food: 5 }); // Try to use 10

      const result = unlockTech(basicKnapping, [], inventory, selections);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough');
    });
  });

  describe('hasTech', () => {
    it('should return true when tech is unlocked', () => {
      expect(hasTech('basic_knapping', ['basic_knapping', 'grinding'])).toBe(true);
    });

    it('should return false when tech is not unlocked', () => {
      expect(hasTech('grinding', ['basic_knapping'])).toBe(false);
    });

    it('should return false for empty unlocked list', () => {
      expect(hasTech('basic_knapping', [])).toBe(false);
    });
  });

  describe('getTechById', () => {
    it('should return tech for valid ID', () => {
      const tech = getTechById('basic_knapping');

      expect(tech).toBeDefined();
      expect(tech?.id).toBe('basic_knapping');
      expect(tech?.name).toBe('Basic Knapping');
    });

    it('should return undefined for invalid ID', () => {
      const tech = getTechById('nonexistent_tech');

      expect(tech).toBeUndefined();
    });
  });

  describe('getAvailableTechs', () => {
    it('should return techs with no prerequisites when none unlocked', () => {
      const available = getAvailableTechs([], TECHNOLOGIES);

      expect(available.length).toBe(1);
      expect(available[0].id).toBe('basic_knapping');
    });

    it('should return techs whose prerequisites are met', () => {
      const available = getAvailableTechs(['basic_knapping'], TECHNOLOGIES);

      expect(available.some((t) => t.id === 'grinding')).toBe(true);
      expect(available.some((t) => t.id === 'cordage_making')).toBe(true);
    });

    it('should not return already unlocked techs', () => {
      const available = getAvailableTechs(['basic_knapping', 'grinding'], TECHNOLOGIES);

      expect(available.some((t) => t.id === 'basic_knapping')).toBe(false);
      expect(available.some((t) => t.id === 'grinding')).toBe(false);
    });

    it('should require all prerequisites to be met', () => {
      // Hafting requires cordage_making which requires basic_knapping
      const available = getAvailableTechs(['basic_knapping'], TECHNOLOGIES);

      // Hafting should not be available yet
      expect(available.some((t) => t.id === 'hafting')).toBe(false);
    });

    it('should unlock next tier when prerequisites met', () => {
      const available = getAvailableTechs(['basic_knapping', 'cordage_making'], TECHNOLOGIES);

      // Hafting should now be available
      expect(available.some((t) => t.id === 'hafting')).toBe(true);
    });
  });

  describe('getTechResourceCost', () => {
    const basicKnapping = TECH_BY_ID['basic_knapping'];

    it('should return cost for required resource', () => {
      const stoneCost = getTechResourceCost(basicKnapping, 'stone');

      expect(stoneCost).toBe(10);
    });

    it('should return 0 for non-required resource', () => {
      const woodCost = getTechResourceCost(basicKnapping, 'wood');

      expect(woodCost).toBe(0);
    });
  });

  describe('Tech Tree Integrity', () => {
    it('should have valid prerequisites for all techs', () => {
      for (const tech of TECHNOLOGIES) {
        for (const prereqId of tech.prerequisites) {
          const prereq = TECH_BY_ID[prereqId];
          expect(prereq).toBeDefined();
        }
      }
    });

    it('should have no circular dependencies', () => {
      // Build a graph of dependencies
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      function hasCycle(techId: string): boolean {
        if (recursionStack.has(techId)) return true;
        if (visited.has(techId)) return false;

        visited.add(techId);
        recursionStack.add(techId);

        const tech = TECH_BY_ID[techId];
        if (tech) {
          for (const prereq of tech.prerequisites) {
            if (hasCycle(prereq)) return true;
          }
        }

        recursionStack.delete(techId);
        return false;
      }

      for (const tech of TECHNOLOGIES) {
        expect(hasCycle(tech.id)).toBe(false);
      }
    });

    it('should have at least one tech with no prerequisites', () => {
      const rootTechs = TECHNOLOGIES.filter((t) => t.prerequisites.length === 0);

      expect(rootTechs.length).toBeGreaterThan(0);
    });

    it('should have all enablesRecipes reference valid recipe IDs', () => {
      // This is a sanity check - the actual validation is done in validateRecipes.ts
      for (const tech of TECHNOLOGIES) {
        expect(tech.enablesRecipes).toBeDefined();
        expect(Array.isArray(tech.enablesRecipes)).toBe(true);
      }
    });
  });

  describe('TechService namespace export', () => {
    it('should export all functions', () => {
      expect(TechService.canUnlockTech).toBe(canUnlockTech);
      expect(TechService.unlockTech).toBe(unlockTech);
      expect(TechService.hasTech).toBe(hasTech);
      expect(TechService.getTechById).toBe(getTechById);
      expect(TechService.getAvailableTechs).toBe(getAvailableTechs);
      expect(TechService.getTechResourceCost).toBe(getTechResourceCost);
    });
  });
});
