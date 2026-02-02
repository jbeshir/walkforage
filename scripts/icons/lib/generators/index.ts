// Generator Factory
import { ImageGenerator, ImageEvaluator } from './interface';
import { DalleGenerator } from './dalle';
import { ReplicateGenerator } from './replicate';
import { GptImageGenerator } from './gpt-image';
import { VisionEvaluator } from './vision';
import { GeneratorName, ResourceType } from '../types';

export { ImageGenerator, ImageEvaluator } from './interface';
export { DalleGenerator } from './dalle';
export { ReplicateGenerator } from './replicate';
export { GptImageGenerator } from './gpt-image';
export { VisionEvaluator } from './vision';

/**
 * Create a generator instance by name.
 */
export function createGenerator(name: GeneratorName): ImageGenerator {
  switch (name) {
    case 'dalle':
      return new DalleGenerator();
    case 'replicate':
      return new ReplicateGenerator();
    case 'gpt-image':
      return new GptImageGenerator();
    default:
      throw new Error(`Unknown generator: ${name}`);
  }
}

/**
 * Get the default generator for a resource type.
 * - Stones: Replicate (Material SD for flat textures)
 * - Woods/Foods: GPT Image (better instruction following than DALL-E)
 */
export function getDefaultGenerator(type: ResourceType): ImageGenerator {
  return type === 'stone' ? createGenerator('replicate') : createGenerator('gpt-image');
}

/**
 * Get the name of the default generator for a resource type.
 */
export function getDefaultGeneratorName(type: ResourceType): GeneratorName {
  return type === 'stone' ? 'replicate' : 'gpt-image';
}

/**
 * Create the default evaluator (GPT-4o Vision).
 */
export function createEvaluator(): ImageEvaluator {
  return new VisionEvaluator();
}
