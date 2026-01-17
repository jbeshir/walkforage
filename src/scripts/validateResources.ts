/**
 * Resource Validation Script
 *
 * Checks for:
 * 1. All wood types have valid biomes (exist in BiomeCode type)
 * 2. All stone types have valid lithologies (exist in lithologyToStones.json mapping)
 * 3. All biomes have at least one wood type (from WOODS data)
 * 4. All lithologies in mapping have at least one stone type
 * 5. Consistency between STONES data and lithologyToStones.json mapping
 * 6. Spawn weight validation (weights should sum to ~1.0)
 * 7. Realm-biome mapping validation
 * 8. Toolstone coverage - which lithologies have toolstones available
 *
 * Run with: npx tsx src/scripts/validateResources.ts
 */

import { WOODS, getWoodsByBiome, getMappedRealmBiomes } from '../data/woods';
import { STONES, getToolstones } from '../data/stones';
import { BiomeCode } from '../types/resources';
import lithologyToStonesData from '../data/gis/mappings/lithologyToStones.json';
import realmBiomesToWoodsData from '../data/gis/mappings/realmBiomesToWoods.json';

interface ValidationResult {
  errors: string[];
  warnings: string[];
  info: string[];
}

// All valid biome codes from BiomeCode type
const VALID_BIOMES: BiomeCode[] = [
  'tropical_moist_broadleaf',
  'tropical_dry_broadleaf',
  'tropical_conifer',
  'temperate_broadleaf_mixed',
  'temperate_conifer',
  'boreal',
  'tropical_grassland',
  'temperate_grassland',
  'flooded_grassland',
  'montane',
  'tundra',
  'mediterranean',
  'desert',
  'mangrove',
];

// Type for the mapping structures
interface LithologyMapping {
  lithology: string;
  stoneIds: string[];
  weights: number[];
}

interface RealmBiomeMapping {
  realm: string;
  biome: string;
  woodIds: string[];
  weights: number[];
}

