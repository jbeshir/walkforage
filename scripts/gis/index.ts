/**
 * GIS Data Processing Scripts
 *
 * These scripts fetch, process, and bundle GIS data for the WalkForage app.
 *
 * Usage:
 *   npx ts-node scripts/gis/index.ts [command]
 *
 * Commands:
 *   fetch-geology   Fetch geology data from Macrostrat API
 *   fetch-biomes    Generate biome data (or process GeoJSON)
 *   build-mappings  Analyze data and update mapping files
 *   build-bundle    Build final tile bundles for the app
 *   all             Run all steps in sequence
 *
 * Example:
 *   npx ts-node scripts/gis/index.ts all
 */

import { spawn } from 'child_process';
import * as path from 'path';

const SCRIPTS_DIR = __dirname;

async function runScript(scriptName: string, args: string[] = []): Promise<void> {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);

  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${scriptName}`);
    console.log(`${'='.repeat(60)}\n`);

    const proc = spawn('npx', ['ts-node', scriptPath, ...args], {
      cwd: path.join(SCRIPTS_DIR, '../..'),
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} exited with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  const command = process.argv[2] || 'help';

  switch (command) {
    case 'fetch-geology':
      await runScript('fetchMacrostrat.ts');
      break;

    case 'fetch-biomes':
      await runScript('fetchBiomes.ts', process.argv.slice(3));
      break;

    case 'build-mappings':
      await runScript('buildMappings.ts');
      break;

    case 'build-bundle':
      await runScript('buildBundle.ts');
      break;

    case 'all':
      console.log('Running all GIS data processing steps...\n');
      console.log('Note: This will take a while due to API rate limiting.\n');

      try {
        // Step 1: Fetch geology data
        await runScript('fetchMacrostrat.ts');

        // Step 2: Generate biome data
        await runScript('fetchBiomes.ts');

        // Step 3: Build mappings
        await runScript('buildMappings.ts');

        // Step 4: Build final bundle
        await runScript('buildBundle.ts');

        console.log('\n' + '='.repeat(60));
        console.log('All GIS data processing complete!');
        console.log('='.repeat(60));
        console.log('\nThe app will now use real GIS data for resource spawning.');
      } catch (error) {
        console.error('\nProcessing failed:', error);
        process.exit(1);
      }
      break;

    case 'help':
    default:
      console.log(`
GIS Data Processing Scripts
===========================

Usage: npx ts-node scripts/gis/index.ts [command]

Commands:
  fetch-geology   Fetch geology data from Macrostrat API
                  (Takes ~30 minutes due to rate limiting)

  fetch-biomes    Generate biome data based on latitude
                  Optionally: npx ts-node scripts/gis/index.ts fetch-biomes path/to/ecoregions.geojson

  build-mappings  Analyze fetched data and update mapping files

  build-bundle    Build final tile bundles for the app

  all             Run all steps in sequence

  help            Show this help message

Quick Start:
  npx ts-node scripts/gis/index.ts all

Individual Steps:
  1. npx ts-node scripts/gis/fetchMacrostrat.ts
  2. npx ts-node scripts/gis/fetchBiomes.ts [optional-geojson-path]
  3. npx ts-node scripts/gis/buildMappings.ts
  4. npx ts-node scripts/gis/buildBundle.ts

Output Files:
  scripts/gis/output/           Raw fetched data
  src/data/gis/geology/         Geology index and tiles
  src/data/gis/biomes/          Biome index and tiles
  src/data/gis/tiles/           Combined detailed tiles
  src/data/gis/mappings/        Lithology/biome to resource mappings
`);
      break;
  }
}

main().catch(console.error);
