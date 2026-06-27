// Tests for HealthService
// Tests platform detection, permission flows, and step data retrieval

import { Platform } from 'react-native';

// Mock the health modules before importing HealthService
const mockGetSdkStatus = jest.fn();
const mockInitialize = jest.fn();
const mockGetGrantedPermissions = jest.fn();
const mockRequestPermission = jest.fn();
const mockReadRecords = jest.fn();
const mockOpenHealthConnectSettings = jest.fn();

const mockIsHealthDataAvailable = jest.fn();
const mockRequestAuthorization = jest.fn();
const mockQueryQuantitySamples = jest.fn();

jest.mock('react-native-health-connect', () => ({
  getSdkStatus: () => mockGetSdkStatus(),
  initialize: () => mockInitialize(),
  getGrantedPermissions: () => mockGetGrantedPermissions(),
  requestPermission: (perms: unknown) => mockRequestPermission(perms),
  readRecords: (type: string, opts: unknown) => mockReadRecords(type, opts),
  openHealthConnectSettings: () => mockOpenHealthConnectSettings(),
}));

jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: () => mockIsHealthDataAvailable(),
  requestAuthorization: (opts: unknown) => mockRequestAuthorization(opts),
  queryQuantitySamples: (type: string, opts: unknown) => mockQueryQuantitySamples(type, opts),
}));

// Import after mocks are set up
import { HealthService, healthService } from '../src/services/HealthService';

