/**
 * buildBundle.ts - Build final GIS tile bundles for the app
 *
 * Combines processed geology and biome data into optimized tile files
 * that can be bundled with the app for offline use.
 *
 * Usage: npx ts-node scripts/gis/buildBundle.ts
 *
 * Input:
 *   - scripts/gis/output/macrostrat_raw.json
 *   - scripts/gis/output/biomes_raw.json
 *
 * Output:
 *   - src/data/gis/geology/index.json (coarse index, precision 3)
 *   - src/data/gis/geology/tiles/*.json (detailed tiles, precision 4)
 *   - src/data/gis/biomes/index.json
 *   - src/data/gis/biomes/tiles/*.json
 */

import * as fs from 'fs';
import * as path from 'path';

// Types
interface GeologyRecord {
  geohash: string;
  lat: number;
  lng: number;
  primaryLithology: string;
  secondaryLithologies: string[];
  confidence: number;
}

interface BiomeRecord {
  geohash: string;
  lat: number;
  lng: number;
  biomeCode: string;
  biomeName: string;
  confidence: number;
}

interface GeoTile {
  geohash: string;
  geology: {
    primaryLithology: string;
    secondaryLithologies: string[];
    confidence: number;
  };
  biome: {
    type: string;
    confidence: number;
  };
}

interface CoarseIndexEntry {
  primaryLithology?: string;
  confidence?: number;
}

interface BiomeIndexEntry {
  type: string;
  confidence: number;
}

interface RawDataFile<T> {
  _meta: {
    source: string;
    totalRecords: number;
  };
  records: T[];
}

// Paths
const OUTPUT_DIR = path.join(__dirname, 'output');
const GIS_DIR = path.join(__dirname, '../../src/data/gis');

/**
 * Normalize Macrostrat lithology names to simple mapping keys.
 * The Macrostrat API returns descriptive/complex lithology names that need
 * to be normalized to match our lithologyToStones.json mapping keys.
 */
function normalizeLithology(lith: string): string {
  const lower = lith.toLowerCase().trim();

  // Direct matches to existing mapping keys (order matters - more specific first)
  const directMatches = [
    'sandstone',
    'siltstone',
    'shale',
    'mudstone',
    'claystone',
    'conglomerate',
    'breccia',
    'limestone',
    'dolomite',
    'dolostone',
    'chalk',
    'marl',
    'chert',
    'novaculite',
    'granite',
    'granodiorite',
    'diorite',
    'gabbro',
    'basalt',
    'andesite',
    'rhyolite',
    'dacite',
    'tuff',
    'pumice',
    'obsidian',
    'ignimbrite',
    'marble',
    'slate',
    'phyllite',
    'schist',
    'gneiss',
    'quartzite',
    'amphibolite',
  ];

  // Check for direct rock type matches
  for (const match of directMatches) {
    if (lower.includes(match)) return match;
  }

  // Category mappings for complex Macrostrat descriptions
  if (lower.includes('volcanic') && lower.includes('mafic')) return 'basalt';
  if (lower.includes('volcanic') && lower.includes('felsic')) return 'rhyolite';
  if (lower.includes('volcanic') && lower.includes('intermediate')) return 'andesite';
  if (lower.includes('mafic volcanic') || lower.includes('mafic-volcanic')) return 'basalt';
  if (lower.includes('felsic volcanic') || lower.includes('felsic-volcanic')) return 'rhyolite';
  if (lower.includes('intermediate volcanic') || lower.includes('intermediate-volcanic'))
    return 'andesite';
  if (lower.includes('flood basalt')) return 'basalt';
  if (lower.includes('basalt group')) return 'basalt';
  if (lower.includes('plutonic') && lower.includes('granit')) return 'granite';
  if (lower.includes('intrusive') && lower.includes('igneous')) return 'granite';
  if (lower.includes('crystalline') && lower.includes('metamorphic')) return 'gneiss';
  if (lower.includes('sedimentary') && lower.includes('volcanic')) return 'tuff';
  if (lower.includes('volcaniclastic')) return 'tuff';
  if (lower.includes('alluvium') || lower.includes('alluvial')) return 'conglomerate';
  if (lower.includes('glacial') || lower.includes('drift') || lower.includes('till'))
    return 'conglomerate';
  if (lower.includes('sand') && !lower.includes('sandstone')) return 'sandstone';
  if (lower.includes('clay') && !lower.includes('claystone')) return 'clay';
  if (lower.includes('iron') || lower.includes('hematite') || lower.includes('magnetite'))
    return 'iron_formation';
  if (lower.includes('sedimentary')) return 'mixed_sedimentary';
  if (lower.includes('metamorphic')) return 'mixed_metamorphic';
  if (lower.includes('igneous')) return 'mixed_igneous';
  if (lower.includes('volcanic')) return 'tuff';

  // Parse "major:{X}, minor{Y}" format from Macrostrat
  const majorMatch = lower.match(/major:\{([^}]+)\}/);
  if (majorMatch) {
    const majorRock = majorMatch[1].split(',')[0].trim();
    for (const match of directMatches) {
      if (majorRock.includes(match)) return match;
    }
    // Fallback for major: format
    if (majorRock.includes('sand')) return 'sandstone';
    if (majorRock.includes('clay')) return 'clay';
    if (majorRock.includes('lime')) return 'limestone';
    if (majorRock.includes('alluvium')) return 'conglomerate';
  }

  return 'unknown';
}

