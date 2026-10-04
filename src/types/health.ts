// Health and step gathering types for WalkForage
// Used for HealthConnect (Android) and HealthKit (iOS) integration

/**
 * Permission status for health data access
 */
export type HealthPermissionStatus = 'not_determined' | 'denied' | 'authorized' | 'unavailable';

/**
 * Why a step read failed. `unavailable` covers Health Connect updating or its service dying.
 */
export type StepReadErrorCode =
  | 'permission'
  | 'unavailable'
  | 'rate_limited'
  | 'not_initialized'
  | 'unknown';

/**
 * Step total for a time window. A failed read is never reported as 0 steps.
 */
export type StepReadResult =
  | { ok: true; steps: number }
  | { ok: false; code: StepReadErrorCode; message: string };

/**
 * Result of a step sync. On error nothing was credited and the sync position did not move.
 */
export type StepSyncResult =
  | { status: 'synced'; credited: number }
  | {
      status: 'error';
      code: StepReadErrorCode | 'not_authorized' | 'not_loaded';
      message: string;
    };

/**
 * Result from a gather action
 */
export interface GatherResult {
  /** Whether gather was successful */
  success: boolean;
  /** Resource ID that was gathered */
  resourceId?: string;
  /** Quantity gathered */
  quantity?: number;
  /** Steps spent on this gather */
  stepsSpent?: number;
  /** Error message if gather failed */
  error?: string;
}
