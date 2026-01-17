import { TECHNOLOGIES, TECH_BY_ID, getTechsByEra, getAvailableTechs } from '../src/data/techTree';
import { TechEra } from '../src/types/tech';

describe('Tech Tree Data', () => {
  describe('TECHNOLOGIES array', () => {
    it('should contain technology entries', () => {
      expect(TECHNOLOGIES.length).toBeGreaterThan(0);
    });

    it('should have unique ids for all technologies', () => {
      const ids = TECHNOLOGIES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid eras for all technologies', () => {
      const validEras: TechEra[] = ['stone', 'copper', 'bronze', 'iron', 'advanced'];
      TECHNOLOGIES.forEach((tech) => {
        expect(validEras).toContain(tech.era);
      });
    });

    it('should have non-empty names and descriptions', () => {
      TECHNOLOGIES.forEach((tech) => {
        expect(tech.name.length).toBeGreaterThan(0);
        expect(tech.description.length).toBeGreaterThan(0);
      });
    });

    it('should have valid resource cost quantities', () => {
      TECHNOLOGIES.forEach((tech) => {
        tech.resourceCost.forEach((cost) => {
          expect(cost.quantity).toBeGreaterThan(0);
          expect(cost.resourceId.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have position coordinates', () => {
      TECHNOLOGIES.forEach((tech) => {
        expect(typeof tech.position.x).toBe('number');
        expect(typeof tech.position.y).toBe('number');
      });
    });

    it('should have icon strings', () => {
      TECHNOLOGIES.forEach((tech) => {
        expect(tech.icon.length).toBeGreaterThan(0);
      });
    });
  });

  describe('TECH_BY_ID', () => {
    it('should contain entries for all technologies', () => {
      expect(Object.keys(TECH_BY_ID).length).toBe(TECHNOLOGIES.length);
    });

    it('should allow lookup by id', () => {
      const flintKnapping = TECH_BY_ID['flint_knapping'];
      expect(flintKnapping).toBeDefined();
      expect(flintKnapping.name).toBe('Flint Knapping');
      expect(flintKnapping.era).toBe('stone');
    });

    it('should return undefined for non-existent id', () => {
      const nonExistent = TECH_BY_ID['nonexistent_tech'];
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('getTechsByEra', () => {
    it('should return stone age technologies', () => {
      const stone = getTechsByEra('stone');
      expect(stone.length).toBeGreaterThan(0);
      stone.forEach((tech) => {
        expect(tech.era).toBe('stone');
      });
      expect(stone.some((t) => t.id === 'flint_knapping')).toBe(true);
      expect(stone.some((t) => t.id === 'pottery')).toBe(true);
    });

    it('should return copper age technologies', () => {
      const copper = getTechsByEra('copper');
      expect(copper.length).toBeGreaterThan(0);
      copper.forEach((tech) => {
        expect(tech.era).toBe('copper');
      });
      expect(copper.some((t) => t.id === 'copper_smelting')).toBe(true);
      expect(copper.some((t) => t.id === 'copper_tools')).toBe(true);
    });

    it('should return bronze age technologies', () => {
      const bronze = getTechsByEra('bronze');
      expect(bronze.length).toBeGreaterThan(0);
      bronze.forEach((tech) => {
        expect(tech.era).toBe('bronze');
      });
      expect(bronze.some((t) => t.id === 'bronze_alloy')).toBe(true);
      expect(bronze.some((t) => t.id === 'bronze_tools')).toBe(true);
    });

    it('should return iron age technologies', () => {
      const iron = getTechsByEra('iron');
      expect(iron.length).toBeGreaterThan(0);
      iron.forEach((tech) => {
        expect(tech.era).toBe('iron');
      });
      expect(iron.some((t) => t.id === 'iron_smelting')).toBe(true);
      expect(iron.some((t) => t.id === 'steel_tools')).toBe(true);
    });

    it('should return empty array for advanced era (not yet implemented)', () => {
      const advanced = getTechsByEra('advanced');
      expect(advanced).toEqual([]);
    });
  });

  describe('getAvailableTechs', () => {
    it('should return flint_knapping when no techs unlocked', () => {
      const available = getAvailableTechs([]);
      expect(available.length).toBeGreaterThan(0);
      expect(available.some((t) => t.id === 'flint_knapping')).toBe(true);
    });

    it('should not return already unlocked techs', () => {
      const available = getAvailableTechs(['flint_knapping']);
      expect(available.some((t) => t.id === 'flint_knapping')).toBe(false);
    });

    it('should unlock stone_tools after flint_knapping', () => {
      const available = getAvailableTechs(['flint_knapping']);
      expect(available.some((t) => t.id === 'stone_tools')).toBe(true);
    });

    it('should unlock basket_weaving after flint_knapping', () => {
      const available = getAvailableTechs(['flint_knapping']);
      expect(available.some((t) => t.id === 'basket_weaving')).toBe(true);
    });

    it('should not unlock pottery without both prerequisites', () => {
      // Pottery requires fire_making and clay_gathering
      const withoutClay = getAvailableTechs([
        'flint_knapping',
        'stone_tools',
        'woodworking',
        'fire_making',
      ]);
      expect(withoutClay.some((t) => t.id === 'pottery')).toBe(false);

      const withoutFire = getAvailableTechs(['flint_knapping', 'basket_weaving', 'clay_gathering']);
      expect(withoutFire.some((t) => t.id === 'pottery')).toBe(false);
    });

    it('should unlock pottery when both prerequisites met', () => {
      const available = getAvailableTechs([
        'flint_knapping',
        'stone_tools',
        'woodworking',
        'fire_making',
        'basket_weaving',
        'clay_gathering',
      ]);
      expect(available.some((t) => t.id === 'pottery')).toBe(true);
    });

    it('should progressively unlock copper age techs', () => {
      // Follow the path to copper tools
      const stoneTechs = [
        'flint_knapping',
        'stone_tools',
        'woodworking',
        'fire_making',
        'basket_weaving',
        'clay_gathering',
        'pottery',
      ];

      let available = getAvailableTechs(stoneTechs);
      expect(available.some((t) => t.id === 'charcoal_production')).toBe(true);

      available = getAvailableTechs([...stoneTechs, 'charcoal_production']);
      expect(available.some((t) => t.id === 'simple_kiln')).toBe(true);

      available = getAvailableTechs([...stoneTechs, 'charcoal_production', 'simple_kiln']);
      expect(available.some((t) => t.id === 'copper_smelting')).toBe(true);

      available = getAvailableTechs([
        ...stoneTechs,
        'charcoal_production',
        'simple_kiln',
        'copper_smelting',
      ]);
      expect(available.some((t) => t.id === 'copper_tools')).toBe(true);
    });
  });

  describe('Tech prerequisites', () => {
    it('should have valid prerequisite references', () => {
      TECHNOLOGIES.forEach((tech) => {
        tech.prerequisites.forEach((prereq) => {
          expect(TECH_BY_ID[prereq.techId]).toBeDefined();
        });
      });
    });

    it('should have prerequisite type as "prerequisite"', () => {
      TECHNOLOGIES.forEach((tech) => {
        tech.prerequisites.forEach((prereq) => {
          expect(prereq.type).toBe('prerequisite');
        });
      });
    });

    it('flint_knapping should have no prerequisites (starting tech)', () => {
      const flintKnapping = TECH_BY_ID['flint_knapping'];
      expect(flintKnapping.prerequisites).toEqual([]);
    });

    it('should have no circular dependencies', () => {
      // Check that no tech depends (directly or indirectly) on itself
      TECHNOLOGIES.forEach((tech) => {
        const visited = new Set<string>();
        const queue = [tech.id];

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;
          visited.add(current);

          const currentTech = TECH_BY_ID[current];
          if (currentTech) {
            currentTech.prerequisites.forEach((prereq) => {
              // Should never find the original tech in its dependency tree
              expect(prereq.techId).not.toBe(tech.id);
              queue.push(prereq.techId);
            });
          }
        }
      });
    });
  });

  describe('Tech unlocks consistency', () => {
    it('should have unlocks that reference valid techs', () => {
      // Not all unlocks are necessarily tech IDs - they could be buildings, recipes, etc.
      // But the ones that ARE tech IDs should exist
      TECHNOLOGIES.forEach((tech) => {
        tech.unlocks.forEach((unlockId) => {
          const unlockedTech = TECH_BY_ID[unlockId];
          // If it's a tech ID, verify it exists
          if (unlockedTech) {
            expect(unlockedTech.id).toBe(unlockId);
          }
        });
      });
    });

    it('unlocked techs should reference unlocking tech as prerequisite', () => {
      TECHNOLOGIES.forEach((tech) => {
        tech.unlocks.forEach((unlockId) => {
          const unlockedTech = TECH_BY_ID[unlockId];
          // Only check if it's actually a technology
          if (unlockedTech) {
            const hasPrereq = unlockedTech.prerequisites.some((p) => p.techId === tech.id);
            expect(hasPrereq).toBe(true);
          }
        });
      });
    });
  });

  describe('Era progression', () => {
    it('should have stone age techs at the start', () => {
      const stoneTechs = getTechsByEra('stone');
      const startingTech = stoneTechs.find((t) => t.prerequisites.length === 0);
      expect(startingTech).toBeDefined();
      expect(startingTech?.id).toBe('flint_knapping');
    });

    it('copper age techs should require stone age prerequisites', () => {
      const copperTechs = getTechsByEra('copper');
      copperTechs.forEach((tech) => {
        // Each copper tech should have at least one prerequisite
        expect(tech.prerequisites.length).toBeGreaterThan(0);

        // Follow prerequisite chain - should eventually reach stone age
        const prereqIds = tech.prerequisites.map((p) => p.techId);
        const hasPathToStone = prereqIds.some((prereqId) => {
          let current = TECH_BY_ID[prereqId];
          while (current) {
            if (current.era === 'stone') return true;
            if (current.prerequisites.length === 0) break;
            current = TECH_BY_ID[current.prerequisites[0].techId];
          }
          return false;
        });
        expect(hasPathToStone).toBe(true);
      });
    });
  });

  describe('Specific technology data', () => {
    it('flint_knapping should enable basic crafting recipes', () => {
      const flintKnapping = TECH_BY_ID['flint_knapping'];
      expect(flintKnapping.enablesRecipes).toContain('hammerstone');
      expect(flintKnapping.enablesRecipes).toContain('stone_knife');
    });

    it('pottery should require both fire_making and clay_gathering', () => {
      const pottery = TECH_BY_ID['pottery'];
      const prereqIds = pottery.prerequisites.map((p) => p.techId);
      expect(prereqIds).toContain('fire_making');
      expect(prereqIds).toContain('clay_gathering');
    });

    it('bronze_alloy should require tin_discovery', () => {
      const bronzeAlloy = TECH_BY_ID['bronze_alloy'];
      const prereqIds = bronzeAlloy.prerequisites.map((p) => p.techId);
      expect(prereqIds).toContain('tin_discovery');
    });

    it('steel_tools should be end-game technology', () => {
      const steelTools = TECH_BY_ID['steel_tools'];
      expect(steelTools.era).toBe('iron');
      expect(steelTools.unlocks).toEqual([]);
      expect(steelTools.gatheringBonus?.multiplier).toBeGreaterThanOrEqual(2.0);
      expect(steelTools.craftingBonus?.speedMultiplier).toBeGreaterThanOrEqual(3.0);
    });

    it('copper_tools should provide gathering bonus', () => {
      const copperTools = TECH_BY_ID['copper_tools'];
      expect(copperTools.gatheringBonus).toBeDefined();
      expect(copperTools.gatheringBonus?.multiplier).toBeGreaterThan(1);
    });

    it('bronze_tools should provide both gathering and crafting bonuses', () => {
      const bronzeTools = TECH_BY_ID['bronze_tools'];
      expect(bronzeTools.gatheringBonus).toBeDefined();
      expect(bronzeTools.craftingBonus).toBeDefined();
    });
  });

  describe('Buildings and recipes enabled', () => {
    it('technologies should enable at least buildings or recipes', () => {
      // Most technologies should enable something
      const techsWithContent = TECHNOLOGIES.filter(
        (t) => t.enablesBuildings.length > 0 || t.enablesRecipes.length > 0
      );
      expect(techsWithContent.length).toBeGreaterThan(TECHNOLOGIES.length * 0.5);
    });

    it('fire_making should enable fire_pit building', () => {
      const fireMaking = TECH_BY_ID['fire_making'];
      expect(fireMaking.enablesBuildings).toContain('fire_pit');
    });

    it('pottery should enable pottery_kiln building', () => {
      const pottery = TECH_BY_ID['pottery'];
      expect(pottery.enablesBuildings).toContain('pottery_kiln');
    });

    it('smithing should enable smithy building', () => {
      const smithing = TECH_BY_ID['smithing'];
      expect(smithing.enablesBuildings).toContain('smithy');
    });
  });
});
