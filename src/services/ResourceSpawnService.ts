// ResourceSpawnService - Spawns resources based on geological and biome data
// Uses GeoDataService for location lookups and mapping files for resource selection

import { LocationGeoData, SpawnConfig, SpawnedResourceData } from '../types/gis';
import { StoneType, WoodType, BiomeCode } from '../types/resources';
import { STONES, STONES_BY_ID, getToolstones } from '../data/stones';
import { WOODS, WOODS_BY_ID, getWoodsByBiome } from '../data/woods';
import { getLithologyMapping } from '../data/gis';
import { getRealmBiomeMapping } from '../data/gis/mappings';
import geoDataService from './GeoDataService';

// Default spawn configuration
const DEFAULT_CONFIG: SpawnConfig = {
  stoneRatio: 0.6,     // 60% stones, 40% woods
  countMin: 3,
  countMax: 5,
  useRarity: true,
  useGeoData: true,
};

class ResourceSpawnService {
  private config: SpawnConfig;

  constructor(config: Partial<SpawnConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update spawn configuration
   */
  setConfig(config: Partial<SpawnConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate resources for a location based on GIS data
   */
  async spawnResources(lat: number, lng: number): Promise<SpawnedResourceData[]> {
    // Get geological/biome data for location (if enabled)
    let geoData: LocationGeoData | null = null;
    if (this.config.useGeoData) {
      try {
        geoData = await geoDataService.getLocationData(lat, lng);
      } catch (error) {
        console.warn('GIS lookup failed, using random spawning:', error);
      }
    }

    // Determine resource count
    const count =
      this.config.countMin +
      Math.floor(Math.random() * (this.config.countMax - this.config.countMin + 1));

    const resources: SpawnedResourceData[] = [];

    for (let i = 0; i < count; i++) {
      const isStone = Math.random() < this.config.stoneRatio;

      if (isStone) {
        const stone = geoData
          ? this.selectStoneFromGeo(geoData)
          : this.selectRandomStone();

        if (stone) {
          resources.push({
            resourceId: stone.id,
            type: 'stone',
            quantity: this.calculateQuantity(stone.properties.rarity),
          });
        }
      } else {
        const wood = geoData
          ? this.selectWoodFromGeo(geoData)
          : this.selectRandomWood();

        if (wood) {
          resources.push({
            resourceId: wood.id,
            type: 'wood',
            quantity: this.calculateQuantity(wood.properties.rarity),
          });
        }
      }
    }

    return resources;
  }

  /**
   * Select a stone type based on geological data
   */
  private selectStoneFromGeo(geoData: LocationGeoData): StoneType | null {
    const { primaryLithology, secondaryLithologies, confidence } = geoData.geology;

    // If confidence is too low, fall back to random
    if (confidence < 0.2) {
      return this.selectRandomStone();
    }

    // Get mapping for primary lithology
    const mapping = getLithologyMapping(primaryLithology);

    if (mapping && mapping.stoneIds.length > 0) {
      // Use weighted random selection from mapped stones
      const stoneId = this.weightedRandomSelect(mapping.stoneIds, mapping.weights);
      const stone = STONES_BY_ID[stoneId];
      if (stone) return stone;
    }

    // Try secondary lithologies with lower probability
    for (const lith of secondaryLithologies) {
      if (Math.random() < 0.3) {
        const secMapping = getLithologyMapping(lith);
        if (secMapping && secMapping.stoneIds.length > 0) {
          const stoneId = this.weightedRandomSelect(secMapping.stoneIds, secMapping.weights);
          const stone = STONES_BY_ID[stoneId];
          if (stone) return stone;
        }
      }
    }

    // Fall back to random stone with rarity weighting
    return this.selectRandomStone();
  }

  /**
   * Select a wood type based on biome data
   * Uses fallback chain: realm+biome -> biome -> random
   */
  private selectWoodFromGeo(geoData: LocationGeoData): WoodType | null {
    const { type: biomeType, realmBiome, confidence } = geoData.biome;

    // If confidence is too low, fall back to random
    if (confidence < 0.2) {
      return this.selectRandomWood();
    }

    // 1. Try realm+biome mapping (most specific, continent-aware)
    if (realmBiome) {
      const realmMapping = getRealmBiomeMapping(realmBiome);
      if (realmMapping && realmMapping.woodIds.length > 0) {
        const woodId = this.weightedRandomSelect(realmMapping.woodIds, realmMapping.weights);
        const wood = WOODS_BY_ID[woodId];
        if (wood) return wood;
      }
    }

    // 2. Fall back to woods with matching biome
    const biomeWoods = getWoodsByBiome(biomeType);
    if (biomeWoods.length > 0) {
      return this.selectByRarity(biomeWoods);
    }

    // 3. Ultimate fallback
    return this.selectRandomWood();
  }

  /**
   * Select a random stone weighted by rarity
   */
  private selectRandomStone(): StoneType {
    return this.selectByRarity(STONES);
  }

  /**
   * Select a random wood weighted by rarity
   */
  private selectRandomWood(): WoodType {
    return this.selectByRarity(WOODS);
  }

  /**
   * Select resource weighted by rarity
   * Higher rarity value = more common (higher spawn probability)
   */
  private selectByRarity<T extends { properties: { rarity: number } }>(
    resources: T[]
  ): T {
    if (!this.config.useRarity || resources.length === 0) {
      return resources[Math.floor(Math.random() * resources.length)];
    }

    // Use rarity as weight (higher rarity = more likely to spawn)
    const weights = resources.map((r) => r.properties.rarity);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    if (totalWeight === 0) {
      return resources[Math.floor(Math.random() * resources.length)];
    }

    let random = Math.random() * totalWeight;
    for (let i = 0; i < resources.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return resources[i];
      }
    }

    return resources[resources.length - 1];
  }

  /**
   * Weighted random selection from parallel arrays
   */
  private weightedRandomSelect(items: string[], weights: number[]): string {
    if (items.length === 0) {
      throw new Error('Cannot select from empty array');
    }

    if (items.length !== weights.length) {
      // If weights don't match, use equal weights
      return items[Math.floor(Math.random() * items.length)];
    }

    const totalWeight = weights.reduce((a, b) => a + b, 0);

    if (totalWeight === 0) {
      return items[Math.floor(Math.random() * items.length)];
    }

    let random = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  }

  /**
   * Calculate spawn quantity based on rarity
   * Rarer resources spawn in smaller quantities
   */
  private calculateQuantity(rarity: number): number {
    // rarity 0.7 (common) -> 1-5
    // rarity 0.1 (rare) -> 1-2
    const maxQuantity = Math.max(1, Math.floor(rarity * 5) + 1);
    return 1 + Math.floor(Math.random() * maxQuantity);
  }

  /**
   * Get toolstones (for special spawning rules if needed)
   */
  getToolstones(): StoneType[] {
    return getToolstones();
  }
}

// Export singleton instance with default config
export const resourceSpawnService = new ResourceSpawnService();
export default resourceSpawnService;