describe('HealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Platform Detection', () => {
    it('should report available on Android', () => {
      Platform.OS = 'android';
      expect(healthService.isAvailable()).toBe(true);
    });

    it('should report available on iOS', () => {
      Platform.OS = 'ios';
      expect(healthService.isAvailable()).toBe(true);
    });

    it('should report unavailable on web', () => {
      Platform.OS = 'web';
      expect(healthService.isAvailable()).toBe(false);
    });
  });

  describe('Android Health Connect', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    describe('initialize', () => {
      it('should handle SDK unavailable status', async () => {
        mockGetSdkStatus.mockResolvedValue(1); // SDK_UNAVAILABLE

        const svc = new HealthService();
        const result = await svc.initialize();

        expect(result).toBe(false);
        expect(svc.getPermissionStatus()).toBe('unavailable');
      });

      it('should return true when already initialized', async () => {
        mockGetSdkStatus.mockResolvedValue(3); // SDK_AVAILABLE
        mockInitialize.mockResolvedValue(true);

        const svc = new HealthService();
        const firstResult = await svc.initialize();
        const secondResult = await svc.initialize();

        expect(firstResult).toBe(true);
        expect(secondResult).toBe(true);
      });
    });

    describe('checkPermission', () => {
      beforeEach(() => {
        mockGetSdkStatus.mockResolvedValue(3);
        mockInitialize.mockResolvedValue(true);
      });

      it('should return status when permission exists', async () => {
        mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);

        const svc = new HealthService();
        const result = await svc.checkPermission();

        expect(result).toBe('authorized');
      });

      it('should handle empty permissions', async () => {
        mockGetGrantedPermissions.mockResolvedValue([]);

        const svc = new HealthService();
        const result = await svc.checkPermission();

        expect(result).toBe('not_determined');
      });
    });

    describe('requestPermission', () => {
      beforeEach(() => {
        mockGetSdkStatus.mockResolvedValue(3);
        mockInitialize.mockResolvedValue(true);
      });

      it('should request permission and return status', async () => {
        mockGetGrantedPermissions.mockResolvedValue([]);
        mockRequestPermission.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);

        const svc = new HealthService();
        const result = await svc.requestPermission();

        expect(result).toBe('authorized');
      });

      it('should return authorized if already has permission', async () => {
        mockGetGrantedPermissions.mockResolvedValue([{ recordType: 'Steps', accessType: 'read' }]);

        const svc = new HealthService();
        const result = await svc.requestPermission();

        expect(result).toBe('authorized');
        expect(mockGetGrantedPermissions).toHaveBeenCalled();
      });

      it('should handle permission denial', async () => {
        mockGetGrantedPermissions.mockResolvedValue([]);
        mockRequestPermission.mockResolvedValue([]);

        const svc = new HealthService();
        const result = await svc.requestPermission();

        expect(result).toBe('denied');
      });
    });

    describe('getStepsSince', () => {
      beforeEach(() => {
        mockGetSdkStatus.mockResolvedValue(3);
        mockInitialize.mockResolvedValue(true);
      });

      it('should return sum of step records', async () => {
        mockReadRecords.mockResolvedValue({
          records: [{ count: 100 }, { count: 200 }, { count: 50 }],
        });

        const svc = new HealthService();
        await svc.initialize();
        const sinceTimestamp = Date.now() - 3600000;

        expect(await svc.getStepsSince(sinceTimestamp)).toBe(350);
      });

      it('should coerce NaN step counts to 0', async () => {
        mockReadRecords.mockResolvedValue({
          records: [{ count: 100 }, { count: NaN }, { count: 50 }],
        });

        const svc = new HealthService();
        await svc.initialize();

        expect(await svc.getStepsSince(Date.now() - 3600000)).toBe(150);
      });

      it('should return 0 for malformed read payloads', async () => {
        mockReadRecords.mockResolvedValue({});

        const svc = new HealthService();
        await svc.initialize();

        expect(await svc.getStepsSince(Date.now() - 3600000)).toBe(0);
      });

      it('should return 0 when no records', async () => {
        mockReadRecords.mockResolvedValue({ records: [] });

        const svc = new HealthService();
        await svc.initialize();

        expect(await svc.getStepsSince(Date.now() - 3600000)).toBe(0);
      });

      it('should return 0 on error', async () => {
        mockReadRecords.mockRejectedValue(new Error('Read failed'));

        const svc = new HealthService();
        await svc.initialize();

        expect(await svc.getStepsSince(Date.now() - 3600000)).toBe(0);
      });
    });

    describe('getTodaySteps', () => {
      beforeEach(() => {
        mockGetSdkStatus.mockResolvedValue(3);
        mockInitialize.mockResolvedValue(true);
      });

      it('should return a number', async () => {
        mockReadRecords.mockResolvedValue({ records: [{ count: 5000 }] });

        const svc = new HealthService();
        await svc.initialize();
        const result = await svc.getTodaySteps();

        expect(result).toBe(5000);
      });
    });

    describe('getDetailedStatus', () => {
      it('should return status object', () => {
        const status = healthService.getDetailedStatus();

        expect(status).toHaveProperty('available');
        expect(status).toHaveProperty('needsInstall');
        expect(status).toHaveProperty('hasPermission');
        expect(typeof status.available).toBe('boolean');
        expect(typeof status.needsInstall).toBe('boolean');
        expect(typeof status.hasPermission).toBe('boolean');
      });
    });

    describe('openHealthSettings', () => {
      it('should call platform settings opener', async () => {
        mockOpenHealthConnectSettings.mockResolvedValue(undefined);

        mockGetSdkStatus.mockResolvedValue(3);
        mockInitialize.mockResolvedValue(true);
        const svc = new HealthService();
        await svc.initialize();
        const result = await svc.openHealthSettings();

        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockOpenHealthConnectSettings.mockRejectedValue(new Error('Failed'));

        mockGetSdkStatus.mockResolvedValue(3);
        mockInitialize.mockResolvedValue(true);
        const svc = new HealthService();
        await svc.initialize();
        const result = await svc.openHealthSettings();

        expect(result).toBe(false);
      });
    });
  });

  describe('iOS HealthKit', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    describe('initialize', () => {
      it('should check HealthKit availability', async () => {
        mockIsHealthDataAvailable.mockResolvedValue(true);

        const svc = new HealthService();
        const result = await svc.initialize();

        expect(result).toBe(true);
        expect(svc.isAvailable()).toBe(true);
      });
    });

    describe('requestPermission', () => {
      beforeEach(() => {
        mockIsHealthDataAvailable.mockResolvedValue(true);
      });

      it('should request authorization', async () => {
        mockRequestAuthorization.mockResolvedValue(undefined);

        const svc = new HealthService();
        const result = await svc.requestPermission();

        expect(result).toBe('authorized');
      });
    });

    describe('getStepsSince', () => {
      beforeEach(() => {
        mockIsHealthDataAvailable.mockResolvedValue(true);
      });

      it('should floor fractional sample sums', async () => {
        mockQueryQuantitySamples.mockResolvedValue([
          { quantity: 150.5 },
          { quantity: 200.3 },
          { quantity: 100.4 },
        ]);

        const svc = new HealthService();
        await svc.initialize();

        expect(await svc.getStepsSince(Date.now() - 3600000)).toBe(451);
      });

      it('should coerce NaN sample quantities to 0', async () => {
        mockQueryQuantitySamples.mockResolvedValue([{ quantity: 150.5 }, { quantity: NaN }]);

        const svc = new HealthService();
        await svc.initialize();

        expect(await svc.getStepsSince(Date.now() - 3600000)).toBe(150);
      });

      it('should return 0 on error', async () => {
        mockQueryQuantitySamples.mockRejectedValue(new Error('Query failed'));

        const svc = new HealthService();
        await svc.initialize();

        expect(await svc.getStepsSince(Date.now() - 3600000)).toBe(0);
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('should handle initialization errors gracefully', async () => {
      mockGetSdkStatus.mockRejectedValue(new Error('SDK check failed'));

      const svc = new HealthService();
      const result = await svc.initialize();

      expect(result).toBe(false);
    });

    it('should handle permission check errors gracefully', async () => {
      mockGetSdkStatus.mockResolvedValue(3);
      mockInitialize.mockResolvedValue(true);
      mockGetGrantedPermissions.mockRejectedValue(new Error('Check failed'));

      const svc = new HealthService();
      const result = await svc.checkPermission();

      expect(result).toBe('not_determined');
    });

    it('should handle permission request errors gracefully', async () => {
      mockGetSdkStatus.mockResolvedValue(3);
      mockInitialize.mockResolvedValue(true);
      mockGetGrantedPermissions.mockResolvedValue([]);
      mockRequestPermission.mockRejectedValue(new Error('Permission failed'));

      const svc = new HealthService();
      const result = await svc.requestPermission();

      expect(result).toBe('not_determined');
    });
  });

  describe('Service Methods', () => {
    it('should have isInitialized method', () => {
      expect(typeof healthService.isInitialized).toBe('function');
      expect(typeof healthService.isInitialized()).toBe('boolean');
    });

    it('should have needsHealthConnectInstall method', () => {
      expect(typeof healthService.needsHealthConnectInstall).toBe('function');
      expect(typeof healthService.needsHealthConnectInstall()).toBe('boolean');
    });

    it('should have openHealthConnectPlayStore method', async () => {
      expect(typeof healthService.openHealthConnectPlayStore).toBe('function');
      const result = await healthService.openHealthConnectPlayStore();
      expect(typeof result).toBe('boolean');
    });
  });
});
