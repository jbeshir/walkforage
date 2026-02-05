// App Icon Prompt Generation
import { ResourceResearch } from '../types';

const APP_ICON_STYLE = [
  'mobile app icon',
  'simple recognizable design',
  'works at small sizes',
  'no text',
  'bold shapes',
  'flat design with subtle depth',
  'square format',
  'centered composition',
].join(', ');

export function generateAppPrompt(resource: ResourceResearch): string {
  const { appearance } = resource;
  const colors = appearance.primaryColors.slice(0, 2).join(' and ');
  const features = appearance.distinguishingFeatures.slice(0, 2).join('. ');

  return [
    'App icon for a walking and foraging game.',
    `Theme: ${features}.`,
    `Colors: ${colors}.`,
    APP_ICON_STYLE + '.',
  ].join(' ');
}
