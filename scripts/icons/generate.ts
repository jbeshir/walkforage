// Image Generation Phase - Generate icons using AI image generators
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import {
  PROMPTS_FILE,
  STATUS_FILE,
  OUTPUT_DIR,
  ASSETS_DIR,
  DALLE_CONFIG,
  PROJECT_ROOT,
} from './lib/config';
import { PromptsOutput, StatusOutput, ResourceType, GeneratorName } from './lib/types';
import { ImageGenerator, createGenerator, getDefaultGeneratorName } from './lib/generators';

// Parse command line arguments
function parseArgs(): {
  type?: ResourceType;
  id?: string;
  force: boolean;
  dryRun: boolean;
  limit?: number;
  service?: GeneratorName;
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = {
    force: false,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      result.type = arg.split('=')[1] as ResourceType;
    } else if (arg.startsWith('--id=')) {
      result.id = arg.split('=')[1];
    } else if (arg === '--force') {
      result.force = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg.startsWith('--limit=')) {
      result.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--service=')) {
      result.service = arg.split('=')[1] as GeneratorName;
    }
  }

  return result;
}

function loadStatus(): StatusOutput {
  if (fs.existsSync(STATUS_FILE)) {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
  }
  return {
    updatedAt: new Date().toISOString(),
    summary: { total: 0, completed: 0, pending: 0, failed: 0 },
    resources: [],
  };
}

