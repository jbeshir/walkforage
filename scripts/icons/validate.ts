// Validation Phase - Validate icon coverage and file integrity
import * as fs from 'fs';
import * as path from 'path';
import { ASSETS_DIR, SRC_DIR } from './lib/config';
import { ResourceType } from './lib/types';

// Import resource data
import { STONES } from '../../src/data/stones';
import { WOODS } from '../../src/data/woods';
import { FOODS } from '../../src/data/foods';

const ICONS_UTIL_PATH = path.join(SRC_DIR, 'utils', 'icons.ts');

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalResources: number;
    totalIcons: number;
    coverage: number;
    stones: { total: number; icons: number };
    woods: { total: number; icons: number };
    foods: { total: number; icons: number };
  };
}

function getIconPath(type: ResourceType, id: string): string {
  return path.join(ASSETS_DIR, `${type}s`, `${id}.png`);
}

function iconExists(type: ResourceType, id: string): boolean {
  return fs.existsSync(getIconPath(type, id));
}

export function runValidation(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('Validating icon pipeline...\n');

  // Check if icon loader exists
  if (!fs.existsSync(ICONS_UTIL_PATH)) {
    warnings.push(
      `Icon loader not found at ${ICONS_UTIL_PATH}. Run 'npm run icons:integrate' to generate it.`
    );
  }

  // Count resources and icons
  const stoneIds = STONES.map((s) => s.id);
  const woodIds = WOODS.map((w) => w.id);
  const foodIds = FOODS.map((f) => f.id);

  const stoneIcons = stoneIds.filter((id) => iconExists('stone', id));
  const woodIcons = woodIds.filter((id) => iconExists('wood', id));
  const foodIcons = foodIds.filter((id) => iconExists('food', id));

  const stats = {
    totalResources: stoneIds.length + woodIds.length + foodIds.length,
    totalIcons: stoneIcons.length + woodIcons.length + foodIcons.length,
    coverage: 0,
    stones: { total: stoneIds.length, icons: stoneIcons.length },
    woods: { total: woodIds.length, icons: woodIcons.length },
    foods: { total: foodIds.length, icons: foodIcons.length },
  };

  stats.coverage = Math.round((stats.totalIcons / stats.totalResources) * 100);

  // Report coverage
  console.log('Icon Coverage:');
  console.log(
    `  Stones: ${stats.stones.icons}/${stats.stones.total} (${Math.round((stats.stones.icons / stats.stones.total) * 100)}%)`
  );
  console.log(
    `  Woods: ${stats.woods.icons}/${stats.woods.total} (${Math.round((stats.woods.icons / stats.woods.total) * 100)}%)`
  );
  console.log(
    `  Foods: ${stats.foods.icons}/${stats.foods.total} (${Math.round((stats.foods.icons / stats.foods.total) * 100)}%)`
  );
  console.log(`  Total: ${stats.totalIcons}/${stats.totalResources} (${stats.coverage}%)\n`);

  // Check for orphan icons (icons without corresponding resources)
  const checkOrphans = (type: ResourceType, validIds: string[]): void => {
    const dir = path.join(ASSETS_DIR, `${type}s`);
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
    for (const file of files) {
      const id = file.replace('.png', '');
      if (!validIds.includes(id)) {
        warnings.push(`Orphan icon: ${type}s/${file} (no matching resource)`);
      }
    }
  };

  checkOrphans('stone', stoneIds);
  checkOrphans('wood', woodIds);
  checkOrphans('food', foodIds);

  // Validate icon files (basic check - file size > 0)
  const validateIconFile = (type: ResourceType, id: string): void => {
    const iconPath = getIconPath(type, id);
    if (fs.existsSync(iconPath)) {
      const stat = fs.statSync(iconPath);
      if (stat.size === 0) {
        errors.push(`Empty icon file: ${iconPath}`);
      } else if (stat.size < 1000) {
        warnings.push(`Very small icon file (${stat.size} bytes): ${iconPath}`);
      }
    }
  };

  // Validate all existing icons
  for (const id of stoneIcons) {
    validateIconFile('stone', id);
  }
  for (const id of woodIcons) {
    validateIconFile('wood', id);
  }
  for (const id of foodIcons) {
    validateIconFile('food', id);
  }

  // Check if icon loader is in sync with actual icons
  if (fs.existsSync(ICONS_UTIL_PATH)) {
    const loaderContent = fs.readFileSync(ICONS_UTIL_PATH, 'utf-8');

    // Count icons referenced in loader
    const stoneMatches = loaderContent.match(/icons\/stones\/[a-z_]+\.png/g) || [];
    const woodMatches = loaderContent.match(/icons\/woods\/[a-z_]+\.png/g) || [];
    const foodMatches = loaderContent.match(/icons\/foods\/[a-z_]+\.png/g) || [];

    const loaderCount = stoneMatches.length + woodMatches.length + foodMatches.length;
    if (loaderCount !== stats.totalIcons) {
      warnings.push(
        `Icon loader may be out of sync. Loader references ${loaderCount} icons, but ${stats.totalIcons} exist. Run 'npm run icons:integrate' to update.`
      );
    }
  }

  // Report results
  if (warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
    console.log('');
  }

  if (errors.length > 0) {
    console.log('Errors:');
    for (const error of errors) {
      console.log(`  - ${error}`);
    }
    console.log('');
  }

  const valid = errors.length === 0;

  if (valid) {
    console.log('Validation passed!');
  } else {
    console.log('Validation failed!');
    process.exitCode = 1;
  }

  return { valid, errors, warnings, stats };
}

// Run if called directly
if (require.main === module) {
  runValidation();
}
