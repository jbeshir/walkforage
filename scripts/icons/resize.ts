// Resize Phase - Batch resize source icons (1024x1024) to bundled size (120x120)
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { SOURCE_ASSETS_DIR, ASSETS_DIR, IMAGE_SPECS } from './lib/config';
import { ResourceType } from './lib/types';

const RESOURCE_TYPES: ResourceType[] = ['stone', 'wood', 'food'];

interface ResizeStats {
  resized: number;
  skipped: number;
  totalSourceBytes: number;
  totalOutputBytes: number;
}

async function resizeIcon(sourcePath: string, destPath: string, size: number): Promise<void> {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await sharp(sourcePath)
    .resize(size, size, {
      fit: 'cover',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9 })
    .toFile(destPath);
}

export async function runResize(): Promise<void> {
  console.log('Starting icon resize phase...');
  console.log(`  Source: ${SOURCE_ASSETS_DIR}`);
  console.log(`  Output: ${ASSETS_DIR}`);
  console.log(`  Target size: ${IMAGE_SPECS.outputSize}x${IMAGE_SPECS.outputSize}px\n`);

  if (!fs.existsSync(SOURCE_ASSETS_DIR)) {
    throw new Error(`Source directory not found: ${SOURCE_ASSETS_DIR}`);
  }

  const stats: ResizeStats = {
    resized: 0,
    skipped: 0,
    totalSourceBytes: 0,
    totalOutputBytes: 0,
  };

  for (const type of RESOURCE_TYPES) {
    const sourceDir = path.join(SOURCE_ASSETS_DIR, `${type}s`);
    const destDir = path.join(ASSETS_DIR, `${type}s`);

    if (!fs.existsSync(sourceDir)) {
      console.log(`  No source directory for ${type}s, skipping`);
      continue;
    }

    const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.png'));
    console.log(`  ${type}s: ${files.length} icons`);

    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(destDir, file);

      const sourceSize = fs.statSync(sourcePath).size;
      stats.totalSourceBytes += sourceSize;

      await resizeIcon(sourcePath, destPath, IMAGE_SPECS.outputSize);

      const destSize = fs.statSync(destPath).size;
      stats.totalOutputBytes += destSize;
      stats.resized++;
    }
  }

  const sourceMB = (stats.totalSourceBytes / 1024 / 1024).toFixed(1);
  const outputMB = (stats.totalOutputBytes / 1024 / 1024).toFixed(1);
  const reduction = (
    ((stats.totalSourceBytes - stats.totalOutputBytes) / stats.totalSourceBytes) *
    100
  ).toFixed(1);

  console.log('\n========================================');
  console.log('Resize complete!');
  console.log(`  Resized: ${stats.resized} icons`);
  console.log(`  Source size:  ${sourceMB} MB`);
  console.log(`  Output size:  ${outputMB} MB`);
  console.log(`  Reduction:    ${reduction}%`);
}

// Run if called directly
if (require.main === module) {
  runResize().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}
