// Village Building Types for WalkForage

import { BuildingResourceCost } from './tech';

export type BuildingCategory = 'shelter' | 'workshop' | 'storage' | 'production' | 'infrastructure';

export interface BuildingLevel {
  level: number;
  productionRate: number; // Base units per hour
  storageCapacity: number; // If applicable
  workerSlots: number;
  upgradeCost: BuildingResourceCost[];
}

export interface Building {
  id: string;
  name: string;
  category: BuildingCategory;
  description: string;

  // Requirements
  requiredTech: string;
  buildCost: BuildingResourceCost[];

  // Levels
  levels: BuildingLevel[];
  maxLevel: number;

  // Display
  icon: string;
  size: { width: number; height: number };
}

export interface PlacedBuilding {
  id: string;
  buildingId: string;
  level: number;
  position: { x: number; y: number };
  assignedWorkers: number;
}

export interface Village {
  name: string;
  buildings: PlacedBuilding[];
  totalWorkers: number;
  availableWorkers: number;
  gridSize: { width: number; height: number };
}
