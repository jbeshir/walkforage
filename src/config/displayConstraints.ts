/**
 * Display constraints for text validation.
 * Update these values when UI layout changes.
 *
 * Characters per line estimates assume:
 * - Average character width ~0.5-0.6 em for proportional fonts
 * - Container width ~280px on a typical phone (360px - margins/padding)
 */

export interface TextConstraint {
  fontSize: number; // Font size in pixels
  maxLines: number; // Number of lines allowed (numberOfLines prop)
  containerWidth: number; // Approximate container width in pixels
  charsPerLine: number; // Estimated characters per line at this font size
}

// Character estimates: at 12px font, ~280px fits ~40 chars; at 16px, ~25 chars
export const DISPLAY_CONSTRAINTS = {
  // Tools and components (CraftingScreen recipe view)
  toolDescription: {
    fontSize: 12,
    maxLines: 2,
    containerWidth: 280,
    charsPerLine: 40, // ~80 chars total for 2 lines
  } as TextConstraint,

  toolName: {
    fontSize: 16,
    maxLines: 1,
    containerWidth: 200, // Less space due to badges
    charsPerLine: 25,
  } as TextConstraint,

  componentDescription: {
    fontSize: 12,
    maxLines: 2,
    containerWidth: 280,
    charsPerLine: 40,
  } as TextConstraint,

  componentName: {
    fontSize: 14,
    maxLines: 1,
    containerWidth: 200,
    charsPerLine: 28,
  } as TextConstraint,

  // Resources (InventoryScreen)
  resourceDescription: {
    fontSize: 12,
    maxLines: 2,
    containerWidth: 280,
    charsPerLine: 40, // ~80 chars total for 2 lines
  } as TextConstraint,

  resourceName: {
    fontSize: 16,
    maxLines: 1,
    containerWidth: 200,
    charsPerLine: 25,
  } as TextConstraint,
} as const;

/**
 * Calculate max characters allowed for a text constraint
 */
export function getMaxChars(constraint: TextConstraint): number {
  return constraint.charsPerLine * constraint.maxLines;
}
