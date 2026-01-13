import { renderHook, act, waitFor } from '@testing-library/react';
import * as Location from 'expo-location';
import { useLocation, getZoneId } from '../src/hooks/useLocation';

// Get the mocked module
const mockLocation = Location as jest.Mocked<typeof Location>;

describe('useLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getZoneId utility function', () => {
    it('should return a zone id string', () => {
      const zoneId = getZoneId(40.7128, -74.006); // New York City coordinates
      expect(typeof zoneId).toBe('string');
      expect(zoneId.startsWith('zone_')).toBe(true);
    });

    it('should return consistent zone id for same location', () => {
      const lat = 51.5074;
      const lon = -0.1278; // London coordinates

      const zoneId1 = getZoneId(lat, lon);
      const zoneId2 = getZoneId(lat, lon);

      expect(zoneId1).toBe(zoneId2);
    });

    it('should return different zone ids for different locations', () => {
      const newYork = getZoneId(40.7128, -74.006);
      const london = getZoneId(51.5074, -0.1278);
      const tokyo = getZoneId(35.6762, 139.6503);

      expect(newYork).not.toBe(london);
      expect(london).not.toBe(tokyo);
      expect(newYork).not.toBe(tokyo);
    });

    it('should return different zone ids for nearby but distinct locations', () => {
      const loc1 = getZoneId(40.7128, -74.006);
      // Move approximately 500m (~0.0045 degrees latitude)
      const loc2 = getZoneId(40.7173, -74.006);

      expect(loc1).not.toBe(loc2);
    });

    it('should handle equator coordinates', () => {
      const zoneId = getZoneId(0, 0);
      expect(typeof zoneId).toBe('string');
      expect(zoneId.startsWith('zone_')).toBe(true);
    });

    it('should handle negative coordinates', () => {
      // Sydney, Australia (southern hemisphere)
      const sydney = getZoneId(-33.8688, 151.2093);
      expect(typeof sydney).toBe('string');
      expect(sydney.startsWith('zone_')).toBe(true);

      // Buenos Aires, Argentina (western and southern hemisphere)
      const buenosAires = getZoneId(-34.6037, -58.3816);
      expect(typeof buenosAires).toBe('string');
      expect(buenosAires.startsWith('zone_')).toBe(true);
    });

    it('should handle extreme latitudes', () => {
      // Near North Pole
      const arctic = getZoneId(89.0, 0);
      expect(typeof arctic).toBe('string');

      // Near South Pole
      const antarctic = getZoneId(-89.0, 0);
      expect(typeof antarctic).toBe('string');

      expect(arctic).not.toBe(antarctic);
    });

    it('should return zone format with coordinates', () => {
      const zoneId = getZoneId(40.7128, -74.006);
      // Zone ID should be in format zone_X_Y
      const parts = zoneId.split('_');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('zone');
      expect(!isNaN(parseInt(parts[1]))).toBe(true);
      expect(!isNaN(parseInt(parts[2]))).toBe(true);
    });

    it('should create zones of approximately 500m', () => {
      const baseZone = getZoneId(40.0, -74.0);
      const nearZone = getZoneId(40.0045, -74.0);

      const baseParts = baseZone.split('_');
      const nearParts = nearZone.split('_');

      // At least the latitude zone should be different after moving ~500m north
      expect(parseInt(baseParts[1])).not.toBe(parseInt(nearParts[1]));
    });
  });

  describe('useLocation hook', () => {
    it('should initialize with null location', () => {
      const { result } = renderHook(() => useLocation());

      expect(result.current.location).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isTracking).toBe(false);
      expect(result.current.totalDistance).toBe(0);
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

      mockLocation.watchPositionAsync.mockImplementationOnce(
        async (_options, callback) => {
          locationCallback = callback;
          return { remove: jest.fn() };
        }
      );

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

    it('should calculate distance between position updates', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      mockLocation.watchPositionAsync.mockImplementationOnce(
        async (_options, callback) => {
          locationCallback = callback;
          return { remove: jest.fn() };
        }
      );

      const { result } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      // First location
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

      // Second location - moved approximately 50 meters north
      await act(async () => {
        if (locationCallback) {
          locationCallback({
            coords: {
              latitude: 40.71325, // ~50m north
              longitude: -74.006,
              accuracy: 10,
              altitude: 0,
              altitudeAccuracy: 0,
              heading: 0,
              speed: 0,
            },
            timestamp: Date.now() + 5000,
          });
        }
      });

      await waitFor(() => {
        // Distance should be approximately 50 meters (between 5 and 100 to pass filter)
        expect(result.current.totalDistance).toBeGreaterThan(0);
      });
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

    it('should filter out GPS drift (distances > 100m)', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      mockLocation.watchPositionAsync.mockImplementationOnce(
        async (_options, callback) => {
          locationCallback = callback;
          return { remove: jest.fn() };
        }
      );

      const { result } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      // First location
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

      const distanceBefore = result.current.totalDistance;

      // GPS drift - jumped 500 meters (should be filtered)
      await act(async () => {
        if (locationCallback) {
          locationCallback({
            coords: {
              latitude: 40.717, // ~500m jump - too far
              longitude: -74.006,
              accuracy: 10,
              altitude: 0,
              altitudeAccuracy: 0,
              heading: 0,
              speed: 0,
            },
            timestamp: Date.now() + 5000,
          });
        }
      });

      // Distance should not have changed due to filter
      expect(result.current.totalDistance).toBe(distanceBefore);
    });

    it('should filter out inaccurate readings (accuracy > 50m)', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Location.PermissionResponse);

      mockLocation.watchPositionAsync.mockImplementationOnce(
        async (_options, callback) => {
          locationCallback = callback;
          return { remove: jest.fn() };
        }
      );

      const { result } = renderHook(() => useLocation());

      await act(async () => {
        await result.current.startTracking();
      });

      // First location with good accuracy
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

      const distanceBefore = result.current.totalDistance;

      // Second location with poor accuracy (> 50m)
      await act(async () => {
        if (locationCallback) {
          locationCallback({
            coords: {
              latitude: 40.7133, // ~50m move
              longitude: -74.006,
              accuracy: 100, // Poor accuracy - should be filtered
              altitude: 0,
              altitudeAccuracy: 0,
              heading: 0,
              speed: 0,
            },
            timestamp: Date.now() + 5000,
          });
        }
      });

      // Distance should not have changed due to accuracy filter
      expect(result.current.totalDistance).toBe(distanceBefore);
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
