// HealthService - Cross-platform wrapper for step counting
// Uses HealthConnect on Android and HealthKit on iOS

import { Platform, Linking } from 'react-native';
import { HealthPermissionStatus } from '../types/health';

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

class HealthService {
  private initialized = false;
  private permissionStatus: HealthPermissionStatus = 'not_determined';
  private sdkStatus: number = SDK_STATUS.SDK_UNAVAILABLE;

  /**
   * Initialize the health service
   * Must be called before other methods
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    await loadHealthModule();

    try {
      if (Platform.OS === 'android' && HealthConnect) {
        // Check SDK status first
        const status = await HealthConnect.getSdkStatus();
        this.sdkStatus = status;

        if (status === SDK_STATUS.SDK_UNAVAILABLE) {
          this.permissionStatus = 'unavailable';
          return false;
        }

        if (status === SDK_STATUS.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
          // Health Connect needs to be installed/updated
          this.permissionStatus = 'unavailable';
          return false;
        }

        // SDK is available, initialize
        const isAvailable = await HealthConnect.initialize();
        if (!isAvailable) {
          this.permissionStatus = 'unavailable';
          return false;
        }
        this.initialized = true;
        return true;
      } else if (Platform.OS === 'ios' && HealthKit) {
        // Check if HealthKit is available
        const isAvailable = await HealthKit.isHealthDataAvailable();
        if (!isAvailable) {
          this.permissionStatus = 'unavailable';
          return false;
        }
        this.initialized = true;
        return true;
      } else {
        // Web or unsupported platform
        this.permissionStatus = 'unavailable';
        return false;
      }
    } catch (error) {
      console.error('Health service initialization failed:', error);
      this.permissionStatus = 'unavailable';
      return false;
    }
  }

  /**
   * Check if we already have permission (without requesting)
   */
  async checkPermission(): Promise<HealthPermissionStatus> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return this.permissionStatus;
    }

    try {
      if (Platform.OS === 'android' && HealthConnect) {
        // Check existing permissions without requesting
        const granted = await HealthConnect.getGrantedPermissions();
        const hasStepsPermission = granted.some(
          (p) => p.recordType === 'Steps' && p.accessType === 'read'
        );

        this.permissionStatus = hasStepsPermission ? 'authorized' : 'not_determined';
        return this.permissionStatus;
      }
    } catch (error) {
      console.warn('Check permission failed:', error);
    }

    return this.permissionStatus;
  }

  /**
   * Request permission to read step data
   */
  async requestPermission(): Promise<HealthPermissionStatus> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        console.warn('Health service not initialized, cannot request permission');
        return this.permissionStatus;
      }
    }

    try {
      if (Platform.OS === 'android' && HealthConnect) {
        // First check if we already have permission
        const granted = await HealthConnect.getGrantedPermissions();
        const alreadyHasPermission = granted.some(
          (p) => p.recordType === 'Steps' && p.accessType === 'read'
        );

        if (alreadyHasPermission) {
          this.permissionStatus = 'authorized';
          return 'authorized';
        }

        // Request the permission - this opens the Health Connect UI
        console.log('Requesting Health Connect permission...');
        const permissions = await HealthConnect.requestPermission([
          { accessType: 'read', recordType: 'Steps' },
        ]);
        console.log('Permission response:', JSON.stringify(permissions));

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
   * Get step count since a given timestamp
   * @param sinceTimestamp - Start time for step count (ms since epoch)
   * @returns Number of steps since the given time
   */
  async getStepsSince(sinceTimestamp: number): Promise<number> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) return 0;
    }

    const startDate = new Date(sinceTimestamp);
    const endDate = new Date();

    try {
      if (Platform.OS === 'android' && HealthConnect) {
        const result = await HealthConnect.readRecords('Steps', {
          timeRangeFilter: {
            operator: 'between',
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          },
        });

        // Sum up all step records
        const totalSteps = result.records.reduce((sum, record) => sum + record.count, 0);
        return totalSteps;
      } else if (Platform.OS === 'ios' && HealthKit) {
        // Query step samples from HealthKit
        const samples = await HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
          limit: 0, // 0 or negative means no limit
          filter: {
            date: {
              startDate,
              endDate,
            },
          },
          unit: 'count',
        });

        // Sum up all step samples
        const totalSteps = samples.reduce((sum, sample) => sum + sample.quantity, 0);
        return Math.floor(totalSteps);
      }

      return 0;
    } catch (error) {
      console.error('Failed to read steps:', error);
      return 0;
    }
  }

  /**
   * Get today's step count
   */
  async getTodaySteps(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.getStepsSince(startOfDay.getTime());
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
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
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

  /**
   * Get detailed status for UI display
   */
  getDetailedStatus(): {
    available: boolean;
    needsInstall: boolean;
    hasPermission: boolean;
  } {
    return {
      available: this.initialized || this.sdkStatus === SDK_STATUS.SDK_AVAILABLE,
      needsInstall: this.needsHealthConnectInstall(),
      hasPermission: this.permissionStatus === 'authorized',
    };
  }
}

// Export singleton instance
export const healthService = new HealthService();
export default healthService;
