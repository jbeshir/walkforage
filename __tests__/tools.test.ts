import {
  TOOLS,
  TOOLS_BY_ID,
  COMPONENTS,
  COMPONENTS_BY_ID,
  getToolById,
  getComponentById,
  getToolsByEra,
  getToolsByCategory,
  getToolPrerequisites,
  getAllToolDependencies,
} from '../src/data/tools';
import { ToolCategory, ComponentCategory } from '../src/types/tools';
import { LithicEra } from '../src/types/tech';

describe('Tools Data', () => {
  describe('TOOLS array', () => {
    it('should contain tool entries', () => {
      expect(TOOLS.length).toBeGreaterThan(0);
    });

    it('should have unique ids for all tools', () => {
      const ids = TOOLS.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid lithic eras for all tools', () => {
      const validEras: LithicEra[] = [
        'lower_paleolithic',
        'middle_paleolithic',
        'upper_paleolithic',
        'mesolithic',
      ];
      TOOLS.forEach((tool) => {
        expect(validEras).toContain(tool.era);
      });
    });

    it('should have valid categories for all tools', () => {
      const validCategories: ToolCategory[] = ['knapping', 'woodworking', 'foraging', 'cutting'];
      TOOLS.forEach((tool) => {
        expect(validCategories).toContain(tool.category);
      });
    });

    it('should have valid gathering bonus (non-negative)', () => {
      TOOLS.forEach((tool) => {
        expect(tool.baseStats.gatheringBonus).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have positive craft times', () => {
      TOOLS.forEach((tool) => {
        expect(tool.baseCraftTime).toBeGreaterThan(0);
      });
    });

    it('should have valid material requirements', () => {
      TOOLS.forEach((tool) => {
        const { materials } = tool;
        if (materials.stone) {
          expect(materials.stone.quantity).toBeGreaterThan(0);
        }
        if (materials.wood) {
          expect(materials.wood.quantity).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('COMPONENTS array', () => {
    it('should contain component entries', () => {
      expect(COMPONENTS.length).toBeGreaterThan(0);
    });

    it('should have unique ids for all components', () => {
      const ids = COMPONENTS.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid categories for all components', () => {
      const validCategories: ComponentCategory[] = ['handle', 'binding'];
      COMPONENTS.forEach((component) => {
        expect(validCategories).toContain(component.category);
      });
    });

    it('should have valid lithic eras for all components', () => {
      const validEras: LithicEra[] = [
        'lower_paleolithic',
        'middle_paleolithic',
        'upper_paleolithic',
        'mesolithic',
      ];
      COMPONENTS.forEach((component) => {
        expect(validEras).toContain(component.era);
      });
    });

    it('should have non-negative property values', () => {
      COMPONENTS.forEach((component) => {
        expect(component.properties.durabilityBonus).toBeGreaterThanOrEqual(0);
        expect(component.properties.efficiencyBonus).toBeGreaterThanOrEqual(0);
        expect(component.properties.qualityTier).toBeGreaterThanOrEqual(1);
        expect(component.properties.qualityTier).toBeLessThanOrEqual(5);
      });
    });

    it('should have positive craft times', () => {
      COMPONENTS.forEach((component) => {
        expect(component.baseCraftTime).toBeGreaterThan(0);
      });
    });
  });

  describe('TOOLS_BY_ID', () => {
    it('should contain entries for all tools', () => {
      expect(Object.keys(TOOLS_BY_ID).length).toBe(TOOLS.length);
    });

    it('should allow lookup by id', () => {
      const hammerstone = TOOLS_BY_ID['hammerstone'];
      expect(hammerstone).toBeDefined();
      expect(hammerstone.name).toBe('Hammerstone');
      expect(hammerstone.era).toBe('lower_paleolithic');
    });

    it('should return undefined for non-existent id', () => {
      const nonExistent = TOOLS_BY_ID['nonexistent_tool'];
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('COMPONENTS_BY_ID', () => {
    it('should contain entries for all components', () => {
      expect(Object.keys(COMPONENTS_BY_ID).length).toBe(COMPONENTS.length);
    });

    it('should allow lookup by id', () => {
      const crudeHandle = COMPONENTS_BY_ID['crude_handle'];
      expect(crudeHandle).toBeDefined();
      expect(crudeHandle.name).toBe('Crude Handle');
      expect(crudeHandle.category).toBe('handle');
    });

    it('should return undefined for non-existent id', () => {
      const nonExistent = COMPONENTS_BY_ID['nonexistent_component'];
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('getToolById', () => {
    it('should return tool for valid id', () => {
      const tool = getToolById('stone_knife');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('Stone Knife');
    });

    it('should return undefined for invalid id', () => {
      expect(getToolById('invalid')).toBeUndefined();
    });
  });

  describe('getComponentById', () => {
    it('should return component for valid id', () => {
      const component = getComponentById('crude_handle');
      expect(component).toBeDefined();
      expect(component?.name).toBe('Crude Handle');
    });

    it('should return undefined for invalid id', () => {
      expect(getComponentById('invalid')).toBeUndefined();
    });
  });

  describe('getToolsByEra', () => {
    it('should return lower paleolithic tools', () => {
      const lowerPaleo = getToolsByEra('lower_paleolithic');
      expect(lowerPaleo.length).toBeGreaterThan(0);
      lowerPaleo.forEach((tool) => {
        expect(tool.era).toBe('lower_paleolithic');
      });
      expect(lowerPaleo.some((t) => t.id === 'hammerstone')).toBe(true);
      expect(lowerPaleo.some((t) => t.id === 'hand_axe')).toBe(true);
    });

    it('should return middle paleolithic tools', () => {
      const middlePaleo = getToolsByEra('middle_paleolithic');
      expect(middlePaleo.length).toBeGreaterThan(0);
      middlePaleo.forEach((tool) => {
        expect(tool.era).toBe('middle_paleolithic');
      });
      expect(middlePaleo.some((t) => t.id === 'stone_knife')).toBe(true);
      expect(middlePaleo.some((t) => t.id === 'hafted_axe')).toBe(true);
    });

    it('should return upper paleolithic tools', () => {
      const upperPaleo = getToolsByEra('upper_paleolithic');
      expect(upperPaleo.length).toBeGreaterThan(0);
      upperPaleo.forEach((tool) => {
        expect(tool.era).toBe('upper_paleolithic');
      });
      expect(upperPaleo.some((t) => t.id === 'pressure_flaker')).toBe(true);
    });

    it('should return mesolithic tools', () => {
      const mesolithic = getToolsByEra('mesolithic');
      expect(mesolithic.length).toBeGreaterThan(0);
      mesolithic.forEach((tool) => {
        expect(tool.era).toBe('mesolithic');
      });
      expect(mesolithic.some((t) => t.id === 'polished_axe')).toBe(true);
    });
  });

  describe('getToolsByCategory', () => {
    it('should return woodworking tools', () => {
      const woodworking = getToolsByCategory('woodworking');
      expect(woodworking.length).toBeGreaterThan(0);
      woodworking.forEach((tool) => {
        expect(tool.category).toBe('woodworking');
      });
      expect(woodworking.some((t) => t.id === 'hand_axe')).toBe(true);
      expect(woodworking.some((t) => t.id === 'hafted_axe')).toBe(true);
    });

    it('should return knapping tools', () => {
      const knapping = getToolsByCategory('knapping');
      expect(knapping.length).toBeGreaterThan(0);
      knapping.forEach((tool) => {
        expect(tool.category).toBe('knapping');
      });
      expect(knapping.some((t) => t.id === 'hammerstone')).toBe(true);
      expect(knapping.some((t) => t.id === 'grinding_stone')).toBe(true);
    });

    it('should return cutting tools', () => {
      const cutting = getToolsByCategory('cutting');
      expect(cutting.length).toBeGreaterThan(0);
      cutting.forEach((tool) => {
        expect(tool.category).toBe('cutting');
      });
      expect(cutting.some((t) => t.id === 'stone_knife')).toBe(true);
    });

    it('should return foraging tools', () => {
      const foraging = getToolsByCategory('foraging');
      expect(foraging.length).toBeGreaterThan(0);
      foraging.forEach((tool) => {
        expect(tool.category).toBe('foraging');
      });
      expect(foraging.some((t) => t.id === 'digging_stick')).toBe(true);
    });
  });

  describe('getToolPrerequisites', () => {
    it('should return empty array for tool with no prerequisites', () => {
      const prereqs = getToolPrerequisites('hammerstone');
      expect(prereqs).toEqual([]);
    });

    it('should return prerequisite tool ids', () => {
      const prereqs = getToolPrerequisites('hand_axe');
      expect(prereqs).toContain('hammerstone');
    });

    it('should return multiple prerequisites for complex tools', () => {
      const prereqs = getToolPrerequisites('polished_axe');
      expect(prereqs.length).toBeGreaterThanOrEqual(2);
      expect(prereqs).toContain('hammerstone');
      expect(prereqs).toContain('grinding_stone');
    });

    it('should return empty array for non-existent tool', () => {
      const prereqs = getToolPrerequisites('nonexistent');
      expect(prereqs).toEqual([]);
    });
  });

  describe('getAllToolDependencies', () => {
    it('should return empty array for tool with no dependencies', () => {
      const deps = getAllToolDependencies('hammerstone');
      expect(deps).toEqual([]);
    });

    it('should return direct dependencies', () => {
      const deps = getAllToolDependencies('hand_axe');
      expect(deps).toContain('hammerstone');
    });

    it('should return transitive dependencies', () => {
      const deps = getAllToolDependencies('hafted_axe');
      expect(deps).toContain('hammerstone');
    });

    it('should return empty array for non-existent tool', () => {
      const deps = getAllToolDependencies('nonexistent');
      expect(deps).toEqual([]);
    });

    it('should not contain duplicates', () => {
      const deps = getAllToolDependencies('polished_axe');
      const uniqueDeps = new Set(deps);
      expect(uniqueDeps.size).toBe(deps.length);
    });
  });

  describe('Tool required components', () => {
    it('should reference valid components', () => {
      TOOLS.forEach((tool) => {
        tool.requiredComponents.forEach((req) => {
          expect(COMPONENTS_BY_ID[req.componentId]).toBeDefined();
        });
      });
    });

    it('should have positive quantities', () => {
      TOOLS.forEach((tool) => {
        tool.requiredComponents.forEach((req) => {
          expect(req.quantity).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Tool required tools', () => {
    it('should reference valid tools', () => {
      TOOLS.forEach((tool) => {
        tool.requiredTools.forEach((req) => {
          expect(TOOLS_BY_ID[req.toolId]).toBeDefined();
        });
      });
    });
  });

  describe('Component required tools', () => {
    it('should reference valid tools', () => {
      COMPONENTS.forEach((component) => {
        component.requiredTools.forEach((req) => {
          expect(TOOLS_BY_ID[req.toolId]).toBeDefined();
        });
      });
    });
  });

  describe('Era progression logic', () => {
    it('should have most lower paleolithic tools without tool requirements', () => {
      const lowerPaleo = getToolsByEra('lower_paleolithic');
      // Some lower paleolithic tools don't require other tools (hammerstone, grinding_stone)
      const noRequirements = lowerPaleo.filter((t) => t.requiredTools.length === 0);
      expect(noRequirements.length).toBeGreaterThan(0);
    });

    it('should have starting tools craftable from scratch', () => {
      // Hammerstone and grinding_stone should be craftable with just raw materials
      const hammerstone = TOOLS_BY_ID['hammerstone'];
      const grindingStone = TOOLS_BY_ID['grinding_stone'];

      expect(hammerstone.requiredTools.length).toBe(0);
      expect(hammerstone.requiredComponents.length).toBe(0);

      expect(grindingStone.requiredTools.length).toBe(0);
      expect(grindingStone.requiredComponents.length).toBe(0);
    });
  });

  describe('Specific tool data', () => {
    it('hammerstone should be the most basic tool', () => {
      const hammerstone = TOOLS_BY_ID['hammerstone'];
      expect(hammerstone.era).toBe('lower_paleolithic');
      expect(hammerstone.requiredTools.length).toBe(0);
      expect(hammerstone.requiredComponents.length).toBe(0);
    });

    it('polished_axe should be the best woodworking tool', () => {
      const polishedAxe = TOOLS_BY_ID['polished_axe'];
      expect(polishedAxe.era).toBe('mesolithic');
      expect(polishedAxe.baseStats.gatheringBonus).toBeGreaterThan(0.5);
    });
  });
});
