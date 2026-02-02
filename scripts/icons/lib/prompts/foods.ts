// Food Prompt Generation
// Optimized for DALL-E 3 (food illustrations)
import { ResourceResearch } from '../types';

// Specific style for consistent food illustrations - matches tree style
const FOOD_STYLE = [
  'simple botanical illustration',
  'watercolor style',
  'plain white background',
  'single specimen centered',
  'whole uncut exterior only',
  'clean composition',
  'single image only',
  'image does not tile or repeat',
  'no text or labels',
].join(', ');

// Category-specific composition guidance
const FOOD_COMPOSITION: Record<string, string> = {
  berry: 'A small sprig with 3-5 berries attached to stem with a few leaves',
  fruit: 'A single whole fruit',
  nut: 'Two or three whole nuts in their shells',
  greens: 'A small bunch of 3-4 fresh leaves',
  root: 'A single root or tuber with soil brushed off',
};

/**
 * Generate a prompt for food icons.
 * Optimized for DALL-E 3 which creates good food illustrations.
 */
export function generateFoodPrompt(resource: ResourceResearch): string {
  const { name, scientificName, category, appearance } = resource;
  const scientificPart = scientificName ? ` (${scientificName})` : '';

  // Get composition guidance for this category
  const composition = FOOD_COMPOSITION[category] || 'Single specimen';

  // Use texture for shape/form description
  const form = appearance.texture;

  // Include colors for visual accuracy
  const colors = appearance.primaryColors.slice(0, 2).join(', ');

  // Include up to 2 distinguishing features for balance
  const features = appearance.distinguishingFeatures.slice(0, 2).join('. ');

  return [
    `${name}${scientificPart}.`,
    `${composition}.`,
    `${form}.`,
    `Colors: ${colors}.`,
    features ? `${features}.` : '',
    FOOD_STYLE + '.',
  ]
    .filter(Boolean)
    .join(' ');
}
