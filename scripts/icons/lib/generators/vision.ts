// GPT-4o Vision Evaluator
import * as https from 'https';
import { ImageEvaluator } from './interface';
import { EvaluationCriteria, EvaluationResult } from '../types';
import { VISION_CONFIG, getOpenAIApiKey } from '../config';

interface VisionResponse {
  hasHands: boolean;
  hasContainers: boolean;
  hasLabels: boolean;
  hasExtraItems: boolean;
  isCentered: boolean;
  matchesDescription: boolean;
  // Food-specific checks
  hasExcessSeeds?: boolean;
  hasMissingSkin?: boolean;
  // Stone-specific checks
  isTexture?: boolean;
  fillsFrame?: boolean;
  has3DObject?: boolean;
  issues: string[];
  confidence: number;
}

/**
 * GPT-4o Vision evaluator for checking generated icon quality.
 * Uses vision capabilities to detect unwanted elements like hands, containers, labels.
 */
export class VisionEvaluator implements ImageEvaluator {
  readonly name = 'vision';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? getOpenAIApiKey();
  }

  async evaluate(imageBuffer: Buffer, criteria: EvaluationCriteria): Promise<EvaluationResult> {
    const prompt = this.buildEvaluationPrompt(criteria);
    const response = await this.callVisionAPI(imageBuffer, prompt);

    // Parse the response and determine pass/fail
    const issues: string[] = [];

    if (criteria.checkForHands && response.hasHands) {
      issues.push('Contains human hands');
    }
    if (criteria.checkForContainers && response.hasContainers) {
      issues.push('Contains containers (bowls, baskets, plates)');
    }
    if (criteria.checkForLabels && response.hasLabels) {
      issues.push('Contains text or labels');
    }
    if (criteria.checkForExtraItems && response.hasExtraItems) {
      issues.push('Contains disconnected extra items');
    }
    // For non-stones, check centering
    if (criteria.type !== 'stone' && !response.isCentered) {
      issues.push('Subject is not centered');
    }
    if (!response.matchesDescription) {
      issues.push(`Does not clearly depict ${criteria.name}`);
    }
    // Food-specific checks
    if (criteria.checkForExcessSeeds && response.hasExcessSeeds) {
      issues.push('Has more seeds than natural for this food');
    }
    if (criteria.checkForMissingSkin && response.hasMissingSkin) {
      issues.push('Missing expected skin/peel');
    }
    // Stone-specific checks
    if (criteria.checkIsTexture && !response.isTexture) {
      issues.push('Not a flat texture (should be surface texture, not an object)');
    }
    if (criteria.checkFillsFrame && !response.fillsFrame) {
      issues.push('Texture does not fill the entire frame edge-to-edge');
    }
    if (criteria.checkNo3DObject && response.has3DObject) {
      issues.push('Contains a 3D object/sphere instead of flat texture');
    }

    // Add any additional issues from the model
    for (const issue of response.issues) {
      if (!issues.includes(issue)) {
        issues.push(issue);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      confidence: response.confidence,
    };
  }

  private buildEvaluationPrompt(criteria: EvaluationCriteria): string {
    // Stone textures have completely different evaluation criteria
    if (criteria.type === 'stone') {
      return this.buildStoneEvaluationPrompt(criteria);
    }

    // Type-specific wording for disconnected items check
    const disconnectedItemsCheck =
      criteria.type === 'wood'
        ? '4. Are there any floating/detached leaves, branches, or other plant elements that are NOT connected to the main tree? (Look carefully for standalone leaves floating in the air or separate from the tree)'
        : '4. Are there any disconnected pieces of fruit, leaves, or other items floating separately from the main food item?';

    const baseChecks = `1. Are there any human hands visible in the image?
2. Are there any containers (bowls, baskets, plates) in the image?
3. Is there any text, watermarks, or labels in the image?
${disconnectedItemsCheck}
5. Is the main subject centered in the frame?
6. Does this clearly look like a ${criteria.type} (${criteria.name})?`;

    const foodChecks =
      criteria.type === 'food'
        ? `
7. Does the food have more seeds/pits visible than would be natural for this type of food? (e.g., a single berry showing dozens of seeds when it should have few or none visible)
8. Is the food missing its natural skin/peel when it should have one? (e.g., a grape or apple shown without skin)`
        : '';

    const baseResponse = `{
  "hasHands": boolean,
  "hasContainers": boolean,
  "hasLabels": boolean,
  "hasExtraItems": boolean,
  "isCentered": boolean,
  "matchesDescription": boolean,`;

    const foodResponse =
      criteria.type === 'food'
        ? `
  "hasExcessSeeds": boolean,
  "hasMissingSkin": boolean,`
        : '';

    return `Analyze this game icon image and check for the following issues.

This should be a ${criteria.type} icon showing: ${criteria.name}

Check for:
${baseChecks}${foodChecks}

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
${baseResponse}${foodResponse}
  "issues": ["list of specific issues found, empty if none"],
  "confidence": 0.0-1.0
}`;
  }

  private buildStoneEvaluationPrompt(criteria: EvaluationCriteria): string {
    return `Analyze this stone texture image. This should be a FLAT TEXTURE of ${criteria.name} stone surface, NOT a 3D object or rock shape.

Check for:
1. Is this a flat surface texture that fills the entire image edge-to-edge? (It should be like looking straight down at a stone surface, not a rock sitting on a background)
2. Does the texture extend all the way to all four edges of the image with no background visible?
3. Is there a 3D object, sphere, or distinct rock shape in the image? (There should NOT be - it should be a flat texture only)
4. Is there any text, watermarks, or labels in the image?
5. Does the texture/color/pattern match what you would expect from ${criteria.name}?

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "isTexture": boolean (true if this is a flat surface texture, false if it shows a 3D object/rock),
  "fillsFrame": boolean (true if texture extends edge-to-edge with no background),
  "has3DObject": boolean (true if there is a sphere, rock shape, or 3D object),
  "hasLabels": boolean,
  "matchesDescription": boolean (true if it looks like ${criteria.name}),
  "hasHands": false,
  "hasContainers": false,
  "hasExtraItems": false,
  "isCentered": true,
  "issues": ["list of specific issues found, empty if none"],
  "confidence": 0.0-1.0
}`;
  }

  private async callVisionAPI(imageBuffer: Buffer, prompt: string): Promise<VisionResponse> {
    return new Promise((resolve, reject) => {
      const base64Image = imageBuffer.toString('base64');

      const requestData = JSON.stringify({
        model: VISION_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'low', // Use low detail to reduce cost
                },
              },
            ],
          },
        ],
        max_tokens: VISION_CONFIG.maxTokens,
        temperature: VISION_CONFIG.temperature,
      });

      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
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
              const content = response.choices?.[0]?.message?.content;

              if (!content) {
                reject(new Error('No content in vision response'));
                return;
              }

              // Parse the JSON response from the model
              // Clean up potential markdown formatting
              let jsonStr = content.trim();
              if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.slice(7);
              }
              if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.slice(3);
              }
              if (jsonStr.endsWith('```')) {
                jsonStr = jsonStr.slice(0, -3);
              }
              jsonStr = jsonStr.trim();

              const visionResult = JSON.parse(jsonStr) as VisionResponse;
              resolve(visionResult);
            } catch (e) {
              reject(new Error(`Failed to parse vision response: ${e}\nRaw: ${data}`));
            }
          } else if (res.statusCode === 429) {
            reject(new Error('RATE_LIMIT'));
          } else {
            reject(new Error(`Vision API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(requestData);
      req.end();
    });
  }
}