/**
 * Load raw geology data
 */
function loadGeologyData(): GeologyRecord[] {
  const dataPath = path.join(OUTPUT_DIR, 'macrostrat_raw.json');
  if (!fs.existsSync(dataPath)) {
    return [];
  }

  const content = fs.readFileSync(dataPath, 'utf-8');
  const data: RawDataFile<GeologyRecord> = JSON.parse(content);
  return data.records;
}

/**
 * Load raw biome data
 */
function loadBiomeData(): BiomeRecord[] {
  const dataPath = path.join(OUTPUT_DIR, 'biomes_raw.json');
  if (!fs.existsSync(dataPath)) {
    return [];
  }

  const content = fs.readFileSync(dataPath, 'utf-8');
  const data: RawDataFile<BiomeRecord> = JSON.parse(content);
  return data.records;
}

/**
 * Group records by geohash prefix (for tile organization)
 */
function groupByPrefix<T extends { geohash: string }>(
  records: T[],
  prefixLength: number
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const record of records) {
    const prefix = record.geohash.substring(0, prefixLength);
    const existing = groups.get(prefix) || [];
    existing.push(record);
    groups.set(prefix, existing);
  }

  return groups;
}

/**
 * Build coarse geology index (precision 3)
 */
function buildCoarseGeologyIndex(records: GeologyRecord[]): Record<string, CoarseIndexEntry> {
  const index: Record<string, CoarseIndexEntry> = {};

  // Group by precision-3 geohash
  const groups = groupByPrefix(records, 3);

  for (const [prefix, groupRecords] of groups) {
    // Find most common NORMALIZED lithology in this coarse cell
    const lithCounts: Record<string, number> = {};
    for (const record of groupRecords) {
      const lith = normalizeLithology(record.primaryLithology);
      lithCounts[lith] = (lithCounts[lith] || 0) + 1;
    }

    const sorted = Object.entries(lithCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topLith, topCount] = sorted[0];
      const confidence = topCount / groupRecords.length;

      index[prefix] = {
        primaryLithology: topLith,
        confidence: Math.round(confidence * 100) / 100,
      };
    }
  }

  return index;
}

/**
 * Build coarse biome index (precision 3)
 */
function buildCoarseBiomeIndex(records: BiomeRecord[]): Record<string, BiomeIndexEntry> {
  const index: Record<string, BiomeIndexEntry> = {};

  // Group by precision-3 geohash
  const groups = groupByPrefix(records, 3);

  for (const [prefix, groupRecords] of groups) {
    // Find most common biome in this coarse cell
    const biomeCounts: Record<string, number> = {};
    for (const record of groupRecords) {
      const biome = record.biomeCode;
      biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;
    }

    const sorted = Object.entries(biomeCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topBiome, topCount] = sorted[0];
      const confidence = topCount / groupRecords.length;

      index[prefix] = {
        type: topBiome,
        confidence: Math.round(confidence * 100) / 100,
      };
    }
  }

  return index;
}

