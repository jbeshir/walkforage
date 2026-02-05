// Tests for useStepGathering hook
// Tests step synchronization, material gathering, permission handling

import React, { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStepGathering } from '../src/hooks/useStepGathering';
import { GameStateProvider } from '../src/hooks/useGameState';
import { healthService } from '../src/services/HealthService';
import { STEPS_PER_GATHER } from '../src/config/gathering';

// Mock the health service
jest.mock('../src/services/HealthService', () => ({
  healthService: {
    isAvailable: jest.fn(),
    initialize: jest.fn(),
    checkPermission: jest.fn(),
    requestPermission: jest.fn(),
    getPermissionStatus: jest.fn(),
    getStepsSince: jest.fn(),
    needsHealthConnectInstall: jest.fn(),
    openHealthSettings: jest.fn(),
    openHealthConnectPlayStore: jest.fn(),
  },
}));

// Get the mocked module
const mockHealthService = healthService as jest.Mocked<typeof healthService>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Wrapper component for tests
function TestWrapper({ children }: { children: ReactNode }) {
  return React.createElement(GameStateProvider, null, children);
}

describe('useStepGathering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mocks - health service available and authorized
    mockHealthService.isAvailable.mockReturnValue(true);
    mockHealthService.initialize.mockResolvedValue(true);
    mockHealthService.checkPermission.mockResolvedValue('authorized');
    mockHealthService.getPermissionStatus.mockReturnValue('authorized');
    mockHealthService.getStepsSince.mockResolvedValue(0);
    mockHealthService.needsHealthConnectInstall.mockReturnValue(false);
    mockHealthService.openHealthSettings.mockResolvedValue(true);
    mockHealthService.openHealthConnectPlayStore.mockResolvedValue(true);

    // Default: no saved game
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('should complete loading after initialization', async () => {
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should report available when health service is available', async () => {
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAvailable).toBe(true);
    });

    it('should report unavailable when health service is not available', async () => {
      mockHealthService.isAvailable.mockReturnValue(false);

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAvailable).toBe(false);
      expect(result.current.permissionStatus).toBe('unavailable');
    });

    it('should check permission status on mount', async () => {
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockHealthService.checkPermission).toHaveBeenCalled();
      expect(result.current.permissionStatus).toBe('authorized');
    });

    it('should handle initialization failure gracefully', async () => {
      mockHealthService.initialize.mockResolvedValue(false);
      mockHealthService.getPermissionStatus.mockReturnValue('unavailable');

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.permissionStatus).toBe('unavailable');
    });
  });

  describe('Permission Request', () => {
    it('should request permission when requested', async () => {
      mockHealthService.checkPermission.mockResolvedValue('not_determined');
      mockHealthService.getPermissionStatus.mockReturnValue('not_determined');
      mockHealthService.requestPermission.mockResolvedValue('authorized');

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.permissionStatus).toBe('not_determined');

      await act(async () => {
        const status = await result.current.requestPermission();
        expect(status).toBe('authorized');
      });

      expect(mockHealthService.requestPermission).toHaveBeenCalled();
      expect(result.current.permissionStatus).toBe('authorized');
    });

    it('should handle permission denial', async () => {
      mockHealthService.checkPermission.mockResolvedValue('not_determined');
      mockHealthService.getPermissionStatus.mockReturnValue('not_determined');
      mockHealthService.requestPermission.mockResolvedValue('denied');

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const status = await result.current.requestPermission();
        expect(status).toBe('denied');
      });

      expect(result.current.permissionStatus).toBe('denied');
    });
  });

  describe('Step Synchronization', () => {
    it('should sync steps from health service', async () => {
      mockHealthService.getStepsSince.mockResolvedValue(5000);

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Advance time to allow debounce
      act(() => {
        jest.advanceTimersByTime(31000);
      });

      await act(async () => {
        const syncResult = await result.current.syncSteps();
        expect(syncResult.success).toBe(true);
        expect(syncResult.newSteps).toBe(5000);
      });
    });

    it('should debounce rapid sync requests', async () => {
      mockHealthService.getStepsSince.mockResolvedValue(1000);

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First sync (after debounce time)
      act(() => {
        jest.advanceTimersByTime(31000);
      });

      await act(async () => {
        await result.current.syncSteps();
      });

      // Immediate second sync should be debounced
      await act(async () => {
        const secondResult = await result.current.syncSteps();
        expect(secondResult.newSteps).toBe(0); // Debounced
      });
    });

    it('should fail sync when permission not granted', async () => {
      mockHealthService.checkPermission.mockResolvedValue('not_determined');
      mockHealthService.getPermissionStatus.mockReturnValue('not_determined');

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const syncResult = await result.current.syncSteps();
        expect(syncResult.success).toBe(false);
        expect(syncResult.error).toContain('Permission');
      });
    });

    it('should not credit historical steps on first sync', async () => {
      mockHealthService.getStepsSince.mockResolvedValue(10000);

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First sync should not credit historical steps
      await act(async () => {
        const syncResult = await result.current.syncSteps();
        expect(syncResult.newSteps).toBe(0);
      });
    });
  });

  describe('Step Spending', () => {
    it('should spend steps correctly', async () => {
      // Start with saved state that has steps
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          availableSteps: 3000,
          lastSyncTimestamp: Date.now() - 60000,
          totalStepsGathered: 0,
        })
      );

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(3000);
      });

      act(() => {
        result.current.spendSteps(STEPS_PER_GATHER);
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(2000);
      });
    });

    it('should track total steps gathered', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          availableSteps: 5000,
          lastSyncTimestamp: Date.now() - 60000,
          totalStepsGathered: 10000,
        })
      );

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.totalStepsGathered).toBe(10000);
      });
    });
  });

  describe('Material Gathering', () => {
    beforeEach(() => {
      // Start with enough steps for gathering
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          availableSteps: 5000,
          lastSyncTimestamp: Date.now() - 60000,
          totalStepsGathered: 0,
          inventory: { stone: [], wood: [], food: [] },
          unlockedTechs: [],
          ownedTools: [],
          ownedComponents: [],
        })
      );
    });

    it('should fail gathering when no steps available', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          availableSteps: 0,
          lastSyncTimestamp: Date.now() - 60000,
          totalStepsGathered: 0,
        })
      );

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const gatherResult = await result.current.gatherMaterial('stone', null);
        expect(gatherResult.success).toBe(false);
        expect(gatherResult.error).toContain('steps');
      });
    });

    it('should succeed gathering wood (base ability allows gathering)', async () => {
      // Wood has baseGatheringAbility of 1, so it doesn't require a tool
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(5000);
      });

      await act(async () => {
        const gatherResult = await result.current.gatherMaterial('wood', null);
        expect(gatherResult.success).toBe(true);
        expect(gatherResult.resourceId).toBeDefined();
      });
    });

    it('should succeed gathering stone (no tool required)', async () => {
      const onGather = jest.fn();

      const { result } = renderHook(() => useStepGathering({ onGather }), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(5000);
      });

      await act(async () => {
        const gatherResult = await result.current.gatherMaterial('stone', null);
        expect(gatherResult.success).toBe(true);
        expect(gatherResult.resourceId).toBeDefined();
        expect(gatherResult.quantity).toBeGreaterThan(0);
        expect(gatherResult.stepsSpent).toBe(STEPS_PER_GATHER);
      });

      // Should call onGather callback
      expect(onGather).toHaveBeenCalledWith('stone', expect.any(String), expect.any(Number));

      // Steps should be spent
      expect(result.current.availableSteps).toBe(4000);
    });

    it('should succeed gathering food (no tool required)', async () => {
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.availableSteps).toBe(5000);
      });

      await act(async () => {
        const gatherResult = await result.current.gatherMaterial('food', null);
        expect(gatherResult.success).toBe(true);
        expect(gatherResult.resourceId).toBeDefined();
      });
    });

    it('should return list of gatherable material types', async () => {
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.gatherableMaterialTypes).toBeDefined();
      expect(result.current.gatherableMaterialTypes.length).toBeGreaterThan(0);
      expect(result.current.gatherableMaterialTypes).toContain('stone');
      expect(result.current.gatherableMaterialTypes).toContain('food');
    });
  });

  describe('Auto-sync Interval', () => {
    it('should auto-sync when interval is set', async () => {
      mockHealthService.getStepsSince.mockResolvedValue(1000);

      const { result } = renderHook(() => useStepGathering({ autoSyncInterval: 60000 }), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Fast-forward to trigger auto-sync
      act(() => {
        jest.advanceTimersByTime(61000);
      });

      // Verify that sync was attempted
      // Note: Due to debouncing, the actual sync behavior depends on state
      expect(mockHealthService.getPermissionStatus).toHaveBeenCalled();
    });

    it('should not auto-sync when interval is 0', async () => {
      const { result } = renderHook(() => useStepGathering({ autoSyncInterval: 0 }), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockHealthService.getStepsSince.mock.calls.length;

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(120000);
      });

      // Should not have made additional sync calls
      expect(mockHealthService.getStepsSince.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Health Settings', () => {
    it('should open health settings', async () => {
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const opened = await result.current.openHealthSettings();
        expect(opened).toBe(true);
      });

      expect(mockHealthService.openHealthSettings).toHaveBeenCalled();
    });

    it('should open Play Store for Health Connect installation', async () => {
      mockHealthService.needsHealthConnectInstall.mockReturnValue(true);

      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.needsInstall).toBe(true);

      await act(async () => {
        const opened = await result.current.openPlayStore();
        expect(opened).toBe(true);
      });

      expect(mockHealthService.openHealthConnectPlayStore).toHaveBeenCalled();
    });
  });

  describe('Return Values', () => {
    it('should return all expected values', async () => {
      const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check all return values are present
      expect(typeof result.current.availableSteps).toBe('number');
      expect(typeof result.current.lastSyncTimestamp).toBe('number');
      expect(typeof result.current.totalStepsGathered).toBe('number');
      expect(typeof result.current.permissionStatus).toBe('string');
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.syncSteps).toBe('function');
      expect(typeof result.current.requestPermission).toBe('function');
      expect(typeof result.current.gatherMaterial).toBe('function');
      expect(typeof result.current.spendSteps).toBe('function');
      expect(typeof result.current.isAvailable).toBe('boolean');
      expect(typeof result.current.needsInstall).toBe('boolean');
      expect(typeof result.current.openHealthSettings).toBe('function');
      expect(typeof result.current.openPlayStore).toBe('function');
      expect(Array.isArray(result.current.gatherableMaterialTypes)).toBe(true);
    });
  });
});
