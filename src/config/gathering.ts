// Configuration constants for step-based resource gathering
// These values control how steps are converted to resources

/**
 * Steps required per gather action (stone or wood)
 * 1000 steps (~0.7-0.8 km) = 1 gather
 */
export const STEPS_PER_GATHER = 1000;

/**
 * Calculate how many gathers are available with current steps
 */
export function calculateGatherableAmount(availableSteps: number): number {
  return Math.floor(availableSteps / STEPS_PER_GATHER);
}

/**
 * Calculate steps required for a given number of gathers
 */
export function calculateStepsRequired(gatherCount: number): number {
  return gatherCount * STEPS_PER_GATHER;
}
