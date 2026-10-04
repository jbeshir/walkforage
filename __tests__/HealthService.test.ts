// Tests for HealthService
// Android runs against the fake Health Connect; iOS against a mocked HealthKit module.

import { Platform } from 'react-native';
import { getInstallationTimeAsync } from 'expo-application';
import {
  fakeHC,
  hcErrors,
  walk,
  sumCounts,
  fitbitBatch,
  FITBIT_ORIGIN,
  ON_DEVICE_ORIGIN,
} from './helpers/fakeHealthConnect';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);

const mockIsHealthDataAvailable = jest.fn();
const mockRequestAuthorization = jest.fn();
const mockQueryQuantitySamples = jest.fn();

jest.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: () => mockIsHealthDataAvailable(),
  requestAuthorization: (opts: unknown) => mockRequestAuthorization(opts),
  queryQuantitySamples: (type: string, opts: unknown) => mockQueryQuantitySamples(type, opts),
}));

// Import after mocks are set up
import { HealthService, healthService } from '../src/services/HealthService';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

describe('HealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fakeHC.reset();
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

    describe('refreshStatus', () => {
      it('should report unavailable when the SDK is unavailable', async () => {
        fakeHC.sdkStatus = 1; // SDK_UNAVAILABLE

        const svc = new HealthService();

        expect(await svc.refreshStatus()).toBe('unavailable');
        expect(svc.getPermissionStatus()).toBe('unavailable');
        expect(svc.needsHealthConnectInstall()).toBe(false);
      });

      it('should flag an install when the provider needs an update', async () => {
        fakeHC.sdkStatus = 2; // SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED

        const svc = new HealthService();

        expect(await svc.refreshStatus()).toBe('unavailable');
        expect(svc.needsHealthConnectInstall()).toBe(true);
      });

      it('should report unavailable when the client does not initialize', async () => {
        fakeHC.initializeResult = false;

        expect(await new HealthService().refreshStatus()).toBe('unavailable');
      });

      it('should report authorized when step access is granted', async () => {
        expect(await new HealthService().refreshStatus()).toBe('authorized');
      });

      it('should report not_determined when step access is not granted', async () => {
        fakeHC.granted = false;

        expect(await new HealthService().refreshStatus()).toBe('not_determined');
      });

      it('should re-check the SDK, client and grant on every call', async () => {
        const svc = new HealthService();
        fakeHC.sdkStatus = 2;
        expect(await svc.refreshStatus()).toBe('unavailable');
        expect(svc.needsHealthConnectInstall()).toBe(true);

        // Health Connect installed while the app runs
        fakeHC.sdkStatus = 3;
        expect(await svc.refreshStatus()).toBe('authorized');
        expect(svc.needsHealthConnectInstall()).toBe(false);

        // Step access revoked in Health Connect settings
        fakeHC.granted = false;
        expect(await svc.refreshStatus()).toBe('not_determined');

        expect(fakeHC.callsTo('getSdkStatus')).toHaveLength(3);
        expect(fakeHC.callsTo('initialize')).toHaveLength(2);
        expect(fakeHC.callsTo('getGrantedPermissions')).toHaveLength(2);
      });

      it('should keep a denial until access is granted', async () => {
        fakeHC.granted = false;
        fakeHC.grantOnRequest = false;
        const svc = new HealthService();
        expect(await svc.requestPermission()).toBe('denied');

        expect(await svc.refreshStatus()).toBe('denied');

        fakeHC.granted = true;
        expect(await svc.refreshStatus()).toBe('authorized');
      });
    });

    describe('requestPermission', () => {
      it('should request permission and return status', async () => {
        fakeHC.granted = false;

        const svc = new HealthService();
        const result = await svc.requestPermission();

        expect(result).toBe('authorized');
        expect(fakeHC.callsTo('requestPermission')).toHaveLength(1);
      });

      it('should return authorized if already has permission', async () => {
        const svc = new HealthService();
        const result = await svc.requestPermission();

        expect(result).toBe('authorized');
        expect(fakeHC.callsTo('getGrantedPermissions')).toHaveLength(1);
        expect(fakeHC.callsTo('requestPermission')).toHaveLength(0);
      });

      it('should handle permission denial', async () => {
        fakeHC.granted = false;
        fakeHC.grantOnRequest = false;

        const svc = new HealthService();
        const result = await svc.requestPermission();

        expect(result).toBe('denied');
      });
    });

    describe('readSteps', () => {
      const now = Date.UTC(2026, 9, 4, 12);

      /** A service whose status was refreshed, as every sync does before reading. */
      async function connected(): Promise<HealthService> {
        const svc = new HealthService();
        await svc.refreshStatus();
        return svc;
      }

      it('should return the aggregate step total for the window, with no origin filter', async () => {
        const records = walk(now - HOUR_MS, now, 25);
        fakeHC.upsert(records);

        const svc = await connected();

        expect(await svc.readSteps(now - HOUR_MS, now)).toEqual({
          ok: true,
          steps: sumCounts(records),
        });
        expect(fakeHC.callsTo('aggregateRecord').map((c) => c.args[0])).toEqual([
          {
            recordType: 'Steps',
            timeRangeFilter: {
              operator: 'between',
              startTime: new Date(now - HOUR_MS).toISOString(),
              endTime: new Date(now).toISOString(),
            },
          },
        ]);
        expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
      });

      it('should de-duplicate sources by Health Connect priority', async () => {
        fakeHC.upsert(walk(now - HOUR_MS, now, 30, ON_DEVICE_ORIGIN)); // 1800 on-device
        fakeHC.upsert(fitbitBatch(now - HOUR_MS, now, 400)); // 1600 Fitbit, higher priority

        const svc = await connected();

        expect(await svc.readSteps(now - HOUR_MS, now)).toEqual({ ok: true, steps: 1600 });
      });

      it('should count the overlapping part of records straddling the window', async () => {
        fakeHC.upsert([
          { start: now - 2 * HOUR_MS, end: now, count: 1000, origin: ON_DEVICE_ORIGIN },
        ]);

        const svc = await connected();

        expect(await svc.readSteps(now - HOUR_MS, now + HOUR_MS)).toEqual({ ok: true, steps: 500 });
      });

      it('should read more than 1000 records in one call', async () => {
        const records = walk(now - 25 * HOUR_MS, now, 3); // 1500 per-minute records
        fakeHC.upsert(records);

        const svc = await connected();

        expect(await svc.readSteps(now - 25 * HOUR_MS, now)).toEqual({ ok: true, steps: 4500 });
        expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(1);
      });

      it('should return 0 steps when there are no records', async () => {
        const svc = await connected();

        expect(await svc.readSteps(now - HOUR_MS, now)).toEqual({ ok: true, steps: 0 });
      });

      it('should coerce a NaN total to 0', async () => {
        fakeHC.upsert([
          { start: now - 30 * 60_000, end: now - 29 * 60_000, count: NaN, origin: 'android' },
        ]);

        const svc = await connected();

        expect(await svc.readSteps(now - HOUR_MS, now)).toEqual({ ok: true, steps: 0 });
      });

      it.each([
        ['permission', 'a SecurityException', hcErrors.permission()],
        ['unavailable', 'Health Connect updating', hcErrors.serviceUnavailable()],
        ['unavailable', 'a RemoteException', hcErrors.remote()],
        ['rate_limited', 'a rate limit', hcErrors.rateLimited()],
        ['not_initialized', 'an uninitialized client', hcErrors.notInitialized()],
        ['unknown', 'any other rejection', hcErrors.argument('bad request')],
      ])('should report %s for %s instead of 0 steps', async (code, _label, error) => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        fakeHC.upsert(walk(now - HOUR_MS, now, 10));
        fakeHC.failNext('aggregateRecord', error);

        const svc = await connected();

        expect(await svc.readSteps(now - HOUR_MS, now)).toEqual({
          ok: false,
          code,
          message: error.message,
        });
        consoleError.mockRestore();
      });

      it('should report not_initialized when Health Connect cannot initialize', async () => {
        fakeHC.sdkStatus = 1;

        const svc = await connected();

        expect(await svc.readSteps(now - HOUR_MS, now)).toMatchObject({
          ok: false,
          code: 'not_initialized',
        });
        expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
      });

      it('should report not_initialized before any status refresh', async () => {
        expect(await new HealthService().readSteps(now - HOUR_MS, now)).toMatchObject({
          ok: false,
          code: 'not_initialized',
        });
        expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
      });
    });

    describe('readStepsBySource', () => {
      const now = Date.UTC(2026, 9, 4, 20);

      async function connected(): Promise<HealthService> {
        const svc = new HealthService();
        await svc.refreshStatus();
        return svc;
      }

      it('should sum raw records per origin across pages, most steps first, without de-duplicating', async () => {
        const onDevice = walk(now - 20 * HOUR_MS, now, 1, ON_DEVICE_ORIGIN); // 1200 records
        const fitbit = fitbitBatch(now - 2 * HOUR_MS, now, 400); // overlaps the phone's last 2 h
        fakeHC.upsert([...onDevice, ...fitbit]);

        const result = await (await connected()).readStepsBySource(now - 20 * HOUR_MS, now);

        expect(result).toEqual({
          ok: true,
          sources: [
            { origin: FITBIT_ORIGIN, records: 8, steps: 3200 },
            { origin: ON_DEVICE_ORIGIN, records: 1200, steps: 1200 },
          ],
        });
        expect(fakeHC.callsTo('readRecords')).toHaveLength(2);
        expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);
      });

      it('should return an error code when a page fails', async () => {
        fakeHC.upsert(walk(now - 20 * HOUR_MS, now, 1));
        const svc = await connected();
        fakeHC.failNext('readRecords', hcErrors.serviceUnavailable(), 1, 1);

        expect(await svc.readStepsBySource(now - 20 * HOUR_MS, now)).toMatchObject({
          ok: false,
          code: 'unavailable',
        });
      });

      it('should not read before the client is initialized', async () => {
        expect(await new HealthService().readStepsBySource(now - HOUR_MS, now)).toMatchObject({
          ok: false,
          code: 'not_initialized',
        });
        expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
      });
    });

    describe('historyStartAfterReinstall', () => {
      const lastSyncedAt = Date.UTC(2026, 8, 1);

      it('should return 30 days before the install time when installed after the last sync', async () => {
        const installedAt = Date.UTC(2026, 9, 4);
        jest.mocked(getInstallationTimeAsync).mockResolvedValue(new Date(installedAt));

        expect(await new HealthService().historyStartAfterReinstall(lastSyncedAt)).toBe(
          installedAt - 30 * DAY_MS
        );
      });

      it('should return undefined when the app was installed before the last sync', async () => {
        jest.mocked(getInstallationTimeAsync).mockResolvedValue(new Date(lastSyncedAt - DAY_MS));

        expect(await new HealthService().historyStartAfterReinstall(lastSyncedAt)).toBeUndefined();
      });

      it('should return undefined when the install time cannot be read', async () => {
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.mocked(getInstallationTimeAsync).mockRejectedValue(new Error('unavailable'));

        expect(await new HealthService().historyStartAfterReinstall(lastSyncedAt)).toBeUndefined();
        expect(consoleWarn).toHaveBeenCalled();
        consoleWarn.mockRestore();
      });
    });

    describe('openHealthSettings', () => {
      it('should call platform settings opener', async () => {
        const svc = new HealthService();
        await svc.refreshStatus();
        const result = await svc.openHealthSettings();

        expect(result).toBe(true);
        expect(fakeHC.callsTo('openHealthConnectSettings')).toHaveLength(1);
      });
    });
  });

  describe('iOS HealthKit', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    describe('refreshStatus', () => {
      it('should check HealthKit availability', async () => {
        mockIsHealthDataAvailable.mockResolvedValue(true);

        const svc = new HealthService();
        const result = await svc.refreshStatus();

        expect(result).toBe('not_determined');
        expect(svc.isAvailable()).toBe(true);
      });

      it('should report unavailable when HealthKit is unavailable', async () => {
        mockIsHealthDataAvailable.mockResolvedValue(false);

        expect(await new HealthService().refreshStatus()).toBe('unavailable');
      });

      it('should keep an authorization HealthKit cannot report', async () => {
        mockIsHealthDataAvailable.mockResolvedValue(true);
        mockRequestAuthorization.mockResolvedValue(undefined);
        const svc = new HealthService();
        await svc.requestPermission();

        expect(await svc.refreshStatus()).toBe('authorized');
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

    describe('readSteps', () => {
      beforeEach(() => {
        mockIsHealthDataAvailable.mockResolvedValue(true);
      });

      it('should query samples over [startMs, endMs] and floor fractional sums', async () => {
        mockQueryQuantitySamples.mockResolvedValue([
          { quantity: 150.5 },
          { quantity: 200.3 },
          { quantity: 100.4 },
        ]);
        const endMs = Date.now();
        const startMs = endMs - HOUR_MS;

        const svc = new HealthService();
        await svc.refreshStatus();

        expect(await svc.readSteps(startMs, endMs)).toEqual({ ok: true, steps: 451 });
        expect(mockQueryQuantitySamples).toHaveBeenCalledWith(
          'HKQuantityTypeIdentifierStepCount',
          expect.objectContaining({
            filter: { date: { startDate: new Date(startMs), endDate: new Date(endMs) } },
          })
        );
      });

      it('should coerce NaN sample quantities to 0', async () => {
        mockQueryQuantitySamples.mockResolvedValue([{ quantity: 150.5 }, { quantity: NaN }]);

        const svc = new HealthService();
        await svc.refreshStatus();

        expect(await svc.readSteps(Date.now() - HOUR_MS, Date.now())).toEqual({
          ok: true,
          steps: 150,
        });
      });

      it('should report an error instead of 0 steps', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockQueryQuantitySamples.mockRejectedValue(new Error('Query failed'));

        const svc = new HealthService();
        await svc.refreshStatus();

        expect(await svc.readSteps(Date.now() - HOUR_MS, Date.now())).toEqual({
          ok: false,
          code: 'unknown',
          message: 'Query failed',
        });
        consoleError.mockRestore();
      });
    });

    it('should not limit history after a reinstall (HealthKit has no grant window)', async () => {
      jest.mocked(getInstallationTimeAsync).mockResolvedValue(new Date(Date.UTC(2026, 9, 4)));

      expect(
        await new HealthService().historyStartAfterReinstall(Date.UTC(2026, 8, 1))
      ).toBeUndefined();
      expect(getInstallationTimeAsync).not.toHaveBeenCalled();
    });

    it('should not read steps by source (Health Connect only)', async () => {
      mockIsHealthDataAvailable.mockResolvedValue(true);
      const svc = new HealthService();
      await svc.refreshStatus();

      expect(await svc.readStepsBySource(Date.now() - HOUR_MS, Date.now())).toMatchObject({
        ok: false,
        code: 'unavailable',
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('should handle initialization errors gracefully', async () => {
      fakeHC.failNext('getSdkStatus', new Error('SDK check failed'));

      const svc = new HealthService();
      const result = await svc.refreshStatus();

      expect(result).toBe('unavailable');
    });

    it('should handle permission check errors gracefully', async () => {
      fakeHC.failNext('getGrantedPermissions', new Error('Check failed'));

      const svc = new HealthService();
      const result = await svc.refreshStatus();

      expect(result).toBe('not_determined');
    });

    it('should handle permission request errors gracefully', async () => {
      fakeHC.granted = false;
      fakeHC.failNext('requestPermission', new Error('Permission failed'));

      const svc = new HealthService();
      const result = await svc.requestPermission();

      expect(result).toBe('not_determined');
    });
  });

  describe('Service Methods', () => {
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
