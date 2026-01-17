import {
  TOOLS,
  TOOLS_BY_ID,
  COMPONENTS,
  COMPONENTS_BY_ID,
  getToolById,
  getComponentById,
  getToolsByTier,
  getToolsByCategory,
  getToolPrerequisites,
  getToolChain,
  getAllToolDependencies,
} from '../src/data/tools';
import { MaterialTier, ToolCategory, ComponentCategory, TIER_ORDER } from '../src/types/tools';

describe('Tools Data', () => {
  describe('TOOLS array', () => {
    it('should contain tool entries', () => {
      expect(TOOLS.length).toBeGreaterThan(0);
    });

    it('should have at least 35 tools', () => {
      expect(TOOLS.length).toBeGreaterThanOrEqual(35);
    });

    it('should have unique ids for all tools', () => {
      const ids = TOOLS.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid tiers for all tools', () => {
      const validTiers: MaterialTier[] = ['primitive', 'stone', 'copper', 'bronze', 'iron', 'steel'];
      TOOLS.forEach((tool) => {
        expect(validTiers).toContain(tool.tier);
      });
    });

    it('should have valid categories for all tools', () => {
      const validCategories: ToolCategory[] = [
        'knapping',
        'woodworking',
        'metalworking',
        'mining',
        'masonry',
        'fire',
        'general',
      ];
      TOOLS.forEach((tool) => {
        expect(validCategories).toContain(tool.category);
      });
    });

    it('should have valid eras for all tools', () => {
      const validEras = ['stone', 'copper', 'bronze', 'iron'];
      TOOLS.forEach((tool) => {
        expect(validEras).toContain(tool.era);
      });
    });

    it('should have positive durability for all tools', () => {
      TOOLS.forEach((tool) => {
        expect(tool.stats.durability).toBeGreaterThan(0);
        expect(tool.stats.maxDurability).toBeGreaterThanOrEqual(tool.stats.durability);
      });
    });

    it('should have valid hardness ratings (1-10)', () => {
      TOOLS.forEach((tool) => {
        expect(tool.stats.hardnessRating).toBeGreaterThanOrEqual(1);
        expect(tool.stats.hardnessRating).toBeLessThanOrEqual(10);
      });
    });

    it('should have positive craft times', () => {
      TOOLS.forEach((tool) => {
        expect(tool.baseCraftTime).toBeGreaterThan(0);
      });
    });
  });

  describe('COMPONENTS array', () => {
    it('should contain component entries', () => {
      expect(COMPONENTS.length).toBeGreaterThan(0);
    });

    it('should have exactly 17 components', () => {
      expect(COMPONENTS.length).toBe(17);
    });

    it('should have unique ids for all components', () => {
      const ids = COMPONENTS.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid categories for all components', () => {
      const validCategories: ComponentCategory[] = [
        'handle',
        'binding',
        'head',
        'fixture',
        'container',
      ];
      COMPONENTS.forEach((component) => {
        expect(validCategories).toContain(component.category);
      });
    });

    it('should have valid tiers for all components', () => {
      const validTiers: MaterialTier[] = ['primitive', 'stone', 'copper', 'bronze', 'iron', 'steel'];
      COMPONENTS.forEach((component) => {
        expect(validTiers).toContain(component.tier);
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
      expect(hammerstone.tier).toBe('primitive');
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
      const component = getComponentById('flint_blade');
      expect(component).toBeDefined();
      expect(component?.name).toBe('Flint Blade');
    });

    it('should return undefined for invalid id', () => {
      expect(getComponentById('invalid')).toBeUndefined();
    });
  });

  describe('getToolsByTier', () => {
    it('should return primitive tools', () => {
      const primitive = getToolsByTier('primitive');
      expect(primitive.length).toBeGreaterThan(0);
      primitive.forEach((tool) => {
        expect(tool.tier).toBe('primitive');
      });
      expect(primitive.some((t) => t.id === 'hammerstone')).toBe(true);
    });

    it('should return stone tools', () => {
      const stone = getToolsByTier('stone');
      expect(stone.length).toBeGreaterThan(0);
      stone.forEach((tool) => {
        expect(tool.tier).toBe('stone');
      });
      expect(stone.some((t) => t.id === 'stone_knife')).toBe(true);
      expect(stone.some((t) => t.id === 'stone_axe')).toBe(true);
    });

    it('should return copper tools', () => {
      const copper = getToolsByTier('copper');
      expect(copper.length).toBeGreaterThan(0);
      copper.forEach((tool) => {
        expect(tool.tier).toBe('copper');
      });
      expect(copper.some((t) => t.id === 'copper_knife')).toBe(true);
    });

    it('should return bronze tools', () => {
      const bronze = getToolsByTier('bronze');
      expect(bronze.length).toBeGreaterThan(0);
      bronze.forEach((tool) => {
        expect(tool.tier).toBe('bronze');
      });
      expect(bronze.some((t) => t.id === 'bronze_axe')).toBe(true);
    });

    it('should return iron tools', () => {
      const iron = getToolsByTier('iron');
      expect(iron.length).toBeGreaterThan(0);
      iron.forEach((tool) => {
        expect(tool.tier).toBe('iron');
      });
      expect(iron.some((t) => t.id === 'iron_hammer')).toBe(true);
    });

    it('should return steel tools', () => {
      const steel = getToolsByTier('steel');
      expect(steel.length).toBeGreaterThan(0);
      steel.forEach((tool) => {
        expect(tool.tier).toBe('steel');
      });
      expect(steel.some((t) => t.id === 'steel_hammer')).toBe(true);
    });
  });

  describe('getToolsByCategory', () => {
    it('should return woodworking tools', () => {
      const woodworking = getToolsByCategory('woodworking');
      expect(woodworking.length).toBeGreaterThan(0);
      woodworking.forEach((tool) => {
        expect(tool.category).toBe('woodworking');
      });
      expect(woodworking.some((t) => t.id === 'stone_axe')).toBe(true);
    });

    it('should return metalworking tools', () => {
      const metalworking = getToolsByCategory('metalworking');
      expect(metalworking.length).toBeGreaterThan(0);
      metalworking.forEach((tool) => {
        expect(tool.category).toBe('metalworking');
      });
      expect(metalworking.some((t) => t.id === 'stone_hammer')).toBe(true);
    });

    it('should return mining tools', () => {
      const mining = getToolsByCategory('mining');
      expect(mining.length).toBeGreaterThan(0);
      mining.forEach((tool) => {
        expect(tool.category).toBe('mining');
      });
      expect(mining.some((t) => t.id === 'copper_pickaxe')).toBe(true);
    });

    it('should return fire tools', () => {
      const fire = getToolsByCategory('fire');
      expect(fire.length).toBeGreaterThan(0);
      fire.forEach((tool) => {
        expect(tool.category).toBe('fire');
      });
      expect(fire.some((t) => t.id === 'bow_drill')).toBe(true);
    });

    it('should return general tools', () => {
      const general = getToolsByCategory('general');
      expect(general.length).toBeGreaterThan(0);
      general.forEach((tool) => {
        expect(tool.category).toBe('general');
      });
      expect(general.some((t) => t.id === 'stone_knife')).toBe(true);
    });

    it('should return knapping tools', () => {
      const knapping = getToolsByCategory('knapping');
      expect(knapping.length).toBeGreaterThan(0);
      knapping.forEach((tool) => {
        expect(tool.category).toBe('knapping');
      });
      expect(knapping.some((t) => t.id === 'hammerstone')).toBe(true);
    });

    it('should return empty array for unused category', () => {
      const masonry = getToolsByCategory('masonry');
      expect(masonry).toEqual([]);
    });
  });

  describe('getToolPrerequisites', () => {
    it('should return empty array for tool with no prerequisites', () => {
      const prereqs = getToolPrerequisites('hammerstone');
      expect(prereqs).toEqual([]);
    });

    it('should return prerequisite tool ids', () => {
      const prereqs = getToolPrerequisites('stone_knife');
      expect(prereqs).toContain('hammerstone');
    });

    it('should return multiple prerequisites for complex tools', () => {
      const prereqs = getToolPrerequisites('stone_axe');
      expect(prereqs.length).toBeGreaterThanOrEqual(2);
      expect(prereqs).toContain('hammerstone');
      expect(prereqs).toContain('grinding_stone');
    });

    it('should return empty array for non-existent tool', () => {
      const prereqs = getToolPrerequisites('nonexistent');
      expect(prereqs).toEqual([]);
    });
  });

  describe('getToolChain', () => {
    it('should return single-item chain for tool with no upgrades path', () => {
      const chain = getToolChain('hammerstone');
      expect(chain.length).toBe(1);
      expect(chain[0].id).toBe('hammerstone');
    });

    it('should return upgrade chain for knife progression', () => {
      const chain = getToolChain('iron_knife');
      expect(chain.length).toBeGreaterThanOrEqual(3);
      const ids = chain.map((t) => t.id);
      expect(ids).toContain('stone_knife');
      expect(ids).toContain('copper_knife');
      expect(ids).toContain('bronze_knife');
      expect(ids).toContain('iron_knife');
    });

    it('should return upgrade chain for axe progression', () => {
      const chain = getToolChain('steel_axe');
      expect(chain.length).toBeGreaterThanOrEqual(4);
      const ids = chain.map((t) => t.id);
      expect(ids).toContain('stone_axe');
      expect(ids).toContain('copper_axe');
      expect(ids).toContain('bronze_axe');
      expect(ids).toContain('iron_axe');
      expect(ids).toContain('steel_axe');
    });

    it('should have chain in correct tier order', () => {
      const chain = getToolChain('iron_knife');
      for (let i = 1; i < chain.length; i++) {
        const prevTierIndex = TIER_ORDER.indexOf(chain[i - 1].tier);
        const currTierIndex = TIER_ORDER.indexOf(chain[i].tier);
        expect(currTierIndex).toBeGreaterThanOrEqual(prevTierIndex);
      }
    });

    it('should return empty array for non-existent tool', () => {
      const chain = getToolChain('nonexistent');
      expect(chain).toEqual([]);
    });
  });

  describe('getAllToolDependencies', () => {
    it('should return empty array for tool with no dependencies', () => {
      const deps = getAllToolDependencies('hammerstone');
      expect(deps).toEqual([]);
    });

    it('should return direct dependencies', () => {
      const deps = getAllToolDependencies('stone_knife');
      expect(deps).toContain('hammerstone');
    });

    it('should return transitive dependencies', () => {
      const deps = getAllToolDependencies('stone_axe');
      expect(deps).toContain('hammerstone');
      expect(deps).toContain('grinding_stone');
    });

    it('should return all dependencies for complex iron tools', () => {
      const deps = getAllToolDependencies('iron_hammer');
      expect(deps.length).toBeGreaterThan(3);
      // Iron hammer needs bronze_hammer, iron_tongs, anvil, and their dependencies
      expect(deps).toContain('bronze_hammer');
      expect(deps).toContain('iron_tongs');
      expect(deps).toContain('anvil');
    });

    it('should return empty array for non-existent tool', () => {
      const deps = getAllToolDependencies('nonexistent');
      expect(deps).toEqual([]);
    });

    it('should not contain duplicates', () => {
      const deps = getAllToolDependencies('steel_hammer');
      const uniqueDeps = new Set(deps);
      expect(uniqueDeps.size).toBe(deps.length);
    });
  });

  describe('Tool upgrade paths', () => {
    it('should have valid upgradesTo references', () => {
      TOOLS.forEach((tool) => {
        if (tool.upgradesTo) {
          expect(TOOLS_BY_ID[tool.upgradesTo]).toBeDefined();
        }
      });
    });

    it('should have valid upgradesFrom references', () => {
      TOOLS.forEach((tool) => {
        if (tool.upgradesFrom) {
          expect(TOOLS_BY_ID[tool.upgradesFrom]).toBeDefined();
        }
      });
    });

    it('should have consistent upgrade paths', () => {
      TOOLS.forEach((tool) => {
        if (tool.upgradesTo) {
          const upgradedTool = TOOLS_BY_ID[tool.upgradesTo];
          expect(upgradedTool.upgradesFrom).toBe(tool.id);
        }
      });
    });

    it('should have no cycles in upgrade paths', () => {
      TOOLS.forEach((tool) => {
        const visited = new Set<string>();
        let current: string | null = tool.id;

        while (current) {
          expect(visited.has(current)).toBe(false);
          visited.add(current);
          const currentTool = TOOLS_BY_ID[current] as typeof TOOLS[number] | undefined;
          current = currentTool?.upgradesTo || null;
        }
      });
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

    it('should have valid minTier values', () => {
      const validTiers: MaterialTier[] = ['primitive', 'stone', 'copper', 'bronze', 'iron', 'steel'];
      TOOLS.forEach((tool) => {
        tool.requiredTools.forEach((req) => {
          expect(validTiers).toContain(req.minTier);
        });
      });
    });

    it('should have non-negative durability consumption', () => {
      TOOLS.forEach((tool) => {
        tool.requiredTools.forEach((req) => {
          expect(req.consumesDurability).toBeGreaterThanOrEqual(0);
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

  describe('Tier progression logic', () => {
    it('should have most primitive tools without tool requirements', () => {
      const primitive = getToolsByTier('primitive');
      // Most primitive tools don't require other tools (hammerstone, grinding_stone)
      // but some (like hand_drill) may require stone-tier tools to craft
      const noRequirements = primitive.filter((t) => t.requiredTools.length === 0);
      expect(noRequirements.length).toBeGreaterThan(0);
    });

    it('should have tools generally requiring same-tier or lower tools', () => {
      const toolsWithRequirements = TOOLS.filter((t) => t.requiredTools.length > 0);
      toolsWithRequirements.forEach((tool) => {
        const toolTierIndex = TIER_ORDER.indexOf(tool.tier);
        tool.requiredTools.forEach((req) => {
          const reqTool = TOOLS_BY_ID[req.toolId];
          if (reqTool) {
            const reqTierIndex = TIER_ORDER.indexOf(reqTool.tier);
            // Required tool tier should be at most one tier above the tool being crafted
            // (some tools like hand_drill require stone tools to make despite being primitive)
            expect(reqTierIndex).toBeLessThanOrEqual(toolTierIndex + 1);
          }
        });
      });
    });
  });

  describe('Specific tool data', () => {
    it('hammerstone should be the most basic tool', () => {
      const hammerstone = TOOLS_BY_ID['hammerstone'];
      expect(hammerstone.tier).toBe('primitive');
      expect(hammerstone.requiredTools.length).toBe(0);
      expect(hammerstone.requiredComponents.length).toBe(0);
    });

    it('steel hammer should be the ultimate metalworking tool', () => {
      const steelHammer = TOOLS_BY_ID['steel_hammer'];
      expect(steelHammer.tier).toBe('steel');
      expect(steelHammer.stats.efficiency).toBeGreaterThanOrEqual(4.0);
      expect(steelHammer.stats.craftingBonus).toBeGreaterThanOrEqual(4.0);
    });

    it('fire tools should have fire_starting ability', () => {
      const fireTools = getToolsByCategory('fire');
      const fireStartingTools = fireTools.filter((t) =>
        t.stats.specialAbilities.includes('fire_starting')
      );
      expect(fireStartingTools.length).toBeGreaterThan(0);
    });

    it('mining tools should enable ore gathering', () => {
      const miningTools = getToolsByCategory('mining');
      miningTools.forEach((tool) => {
        expect(tool.enablesGathering.length).toBeGreaterThan(0);
      });
    });
  });
});
