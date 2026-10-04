// HealthService - Cross-platform wrapper for step counting
// Uses HealthConnect on Android and HealthKit on iOS

import { Platform, Linking } from 'react-native';
import { getInstallationTimeAsync } from 'expo-application';
import {
  HealthPermissionStatus,
  SourceSteps,
  SourceStepsResult,
  StepReadResult,
} from '../types/health';
import { HISTORY_WINDOW_DAYS } from '../config/stepSync';
import { DAY_MS } from '../utils/time';

// Conditional imports - these will be resolved at build time
let HealthConnect: typeof import('react-native-health-connect') | null = null;
let HealthKit: typeof import('@kingstinct/react-native-healthkit') | null = null;

// Health Connect SDK status codes
const SDK_STATUS = {
  SDK_UNAVAILABLE: 1,
  SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
  SDK_AVAILABLE: 3,
} as const;

// Lazy load platform-specific health modules
async function loadHealthModule(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      HealthConnect = await import('react-native-health-connect');
    } else if (Platform.OS === 'ios') {
      HealthKit = await import('@kingstinct/react-native-healthkit');
    }
  } catch (error) {
    console.warn('Failed to load health module:', error);
  }
}

/**
 * Map a rejected read to a code. RNHC rejects with the `code` from its ExceptionsUtils mapping:
 * a rate limit and "Health Connect is updating" both arrive as SERVICE_UNAVAILABLE (only the
 * message tells them apart), and a RemoteException arrives as UNDERLYING_ERROR.
 */
function toStepReadError(error: unknown): StepReadResult & { ok: false } {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  if (/rate limit|quota/i.test(message)) {
    return { ok: false, code: 'rate_limited', message };
  }
  if (code === 'PERMISSION_ERROR' || /SecurityException|permission/i.test(message)) {
    return { ok: false, code: 'permission', message };
  }
  if (code === 'SERVICE_UNAVAILABLE' || /RemoteException|updating/i.test(message)) {
    return { ok: false, code: 'unavailable', message };
  }
  if (code === 'CLIENT_NOT_INITIALIZED') {
    return { ok: false, code: 'not_initialized', message };
  }
  return { ok: false, code: 'unknown', message };
}

export class HealthService {
  // What the last refreshStatus() found. Nothing here outlives the next refresh: Health Connect can
  // be installed, updated or have its grant revoked while the app runs.
  private initialized = false;
  private permissionStatus: HealthPermissionStatus = 'not_determined';
  /** Null until the SDK answers (or on iOS). */
  private sdkStatus: number | null = null;

  /**
   * Re-check SDK availability, initialize the client and re-read the step grant. Every sync
   * trigger calls this first, so the status and needs-install state are never stale.
   */
  async refreshStatus(): Promise<HealthPermissionStatus> {
    this.initialized = await this.initialize();
    this.permissionStatus = this.initialized ? await this.readGrant() : 'unavailable';
    return this.permissionStatus;
  }

  private async initialize(): Promise<boolean> {
    await loadHealthModule();

    try {
      if (Platform.OS === 'android' && HealthConnect) {
        this.sdkStatus = null;
        this.sdkStatus = await HealthConnect.getSdkStatus();
        // Unavailable, or Health Connect needs to be installed/updated
        if (this.sdkStatus !== SDK_STATUS.SDK_AVAILABLE) return false;
        return await HealthConnect.initialize();
      } else if (Platform.OS === 'ios' && HealthKit) {
        return await HealthKit.isHealthDataAvailable();
      }
      // Web or unsupported platform
      return false;
    } catch (error) {
      console.error('Health service initialization failed:', error);
      return false;
    }
  }

  /** The step grant on an initialized client. */
  private async readGrant(): Promise<HealthPermissionStatus> {
    // Keeps what the user last told us when the platform can't say (HealthKit hides read grants).
    const known =
      this.permissionStatus === 'unavailable' ? 'not_determined' : this.permissionStatus;
    if (Platform.OS !== 'android' || !HealthConnect) return known;
    try {
      const granted = await HealthConnect.getGrantedPermissions();
      if (granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read')) {
        return 'authorized';
      }
      // A denial stays a denial (the UI then offers settings); a revoked grant can be asked again.
      return known === 'denied' ? 'denied' : 'not_determined';
    } catch (error) {
      console.warn('Check permission failed:', error);
      return known;
    }
  }

