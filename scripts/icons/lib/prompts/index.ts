// Prompt Generation Module
import { ResourceResearch } from '../types';
import { generateStonePrompt } from './stones';
import { generateWoodPrompt } from './woods';
import { generateFoodPrompt } from './foods';
import { generateAppPrompt } from './apps';

export { generateStonePrompt } from './stones';
export { generateWoodPrompt } from './woods';
export { generateFoodPrompt } from './foods';
export { generateAppPrompt } from './apps';

/**
 * Generate a prompt for a resource based on its type.
 */
export function generatePrompt(resource: ResourceResearch): string {
  switch (resource.type) {
    case 'stone':
      return generateStonePrompt(resource);
    case 'wood':
      return generateWoodPrompt(resource);
    case 'food':
      return generateFoodPrompt(resource);
    case 'app':
      return generateAppPrompt(resource);
    default:
      throw new Error(`Unknown resource type: ${resource.type}`);
  }
}
