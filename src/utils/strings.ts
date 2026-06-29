// String Utility Functions

/**
 * Capitalize the first letter of a string.
 */
export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a snake_case string for display.
 * Converts "hello_world" to "Hello World".
 */
export function formatSnakeCase(str: string): string {
  return str.split('_').map(capitalizeFirst).join(' ');
}

/**
 * Convert a snake_case identifier to a space-separated string for display,
 * preserving the original letter case. Converts "stone_axe" to "stone axe".
 */
export function humanizeId(str: string): string {
  return str.replace(/_/g, ' ');
}
