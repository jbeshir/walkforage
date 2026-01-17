/**
 * convertShapefile.ts - Convert Resolve Ecoregions shapefile to GeoJSON
 *
 * Usage: npx ts-node scripts/gis/convertShapefile.ts
 */

// @ts-expect-error - shapefile doesn't have type definitions
import * as shapefile from 'shapefile';
import * as fs from 'fs';
import * as path from 'path';

const INPUT_SHP = path.join(__dirname, 'input', 'Ecoregions2017.shp');
const OUTPUT_GEOJSON = path.join(__dirname, 'input', 'resolve_ecoregions.geojson');

async function convert() {
  console.log('Converting Resolve Ecoregions shapefile to GeoJSON...');
  console.log(`Input: ${INPUT_SHP}`);
  console.log(`Output: ${OUTPUT_GEOJSON}`);

  const features: GeoJSON.Feature[] = [];
  let count = 0;

  const source = await shapefile.open(INPUT_SHP);

  while (true) {
    const result = await source.read();
    if (result.done) break;

    const feature = result.value as GeoJSON.Feature;
    features.push(feature);
    count++;

    if (count % 100 === 0) {
      process.stdout.write(`\rProcessed ${count} features...`);
    }
  }

  console.log(`\nTotal features: ${count}`);

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };

  console.log('Writing GeoJSON file...');
  fs.writeFileSync(OUTPUT_GEOJSON, JSON.stringify(geojson));

  const stats = fs.statSync(OUTPUT_GEOJSON);
  console.log(`Output size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  console.log('Done!');
}

convert().catch(console.error);
