// Stone Resources - Based on USGS geological classifications
// Properties derived from real material science

import { StoneType } from '../types/resources';

export const STONES: StoneType[] = [
  // SEDIMENTARY STONES
  {
    id: 'limestone',
    name: 'Limestone',
    category: 'sedimentary',
    description: 'Soft, easily worked stone. Common building material.',
    properties: { hardness: 3, workability: 8, durability: 5, rarity: 0.7 },
    color: '#D4C5A9',
  },
  {
    id: 'sandstone',
    name: 'Sandstone',
    category: 'sedimentary',
    description: 'Granular sedimentary rock, good for rough construction.',
    properties: { hardness: 4, workability: 7, durability: 4, rarity: 0.6 },
    color: '#C9A66B',
  },
  {
    id: 'shale',
    name: 'Shale',
    category: 'sedimentary',
    description: 'Layered sedimentary rock, splits into flat pieces.',
    properties: { hardness: 2, workability: 6, durability: 3, rarity: 0.5 },
    color: '#5C5C5C',
  },
  {
    id: 'chalk',
    name: 'Chalk',
    category: 'sedimentary',
    description: 'Soft white limestone, source of lime for mortar.',
    properties: { hardness: 1, workability: 9, durability: 2, rarity: 0.4 },
    color: '#F5F5F5',
  },
  {
    id: 'clay',
    name: 'Clay',
    category: 'sedimentary',
    description: 'Fine-grained earth, essential for pottery and bricks.',
    properties: { hardness: 1, workability: 10, durability: 1, rarity: 0.8 },
    color: '#8B4513',
  },

  // IGNEOUS STONES
  {
    id: 'granite',
    name: 'Granite',
    category: 'igneous',
    description: 'Hard crystalline rock. Extremely durable but difficult to work.',
    properties: { hardness: 7, workability: 3, durability: 9, rarity: 0.3 },
    color: '#9E9E9E',
  },
  {
    id: 'basalt',
    name: 'Basalt',
    category: 'igneous',
    description: 'Dark volcanic rock, very hard and dense.',
    properties: { hardness: 8, workability: 2, durability: 9, rarity: 0.25 },
    color: '#3D3D3D',
  },
  {
    id: 'diorite',
    name: 'Diorite',
    category: 'igneous',
    description: 'Hard stone used for ancient stone hammers.',
    properties: { hardness: 7, workability: 3, durability: 8, rarity: 0.2 },
    color: '#6B6B6B',
  },
  {
    id: 'pumice',
    name: 'Pumice',
    category: 'igneous',
    description: 'Porous volcanic stone, lightweight and abrasive.',
    properties: { hardness: 5, workability: 6, durability: 3, rarity: 0.15 },
    color: '#E8E8E8',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    category: 'igneous',
    description: 'Volcanic glass. Creates razor-sharp edges when knapped.',
    properties: { hardness: 6, workability: 7, durability: 4, rarity: 0.1 },
    color: '#1A1A1A',
  },

  // METAMORPHIC STONES
  {
    id: 'marble',
    name: 'Marble',
    category: 'metamorphic',
    description: 'Crystallized limestone. Prized for monuments and decoration.',
    properties: { hardness: 4, workability: 6, durability: 7, rarity: 0.15 },
    color: '#FAFAFA',
  },
  {
    id: 'slate',
    name: 'Slate',
    category: 'metamorphic',
    description: 'Dense layered stone, excellent for roofing and flooring.',
    properties: { hardness: 5, workability: 5, durability: 7, rarity: 0.3 },
    color: '#4A4A4A',
  },
  {
    id: 'quartzite',
    name: 'Quartzite',
    category: 'metamorphic',
    description: 'Extremely hard metamorphic rock, harder than granite.',
    properties: { hardness: 9, workability: 1, durability: 10, rarity: 0.15 },
    color: '#F0E68C',
  },
  {
    id: 'schist',
    name: 'Schist',
    category: 'metamorphic',
    description: 'Layered metamorphic rock with visible mineral grains.',
    properties: { hardness: 5, workability: 4, durability: 6, rarity: 0.25 },
    color: '#708090',
  },
  {
    id: 'gneiss',
    name: 'Gneiss',
    category: 'metamorphic',
    description: 'Banded metamorphic rock, similar to granite in strength.',
    properties: { hardness: 7, workability: 3, durability: 8, rarity: 0.2 },
    color: '#A9A9A9',
  },

  // TOOLSTONES - Critical for early game
  {
    id: 'flint',
    name: 'Flint',
    category: 'toolstone',
    description: 'The classic toolmaking stone. Produces sharp, durable edges.',
    properties: { hardness: 7, workability: 8, durability: 6, rarity: 0.35 },
    color: '#2F2F2F',
  },
  {
    id: 'chert',
    name: 'Chert',
    category: 'toolstone',
    description: 'Similar to flint, found in limestone regions.',
    properties: { hardness: 7, workability: 7, durability: 5, rarity: 0.3 },
    color: '#4B3621',
  },
  {
    id: 'jasper',
    name: 'Jasper',
    category: 'toolstone',
    description: 'Colorful microcrystalline quartz, good for tools.',
    properties: { hardness: 7, workability: 6, durability: 6, rarity: 0.2 },
    color: '#8B0000',
  },

  // ORES
  {
    id: 'malachite',
    name: 'Malachite',
    category: 'ore',
    description: 'Green copper ore. The first metal humanity learned to smelt.',
    properties: { hardness: 4, workability: 5, durability: 4, rarity: 0.08 },
    color: '#0BDA51',
  },
  {
    id: 'cassiterite',
    name: 'Cassiterite',
    category: 'ore',
    description: 'Tin ore. Rare but essential for bronze.',
    properties: { hardness: 6, workability: 4, durability: 5, rarity: 0.02 },
    color: '#2C1810',
  },
  {
    id: 'hematite',
    name: 'Hematite',
    category: 'ore',
    description: 'Iron ore. Abundant but requires high-temperature smelting.',
    properties: { hardness: 6, workability: 3, durability: 6, rarity: 0.12 },
    color: '#5C3317',
  },
  {
    id: 'magnetite',
    name: 'Magnetite',
    category: 'ore',
    description: 'Magnetic iron ore, higher iron content than hematite.',
    properties: { hardness: 6, workability: 3, durability: 6, rarity: 0.08 },
    color: '#1C1C1C',
  },
  {
    id: 'galena',
    name: 'Galena',
    category: 'ore',
    description: 'Lead ore. Heavy and easily smelted.',
    properties: { hardness: 2, workability: 7, durability: 3, rarity: 0.05 },
    color: '#3C3C3C',
  },
];

export const STONES_BY_ID = Object.fromEntries(
  STONES.map(s => [s.id, s])
);

export function getStonesByCategory(category: string): StoneType[] {
  return STONES.filter(s => s.category === category);
}