  /**
   * Request permission to read step data
   */
  async requestPermission(): Promise<HealthPermissionStatus> {
    const current = await this.refreshStatus();
    if (current === 'unavailable') {
      console.warn('Health service not initialized, cannot request permission');
      return current;
    }
    if (current === 'authorized') return current;

    try {
      if (Platform.OS === 'android' && HealthConnect) {
        // Request the permission - this opens the Health Connect UI
        if (__DEV__) {
          console.log('Requesting Health Connect permission...');
        }
        const permissions = await HealthConnect.requestPermission([
          { accessType: 'read', recordType: 'Steps' },
        ]);
        if (__DEV__) {
          console.log('Permission response:', JSON.stringify(permissions));
        }

        // Check if steps permission was granted
        const hasStepsPermission = permissions.some(
          (p) => p.recordType === 'Steps' && p.accessType === 'read'
        );

        this.permissionStatus = hasStepsPermission ? 'authorized' : 'denied';
        return this.permissionStatus;
      } else if (Platform.OS === 'ios' && HealthKit) {
        // Request authorization for step count
        await HealthKit.requestAuthorization({
          toRead: ['HKQuantityTypeIdentifierStepCount'],
        });

        // iOS doesn't tell us if permission was granted, assume authorized
        // The actual permission will be revealed when we try to read data
        this.permissionStatus = 'authorized';
        return this.permissionStatus;
      }

      return 'unavailable';
    } catch (error) {
      console.error('Permission request failed:', error);
      // Don't immediately set to denied - might be a transient error
      // Keep as not_determined so user can try again
      return this.permissionStatus;
    }
  }

  /**
   * Read the step total for [startMs, endMs). Errors are returned as codes, never as 0 steps.
   * Reads use the client the last refreshStatus() initialized.
   */
  async readSteps(startMs: number, endMs: number): Promise<StepReadResult> {
    if (!this.initialized) {
      return { ok: false, code: 'not_initialized', message: 'Health service is not available' };
    }

    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    try {
      if (Platform.OS === 'android' && HealthConnect) {
        // The aggregate de-duplicates sources by the user's Health Connect priority and pro-rates
        // records that straddle the window. No origin filter, so on-device steps count too.
        const result = await HealthConnect.aggregateRecord({
          recordType: 'Steps',
          timeRangeFilter: {
            operator: 'between',
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          },
        });
        // Defensive: a NaN total from the bridge counts as 0
        return { ok: true, steps: Math.floor(Number(result.COUNT_TOTAL) || 0) };
      } else if (Platform.OS === 'ios' && HealthKit) {
        // Query step samples from HealthKit
        const samples = await HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
          limit: 0, // 0 or negative means no limit
          filter: {
            date: {
              startDate,
              endDate,
              // Only samples starting in the window: one crossing midnight counts in one day's
              // bucket, not in both.
              strictStartDate: true,
            },
          },
          unit: 'count',
        });

        // Sum up all step samples (defensive: malformed/NaN payload -> 0)
        const totalSteps = (samples ?? []).reduce(
          (sum, sample) => sum + (Number(sample?.quantity) || 0),
          0
        );
        return { ok: true, steps: Math.floor(totalSteps) };
      }

