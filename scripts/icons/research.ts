// Research Phase - Merge resource data with appearance descriptions
import * as fs from 'fs';
import {
  RESEARCH_FILE,
  OUTPUT_DIR,
  STONES_APPEARANCES,
  WOODS_APPEARANCES,
  FOODS_APPEARANCES,
} from './lib/config';
import {
  ResourceResearch,
  ResearchOutput,
  AppearanceData,
  AppearanceDataFile,
  ResourceType,
} from './lib/types';

// Import resource data
import { STONES } from '../../src/data/stones';
import { WOODS } from '../../src/data/woods';
import { FOODS } from '../../src/data/foods';

function loadAppearanceData(filePath: string): AppearanceDataFile {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: Appearance file not found: ${filePath}`);
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as AppearanceDataFile;
}

function createDefaultAppearance(name: string, color: string): AppearanceData {
  return {
    primaryColors: [color],
    texture: 'natural texture',
    distinguishingFeatures: [`typical ${name.toLowerCase()} appearance`],
  };
}

export function runResearch(): ResearchOutput {
  console.log('Starting research phase...');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load appearance data
  const stonesAppearances = loadAppearanceData(STONES_APPEARANCES);
  const woodsAppearances = loadAppearanceData(WOODS_APPEARANCES);
  const foodsAppearances = loadAppearanceData(FOODS_APPEARANCES);

  const resources: ResourceResearch[] = [];
  const missing: { id: string; type: ResourceType; name: string }[] = [];

  // Process stones
  console.log(`Processing ${STONES.length} stones...`);
  for (const stone of STONES) {
    const appearance = stonesAppearances[stone.id];
    if (appearance) {
      resources.push({
        id: stone.id,
        type: 'stone',
        name: stone.name,
        category: stone.category,
        appearance,
      });
    } else {
      missing.push({ id: stone.id, type: 'stone', name: stone.name });
      resources.push({
        id: stone.id,
        type: 'stone',
        name: stone.name,
        category: stone.category,
        appearance: createDefaultAppearance(stone.name, stone.color),
      });
    }
  }

  // Process woods
  console.log(`Processing ${WOODS.length} woods...`);
  for (const wood of WOODS) {
    const appearance = woodsAppearances[wood.id];
    if (appearance) {
      resources.push({
        id: wood.id,
        type: 'wood',
        name: wood.name,
        scientificName: wood.scientificName,
        category: wood.category,
        appearance,
      });
    } else {
      missing.push({ id: wood.id, type: 'wood', name: wood.name });
      resources.push({
        id: wood.id,
        type: 'wood',
        name: wood.name,
        scientificName: wood.scientificName,
        category: wood.category,
        appearance: createDefaultAppearance(wood.name, wood.color),
      });
    }
  }

  // Process foods
  console.log(`Processing ${FOODS.length} foods...`);
  for (const food of FOODS) {
    const appearance = foodsAppearances[food.id];
    if (appearance) {
      resources.push({
        id: food.id,
        type: 'food',
        name: food.name,
        scientificName: food.scientificName,
        category: food.category,
        appearance,
      });
    } else {
      missing.push({ id: food.id, type: 'food', name: food.name });
      resources.push({
        id: food.id,
        type: 'food',
        name: food.name,
        scientificName: food.scientificName,
        category: food.category,
        appearance: createDefaultAppearance(food.name, food.color),
      });
    }
  }

  const output: ResearchOutput = {
    generatedAt: new Date().toISOString(),
    resources,
    missing,
  };

  // Write output
  fs.writeFileSync(RESEARCH_FILE, JSON.stringify(output, null, 2));
  console.log(`Research complete. Output written to: ${RESEARCH_FILE}`);
  console.log(`  Total resources: ${resources.length}`);
  console.log(`  Stones: ${STONES.length}`);
  console.log(`  Woods: ${WOODS.length}`);
  console.log(`  Foods: ${FOODS.length}`);

  if (missing.length > 0) {
    console.log(`  Missing appearance data: ${missing.length}`);
    for (const m of missing) {
      console.log(`    - ${m.type}/${m.id}: ${m.name}`);
    }
  }

  return output;
}

// Run if called directly
if (require.main === module) {
  runResearch();
}
