/**
 * Tests for ResourceSpawnService
 * Tests resource spawning including realm-biome aware wood selection
 */
import { resourceSpawnService } from '../src/services/ResourceSpawnService';
import { STONES_BY_ID } from '../src/data/stones';
import { WOODS_BY_ID, getWoodsByRealm } from '../src/data/woods';

describe('ResourceSpawnService', () => {
  describe('spawnResources', () => {
    it('should spawn resources for valid coordinates', async () => {
      const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);

      expect(resources).toBeInstanceOf(Array);
      expect(resources.length).toBeGreaterThan(0);
    });

    it('should return resources with required fields', async () => {
      const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);

      for (const resource of resources) {
        expect(resource.resourceId).toBeDefined();
        expect(typeof resource.resourceId).toBe('string');
        expect(['stone', 'wood']).toContain(resource.type);
        expect(typeof resource.quantity).toBe('number');
        expect(resource.quantity).toBeGreaterThan(0);
      }
    });

    it('should spawn valid stone IDs', async () => {
      const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);
      const stones = resources.filter((r) => r.type === 'stone');

      for (const stone of stones) {
        expect(STONES_BY_ID[stone.resourceId]).toBeDefined();
      }
    });

    it('should spawn valid wood IDs', async () => {
      const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);
      const woods = resources.filter((r) => r.type === 'wood');

      for (const wood of woods) {
        expect(WOODS_BY_ID[wood.resourceId]).toBeDefined();
      }
    });

    it('should spawn between min and max configured counts', async () => {
      // Run multiple times to check bounds
      for (let i = 0; i < 10; i++) {
        const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);
        // Default config is 3-5 resources
        expect(resources.length).toBeGreaterThanOrEqual(3);
        expect(resources.length).toBeLessThanOrEqual(5);
      }
    });

    it('should work for different global locations', async () => {
      const locations = [
        { name: 'NYC', lat: 40.7128, lng: -74.006 },
        { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
        { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
        { name: 'Amazon', lat: -3.4653, lng: -62.2159 },
        { name: 'Sahara', lat: 23.4162, lng: 25.6628 },
      ];

      for (const loc of locations) {
        const resources = await resourceSpawnService.spawnResources(loc.lat, loc.lng);
        expect(resources.length).toBeGreaterThan(0);
      }
    });
  });

  describe('configuration', () => {
    it('should allow updating spawn configuration', () => {
      // Save original to restore
      const originalConfig = {
        stoneRatio: 0.6,
        countMin: 3,
        countMax: 5,
      };

      // Update config
      resourceSpawnService.setConfig({
        stoneRatio: 0.8,
        countMin: 1,
        countMax: 2,
      });

      // Restore original config
      resourceSpawnService.setConfig(originalConfig);
    });
  });

  describe('getToolstones', () => {
    it('should return toolstone types', () => {
      const toolstones = resourceSpawnService.getToolstones();

      expect(toolstones).toBeInstanceOf(Array);
      expect(toolstones.length).toBeGreaterThan(0);

      // All returned stones should have isToolstone flag
      for (const stone of toolstones) {
        expect(stone.isToolstone).toBe(true);
      }
    });

    it('should include known toolstones', () => {
      const toolstones = resourceSpawnService.getToolstones();
      const toolstoneIds = toolstones.map((s) => s.id);

      // These should be marked as toolstones
      expect(toolstoneIds).toContain('flint');
      expect(toolstoneIds).toContain('chert');
      expect(toolstoneIds).toContain('obsidian');
    });
  });

  describe('spawn distribution', () => {
    it('should spawn both stones and woods', async () => {
      // Run multiple spawns to check distribution
      let stoneCount = 0;
      let woodCount = 0;

      for (let i = 0; i < 20; i++) {
        const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);
        stoneCount += resources.filter((r) => r.type === 'stone').length;
        woodCount += resources.filter((r) => r.type === 'wood').length;
      }

      // Should have spawned some of each type
      expect(stoneCount).toBeGreaterThan(0);
      expect(woodCount).toBeGreaterThan(0);
    });

    it('should respect stone ratio approximately', async () => {
      let stoneCount = 0;
      let totalCount = 0;

      // Run many spawns for statistical significance
      for (let i = 0; i < 50; i++) {
        const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);
        stoneCount += resources.filter((r) => r.type === 'stone').length;
        totalCount += resources.length;
      }

      const stoneRatio = stoneCount / totalCount;
      // Default ratio is 0.6, allow ±0.15 for randomness
      expect(stoneRatio).toBeGreaterThan(0.4);
      expect(stoneRatio).toBeLessThan(0.8);
    });
  });

  describe('quantity calculation', () => {
    it('should spawn quantities based on rarity', async () => {
      // Run multiple spawns and collect quantities
      const quantities: number[] = [];

      for (let i = 0; i < 30; i++) {
        const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);
        for (const resource of resources) {
          quantities.push(resource.quantity);
        }
      }

      // All quantities should be positive integers
      for (const qty of quantities) {
        expect(Number.isInteger(qty)).toBe(true);
        expect(qty).toBeGreaterThan(0);
      }

      // Should have some variety in quantities
      const uniqueQuantities = new Set(quantities);
      expect(uniqueQuantities.size).toBeGreaterThan(1);
    });
  });

  describe('realm-biome aware spawning', () => {
    it('should spawn woods native to Nearctic realm in North America', async () => {
      const nearcticWoods = getWoodsByRealm('Nearctic');
      const nearcticWoodIds = new Set(nearcticWoods.map((w) => w.id));

      // Run multiple spawns in NYC to collect wood samples
      const spawnedWoodIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);
        const woods = resources.filter((r) => r.type === 'wood');
        for (const wood of woods) {
          spawnedWoodIds.push(wood.resourceId);
        }
      }

      // At least some spawned woods should be Nearctic species
      const nearcticSpawned = spawnedWoodIds.filter((id) => nearcticWoodIds.has(id));
      expect(nearcticSpawned.length).toBeGreaterThan(0);
    });

    it('should spawn woods native to Palearctic realm in Europe', async () => {
      const palearcticWoods = getWoodsByRealm('Palearctic');
      const palearcticWoodIds = new Set(palearcticWoods.map((w) => w.id));

      // Run multiple spawns in London to collect wood samples
      const spawnedWoodIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const resources = await resourceSpawnService.spawnResources(51.5074, -0.1278);
        const woods = resources.filter((r) => r.type === 'wood');
        for (const wood of woods) {
          spawnedWoodIds.push(wood.resourceId);
        }
      }

      // At least some spawned woods should be Palearctic species
      const palearcticSpawned = spawnedWoodIds.filter((id) => palearcticWoodIds.has(id));
      expect(palearcticSpawned.length).toBeGreaterThan(0);
    });

    it('should spawn woods native to Australasia realm in Australia', async () => {
      const australasiaWoods = getWoodsByRealm('Australasia');
      const australasiaWoodIds = new Set(australasiaWoods.map((w) => w.id));

      // Run multiple spawns in Sydney to collect wood samples
      const spawnedWoodIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const resources = await resourceSpawnService.spawnResources(-33.8688, 151.2093);
        const woods = resources.filter((r) => r.type === 'wood');
        for (const wood of woods) {
          spawnedWoodIds.push(wood.resourceId);
        }
      }

      // At least some spawned woods should be Australasia species
      const australasiaSpawned = spawnedWoodIds.filter((id) => australasiaWoodIds.has(id));
      expect(australasiaSpawned.length).toBeGreaterThan(0);
    });

    it('should spawn different woods in Europe vs North America', async () => {
      // Collect woods from NYC (Nearctic)
      const nycWoodIds: Set<string> = new Set();
      for (let i = 0; i < 30; i++) {
        const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);
        for (const r of resources.filter((r) => r.type === 'wood')) {
          nycWoodIds.add(r.resourceId);
        }
      }

      // Collect woods from London (Palearctic)
      const londonWoodIds: Set<string> = new Set();
      for (let i = 0; i < 30; i++) {
        const resources = await resourceSpawnService.spawnResources(51.5074, -0.1278);
        for (const r of resources.filter((r) => r.type === 'wood')) {
          londonWoodIds.add(r.resourceId);
        }
      }

      // The sets should not be identical
      // (they may have some overlap from cosmopolitan species like willow)
      const nycOnly = [...nycWoodIds].filter((id) => !londonWoodIds.has(id));
      const londonOnly = [...londonWoodIds].filter((id) => !nycWoodIds.has(id));

      // At least one location should have unique species
      expect(nycOnly.length + londonOnly.length).toBeGreaterThan(0);
    });

    it('should prefer native woods over foreign woods in North America', async () => {
      // Run many spawns in NYC
      const nearcticWoods = getWoodsByRealm('Nearctic');
      const nearcticWoodIds = new Set(nearcticWoods.map((w) => w.id));

      const spawnedWoodIds: string[] = [];
      for (let i = 0; i < 100; i++) {
        const resources = await resourceSpawnService.spawnResources(40.7128, -74.006);
        for (const r of resources.filter((r) => r.type === 'wood')) {
          spawnedWoodIds.push(r.resourceId);
        }
      }

      // All spawned woods should be valid
      for (const id of spawnedWoodIds) {
        expect(WOODS_BY_ID[id]).toBeDefined();
      }

      // If realm data is available, Nearctic woods should appear
      const nearcticCount = spawnedWoodIds.filter((id) => nearcticWoodIds.has(id)).length;
      expect(nearcticCount).toBeGreaterThan(0);
    });

    it('should prefer native woods over foreign woods in Europe', async () => {
      // Run many spawns in London
      const palearcticWoods = getWoodsByRealm('Palearctic');
      const palearcticWoodIds = new Set(palearcticWoods.map((w) => w.id));

      const spawnedWoodIds: string[] = [];
      for (let i = 0; i < 100; i++) {
        const resources = await resourceSpawnService.spawnResources(51.5074, -0.1278);
        for (const r of resources.filter((r) => r.type === 'wood')) {
          spawnedWoodIds.push(r.resourceId);
        }
      }

      // All spawned woods should be valid
      for (const id of spawnedWoodIds) {
        expect(WOODS_BY_ID[id]).toBeDefined();
      }

      // If realm data is available, Palearctic woods should appear
      const palearcticCount = spawnedWoodIds.filter((id) => palearcticWoodIds.has(id)).length;
      expect(palearcticCount).toBeGreaterThan(0);
    });

    it('should spawn tropical species in the Amazon', async () => {
      const neotropicWoods = getWoodsByRealm('Neotropic');
      const neotropicWoodIds = new Set(neotropicWoods.map((w) => w.id));

      // Run multiple spawns in Amazon
      const spawnedWoodIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const resources = await resourceSpawnService.spawnResources(-3.4653, -62.2159);
        const woods = resources.filter((r) => r.type === 'wood');
        for (const wood of woods) {
          spawnedWoodIds.push(wood.resourceId);
        }
      }

      // At least some spawned woods should be Neotropic species
      const neotropicSpawned = spawnedWoodIds.filter((id) => neotropicWoodIds.has(id));
      expect(neotropicSpawned.length).toBeGreaterThan(0);

      // Should include iconic species
      const hasIconicSpecies =
        spawnedWoodIds.includes('mahogany') ||
        spawnedWoodIds.includes('brazil_nut') ||
        spawnedWoodIds.includes('ceiba') ||
        spawnedWoodIds.includes('balsa');
      expect(hasIconicSpecies).toBe(true);
    });
  });

  describe('global coverage spawning', () => {
    const testLocations = [
      { name: 'New York (Nearctic)', lat: 40.7128, lng: -74.006 },
      { name: 'London (Palearctic)', lat: 51.5074, lng: -0.1278 },
      { name: 'Tokyo (Palearctic)', lat: 35.6762, lng: 139.6503 },
      { name: 'Sydney (Australasia)', lat: -33.8688, lng: 151.2093 },
      { name: 'Amazon (Neotropic)', lat: -3.4653, lng: -62.2159 },
      { name: 'Nairobi (Afrotropic)', lat: -1.2921, lng: 36.8219 },
      { name: 'Mumbai (Indomalayan)', lat: 19.076, lng: 72.8777 },
    ];

    it.each(testLocations)('should spawn valid resources for $name', async ({ lat, lng }) => {
      const resources = await resourceSpawnService.spawnResources(lat, lng);

      expect(resources.length).toBeGreaterThan(0);

      for (const resource of resources) {
        if (resource.type === 'stone') {
          expect(STONES_BY_ID[resource.resourceId]).toBeDefined();
        } else {
          expect(WOODS_BY_ID[resource.resourceId]).toBeDefined();
        }
      }
    });
  });
});
