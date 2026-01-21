// Collection Utility Functions

/**
 * Create a lookup map from an array of items with an `id` property.
 * Useful for O(1) lookups by ID.
 */
export function createByIdMap<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}
