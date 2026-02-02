// Wood Prompt Generation
// Optimized for DALL-E 3 (tree illustrations)
import { ResourceResearch } from '../types';

// Specific style for consistent tree illustrations
const TREE_STYLE = [
  'simple botanical illustration',
  'watercolor style',
  'plain white background',
  'single complete tree with visible trunk base and full canopy',
  'tiny gap of white space above the tree crown',
  'tiny gap of white space below the trunk base',
  'realistically sized leaves',
  'one illustration filling the entire canvas',
  'not a pattern',
  'not a repeating tile',
  'full color',
  'no text or labels',
].join(', ');

/**
 * Generate a prompt for wood/tree icons.
 * Optimized for DALL-E 3 which creates good tree illustrations.
 */
export function generateWoodPrompt(resource: ResourceResearch): string {
  const { name, scientificName, appearance } = resource;
  const scientificPart = scientificName ? ` (${scientificName})` : '';

  // Include leaf/needle shape from texture
  const leafInfo = appearance.texture;

  // Explicit colors for trunk and foliage to prevent color bleeding
  const trunkColor = appearance.trunkColor ? `Trunk: ${appearance.trunkColor}.` : '';
  const foliageColor = appearance.foliageColor ? `Foliage: ${appearance.foliageColor}.` : '';

  // Include all distinguishing features
  const distinguishing = appearance.distinguishingFeatures.join('. ');

  // Include family features if available
  const family = appearance.familyFeatures?.join('. ') || '';

  return [
    `A single ${name} tree${scientificPart}.`,
    `${leafInfo}.`,
    trunkColor,
    foliageColor,
    family ? `${family}.` : '',
    `${distinguishing}.`,
    TREE_STYLE + '.',
  ]
    .filter(Boolean)
    .join(' ');
}