function validateResources(): ValidationResult {
  const result: ValidationResult = {
    errors: [],
    warnings: [],
    info: [],
  };

  const allWoodIds = new Set(WOODS.map((w) => w.id));
  const allStoneIds = new Set(STONES.map((s) => s.id));
  const validBiomeSet = new Set<string>(VALID_BIOMES);

  // Get mapping data (filter out metadata keys)
  const lithologyMappings = Object.entries(lithologyToStonesData)
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, value]) => [key, value as LithologyMapping] as const);

  const realmBiomeMappings = Object.entries(realmBiomesToWoodsData)
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, value]) => [key, value as RealmBiomeMapping] as const);

  const mappedLithologies = new Set(lithologyMappings.map(([key]) => key));

  // Track which biomes/lithologies have resources
  const biomesWithWoods = new Set<string>();
  const lithologiesWithStones = new Set<string>();

  // ========== 1. Validate Wood Types ==========
  result.info.push('--- Validating Wood Types ---');

  for (const wood of WOODS) {
    // Check all biomes are valid
    for (const biome of wood.biomes) {
      if (!validBiomeSet.has(biome)) {
        result.errors.push(`Wood "${wood.id}" has invalid biome "${biome}"`);
      } else {
        biomesWithWoods.add(biome);
      }
    }

    // Check rarity is valid
    if (wood.properties.rarity < 0 || wood.properties.rarity > 1) {
      result.errors.push(
        `Wood "${wood.id}" has invalid rarity ${wood.properties.rarity} (should be 0-1)`
      );
    }

    // Check realm-biome codes are valid format
    if (wood.realmBiomes) {
      for (const rb of wood.realmBiomes) {
        if (!/^[A-Z]{2}\d{2}$/.test(rb)) {
          result.errors.push(
            `Wood "${wood.id}" has invalid realmBiome format "${rb}" (expected XX##)`
          );
        }
      }
    }
  }

  // ========== 2. Validate Stone Types ==========
  result.info.push('--- Validating Stone Types ---');

  for (const stone of STONES) {
    // Check stone appears in at least one lithology mapping
    let foundInMapping = false;
    for (const [lithology, mapping] of lithologyMappings) {
      if (mapping.stoneIds.includes(stone.id)) {
        foundInMapping = true;
        lithologiesWithStones.add(lithology);
      }
    }

    if (!foundInMapping) {
      result.errors.push(
        `Stone "${stone.id}" is not referenced in any lithologyToStones.json mapping`
      );
    }

    // Check rarity is valid
    if (stone.properties.rarity < 0 || stone.properties.rarity > 1) {
      result.errors.push(
        `Stone "${stone.id}" has invalid rarity ${stone.properties.rarity} (should be 0-1)`
      );
    }

    // Check if at least one of the stone's lithologies exists in the mapping
    const hasValidMapping = stone.lithologies.some((lith) => mappedLithologies.has(lith));
    if (!hasValidMapping) {
      result.errors.push(
        `Stone "${stone.id}" has no lithologies that exist in lithologyToStones.json: [${stone.lithologies.join(', ')}]`
      );
    }
  }

  // ========== 3. Check All Biomes Have Woods ==========
  // Every biome must have at least one wood with that biome in its biomes array.
  // This ensures getWoodsByBiome() works as a fallback when realm-biome data is unavailable.
  // Woods in realm-biome mappings should also have the corresponding biome in their biomes array.
  result.info.push('--- Checking Biome Coverage ---');

  // Build a map of biomes to woods from realm-biome mappings
  const woodsByBiomeFromRealmMapping = new Map<string, Set<string>>();
  for (const [, mapping] of realmBiomeMappings) {
    if (!woodsByBiomeFromRealmMapping.has(mapping.biome)) {
      woodsByBiomeFromRealmMapping.set(mapping.biome, new Set());
    }
    for (const woodId of mapping.woodIds) {
      woodsByBiomeFromRealmMapping.get(mapping.biome)!.add(woodId);
    }
  }

  for (const biome of VALID_BIOMES) {
    const woodsForBiome = getWoodsByBiome(biome);
    if (woodsForBiome.length === 0) {
      result.errors.push(`Biome "${biome}" has no wood types in WOODS.biomes array`);
    }
  }

  // ========== 4. Check All Lithologies Have Stones ==========
  result.info.push('--- Checking Lithology Coverage ---');

  for (const [lithology, mapping] of lithologyMappings) {
    if (mapping.stoneIds.length === 0) {
      result.errors.push(`Lithology "${lithology}" has no stones in mapping`);
    }

    // Verify all referenced stone IDs exist
    for (const stoneId of mapping.stoneIds) {
      if (!allStoneIds.has(stoneId)) {
        result.errors.push(`Lithology "${lithology}" references non-existent stone "${stoneId}"`);
      }
    }
  }

  // ========== 5. Validate Lithology Spawn Weights ==========
  result.info.push('--- Validating Lithology Spawn Weights ---');

  for (const [lithology, mapping] of lithologyMappings) {
    const sum = mapping.weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      result.warnings.push(
        `Lithology "${lithology}" weights sum to ${sum.toFixed(3)} (expected ~1.0)`
      );
    }

    if (mapping.stoneIds.length !== mapping.weights.length) {
      result.errors.push(
        `Lithology "${lithology}" has ${mapping.stoneIds.length} stones but ${mapping.weights.length} weights`
      );
    }
  }

  // ========== 6. Validate Realm-Biome Mappings ==========
  result.info.push('--- Validating Realm-Biome Mappings ---');

  for (const [realmBiome, mapping] of realmBiomeMappings) {
    // Check format
    if (!/^[A-Z]{2}\d{2}$/.test(realmBiome)) {
      result.errors.push(`realmBiomesToWoods.json has invalid key "${realmBiome}" (expected XX##)`);
    }

    // Check weights
    const sum = mapping.weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      result.warnings.push(
        `Realm-biome "${realmBiome}" weights sum to ${sum.toFixed(3)} (expected ~1.0)`
      );
    }

    if (mapping.woodIds.length !== mapping.weights.length) {
      result.errors.push(
        `Realm-biome "${realmBiome}" has ${mapping.woodIds.length} woods but ${mapping.weights.length} weights`
      );
    }

    // Verify all referenced wood IDs exist
    for (const woodId of mapping.woodIds) {
      if (!allWoodIds.has(woodId)) {
        result.errors.push(`Realm-biome "${realmBiome}" references non-existent wood "${woodId}"`);
      }
    }
  }

  // Check woods can be found by realm-biome
  const mappedRealmBiomes = getMappedRealmBiomes();
  result.info.push(`Realm-biome codes with mappings: ${mappedRealmBiomes.length}`);

  // ========== 7. Validate Toolstone Coverage ==========
  result.info.push('--- Validating Toolstone Coverage ---');

  const toolstones = getToolstones();
  const toolstoneIds = new Set(toolstones.map((t) => t.id));
  const lithologiesWithToolstones: string[] = [];
  const lithologiesWithoutToolstones: string[] = [];

  for (const [lithology, mapping] of lithologyMappings) {
    const hasToolstone = mapping.stoneIds.some((id) => toolstoneIds.has(id));
    if (hasToolstone) {
      lithologiesWithToolstones.push(lithology);
    } else {
      lithologiesWithoutToolstones.push(lithology);
    }
  }

  result.info.push(`Toolstones available: ${toolstones.map((t) => t.id).join(', ')}`);
  result.info.push(
    `Lithologies with toolstones: ${lithologiesWithToolstones.length}/${lithologyMappings.length}`
  );

  // Every lithology must have at least one toolstone available
  if (lithologiesWithoutToolstones.length > 0) {
    for (const lithology of lithologiesWithoutToolstones) {
      result.errors.push(
        `Lithology "${lithology}" has no toolstone - add at least one with low spawn weight`
      );
    }
  }

  // ========== 8. Summary Statistics ==========
  result.info.push('--- Summary Statistics ---');
  result.info.push(`Total wood types: ${WOODS.length}`);
  result.info.push(`Total stone types: ${STONES.length}`);
  result.info.push(`Valid biomes: ${VALID_BIOMES.length}`);
  result.info.push(`Mapped lithologies: ${lithologyMappings.length}`);
  result.info.push(`Realm-biome mappings: ${realmBiomeMappings.length}`);
  result.info.push(`Biomes with wood: ${biomesWithWoods.size}/${VALID_BIOMES.length}`);
  result.info.push(
    `Lithologies with stones: ${lithologiesWithStones.size}/${lithologyMappings.length}`
  );

  // Wood category distribution
  const woodCategories: Record<string, number> = {};
  for (const wood of WOODS) {
    woodCategories[wood.category] = (woodCategories[wood.category] || 0) + 1;
  }
  result.info.push(
    `Wood categories: ${Object.entries(woodCategories)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`
  );

  // Stone category distribution
  const stoneCategories: Record<string, number> = {};
  for (const stone of STONES) {
    stoneCategories[stone.category] = (stoneCategories[stone.category] || 0) + 1;
  }
  result.info.push(
    `Stone categories: ${Object.entries(stoneCategories)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`
  );

  // Realm distribution
  const realmCounts: Record<string, number> = {};
  for (const wood of WOODS) {
    if (wood.nativeRealms) {
      for (const realm of wood.nativeRealms) {
        realmCounts[realm] = (realmCounts[realm] || 0) + 1;
      }
    }
  }
  result.info.push(
    `Woods by realm: ${Object.entries(realmCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`
  );

  return result;
}

// Main execution
/* eslint-disable no-console */
function main() {
  console.log('='.repeat(60));
  console.log('Resource Validation Report');
  console.log('='.repeat(60));
  console.log('');

  const result = validateResources();

  if (result.errors.length > 0) {
    console.log('ERRORS:');
    console.log('-'.repeat(40));
    for (const error of result.errors) {
      console.log(`  [ERROR] ${error}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('WARNINGS:');
    console.log('-'.repeat(40));
    for (const warning of result.warnings) {
      console.log(`  [WARN]  ${warning}`);
    }
    console.log('');
  }

  console.log('INFO:');
  console.log('-'.repeat(40));
  for (const info of result.info) {
    console.log(`  [INFO]  ${info}`);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log(`Summary: ${result.errors.length} errors, ${result.warnings.length} warnings`);
  console.log('='.repeat(60));

  // Exit with error code if there are errors
  if (result.errors.length > 0) {
    process.exit(1);
  }
}
/* eslint-enable no-console */

// Export for use as module
export { validateResources, ValidationResult };

// Run if executed directly
main();