function saveStatus(status: StatusOutput): void {
  status.updatedAt = new Date().toISOString();
  status.summary = {
    total: status.resources.length,
    completed: status.resources.filter((r) => r.status === 'completed').length,
    pending: status.resources.filter((r) => r.status === 'pending').length,
    failed: status.resources.filter((r) => r.status === 'failed').length,
  };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function getIconPath(type: ResourceType, id: string): string {
  return path.join(ASSETS_DIR, `${type}s`, `${id}.png`);
}

function iconExists(type: ResourceType, id: string): boolean {
  return fs.existsSync(getIconPath(type, id));
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Handle file:// URLs (local files from gpt-image generator)
  if (url.startsWith('file://')) {
    const sourcePath = url.slice(7); // Remove 'file://' prefix
    fs.copyFileSync(sourcePath, destPath);
    // Clean up temp file
    fs.unlinkSync(sourcePath);
    return;
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            downloadImage(redirectUrl, destPath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => {}); // Delete partial file
        reject(err);
      });
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function copyAppIconToExpoLocations(sourcePath: string): void {
  const expoAssets = path.join(PROJECT_ROOT, 'assets');
  const destinations = ['icon.png', 'adaptive-icon.png', 'splash-icon.png'];

  for (const dest of destinations) {
    const destPath = path.join(expoAssets, dest);
    fs.copyFileSync(sourcePath, destPath);
    console.log(`  Copied to ${destPath}`);
  }
}

export async function runGenerate(): Promise<void> {
  const args = parseArgs();

  console.log('Starting image generation phase...');
  console.log(`  Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (args.type) console.log(`  Type filter: ${args.type}`);
  if (args.id) console.log(`  ID filter: ${args.id}`);
  if (args.force) console.log(`  Force regeneration: enabled`);
  if (args.limit) console.log(`  Limit: ${args.limit}`);
  if (args.service) console.log(`  Service override: ${args.service}`);

  // Ensure directories exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load prompts
  if (!fs.existsSync(PROMPTS_FILE)) {
    throw new Error(`Prompts file not found: ${PROMPTS_FILE}\nRun 'npm run icons:prompts' first.`);
  }
  const promptsData: PromptsOutput = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));

  // Load or initialize status
  const status = loadStatus();

  // Filter prompts
  let toGenerate = promptsData.prompts;

  if (args.type) {
    toGenerate = toGenerate.filter((p) => p.type === args.type);
  }
  if (args.id) {
    toGenerate = toGenerate.filter((p) => p.id === args.id);
  }
  if (!args.force) {
    toGenerate = toGenerate.filter((p) => !iconExists(p.type, p.id));
  }
  if (args.limit) {
    toGenerate = toGenerate.slice(0, args.limit);
  }

  console.log(`\nResources to generate: ${toGenerate.length}`);

  if (toGenerate.length === 0) {
    console.log('Nothing to generate. Use --force to regenerate existing icons.');
    return;
  }

  if (args.dryRun) {
    console.log('\nDry run - would generate the following:');
    for (const p of toGenerate) {
      const generatorName = args.service ?? getDefaultGeneratorName(p.type);
      console.log(`  ${p.type}/${p.id}: ${p.name} (using ${generatorName})`);
      console.log(`    Prompt: ${p.prompt.substring(0, 100)}...`);
    }
    return;
  }

  // Create generators (lazily initialized on first use per type)
  const generators = new Map<string, ImageGenerator>();

  function getGeneratorForType(type: ResourceType): ImageGenerator {
    const generatorName = args.service ?? getDefaultGeneratorName(type);

    if (!generators.has(generatorName)) {
      console.log(`  Initializing ${generatorName} generator...`);
      generators.set(generatorName, createGenerator(generatorName));
    }

    return generators.get(generatorName)!;
  }

  // Generate images
  let generated = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < toGenerate.length; i++) {
    const p = toGenerate[i];
    const progress = `[${i + 1}/${toGenerate.length}]`;

    // Get or create generator for this type
    const generator = getGeneratorForType(p.type);

    // Update status
    let resourceStatus = status.resources.find((r) => r.id === p.id && r.type === p.type);
    if (!resourceStatus) {
      resourceStatus = {
        id: p.id,
        type: p.type,
        name: p.name,
        status: 'pending',
      };
      status.resources.push(resourceStatus);
    }

    console.log(`\n${progress} Generating ${p.type}/${p.id}: ${p.name}`);
    console.log(`  Using: ${generator.name}`);
    resourceStatus.status = 'generating';
    saveStatus(status);

    let retries = 0;
    let success = false;

    while (retries < DALLE_CONFIG.maxRetries && !success) {
      try {
        // Generate image
        console.log(`  Calling ${generator.name} API...`);
        const imageUrl = await generator.generate(p.prompt);

        // Download image
        const iconPath = getIconPath(p.type, p.id);
        console.log(`  Downloading to ${iconPath}...`);
        await downloadImage(imageUrl, iconPath);

        // Update status
        resourceStatus.status = 'completed';
        resourceStatus.generatedAt = new Date().toISOString();
        delete resourceStatus.error;
        saveStatus(status);

        generated++;
        success = true;
        console.log(`  Success!`);

        // Copy app icons to Expo asset locations
        if (p.type === 'app') {
          copyAppIconToExpoLocations(iconPath);
        }

        // Rate limiting: wait between requests (use DALL-E config for now)
        if (i < toGenerate.length - 1) {
          const waitTime = Math.ceil(60000 / DALLE_CONFIG.rateLimit);
          console.log(`  Waiting ${waitTime / 1000}s for rate limit...`);
          await sleep(waitTime);
        }
      } catch (e) {
        const error = e as Error;
        if (error.message === 'RATE_LIMIT') {
          retries++;
          console.log(
            `  Rate limited. Retry ${retries}/${DALLE_CONFIG.maxRetries} after ${DALLE_CONFIG.retryDelay / 1000}s...`
          );
          await sleep(DALLE_CONFIG.retryDelay);
        } else {
          console.error(`  Error: ${error.message}`);
          resourceStatus.status = 'failed';
          resourceStatus.error = error.message;
          saveStatus(status);
          failed++;
          break;
        }
      }
    }

    if (!success && retries >= DALLE_CONFIG.maxRetries) {
      console.error(`  Failed after ${retries} retries`);
      resourceStatus.status = 'failed';
      resourceStatus.error = 'Max retries exceeded due to rate limiting';
      saveStatus(status);
      failed++;
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('\n========================================');
  console.log('Generation complete!');
  console.log(`  Generated: ${generated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Status file: ${STATUS_FILE}`);
}

// Run if called directly
if (require.main === module) {
  runGenerate().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}
