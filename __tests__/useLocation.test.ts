import { renderHook, act, waitFor } from '@testing-library/react';
import * as Location from 'expo-location';
import { useLocation } from '../src/hooks/useLocation';

// Get the mocked module
const mockLocation = Location as jest.Mocked<typeof Location>;

describe('useLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useLocation hook', () => {
    it('should initialize with null location', () => {
      const { result } = renderHook(() => useLocation());

      expect(result.current.location).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isTracking).toBe(false);
    });

    it('should have startTracking and stopTracking functions', () => {
      const { result } = renderHook(() => useLocation());

      expect(typeof result.current.startTracking).toBe('function');
      expect(typeof result.current.stopTracking).toBe('function');
    });

    it('should request permissions when starting tracking', async () => {
      const { result } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should set error when permission is denied', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
        status: 'denied',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      const { result } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      expect(result.current.error).toBe('Location permission denied');
      expect(result.current.isTracking).toBe(false);
    });

    it('should start watching position when permission is granted', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      const { result } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      expect(mockLocation.watchPositionAsync).toHaveBeenCalled();
      expect(result.current.isTracking).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should update location when position changes', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      mockLocation.watchPositionAsync.mockImplementationOnce(async (_options, callback) => {
        locationCallback = callback;
        return { remove: jest.fn() };
      });

      const { result } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      // Simulate location update
      await act(async () => {
        if (locationCallback) {
          locationCallback({
            coords: {
              latitude: 40.7128,
              longitude: -74.006,
              accuracy: 10,
              altitude: 0,
              altitudeAccuracy: 0,
              heading: 0,
              speed: 0,
            },
            timestamp: Date.now(),
          });
        }
      });

      await waitFor(() => {
        expect(result.current.location).not.toBeNull();
      });

      expect(result.current.location?.latitude).toBe(40.7128);
      expect(result.current.location?.longitude).toBe(-74.006);
    });

    it('should stop tracking when stopTracking is called', async () => {
      const mockRemove = jest.fn();

      mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      mockLocation.watchPositionAsync.mockResolvedValueOnce({
        remove: mockRemove,
      });

      const { result } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      expect(result.current.isTracking).toBe(true);

      act(() => {
        result.current.stopTracking();
      });

      expect(result.current.isTracking).toBe(false);
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should handle tracking errors gracefully', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockRejectedValueOnce(
        new Error('Location service unavailable')
      );

      const { result } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      expect(result.current.error).toBe('Location service unavailable');
      expect(result.current.isTracking).toBe(false);
    });

    it('should cleanup subscription on unmount', async () => {
      const mockRemove = jest.fn();

      mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      mockLocation.watchPositionAsync.mockResolvedValueOnce({
        remove: mockRemove,
      });

      const { result, unmount } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      unmount();

      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
