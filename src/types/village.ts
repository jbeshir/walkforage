// Village Building Types for WalkForage

import { ResourceRequirement } from './tech';

export type BuildingCategory = 'shelter' | 'workshop' | 'storage' | 'production' | 'infrastructure';

export interface BuildingLevel {
  level: number;
  productionRate: number; // Base units per hour
  storageCapacity: number; // If applicable
  workerSlots: number;
  upgradeCost: ResourceRequirement[];
}

export interface Building {
  id: string;
  name: string;
  category: BuildingCategory;
  description: string;

  // Requirements
  requiredTech: string;
  buildCost: ResourceRequirement[];

  // Production
  produces?: string; // Resource ID
  consumes?: ResourceRequirement[];

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
  lastCollected: number; // Timestamp
  accumulatedProduction: number;
}

export interface Village {
  name: string;
  buildings: PlacedBuilding[];
  totalWorkers: number;
  availableWorkers: number;
  gridSize: { width: number; height: number };
}

// Idle production calculation
export interface ProductionSnapshot {
  buildingId: string;
  resourceId: string;
  amountProduced: number;
  timeElapsed: number; // seconds
}

export function calculateOfflineProduction(
  building: PlacedBuilding,
  buildingDef: Building,
  toolMultiplier: number,
  maxOfflineHours: number = 24
): ProductionSnapshot | null {
  if (!buildingDef.produces) return null;

  const now = Date.now();
  const elapsed = Math.min((now - building.lastCollected) / 1000, maxOfflineHours * 3600);

  const levelDef = buildingDef.levels[building.level - 1];
  const baseRate = levelDef.productionRate / 3600; // per second
  const workerBonus = building.assignedWorkers / levelDef.workerSlots;
  const effectiveRate = baseRate * toolMultiplier * workerBonus;

  return {
    buildingId: building.id,
    resourceId: buildingDef.produces,
    amountProduced: Math.floor(elapsed * effectiveRate),
    timeElapsed: elapsed,
  };
}