      return { ok: false, code: 'unavailable', message: 'Step data is not available here' };
    } catch (error) {
      console.error('Failed to read steps:', error);
      return toStepReadError(error);
    }
  }

  /**
   * Raw step records starting in [startMs, endMs), summed per data origin, most steps first. For
   * diagnostics only: origins overlap (a watch and the phone count the same walk), so the sum of
   * all origins is more than the steps a sync credits. Android only.
   */
  async readStepsBySource(startMs: number, endMs: number): Promise<SourceStepsResult> {
    if (Platform.OS !== 'android' || !HealthConnect) {
      return { ok: false, code: 'unavailable', message: 'Steps by source need Health Connect' };
    }
    if (!this.initialized) {
      return { ok: false, code: 'not_initialized', message: 'Health service is not available' };
    }

    const sources = new Map<string, SourceSteps>();
    let pageToken: string | undefined;
    try {
      do {
        const page = await HealthConnect.readRecords('Steps', {
          timeRangeFilter: {
            operator: 'between',
            startTime: new Date(startMs).toISOString(),
            endTime: new Date(endMs).toISOString(),
          },
          pageToken,
        });
        for (const record of page.records) {
          const origin = record.metadata?.dataOrigin ?? 'unknown';
          const source = sources.get(origin) ?? { origin, records: 0, steps: 0 };
          sources.set(origin, {
            origin,
            records: source.records + 1,
            steps: source.steps + (Number(record.count) || 0),
          });
        }
        // The last page's token may be '' rather than absent.
        pageToken = page.pageToken || undefined;
      } while (pageToken);
    } catch (error) {
      return toStepReadError(error);
    }
    return { ok: true, sources: [...sources.values()].sort((a, b) => b.steps - a.steps) };
  }

  /**
   * Health Connect shares only HISTORY_WINDOW_DAYS before the app's first grant, and a reinstalled
   * app needs a new grant. If the app was installed after `lastSyncedAt` (a save restored onto a
   * reinstall or a new phone), returns the time from which Health Connect certainly shares steps;
   * otherwise undefined. The grant time itself is not available, and it may be long after the
   * install (the player reconnects later), but it is no later than `nowMs` since syncing needs
   * the grant. So `nowMs - HISTORY_WINDOW_DAYS` is the latest the hidden history can end: steps
   * before it may be hidden, steps from it onward are not.
   */
  async historyStartAfterReinstall(
    lastSyncedAt: number,
    nowMs: number
  ): Promise<number | undefined> {
    if (Platform.OS !== 'android') return undefined;
    try {
      const installedAt = (await getInstallationTimeAsync()).getTime();
      return installedAt > lastSyncedAt ? nowMs - HISTORY_WINDOW_DAYS * DAY_MS : undefined;
    } catch (error) {
      console.warn('Could not read the app install time:', error);
      return undefined;
    }
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): HealthPermissionStatus {
    return this.permissionStatus;
  }

  /**
   * Check if service is available on this platform
   */
  isAvailable(): boolean {
    return Platform.OS === 'android' || Platform.OS === 'ios';
  }

  /**
   * Whether the device can't run Health Connect at all (e.g. an Android version that is too old),
   * as opposed to Health Connect being unavailable for now.
   */
  isHealthConnectUnsupported(): boolean {
    return Platform.OS === 'android' && this.sdkStatus === SDK_STATUS.SDK_UNAVAILABLE;
  }

  /**
   * Check if Health Connect needs to be installed or updated
   */
  needsHealthConnectInstall(): boolean {
    return (
      Platform.OS === 'android' &&
      this.sdkStatus === SDK_STATUS.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
    );
  }

  /**
   * Open Health Connect settings (Android) or Health app (iOS)
   */
  async openHealthSettings(): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && HealthConnect) {
        await HealthConnect.openHealthConnectSettings();
        return true;
      } else if (Platform.OS === 'ios') {
        // Open the Health app on iOS
        const url = 'x-apple-health://';
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to open health settings:', error);
      return false;
    }
  }

  /**
   * Open Play Store to install/update Health Connect (Android only)
   */
  async openHealthConnectPlayStore(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      const playStoreUrl = 'market://details?id=com.google.android.apps.healthdata';
      const webUrl =
        'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

      const canOpenMarket = await Linking.canOpenURL(playStoreUrl);
      if (canOpenMarket) {
        await Linking.openURL(playStoreUrl);
        return true;
      }

      // Fallback to web URL
      await Linking.openURL(webUrl);
      return true;
    } catch (error) {
      console.error('Failed to open Play Store:', error);
      return false;
    }
  }
}

// Export singleton instance
export const healthService = new HealthService();
export default healthService;
