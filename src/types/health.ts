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
 * One local calendar day, or the part of one that a ledger started in. The bounds are fixed when
 * the bucket is created; `credited` is the highest Health Connect total ever credited for it.
 */
export interface StepBucket {
  startMs: number;
  endMs: number;
  credited: number;
}

/** What has been credited from the health platform. Buckets are contiguous, ascending, non-empty. */
export interface StepLedger {
  buckets: StepBucket[];
  lastSyncedAt: number;
}

/**
 * Steps credited by one sync for the bucket starting at `startMs`. `late`: the bucket had ended
 * before the previous sync, which read all of it, so these steps reached the health platform
 * after that sync (a watch or fitness app syncing late).
 */
export interface DayCredit {
  startMs: number;
  steps: number;
  late: boolean;
}

/**
 * How much a sync re-reads. `full` reconciles the last RECONCILE_DAYS; `recent` (the foreground
 * interval) only the last RECENT_RECONCILE_DAYS, unless time before that was never read.
 */
export type StepSyncMode = 'full' | 'recent';

/**
 * Result of a step sync. On error nothing was credited and the ledger did not change.
 * `welcome`: the first sync of a new game, which also credited the last week.
 * `historyLimitedBefore`: after a reinstall, steps before this time could not be read.
 */
export type StepSyncResult =
  | {
      status: 'synced';
      credited: number;
      perDay: DayCredit[];
      welcome: boolean;
      historyLimitedBefore?: number;
      syncedAt: number;
    }
  | {
      status: 'error';
      code: StepReadErrorCode | 'not_authorized' | 'not_loaded';
      message: string;
    };

/** Raw step records from one data origin (app), not de-duplicated against other origins. */
export interface SourceSteps {
  origin: string;
  records: number;
  steps: number;
}

/** Raw steps per data origin for a time window, for diagnostics. */
export type SourceStepsResult =
  | { ok: true; sources: SourceSteps[] }
  | { ok: false; code: StepReadErrorCode; message: string };

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
