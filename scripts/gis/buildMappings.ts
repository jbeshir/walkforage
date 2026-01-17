/**
 * buildMappings.ts - Generate lithology→stones mapping file
 *
 * Analyzes the raw GIS data from fetchMacrostrat.ts to generate
 * optimized mapping files for the app.
 *
 * This script validates that all encountered lithologies are properly
 * mapped to game resources.
 *
 * Usage: npx ts-node scripts/gis/buildMappings.ts
 *
 * Input:
 *   - scripts/gis/output/macrostrat_raw.json
 *
 * Output:
 *   - src/data/gis/mappings/lithologyToStones.json (updates)
 *   - scripts/gis/output/mapping_report.json
 *
 * Note: Wood mappings are handled by realmBiomesToWoods.json which maps
 * realm+biome combinations to region-specific wood species. See woods.ts
 * for the wood data with biome associations used as fallback.
 */

import * as fs from 'fs';
import * as path from 'path';

// Import existing mappings to validate/extend
const MAPPINGS_DIR = path.join(__dirname, '../../src/data/gis/mappings');

interface LithologyMapping {
  lithology: string;
  stoneIds: string[];
  weights: number[];
}

interface GeologyRecord {
  geohash: string;
  primaryLithology: string;
  secondaryLithologies: string[];
}

interface RawDataFile<T> {
  _meta: {
    source: string;
    totalRecords: number;
  };
  records: T[];
}

// Stone data (copied from src/data/stones.ts for standalone use)
const STONE_LITHOLOGIES: Record<string, string[]> = {
  sandstone: ['sandstone', 'sand', 'arenite', 'arkose', 'greywacke', 'wacke'],
  limestone: ['limestone', 'carbonate', 'calcilite', 'micrite', 'oolite', 'coquina'],
  shale: ['shale', 'mudrock', 'argillite'],
  chalk: ['chalk', 'marl'],
  clay: ['clay', 'claystone', 'benite', 'kaolin'],
  slate: ['slate', 'argillaceous'],
  marble: ['marble', 'crystalline carbonate'],
  quartzite: ['quartzite', 'silicified sandstone', 'metaquartzite'],
  schist: ['schist', 'mica schist', 'chlorite schist', 'talc schist'],
  gneiss: ['gneiss', 'orthogneiss', 'paragneiss'],
  granite: ['granite', 'granodiorite', 'tonalite', 'syenite', 'monzonite'],
  diorite: ['diorite', 'quartz diorite'],
  basalt: ['basalt', 'flood basalt', 'pillow basalt', 'vesicular basalt'],
  obsidian: ['obsidian', 'volcanic glass', 'vitrophyre'],
  pumice: ['pumice', 'pumicite', 'scoria'],
  flint: ['flint', 'chert', 'chalcedony', 'agate'],
  chert: ['chert', 'novaculite', 'porcellanite'],
  jasper: ['jasper', 'radiolarite', 'siliceous'],
  hematite: ['hematite', 'iron formation', 'banded iron'],
  magnetite: ['magnetite', 'iron ore', 'taconite'],
  malachite: ['malachite', 'copper carbonate'],
  azurite: ['azurite', 'copper ore'],
  galena: ['galena', 'lead ore', 'lead sulfide'],
  dolomite: ['dolomite', 'dolostone', 'dolomitic limestone'],
  siltstone: ['siltstone', 'silt', 'silty'],
  mudstone: ['mudstone', 'mud', 'muddy', 'pelite'],
  conglomerate: ['conglomerate', 'breccia', 'diamictite', 'fanglomerate'],
  novaculite: ['novaculite', 'arkansas stone'],
  gabbro: ['gabbro', 'norite', 'troctolite', 'anorthosite'],
  andesite: ['andesite', 'dacite'],
  rhyolite: ['rhyolite', 'felsic volcanic', 'ignimbrite'],
  tuff: ['tuff', 'volcanic ash', 'lapilli', 'pyroclastic'],
  phyllite: ['phyllite', 'low-grade metamorphic'],
  amphibolite: ['amphibolite', 'hornblende', 'amphibole'],
};

/**
 * Load raw geology data
 */
function loadGeologyData(): GeologyRecord[] | null {
  const dataPath = path.join(__dirname, 'output/macrostrat_raw.json');
  if (!fs.existsSync(dataPath)) {
    console.log('No geology data found at', dataPath);
    return null;
  }

  const content = fs.readFileSync(dataPath, 'utf-8');
  const data: RawDataFile<GeologyRecord> = JSON.parse(content);
  return data.records;
}

/**
 * Normalize lithology name for matching
 */
