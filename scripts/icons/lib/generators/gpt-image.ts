// GPT Image Generator (gpt-image-1)
// Better at following precise instructions than DALL-E 3
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { ImageGenerator } from './interface';
import { ResourceType } from '../types';
import { GPT_IMAGE_CONFIG, getOpenAIApiKey } from '../config';

/**
 * GPT Image generator using gpt-image-1 model.
 * Better at following precise instructions than DALL-E 3.
 * Returns base64-encoded images directly.
 */
export class GptImageGenerator implements ImageGenerator {
  readonly name = 'gpt-image';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? getOpenAIApiKey();
  }

  async generate(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        model: GPT_IMAGE_CONFIG.model,
        prompt: prompt,
        n: 1,
        size: GPT_IMAGE_CONFIG.size,
        quality: GPT_IMAGE_CONFIG.quality,
      });

      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/images/generations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(requestData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              if (response.data && response.data[0]) {
                // gpt-image-1 returns base64 directly, not URLs
                if (response.data[0].b64_json) {
                  // Save to temp file and return path as "file://" URL
                  const tempPath = this.saveBase64ToTemp(response.data[0].b64_json);
                  resolve(`file://${tempPath}`);
                } else if (response.data[0].url) {
                  // Fallback to URL if provided
                  resolve(response.data[0].url);
                } else {
                  reject(new Error('No image data in response'));
                }
              } else {
                reject(new Error('No image data in response'));
              }
            } catch (e) {
              reject(new Error(`Failed to parse response: ${e}`));
            }
          } else if (res.statusCode === 429) {
            reject(new Error('RATE_LIMIT'));
          } else {
            reject(new Error(`API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(requestData);
      req.end();
    });
  }

  private saveBase64ToTemp(base64Data: string): string {
    const tempDir = path.join(process.cwd(), 'scripts', 'icons', 'output', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, `gpt-image-${Date.now()}.png`);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(tempFile, buffer);
    return tempFile;
  }

  supportsType(type: ResourceType): boolean {
    // GPT Image works well for trees and foods with better instruction following
    return type === 'wood' || type === 'food';
  }
}
