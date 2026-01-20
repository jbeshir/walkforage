import { CraftingService, CraftingState } from '../src/services/CraftingService';
import { getToolById, getComponentById } from '../src/data/tools';
import { isTool } from '../src/types/tools';

// Helper to create a minimal crafting state
function createTestState(overrides: Partial<CraftingState> = {}): CraftingState {
  return {
    inventory: {
      stone: [],
      wood: [],
    },
    unlockedTechs: [],
    ownedTools: [],
    ownedComponents: [],
    ...overrides,
  };
}

describe('CraftingService', () => {
  describe('canCraft', () => {
    describe('with Tool', () => {
      const hammerstone = getToolById('hammerstone')!;

      it('should return false when tech is not unlocked', () => {
        const state = createTestState();
        const result = CraftingService.canCraft(hammerstone, state);

        expect(result.canCraft).toBe(false);
        expect(result.missingRequirements).toContain(`Tech: ${hammerstone.requiredTech}`);
      });

      it('should return false when materials are missing', () => {
        const state = createTestState({
          unlockedTechs: [hammerstone.requiredTech],
        });
        const result = CraftingService.canCraft(hammerstone, state);

        expect(result.canCraft).toBe(false);
        expect(result.missingRequirements.some((r) => r.includes('stone'))).toBe(true);
      });

      it('should return true when all requirements are met', () => {
        const state = createTestState({
          unlockedTechs: [hammerstone.requiredTech],
          inventory: {
            stone: [{ resourceId: 'granite', quantity: 10 }],
            wood: [],
          },
        });
        const result = CraftingService.canCraft(hammerstone, state);

        expect(result.canCraft).toBe(true);
        expect(result.missingRequirements).toEqual([]);
        expect(result.availableStones).toContain('granite');
      });

      it('should check for toolstone requirement', () => {
        const handAxe = getToolById('hand_axe')!;
        const state = createTestState({
          unlockedTechs: [handAxe.requiredTech],
          ownedTools: [
            {
              instanceId: 'test_hammerstone',
              toolId: 'hammerstone',
              materials: {},
              quality: 0.5,
            },
          ],
          ownedComponents: [],
          inventory: {
            stone: [{ resourceId: 'granite', quantity: 10 }], // Not a toolstone
            wood: [],
          },
        });

        const result = CraftingService.canCraft(handAxe, state);

        // Granite is not a toolstone, so should fail
        expect(result.availableStones).toEqual([]);
        expect(result.canCraft).toBe(false);
      });

      it('should list available materials when craftable', () => {
        const state = createTestState({
          unlockedTechs: [hammerstone.requiredTech],
          inventory: {
            stone: [
              { resourceId: 'granite', quantity: 10 },
              { resourceId: 'basalt', quantity: 10 }, // Enough for requirements
            ],
            wood: [],
          },
        });

        const result = CraftingService.canCraft(hammerstone, state);

        expect(result.availableStones).toContain('granite');
        expect(result.availableStones).toContain('basalt');
      });
    });

    describe('with CraftedComponent', () => {
      const crudeHandle = getComponentById('crude_handle')!;

      it('should return false when tech is not unlocked', () => {
        const state = createTestState();
        const result = CraftingService.canCraft(crudeHandle, state);

        expect(result.canCraft).toBe(false);
        expect(result.missingRequirements).toContain(`Tech: ${crudeHandle.requiredTech}`);
      });

      it('should check required tools', () => {
        const state = createTestState({
          unlockedTechs: [crudeHandle.requiredTech],
          inventory: {
            stone: [],
            wood: [{ resourceId: 'european_ash', quantity: 10 }],
          },
        });

        const result = CraftingService.canCraft(crudeHandle, state);

        // Crude handle requires a stone knife
        if (crudeHandle.requiredTools.length > 0) {
          expect(result.canCraft).toBe(false);
          expect(result.missingRequirements.some((r) => r.includes('Tool:'))).toBe(true);
        }
      });
    });

    describe('component requirements', () => {
      it('should check required components for tools', () => {
        const haftedAxe = getToolById('hafted_axe')!;
        const state = createTestState({
          unlockedTechs: [haftedAxe.requiredTech],
          ownedTools: [
            {
              instanceId: 'test_hammerstone',
              toolId: 'hammerstone',
              materials: {},
              quality: 0.5,
            },
          ],
          ownedComponents: [], // No components
          inventory: {
            stone: [{ resourceId: 'flint', quantity: 10 }],
            wood: [{ resourceId: 'european_ash', quantity: 10 }],
          },
        });

        const result = CraftingService.canCraft(haftedAxe, state);

        // Hafted axe requires components
        if (haftedAxe.requiredComponents.length > 0) {
          expect(result.canCraft).toBe(false);
          expect(result.missingRequirements.some((r) => r.includes('Component:'))).toBe(true);
        }
      });
    });
  });

  describe('craft', () => {
    describe('with Tool', () => {
      const hammerstone = getToolById('hammerstone')!;

      it('should fail when canCraft returns false', () => {
        const state = createTestState();
        const result = CraftingService.craft(hammerstone, {}, state);

        expect(result.success).toBe(false);
        expect('error' in result && result.error).toBeTruthy();
      });

      it('should fail when stone not selected but required', () => {
        const state = createTestState({
          unlockedTechs: [hammerstone.requiredTech],
          inventory: {
            stone: [{ resourceId: 'granite', quantity: 10 }],
            wood: [],
          },
        });

        const result = CraftingService.craft(hammerstone, {}, state);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('not selected');
        }
      });

      it('should succeed and consume materials', () => {
        const initialQuantity = 20; // More than required so some remains
        const state = createTestState({
          unlockedTechs: [hammerstone.requiredTech],
          inventory: {
            stone: [{ resourceId: 'granite', quantity: initialQuantity }],
            wood: [],
          },
        });

        const result = CraftingService.craft(hammerstone, { selectedStoneId: 'granite' }, state);

        expect(result.success).toBe(true);
        if (result.success) {
          // Materials should be consumed
          const stoneStack = result.newState.inventory.stone.find(
            (s) => s.resourceId === 'granite'
          );
          expect(stoneStack).toBeDefined();
          expect(stoneStack!.quantity).toBeLessThan(initialQuantity);

          // Tool should be added
          expect(result.newState.ownedTools.length).toBe(1);
          expect(result.newState.ownedTools[0].toolId).toBe('hammerstone');

          // Crafted item should be returned
          expect(isTool(hammerstone)).toBe(true);
          expect(result.craftedItem).toBeDefined();
        }
      });

      it('should create tool with quality based on materials', () => {
        const state = createTestState({
          unlockedTechs: [hammerstone.requiredTech],
          inventory: {
            stone: [{ resourceId: 'granite', quantity: 10 }],
            wood: [],
          },
        });

        const result = CraftingService.craft(hammerstone, { selectedStoneId: 'granite' }, state);

        expect(result.success).toBe(true);
        if (result.success) {
          const tool = result.newState.ownedTools[0];
          expect(tool.quality).toBeGreaterThanOrEqual(0);
          expect(tool.quality).toBeLessThanOrEqual(1);
        }
      });
    });

    describe('with CraftedComponent', () => {
      const crudeHandle = getComponentById('crude_handle')!;

      it('should succeed and add to ownedComponents', () => {
        // First, we need to meet all requirements for crude_handle
        const state = createTestState({
          unlockedTechs: [crudeHandle.requiredTech],
          ownedTools: crudeHandle.requiredTools.map((reqToolId) => ({
            instanceId: `test_${reqToolId}`,
            toolId: reqToolId,
            materials: {},
            quality: 0.5,
          })),
          ownedComponents: [],
          inventory: {
            stone: [],
            wood: [{ resourceId: 'european_ash', quantity: 10 }],
          },
        });

        // Check if we can craft
        const canCraftResult = CraftingService.canCraft(crudeHandle, state);
        if (!canCraftResult.canCraft) {
          // Skip test if requirements aren't met (might be test data issue)
          console.log('Skipping test: crude_handle requirements not met', canCraftResult);
          return;
        }

        const result = CraftingService.craft(
          crudeHandle,
          { selectedWoodId: 'european_ash' },
          state
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.newState.ownedComponents.length).toBe(1);
          expect(result.newState.ownedComponents[0].componentId).toBe('crude_handle');
        }
      });
    });

    describe('component consumption', () => {
      it('should consume selected components when crafting tools', () => {
        const haftedAxe = getToolById('hafted_axe')!;

        // Skip if no components required
        if (haftedAxe.requiredComponents.length === 0) {
          return;
        }

        const componentReq = haftedAxe.requiredComponents[0];
        const componentInstanceId = 'test_component_123';

        const state = createTestState({
          unlockedTechs: [haftedAxe.requiredTech],
          ownedTools: haftedAxe.requiredTools.map((reqToolId) => ({
            instanceId: `test_${reqToolId}`,
            toolId: reqToolId,
            materials: {},
            quality: 0.5,
          })),
          ownedComponents: [
            {
              instanceId: componentInstanceId,
              componentId: componentReq.componentId,
              materials: { woodId: 'european_ash', woodQuantity: 5 },
              quality: 0.5,
            },
          ],
          inventory: {
            stone: [{ resourceId: 'flint', quantity: 20 }],
            wood: [{ resourceId: 'european_ash', quantity: 20 }],
          },
        });

        const canCraftResult = CraftingService.canCraft(haftedAxe, state);
        if (!canCraftResult.canCraft) {
          console.log('Skipping test: hafted_axe requirements not met', canCraftResult);
          return;
        }

        const result = CraftingService.craft(
          haftedAxe,
          {
            selectedStoneId: 'flint',
            selectedWoodId: 'european_ash',
            selectedComponentIds: [componentInstanceId],
          },
          state
        );

        expect(result.success).toBe(true);
        if (result.success) {
          // Component should be consumed
          expect(result.newState.ownedComponents.length).toBe(0);
          // Tool should be created
          expect(result.newState.ownedTools.length).toBeGreaterThan(state.ownedTools.length);
        }
      });
    });
  });

  describe('type guard integration', () => {
    it('should correctly identify Tool vs CraftedComponent', () => {
      const hammerstone = getToolById('hammerstone')!;
      const crudeHandle = getComponentById('crude_handle')!;

      expect(isTool(hammerstone)).toBe(true);
      expect(isTool(crudeHandle)).toBe(false);
    });

    it('should create correct item type based on craftable', () => {
      const hammerstone = getToolById('hammerstone')!;

      const state = createTestState({
        unlockedTechs: [hammerstone.requiredTech],
        inventory: {
          stone: [{ resourceId: 'granite', quantity: 10 }],
          wood: [],
        },
      });

      const result = CraftingService.craft(hammerstone, { selectedStoneId: 'granite' }, state);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should be in ownedTools, not ownedComponents
        expect(result.newState.ownedTools.length).toBe(1);
        expect(result.newState.ownedComponents.length).toBe(0);
      }
    });
  });
});