function normalizeLithology(lith: string): string {
  return lith.toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find matching stones for a lithology
 */
function findStonesForLithology(lithology: string): string[] {
  const normalized = normalizeLithology(lithology);
  const matches: string[] = [];

  for (const [stoneId, lithologies] of Object.entries(STONE_LITHOLOGIES)) {
    for (const lith of lithologies) {
      if (normalized.includes(lith) || lith.includes(normalized)) {
        if (!matches.includes(stoneId)) {
          matches.push(stoneId);
        }
        break;
      }
    }
  }

  return matches;
}

/**
 * Analyze geology data and generate mapping recommendations
 */
function analyzeGeologyData(records: GeologyRecord[]) {
  console.log('\nAnalyzing geology data...');

  // Count lithology occurrences
  const lithCounts: Record<string, number> = {};
  const unmappedLiths = new Set<string>();

  for (const record of records) {
    const lith = normalizeLithology(record.primaryLithology);
    lithCounts[lith] = (lithCounts[lith] || 0) + 1;

    const stones = findStonesForLithology(lith);
    if (stones.length === 0) {
      unmappedLiths.add(lith);
    }
  }

  // Sort by frequency
  const sortedLiths = Object.entries(lithCounts)
    .sort((a, b) => b[1] - a[1]);

  console.log(`\nTop 20 lithologies (${sortedLiths.length} total):`);
  for (const [lith, count] of sortedLiths.slice(0, 20)) {
    const stones = findStonesForLithology(lith);
    const status = stones.length > 0 ? `→ ${stones.join(', ')}` : '⚠️ UNMAPPED';
    console.log(`  ${lith}: ${count} ${status}`);
  }

  if (unmappedLiths.size > 0) {
    console.log(`\n⚠️ ${unmappedLiths.size} unmapped lithologies:`);
    for (const lith of [...unmappedLiths].slice(0, 20)) {
      console.log(`  - ${lith}`);
    }
  }

  return { lithCounts, unmappedLiths };
}

/**
 * Generate updated lithology mapping file
 */
function generateLithologyMappings(lithCounts: Record<string, number>): Record<string, LithologyMapping> {
  const mappings: Record<string, LithologyMapping> = {};

  for (const lith of Object.keys(lithCounts)) {
    const normalizedKey = lith.replace(/\s+/g, '_');
    const stones = findStonesForLithology(lith);

    if (stones.length > 0) {
      // Generate weights based on stone rarity (simplified)
      const weights = stones.map(() => 1 / stones.length);

      mappings[normalizedKey] = {
        lithology: lith,
        stoneIds: stones,
        weights,
      };
    }
  }

  return mappings;
}

/**
 * Main function
 */
async function main() {
  console.log('GIS Mapping Builder');
  console.log('===================\n');

  // Create output directory
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const report: {
    geology?: ReturnType<typeof analyzeGeologyData>;
    generatedAt: string;
  } = {
    generatedAt: new Date().toISOString(),
  };

  // Process geology data if available
  const geologyRecords = loadGeologyData();
  if (geologyRecords) {
    report.geology = analyzeGeologyData(geologyRecords);

    // Generate updated mappings
    const lithMappings = generateLithologyMappings(report.geology.lithCounts);

    // Merge with existing mappings
    const existingPath = path.join(MAPPINGS_DIR, 'lithologyToStones.json');
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(existingPath)) {
      existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
    }

    const merged = {
      _comment: 'Generated by buildMappings.ts - maps Macrostrat lithologies to game stone IDs',
      _source: 'Macrostrat API',
      _generatedAt: new Date().toISOString(),
      ...existing,
      ...lithMappings,
    };

    fs.writeFileSync(existingPath, JSON.stringify(merged, null, 2));
    console.log(`\nUpdated ${existingPath}`);
  } else {
    console.log('Skipping geology analysis (no data available)');
    console.log('Run fetchMacrostrat.ts first to fetch geology data');
  }

  // Save report
  const reportPath = path.join(outputDir, 'mapping_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved analysis report to ${reportPath}`);

  // Summary
  console.log('\n===================');
  console.log('Summary');
  console.log('===================');

  if (report.geology) {
    const unmapped = report.geology.unmappedLiths.size;
    if (unmapped > 0) {
      console.log(`⚠️ ${unmapped} lithologies need manual mapping in lithologyToStones.json`);
    } else {
      console.log('✅ All lithologies are mapped to stones');
    }
  }

  console.log('\nNote: Wood mappings use realmBiomesToWoods.json for realm+biome');
  console.log('specific species, with fallback to biomes in woods.ts data.');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { analyzeGeologyData, generateLithologyMappings };
