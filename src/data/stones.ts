// Stone Resources - Based on Macrostrat geological classifications
// Properties derived from real material science
// Lithologies mapped to Macrostrat API (221 lithology types)

import { StoneType } from '../types/resources';

export const STONES: StoneType[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SEDIMENTARY STONES - Formed from compressed sediments
  // ═══════════════════════════════════════════════════════════════════════════

  // Carbonate sedimentary
  {
    id: 'limestone',
    name: 'Limestone',
    category: 'sedimentary',
    description: 'Soft, easily worked stone. Common building material.',
    properties: { hardness: 3, workability: 8, durability: 5, rarity: 0.7 },
    lithologies: ['limestone', 'lime_mudstone', 'wackestone', 'packstone'],
    color: '#D4C5A9',
  },
  {
    id: 'chalk',
    name: 'Chalk',
    category: 'sedimentary',
    description: 'Soft white limestone, source of lime for mortar.',
    properties: { hardness: 1, workability: 9, durability: 2, rarity: 0.4 },
    lithologies: ['chalk', 'calcarite'],
    color: '#F5F5F5',
  },
  {
    id: 'dolomite',
    name: 'Dolomite',
    category: 'sedimentary',
    description: 'Carbonate rock similar to limestone but harder.',
    properties: { hardness: 4, workability: 6, durability: 6, rarity: 0.35 },
    lithologies: ['dolomite', 'dolostone'],
    color: '#E8DCC8',
  },

  // Siliciclastic sedimentary
  {
    id: 'sandstone',
    name: 'Sandstone',
    category: 'sedimentary',
    description: 'Granular sedimentary rock, good for rough construction.',
    properties: { hardness: 4, workability: 7, durability: 4, rarity: 0.6 },
    lithologies: ['sandstone', 'arenite', 'arkose', 'greywacke'],
    color: '#C9A66B',
  },
  {
    id: 'siltstone',
    name: 'Siltstone',
    category: 'sedimentary',
    description: 'Fine-grained rock between sandstone and shale.',
    properties: { hardness: 3, workability: 6, durability: 4, rarity: 0.4 },
    lithologies: ['siltstone'],
    color: '#A89080',
  },
  {
    id: 'shale',
    name: 'Shale',
    category: 'sedimentary',
    description: 'Layered sedimentary rock, splits into flat pieces.',
    properties: { hardness: 2, workability: 6, durability: 3, rarity: 0.5 },
    lithologies: ['shale', 'mudstone', 'claystone'],
    color: '#5C5C5C',
  },
  {
    id: 'mudstone',
    name: 'Mudstone',
    category: 'sedimentary',
    description: 'Fine-grained rock that does not split like shale.',
    properties: { hardness: 2, workability: 7, durability: 3, rarity: 0.5 },
    lithologies: ['mudstone', 'claystone', 'argillite'],
    color: '#6B5B4F',
  },
  {
    id: 'conglomerate',
    name: 'Conglomerate',
    category: 'sedimentary',
    description: 'Rock composed of rounded pebbles cemented together.',
    properties: { hardness: 5, workability: 3, durability: 5, rarity: 0.3 },
    lithologies: ['conglomerate', 'breccia', 'diamictite'],
    color: '#8B7D6B',
  },
  {
    id: 'clay',
    name: 'Clay',
    category: 'sedimentary',
    description: 'Fine-grained earth, essential for pottery and bricks.',
    properties: { hardness: 1, workability: 10, durability: 1, rarity: 0.8 },
    lithologies: ['clay', 'mudite'],
    color: '#8B4513',
  },

  // Chemical sedimentary (toolstones)
  {
    id: 'flint',
    name: 'Flint',
    category: 'sedimentary',
    description: 'The classic toolmaking stone. Produces sharp, durable edges.',
    properties: { hardness: 7, workability: 8, durability: 6, rarity: 0.35 },
    lithologies: ['chert', 'flint'],
    isToolstone: true,
    color: '#2F2F2F',
  },
  {
    id: 'chert',
    name: 'Chert',
    category: 'sedimentary',
    description: 'Similar to flint, found in limestone regions.',
    properties: { hardness: 7, workability: 7, durability: 5, rarity: 0.3 },
    lithologies: ['chert', 'novaculite', 'radiolarite'],
    isToolstone: true,
    color: '#4B3621',
  },
  {
    id: 'travertine',
    name: 'Travertine',
    category: 'sedimentary',
    description: 'Banded limestone deposited by mineral springs. Premium decorative stone.',
    properties: { hardness: 3, workability: 7, durability: 5, rarity: 0.2 },
    lithologies: ['travertine', 'tufa'],
    color: '#F5E6D3',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IGNEOUS PLUTONIC - Formed from slowly cooled magma underground
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'granite',
    name: 'Granite',
    category: 'igneous_plutonic',
    description: 'Hard crystalline rock. Extremely durable but difficult to work.',
    properties: { hardness: 7, workability: 3, durability: 9, rarity: 0.3 },
    lithologies: ['granite', 'granodiorite', 'monzonite'],
    color: '#9E9E9E',
  },
  {
    id: 'diorite',
    name: 'Diorite',
    category: 'igneous_plutonic',
    description: 'Hard stone used for ancient stone hammers.',
    properties: { hardness: 7, workability: 3, durability: 8, rarity: 0.2 },
    lithologies: ['diorite', 'tonalite'],
    color: '#6B6B6B',
  },
  {
    id: 'gabbro',
    name: 'Gabbro',
    category: 'igneous_plutonic',
    description: 'Dark coarse-grained rock, the plutonic equivalent of basalt.',
    properties: { hardness: 7, workability: 2, durability: 8, rarity: 0.15 },
    lithologies: ['gabbro', 'norite', 'troctolite'],
    color: '#2F2F2F',
  },
  {
    id: 'diabase',
    name: 'Diabase',
    category: 'igneous_plutonic',
    description: 'Fine-grained intrusive rock, used for grinding stones and megaliths.',
    properties: { hardness: 7, workability: 2, durability: 8, rarity: 0.2 },
    lithologies: ['diabase', 'dolerite'],
    color: '#3A3A3A',
  },
  {
    id: 'pegmatite',
    name: 'Pegmatite',
    category: 'igneous_plutonic',
    description: 'Coarse crystalline rock, source of large feldspar and mica crystals.',
    properties: { hardness: 6, workability: 4, durability: 7, rarity: 0.15 },
    lithologies: ['pegmatite'],
    color: '#E8D8C8',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IGNEOUS VOLCANIC - Formed from rapidly cooled lava at surface
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'basalt',
    name: 'Basalt',
    category: 'igneous_volcanic',
    description: 'Dark volcanic rock, very hard and dense.',
    properties: { hardness: 8, workability: 2, durability: 9, rarity: 0.25 },
    lithologies: ['basalt', 'trachybasalt'],
    color: '#3D3D3D',
  },
  {
    id: 'andesite',
    name: 'Andesite',
    category: 'igneous_volcanic',
    description: 'Intermediate volcanic rock, common in mountain building zones.',
    properties: { hardness: 6, workability: 4, durability: 7, rarity: 0.2 },
    lithologies: ['andesite', 'trachyandesite'],
    color: '#5A5A5A',
  },
  {
    id: 'rhyolite',
    name: 'Rhyolite',
    category: 'igneous_volcanic',
    description: 'Light-colored volcanic rock, the extrusive form of granite.',
    properties: { hardness: 6, workability: 5, durability: 6, rarity: 0.15 },
    lithologies: ['rhyolite', 'rhyodacite', 'dacite'],
    color: '#C4B8A8',
  },
  {
    id: 'tuff',
    name: 'Tuff',
    category: 'igneous_volcanic',
    description: 'Consolidated volcanic ash, easy to carve.',
    properties: { hardness: 3, workability: 7, durability: 4, rarity: 0.25 },
    lithologies: ['tuff', 'volcanic_ash', 'ignimbrite', 'welded_tuff'],
    color: '#D4C4A8',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    category: 'igneous_volcanic',
    description: 'Volcanic glass. Creates razor-sharp edges when knapped.',
    properties: { hardness: 6, workability: 7, durability: 4, rarity: 0.1 },
    lithologies: ['obsidian', 'volcanic_glass'],
    isToolstone: true,
    color: '#1A1A1A',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // METAMORPHIC STONES - Transformed by heat and pressure
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'marble',
    name: 'Marble',
    category: 'metamorphic',
    description: 'Crystallized limestone. Prized for monuments and decoration.',
    properties: { hardness: 4, workability: 6, durability: 7, rarity: 0.15 },
    lithologies: ['marble'],
    color: '#FAFAFA',
  },
  {
    id: 'slate',
    name: 'Slate',
    category: 'metamorphic',
    description: 'Dense layered stone, excellent for roofing and flooring.',
    properties: { hardness: 5, workability: 5, durability: 7, rarity: 0.3 },
    lithologies: ['slate'],
    color: '#4A4A4A',
  },
  {
    id: 'phyllite',
    name: 'Phyllite',
    category: 'metamorphic',
    description: 'Intermediate between slate and schist, with silky sheen.',
    properties: { hardness: 4, workability: 5, durability: 5, rarity: 0.25 },
    lithologies: ['phyllite'],
    color: '#5C6B6B',
  },
  {
    id: 'schist',
    name: 'Schist',
    category: 'metamorphic',
    description: 'Layered metamorphic rock with visible mineral grains.',
    properties: { hardness: 5, workability: 4, durability: 6, rarity: 0.25 },
    lithologies: ['schist', 'mica_schist'],
    color: '#708090',
  },
  {
    id: 'gneiss',
    name: 'Gneiss',
    category: 'metamorphic',
    description: 'Banded metamorphic rock, similar to granite in strength.',
    properties: { hardness: 7, workability: 3, durability: 8, rarity: 0.2 },
    lithologies: ['gneiss', 'orthogneiss', 'paragneiss'],
    color: '#A9A9A9',
  },
  {
    id: 'quartzite',
    name: 'Quartzite',
    category: 'metamorphic',
    description: 'Extremely hard metamorphic rock, harder than granite.',
    properties: { hardness: 9, workability: 1, durability: 10, rarity: 0.15 },
    lithologies: ['quartzite'],
    isToolstone: true,
    color: '#F0E68C',
  },
  {
    id: 'amphibolite',
    name: 'Amphibolite',
    category: 'metamorphic',
    description: 'Dark metamorphic rock rich in amphibole minerals.',
    properties: { hardness: 6, workability: 3, durability: 7, rarity: 0.15 },
    lithologies: ['amphibolite'],
    color: '#2D3D2D',
  },
  {
    id: 'greenstone',
    name: 'Greenstone',
    category: 'metamorphic',
    description: 'Altered mafic volcanic rock, prized for polished axes worldwide.',
    properties: { hardness: 6, workability: 5, durability: 7, rarity: 0.15 },
    lithologies: ['greenstone', 'greenschist'],
    isToolstone: true,
    color: '#4A6741',
  },
  {
    id: 'soapstone',
    name: 'Soapstone',
    category: 'metamorphic',
    description: 'Soft talc-rich stone, easily carved for bowls, lamps, and molds.',
    properties: { hardness: 2, workability: 9, durability: 4, rarity: 0.12 },
    lithologies: ['soapstone', 'steatite', 'talc_schist'],
    color: '#8B9A8B',
  },
  {
    id: 'serpentinite',
    name: 'Serpentinite',
    category: 'metamorphic',
    description: 'Green metamorphic rock from altered ultramafic, decorative and for tools.',
    properties: { hardness: 4, workability: 6, durability: 5, rarity: 0.1 },
    lithologies: ['serpentinite', 'serpentine'],
    color: '#3D5C3D',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ORES - Mineral deposits for metal extraction
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'malachite',
    name: 'Malachite',
    category: 'ore',
    description: 'Green copper ore. The first metal humanity learned to smelt.',
    properties: { hardness: 4, workability: 5, durability: 4, rarity: 0.08 },
    lithologies: ['copper_ore', 'mineralized'],
    color: '#0BDA51',
  },
  {
    id: 'hematite',
    name: 'Hematite',
    category: 'ore',
    description: 'Iron ore. Abundant but requires high-temperature smelting.',
    properties: { hardness: 6, workability: 3, durability: 6, rarity: 0.12 },
    lithologies: ['iron_formation', 'ironstone'],
    color: '#5C3317',
  },
  {
    id: 'magnetite',
    name: 'Magnetite',
    category: 'ore',
    description: 'Magnetic iron ore, higher iron content than hematite.',
    properties: { hardness: 6, workability: 3, durability: 6, rarity: 0.08 },
    lithologies: ['iron_formation', 'ironstone'],
    color: '#1C1C1C',
  },
];

// Lookup tables
export const STONES_BY_ID = Object.fromEntries(STONES.map((s) => [s.id, s])) as Record<
  string,
  StoneType
>;

// Helper functions
export function getStonesByCategory(category: string): StoneType[] {
  return STONES.filter((s) => s.category === category);
}

export function getToolstones(): StoneType[] {
  return STONES.filter((s) => s.isToolstone === true);
}

export function getStonesByLithology(lithology: string): StoneType[] {
  return STONES.filter((s) => s.lithologies.includes(lithology));
}
