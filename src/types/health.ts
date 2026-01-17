// Health and step gathering types for WalkForage
// Used for HealthConnect (Android) and HealthKit (iOS) integration

/**
 * Permission status for health data access
 */
export type HealthPermissionStatus = 'not_determined' | 'denied' | 'authorized' | 'unavailable';

/**
 * Current step gathering state
 */
export interface StepGatheringState {
  /** Steps available for gathering (synced from health service) */
  availableSteps: number;
  /** Timestamp of last step sync from health service */
  lastSyncTimestamp: number;
  /** Timestamp of last gather action */
  lastGatherTimestamp: number;
  /** Total steps ever used for gathering */
  totalStepsGathered: number;
  /** Current health permission status */
  permissionStatus: HealthPermissionStatus;
}

/**
 * Result from syncing steps from health service
 */
export interface StepSyncResult {
  /** Number of new steps synced */
  newSteps: number;
  /** Total available steps after sync */
  totalAvailable: number;
  /** Whether sync was successful */
  success: boolean;
  /** Error message if sync failed */
  error?: string;
}

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
