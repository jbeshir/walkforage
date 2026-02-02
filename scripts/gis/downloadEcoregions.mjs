/**
 * downloadEcoregions.mjs - Download Resolve Ecoregions 2017 shapefile
 *
 * Downloads and extracts the Ecoregions2017 shapefile from the official source.
 *
 * Usage: npm run gis:download-biomes
 *        node scripts/gis/downloadEcoregions.mjs
 *
 * Output: scripts/gis/input/Ecoregions2017.shp (and associated files)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.join(__dirname, 'input');
const ZIP_PATH = path.join(INPUT_DIR, 'Ecoregions2017.zip');
const SHP_PATH = path.join(INPUT_DIR, 'Ecoregions2017.shp');

// Official download URL from https://ecoregions.appspot.com/
const DOWNLOAD_URL = 'https://storage.googleapis.com/teow2016/Ecoregions2017.zip';

async function downloadFile(url, destPath) {
  console.log(`Downloading from ${url}...`);
  console.log(`Destination: ${destPath}`);
  console.log('(This may take a few minutes for ~150MB file)\n');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  let downloadedBytes = 0;

  const fileStream = fs.createWriteStream(destPath);
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    fileStream.write(Buffer.from(value));
    downloadedBytes += value.length;

    if (totalBytes > 0) {
      const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
      const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
      process.stdout.write(`\rDownloading: ${percent}% (${mb} MB)`);
    }
  }

  fileStream.end();
  console.log('\nDownload complete!');
}

function extractZip(zipPath, destDir) {
  console.log(`\nExtracting ${path.basename(zipPath)}...`);

  // Use system unzip command (available on Linux/macOS)
  try {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
    console.log('Extraction complete!');
  } catch (error) {
    throw new Error(`Failed to extract zip. Make sure 'unzip' is installed.`);
  }
}

async function main() {
  console.log('Ecoregions 2017 Shapefile Downloader');
  console.log('=====================================\n');

  // Create input directory if needed
  if (!fs.existsSync(INPUT_DIR)) {
    fs.mkdirSync(INPUT_DIR, { recursive: true });
  }

  // Check if already downloaded
  if (fs.existsSync(SHP_PATH)) {
    const stats = fs.statSync(SHP_PATH);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`Shapefile already exists: ${SHP_PATH}`);
    console.log(`Size: ${sizeMB} MB`);
    console.log('\nTo re-download, delete the existing files first.');
    return;
  }

  // Download if zip doesn't exist
  if (!fs.existsSync(ZIP_PATH)) {
    await downloadFile(DOWNLOAD_URL, ZIP_PATH);
  } else {
    console.log(`Using existing zip: ${ZIP_PATH}`);
  }

  // Extract
  extractZip(ZIP_PATH, INPUT_DIR);

  // Verify extraction
  if (fs.existsSync(SHP_PATH)) {
    const stats = fs.statSync(SHP_PATH);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`\nSuccess! Shapefile ready: ${SHP_PATH}`);
    console.log(`Size: ${sizeMB} MB`);
    console.log('\nNext step: npm run gis:process-biomes');
  } else {
    console.error('\nError: Shapefile not found after extraction.');
    console.error('The zip file structure may have changed.');
  }
}

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
