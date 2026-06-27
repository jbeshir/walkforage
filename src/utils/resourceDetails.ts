import { MaterialType } from '../config/materials';
import { WOODS_BY_ID } from '../data/woods';
import { FOODS_BY_ID } from '../data/foods';

/** Latin/botanical name for wood & food resources; undefined for types without one. */
export function getScientificName(type: MaterialType, resourceId: string): string | undefined {
  if (type === 'wood') return WOODS_BY_ID[resourceId]?.scientificName;
  if (type === 'food') return FOODS_BY_ID[resourceId]?.scientificName;
  return undefined;
}