/**
 * Build detailed geology tiles (precision 4)
 */
function buildGeologyTiles(
  records: GeologyRecord[]
): Map<string, Record<string, GeoTile['geology']>> {
  const tiles = new Map<string, Record<string, GeoTile['geology']>>();

  // Group by precision-3 prefix for file organization
  const groups = groupByPrefix(records, 3);

  for (const [prefix, groupRecords] of groups) {
    const tileData: Record<string, GeoTile['geology']> = {};

    for (const record of groupRecords) {
      tileData[record.geohash] = {
        // Normalize lithology names
        primaryLithology: normalizeLithology(record.primaryLithology),
        secondaryLithologies: record.secondaryLithologies.map(normalizeLithology),
        confidence: record.confidence,
      };
    }

    tiles.set(prefix, tileData);
  }

  return tiles;
}

/**
 * Build detailed biome tiles (precision 4)
 */
function buildBiomeTiles(records: BiomeRecord[]): Map<string, Record<string, GeoTile['biome']>> {
  const tiles = new Map<string, Record<string, GeoTile['biome']>>();

  // Group by precision-3 prefix for file organization
  const groups = groupByPrefix(records, 3);

  for (const [prefix, groupRecords] of groups) {
    const tileData: Record<string, GeoTile['biome']> = {};

    for (const record of groupRecords) {
      tileData[record.geohash] = {
        type: record.biomeCode,
        confidence: record.confidence,
      };
    }

    tiles.set(prefix, tileData);
  }

  return tiles;
}

/**
 * Build combined tiles (geology + biome)
 */
function buildCombinedTiles(
  geologyRecords: GeologyRecord[],
  biomeRecords: BiomeRecord[]
): Map<string, Record<string, GeoTile>> {
  const tiles = new Map<string, Record<string, GeoTile>>();

  // Create lookup maps
  const geologyMap = new Map<string, GeologyRecord>();
  for (const record of geologyRecords) {
    geologyMap.set(record.geohash, record);
  }

  const biomeMap = new Map<string, BiomeRecord>();
  for (const record of biomeRecords) {
    biomeMap.set(record.geohash, record);
  }

  // Get all unique geohashes
  const allGeohashes = new Set([...geologyMap.keys(), ...biomeMap.keys()]);

  // Group by prefix
  const groups = new Map<string, string[]>();
  for (const geohash of allGeohashes) {
    const prefix = geohash.substring(0, 3);
    const existing = groups.get(prefix) || [];
    existing.push(geohash);
    groups.set(prefix, existing);
  }

  // Build combined tiles
  for (const [prefix, geohashes] of groups) {
    const tileData: Record<string, GeoTile> = {};

    for (const geohash of geohashes) {
      const geology = geologyMap.get(geohash);
      const biome = biomeMap.get(geohash);

      tileData[geohash] = {
        geohash,
        geology: geology
          ? {
              // Normalize lithology names to match our mapping keys
              primaryLithology: normalizeLithology(geology.primaryLithology),
              secondaryLithologies: geology.secondaryLithologies.map(normalizeLithology),
              confidence: geology.confidence,
            }
          : {
              primaryLithology: 'unknown',
              secondaryLithologies: [],
              confidence: 0,
            },
        biome: biome
          ? {
              type: biome.biomeCode,
              confidence: biome.confidence,
            }
          : {
              type: 'unknown',
              confidence: 0,
            },
      };
    }

    tiles.set(prefix, tileData);
  }

  return tiles;
}

/**
 * Write files with size reporting
 */
function writeJsonFile(filePath: string, data: unknown): number {
  const content = JSON.stringify(data);
  fs.writeFileSync(filePath, content);
  return content.length;
}

/**
 * Main function
 */
