// DALL-E 3 Image Generator
import * as https from 'https';
import { ImageGenerator } from './interface';
import { ResourceType } from '../types';
import { DALLE_CONFIG, getOpenAIApiKey } from '../config';

/**
 * DALL-E 3 image generator implementation.
 * Good for tree and food icons, but produces spherical 3D objects for stone textures.
 */
export class DalleGenerator implements ImageGenerator {
  readonly name = 'dalle';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? getOpenAIApiKey();
  }

  async generate(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        model: DALLE_CONFIG.model,
        prompt: prompt,
        n: 1,
        size: DALLE_CONFIG.size,
        quality: DALLE_CONFIG.quality,
        style: DALLE_CONFIG.style,
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
              if (response.data && response.data[0] && response.data[0].url) {
                resolve(response.data[0].url);
              } else {
                reject(new Error('No image URL in response'));
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

  supportsType(type: ResourceType): boolean {
    // DALL-E works well for trees and foods, but produces 3D spheres for stones
    return type === 'wood' || type === 'food';
  }
}
