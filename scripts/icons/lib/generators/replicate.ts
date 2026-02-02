// Replicate Material Stable Diffusion Image Generator
import * as https from 'https';
import { ImageGenerator } from './interface';
import { ResourceType } from '../types';
import { REPLICATE_CONFIG, getReplicateApiToken } from '../config';

interface PredictionResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string[];
  error?: string;
}

/**
 * Replicate Material Stable Diffusion image generator.
 * Specifically designed for generating seamless tileable material textures.
 * Ideal for stone textures that need to be flat surfaces, not 3D objects.
 */
export class ReplicateGenerator implements ImageGenerator {
  readonly name = 'replicate';
  private apiToken: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken ?? getReplicateApiToken();
  }

  async generate(prompt: string): Promise<string> {
    // Create prediction
    const prediction = await this.createPrediction(prompt);

    // Poll for completion
    const result = await this.pollPrediction(prediction.id);

    if (result.status === 'failed') {
      throw new Error(`Replicate generation failed: ${result.error || 'Unknown error'}`);
    }

    if (!result.output || result.output.length === 0) {
      throw new Error('No output image from Replicate');
    }

    return result.output[0];
  }

  supportsType(type: ResourceType): boolean {
    // Material Stable Diffusion is designed for textures, perfect for stones
    return type === 'stone';
  }

  private async createPrediction(prompt: string): Promise<PredictionResponse> {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        version: REPLICATE_CONFIG.version,
        input: {
          prompt: prompt,
          guidance_scale: REPLICATE_CONFIG.parameters.guidance_scale,
          num_inference_steps: REPLICATE_CONFIG.parameters.num_inference_steps,
          width: REPLICATE_CONFIG.parameters.width,
          height: REPLICATE_CONFIG.parameters.height,
        },
      });

      const options = {
        hostname: 'api.replicate.com',
        port: 443,
        path: '/v1/predictions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Length': Buffer.byteLength(requestData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 201 || res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              resolve(response as PredictionResponse);
            } catch (e) {
              reject(new Error(`Failed to parse Replicate response: ${e}`));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('Invalid Replicate API token'));
          } else if (res.statusCode === 429) {
            reject(new Error('RATE_LIMIT'));
          } else {
            reject(new Error(`Replicate API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(requestData);
      req.end();
    });
  }

  private async pollPrediction(predictionId: string): Promise<PredictionResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < REPLICATE_CONFIG.maxPollTime) {
      const prediction = await this.getPrediction(predictionId);

      if (
        prediction.status === 'succeeded' ||
        prediction.status === 'failed' ||
        prediction.status === 'canceled'
      ) {
        return prediction;
      }

      // Wait before polling again
      await this.sleep(REPLICATE_CONFIG.pollInterval);
    }

    throw new Error('Replicate prediction timed out');
  }

  private async getPrediction(predictionId: string): Promise<PredictionResponse> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.replicate.com',
        port: 443,
        path: `/v1/predictions/${predictionId}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
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
              resolve(response as PredictionResponse);
            } catch (e) {
              reject(new Error(`Failed to parse Replicate response: ${e}`));
            }
          } else {
            reject(new Error(`Replicate API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
