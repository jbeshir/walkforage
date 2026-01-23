// ResourceSpawnService - Selects resources based on geological and biome data
// Pure resource selection logic - no React Native dependencies

import { LocationGeoData } from '../types/gis';
import { StoneType, WoodType } from '../types/resources';
import { STONES, STONES_BY_ID, getToolstones } from '../data/stones';
import { WOODS, WOODS_BY_ID, getWoodsByBiome } from '../data/woods';
import { getLithologyMapping } from '../data/gis';
import { getRealmBiomeMapping } from '../data/gis/mappings';

class ResourceSpawnService {
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
   */
  private selectWoodFromGeo(geoData: LocationGeoData): WoodType | null {
    const { type: biomeType, realm, confidence } = geoData.biome;

    // If confidence is too low, fall back to random
    if (confidence < 0.2) {
      return this.selectRandomWood();
    }

    // Try realm+biome mapping first
    if (realm) {
      const realmMapping = getRealmBiomeMapping(realm, biomeType);
      if (realmMapping && realmMapping.woodIds.length > 0) {
        const woodId = this.weightedRandomSelect(realmMapping.woodIds, realmMapping.weights);
        const wood = WOODS_BY_ID[woodId];
        if (wood) return wood;
      }

      // If no curated mapping exists, filter biome woods by realm
      const biomeWoods = getWoodsByBiome(biomeType);
      const realmFiltered = biomeWoods.filter(
        (w) => w.nativeRealms && w.nativeRealms.includes(realm)
      );
      if (realmFiltered.length > 0) {
        return this.selectByRarity(realmFiltered);
      }
    }

    // Fallback: biome-only (no realm info)
    const biomeWoods = getWoodsByBiome(biomeType);
    if (biomeWoods.length > 0) {
      return this.selectByRarity(biomeWoods);
    }

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
  private selectByRarity<T extends { rarity: number }>(resources: T[]): T {
    if (resources.length === 0) {
      throw new Error('Cannot select from empty array');
    }

    // Use rarity as weight (higher rarity = more likely to spawn)
    const weights = resources.map((r) => r.rarity);
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
   * Get toolstones (for special spawning rules if needed)
   */
  getToolstones(): StoneType[] {
    return getToolstones();
  }

  /**
   * Get a single random stone appropriate for the location's geology
   * Used for step-based gathering
   */
  getRandomStoneForLocation(geoData: LocationGeoData): StoneType | null {
    return this.selectStoneFromGeo(geoData);
  }

  /**
   * Get a single random wood appropriate for the location's biome
   * Used for step-based gathering
   */
  getRandomWoodForLocation(geoData: LocationGeoData): WoodType | null {
    return this.selectWoodFromGeo(geoData);
  }

  /**
   * Get a random stone (no location data)
   * Used when geo data is not available
   */
  getRandomStone(): StoneType {
    return this.selectRandomStone();
  }

  /**
   * Get a random wood (no location data)
   * Used when geo data is not available
   */
  getRandomWood(): WoodType {
    return this.selectRandomWood();
  }
}

// Export singleton instance
export const resourceSpawnService = new ResourceSpawnService();
export default resourceSpawnService;
