// Wood Resources - Based on Global Forest Watch and botanical data
// Properties derived from real wood science

import { WoodType } from '../types/resources';

export const WOODS: WoodType[] = [
  // SOFTWOODS - Common, fast-growing, easier to work
  {
    id: 'pine',
    name: 'Pine',
    category: 'softwood',
    description: 'Common softwood. Light, easy to work, but less durable.',
    properties: { hardness: 3, workability: 8, durability: 4, rarity: 0.7 },
    biomes: ['temperate_conifer', 'boreal'],
    color: '#DEB887',
  },
  {
    id: 'spruce',
    name: 'Spruce',
    category: 'softwood',
    description: 'Strong for its weight. Good for construction and tool handles.',
    properties: { hardness: 4, workability: 7, durability: 4, rarity: 0.6 },
    biomes: ['boreal', 'temperate_conifer', 'montane'],
    color: '#D2B48C',
  },
  {
    id: 'fir',
    name: 'Fir',
    category: 'softwood',
    description: 'Tall straight trees. Excellent for beams and masts.',
    properties: { hardness: 3, workability: 8, durability: 3, rarity: 0.5 },
    biomes: ['temperate_conifer', 'montane'],
    color: '#C4A484',
  },
  {
    id: 'cedar',
    name: 'Cedar',
    category: 'softwood',
    description: 'Naturally rot-resistant. Aromatic and durable for outdoor use.',
    properties: { hardness: 3, workability: 8, durability: 7, rarity: 0.3 },
    biomes: ['temperate_conifer', 'mediterranean'],
    color: '#B8860B',
  },
  {
    id: 'larch',
    name: 'Larch',
    category: 'softwood',
    description: 'Deciduous conifer. Harder than most softwoods.',
    properties: { hardness: 5, workability: 6, durability: 6, rarity: 0.25 },
    biomes: ['boreal', 'montane'],
    color: '#C9A56B',
  },

  // HARDWOODS - Stronger, more durable, required for advanced construction
  {
    id: 'oak',
    name: 'Oak',
    category: 'hardwood',
    description: 'The king of hardwoods. Essential for ships, tools, and buildings.',
    properties: { hardness: 7, workability: 4, durability: 9, rarity: 0.25 },
    biomes: ['temperate_broadleaf', 'mediterranean'],
    color: '#8B7355',
  },
  {
    id: 'ash',
    name: 'Ash',
    category: 'hardwood',
    description: 'Flexible and shock-resistant. Ideal for tool handles and weapons.',
    properties: { hardness: 6, workability: 6, durability: 6, rarity: 0.3 },
    biomes: ['temperate_broadleaf'],
    color: '#C9B79C',
  },
  {
    id: 'beech',
    name: 'Beech',
    category: 'hardwood',
    description: 'Dense hardwood. Excellent for furniture and flooring.',
    properties: { hardness: 6, workability: 5, durability: 5, rarity: 0.35 },
    biomes: ['temperate_broadleaf'],
    color: '#D4A26A',
  },
  {
    id: 'maple',
    name: 'Maple',
    category: 'hardwood',
    description: 'Hard and fine-grained. Used for instruments and fine woodwork.',
    properties: { hardness: 7, workability: 5, durability: 6, rarity: 0.25 },
    biomes: ['temperate_broadleaf', 'temperate_mixed'],
    color: '#C4A35A',
  },
  {
    id: 'birch',
    name: 'Birch',
    category: 'hardwood',
    description: 'Light-colored hardwood. Bark useful for many crafts.',
    properties: { hardness: 5, workability: 6, durability: 4, rarity: 0.4 },
    biomes: ['boreal', 'temperate_broadleaf'],
    color: '#F5DEB3',
  },
  {
    id: 'elm',
    name: 'Elm',
    category: 'hardwood',
    description: 'Interlocking grain resists splitting. Good for wheels and chairs.',
    properties: { hardness: 5, workability: 4, durability: 5, rarity: 0.2 },
    biomes: ['temperate_broadleaf'],
    color: '#9B7653',
  },
  {
    id: 'hickory',
    name: 'Hickory',
    category: 'hardwood',
    description: 'Extremely tough. The best wood for striking tool handles.',
    properties: { hardness: 8, workability: 3, durability: 7, rarity: 0.15 },
    biomes: ['temperate_broadleaf'],
    color: '#A0522D',
  },
  {
    id: 'yew',
    name: 'Yew',
    category: 'hardwood',
    description: 'Dense and flexible. The traditional wood for longbows.',
    properties: { hardness: 6, workability: 5, durability: 8, rarity: 0.1 },
    biomes: ['temperate_broadleaf', 'temperate_conifer'],
    color: '#B87333',
  },

  // TROPICAL - Specialized properties
  {
    id: 'teak',
    name: 'Teak',
    category: 'tropical',
    description: 'Naturally oily and rot-resistant. Prized for shipbuilding.',
    properties: { hardness: 6, workability: 5, durability: 10, rarity: 0.08 },
    biomes: ['tropical_moist', 'tropical_dry'],
    color: '#9A7B4F',
  },
  {
    id: 'mahogany',
    name: 'Mahogany',
    category: 'tropical',
    description: 'Rich reddish wood. Excellent for fine furniture.',
    properties: { hardness: 5, workability: 7, durability: 7, rarity: 0.05 },
    biomes: ['tropical_moist'],
    color: '#C04000',
  },
  {
    id: 'bamboo',
    name: 'Bamboo',
    category: 'tropical',
    description: 'Fast-growing grass with wood-like properties. Versatile.',
    properties: { hardness: 5, workability: 6, durability: 4, rarity: 0.5 },
    biomes: ['tropical_moist', 'subtropical'],
    color: '#7DB46C',
  },
  {
    id: 'ebony',
    name: 'Ebony',
    category: 'tropical',
    description: 'Dense black wood. Extremely hard and rare.',
    properties: { hardness: 9, workability: 2, durability: 9, rarity: 0.02 },
    biomes: ['tropical_moist'],
    color: '#1B1B1B',
  },

  // FRUIT TREES - Provide wood AND food
  {
    id: 'apple',
    name: 'Apple Wood',
    category: 'fruit',
    description: 'Dense fruitwood. Burns well and carves beautifully.',
    properties: { hardness: 6, workability: 6, durability: 5, rarity: 0.15 },
    biomes: ['temperate_broadleaf', 'temperate_mixed'],
    color: '#8B4513',
  },
  {
    id: 'cherry',
    name: 'Cherry Wood',
    category: 'fruit',
    description: 'Fine-grained hardwood with warm color.',
    properties: { hardness: 5, workability: 7, durability: 5, rarity: 0.15 },
    biomes: ['temperate_broadleaf'],
    color: '#DE3163',
  },
  {
    id: 'walnut',
    name: 'Walnut',
    category: 'fruit',
    description: 'Strong, shock-resistant. Traditional for gunstocks.',
    properties: { hardness: 6, workability: 6, durability: 7, rarity: 0.12 },
    biomes: ['temperate_broadleaf', 'mediterranean'],
    color: '#5C4033',
  },
  {
    id: 'olive',
    name: 'Olive Wood',
    category: 'fruit',
    description: 'Dense with beautiful grain. Resistant to decay.',
    properties: { hardness: 7, workability: 4, durability: 8, rarity: 0.1 },
    biomes: ['mediterranean'],
    color: '#808000',
  },
];

export const WOODS_BY_ID = Object.fromEntries(
  WOODS.map(w => [w.id, w])
);

export function getWoodsByBiome(biome: string): WoodType[] {
  return WOODS.filter(w => w.biomes.includes(biome));
}

export function getWoodsByCategory(category: string): WoodType[] {
  return WOODS.filter(w => w.category === category);
}
