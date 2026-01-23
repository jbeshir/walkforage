import { TECHNOLOGIES, TECH_BY_ID, getTechsByEra, getAvailableTechs } from '../src/data/techTree';
import { LithicEra } from '../src/types/tech';

describe('Tech Tree Data', () => {
  describe('TECHNOLOGIES array', () => {
    it('should contain technology entries', () => {
      expect(TECHNOLOGIES.length).toBeGreaterThan(0);
    });

    it('should have exactly 7 lithic era technologies', () => {
      expect(TECHNOLOGIES.length).toBe(7);
    });

    it('should have unique ids for all technologies', () => {
      const ids = TECHNOLOGIES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid lithic eras for all technologies', () => {
      const validEras: LithicEra[] = [
        'lower_paleolithic',
        'middle_paleolithic',
        'upper_paleolithic',
        'mesolithic',
      ];
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
          expect(['stone', 'wood', 'food']).toContain(cost.resourceType);
        });
      });
    });
  });

  describe('TECH_BY_ID', () => {
    it('should contain entries for all technologies', () => {
      expect(Object.keys(TECH_BY_ID).length).toBe(TECHNOLOGIES.length);
    });

    it('should allow lookup by id', () => {
      const basicKnapping = TECH_BY_ID['basic_knapping'];
      expect(basicKnapping).toBeDefined();
      expect(basicKnapping.name).toBe('Basic Knapping');
      expect(basicKnapping.era).toBe('lower_paleolithic');
    });

    it('should return undefined for non-existent id', () => {
      const nonExistent = TECH_BY_ID['nonexistent_tech'];
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('getTechsByEra', () => {
    it('should return lower paleolithic technologies', () => {
      const lowerPaleo = getTechsByEra('lower_paleolithic');
      expect(lowerPaleo.length).toBeGreaterThan(0);
      lowerPaleo.forEach((tech) => {
        expect(tech.era).toBe('lower_paleolithic');
      });
      expect(lowerPaleo.some((t) => t.id === 'basic_knapping')).toBe(true);
    });

    it('should return middle paleolithic technologies', () => {
      const middlePaleo = getTechsByEra('middle_paleolithic');
      expect(middlePaleo.length).toBeGreaterThan(0);
      middlePaleo.forEach((tech) => {
        expect(tech.era).toBe('middle_paleolithic');
      });
      expect(middlePaleo.some((t) => t.id === 'hafting')).toBe(true);
    });

    it('should return upper paleolithic technologies', () => {
      const upperPaleo = getTechsByEra('upper_paleolithic');
      expect(upperPaleo.length).toBeGreaterThan(0);
      upperPaleo.forEach((tech) => {
        expect(tech.era).toBe('upper_paleolithic');
      });
      expect(upperPaleo.some((t) => t.id === 'blade_technology')).toBe(true);
    });

    it('should return mesolithic technologies', () => {
      const mesolithic = getTechsByEra('mesolithic');
      expect(mesolithic.length).toBeGreaterThan(0);
      mesolithic.forEach((tech) => {
        expect(tech.era).toBe('mesolithic');
      });
      expect(mesolithic.some((t) => t.id === 'polished_stone')).toBe(true);
    });
  });

  describe('getAvailableTechs', () => {
    it('should return basic_knapping when no techs unlocked', () => {
      const available = getAvailableTechs([]);
      expect(available.length).toBeGreaterThan(0);
      expect(available.some((t) => t.id === 'basic_knapping')).toBe(true);
    });

    it('should not return already unlocked techs', () => {
      const available = getAvailableTechs(['basic_knapping']);
      expect(available.some((t) => t.id === 'basic_knapping')).toBe(false);
    });

    it('should unlock grinding after basic_knapping', () => {
      const available = getAvailableTechs(['basic_knapping']);
      expect(available.some((t) => t.id === 'grinding')).toBe(true);
    });

    it('should unlock cordage_making after basic_knapping', () => {
      const available = getAvailableTechs(['basic_knapping']);
      expect(available.some((t) => t.id === 'cordage_making')).toBe(true);
    });

    it('should unlock hafting after basic_knapping and cordage_making', () => {
      // hafting requires basic_knapping and cordage_making
      const withoutCordage = getAvailableTechs(['basic_knapping']);
      expect(withoutCordage.some((t) => t.id === 'hafting')).toBe(false);

      const withCordage = getAvailableTechs(['basic_knapping', 'cordage_making']);
      expect(withCordage.some((t) => t.id === 'hafting')).toBe(true);
    });

    it('should progressively unlock technologies', () => {
      // Follow the path to blade_technology - now unlocks directly after hafting
      const available = getAvailableTechs(['basic_knapping', 'cordage_making', 'hafting']);
      expect(available.some((t) => t.id === 'blade_technology')).toBe(true);
    });
  });

  describe('Tech prerequisites', () => {
    it('should have valid prerequisite references', () => {
      TECHNOLOGIES.forEach((tech) => {
        tech.prerequisites.forEach((prereqId) => {
          expect(TECH_BY_ID[prereqId]).toBeDefined();
        });
      });
    });

    it('basic_knapping should have no prerequisites (starting tech)', () => {
      const basicKnapping = TECH_BY_ID['basic_knapping'];
      expect(basicKnapping.prerequisites).toEqual([]);
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
            currentTech.prerequisites.forEach((prereqId) => {
              // Should never find the original tech in its dependency tree
              expect(prereqId).not.toBe(tech.id);
              queue.push(prereqId);
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
            const hasPrereq = unlockedTech.prerequisites.includes(tech.id);
            expect(hasPrereq).toBe(true);
          }
        });
      });
    });
  });

  describe('Era progression', () => {
    it('should have lower paleolithic techs at the start', () => {
      const lowerPaleoTechs = getTechsByEra('lower_paleolithic');
      const startingTech = lowerPaleoTechs.find((t) => t.prerequisites.length === 0);
      expect(startingTech).toBeDefined();
      expect(startingTech?.id).toBe('basic_knapping');
    });

    it('middle paleolithic techs should require lower paleolithic prerequisites', () => {
      const middlePaleoTechs = getTechsByEra('middle_paleolithic');
      middlePaleoTechs.forEach((tech) => {
        // Each middle paleolithic tech should have at least one prerequisite
        expect(tech.prerequisites.length).toBeGreaterThan(0);

        // Follow prerequisite chain - should eventually reach lower_paleolithic
        const hasPathToLowerPaleo = tech.prerequisites.some((prereqId) => {
          let current = TECH_BY_ID[prereqId];
          while (current) {
            if (current.era === 'lower_paleolithic') return true;
            if (current.prerequisites.length === 0) break;
            current = TECH_BY_ID[current.prerequisites[0]];
          }
          return false;
        });
        expect(hasPathToLowerPaleo).toBe(true);
      });
    });
  });

  describe('Specific technology data', () => {
    it('basic_knapping should enable hammerstone recipe', () => {
      const basicKnapping = TECH_BY_ID['basic_knapping'];
      expect(basicKnapping.enablesRecipes).toContain('hammerstone');
    });

    it('hafting should require cordage_making', () => {
      const hafting = TECH_BY_ID['hafting'];
      expect(hafting.prerequisites).toContain('cordage_making');
    });

    it('polished_stone should be late-game technology', () => {
      const polishedStone = TECH_BY_ID['polished_stone'];
      expect(polishedStone.era).toBe('mesolithic');
    });

    it('blade_technology should enable pressure_flaker recipe', () => {
      const bladeTech = TECH_BY_ID['blade_technology'];
      expect(bladeTech.enablesRecipes).toContain('pressure_flaker');
    });
  });

  describe('Recipes enabled', () => {
    it('all technologies should enable something (unlocks or recipes)', () => {
      // Every technology should enable at least one other tech or recipe
      TECHNOLOGIES.forEach((tech) => {
        const enablesSomething = tech.unlocks.length > 0 || tech.enablesRecipes.length > 0;
        expect(enablesSomething).toBe(true);
      });
    });
  });
});