async function main() {
  console.log('GIS Bundle Builder');
  console.log('==================\n');

  // Load raw data
  const geologyRecords = loadGeologyData();
  const biomeRecords = loadBiomeData();

  console.log(`Loaded ${geologyRecords.length} geology records`);
  console.log(`Loaded ${biomeRecords.length} biome records`);

  if (geologyRecords.length === 0 && biomeRecords.length === 0) {
    console.log('\nNo data to process. Run these scripts first:');
    console.log('  npx ts-node scripts/gis/fetchMacrostrat.ts');
    console.log('  npx ts-node scripts/gis/fetchBiomes.ts');
    return;
  }

  // Create output directories
  const geologyDir = path.join(GIS_DIR, 'geology');
  const biomesDir = path.join(GIS_DIR, 'biomes');
  const tilesDir = path.join(GIS_DIR, 'tiles');

  for (const dir of [geologyDir, biomesDir, tilesDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  let totalBytes = 0;

  // Build and write coarse indexes
  if (geologyRecords.length > 0) {
    console.log('\nBuilding geology index...');
    const geologyIndex = buildCoarseGeologyIndex(geologyRecords);
    const indexPath = path.join(geologyDir, 'index.json');
    const bytes = writeJsonFile(indexPath, {
      _meta: {
        type: 'coarse_geology_index',
        precision: 3,
        cellCount: Object.keys(geologyIndex).length,
        generatedAt: new Date().toISOString(),
      },
      data: geologyIndex,
    });
    totalBytes += bytes;
    console.log(`  Wrote ${indexPath} (${(bytes / 1024).toFixed(1)} KB)`);
  }

  if (biomeRecords.length > 0) {
    console.log('\nBuilding biome index...');
    const biomeIndex = buildCoarseBiomeIndex(biomeRecords);
    const indexPath = path.join(biomesDir, 'index.json');
    const bytes = writeJsonFile(indexPath, {
      _meta: {
        type: 'coarse_biome_index',
        precision: 3,
        cellCount: Object.keys(biomeIndex).length,
        generatedAt: new Date().toISOString(),
      },
      data: biomeIndex,
    });
    totalBytes += bytes;
    console.log(`  Wrote ${indexPath} (${(bytes / 1024).toFixed(1)} KB)`);
  }

  // Build and write combined detailed tiles
  if (geologyRecords.length > 0 || biomeRecords.length > 0) {
    console.log('\nBuilding detailed tiles...');
    const combinedTiles = buildCombinedTiles(geologyRecords, biomeRecords);

    let tileCount = 0;
    let tileBytes = 0;

    for (const [prefix, tileData] of combinedTiles) {
      const tilePath = path.join(tilesDir, `${prefix}.json`);
      const bytes = writeJsonFile(tilePath, {
        _meta: {
          type: 'detailed_tile',
          prefix,
          precision: 4,
          cellCount: Object.keys(tileData).length,
        },
        data: tileData,
      });
      tileBytes += bytes;
      tileCount++;
    }

    totalBytes += tileBytes;
    console.log(`  Wrote ${tileCount} tile files (${(tileBytes / 1024).toFixed(1)} KB total)`);
  }

  // Generate manifest
  const manifestPath = path.join(GIS_DIR, 'manifest.json');
  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sources: {
      geology: geologyRecords.length > 0 ? 'Macrostrat API' : null,
      biomes: biomeRecords.length > 0 ? 'Resolve Ecoregions 2017 / Latitude estimation' : null,
    },
    statistics: {
      geologyRecords: geologyRecords.length,
      biomeRecords: biomeRecords.length,
      totalSizeBytes: totalBytes,
      totalSizeKB: Math.round(totalBytes / 1024),
    },
    files: {
      geologyIndex: geologyRecords.length > 0 ? 'geology/index.json' : null,
      biomeIndex: biomeRecords.length > 0 ? 'biomes/index.json' : null,
      tilesDir: 'tiles/',
    },
  };

  writeJsonFile(manifestPath, manifest);
  console.log(`\nWrote manifest: ${manifestPath}`);

  // Summary
  console.log('\n==================');
  console.log('Bundle Summary');
  console.log('==================');
  console.log(`Total size: ${(totalBytes / 1024).toFixed(1)} KB`);
  console.log(`Geology cells: ${geologyRecords.length}`);
  console.log(`Biome cells: ${biomeRecords.length}`);
  console.log('\nBundle location: src/data/gis/');
  console.log('\nTo use in the app, the GeoDataService will automatically');
  console.log('load and use these tile files for location lookups.');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { buildCoarseGeologyIndex, buildCoarseBiomeIndex, buildCombinedTiles };
