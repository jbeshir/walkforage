// Stone Prompt Generation
// Optimized for Replicate Material Stable Diffusion (flat tileable textures)
import { ResourceResearch } from '../types';

/**
 * Generate a prompt for stone textures.
 * Optimized for Material Stable Diffusion which creates seamless tileable textures.
 */
export function generateStonePrompt(resource: ResourceResearch): string {
  const { name, appearance } = resource;
  const colors = appearance.primaryColors.join(', ');
  const features = appearance.distinguishingFeatures.join('. ');

  // Material SD prompt style - focus on material properties, not scene
  // Avoid words like "tile", "tileable", "seamless" which create grid patterns
  // Avoid "macro" or "close-up" which zoom in too much
  return [
    `${name} rock surface.`,
    `${appearance.texture}.`,
    `Colors: ${colors}.`,
    appearance.pattern ? `${appearance.pattern}.` : '',
    `${features}.`,
    'Natural stone, rough texture, photograph from 1 meter distance, no text or labels.',
  ]
    .filter(Boolean)
    .join(' ');
}
