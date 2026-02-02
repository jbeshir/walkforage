// Location tracking hook for WalkForage
// Handles GPS for map display

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';

export interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  timestamp: number;
}

export type LocationStatus =
  | 'idle'
  | 'requesting_permission'
  | 'getting_location'
  | 'tracking'
  | 'error';

export interface LocationHookResult {
  location: LocationState | null;
  error: string | null;
  status: LocationStatus;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

export function useLocation(): LocationHookResult {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const startTracking = useCallback(async () => {
    // Prevent multiple simultaneous starts
    if (status === 'requesting_permission' || status === 'getting_location') {
      return;
    }

    try {
      setStatus('requesting_permission');
      setError(null);

      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        setError('Location permission denied. Please enable in Settings.');
        setStatus('error');
        return;
      }

      setStatus('getting_location');

      // Get current position immediately (with timeout)
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const initialState: LocationState = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          accuracy: currentLocation.coords.accuracy,
          altitude: currentLocation.coords.altitude,
          altitudeAccuracy: currentLocation.coords.altitudeAccuracy,
          timestamp: currentLocation.timestamp,
        };
        setLocation(initialState);
      } catch (posErr) {
        // Log but don't fail - we'll still try to watch for updates
        console.warn('Could not get immediate location, waiting for updates:', posErr);
      }

      // Start watching position for ongoing updates
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        (newLocation) => {
          const newState: LocationState = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy,
            altitude: newLocation.coords.altitude,
            altitudeAccuracy: newLocation.coords.altitudeAccuracy,
            timestamp: newLocation.timestamp,
          };
          setLocation(newState);
          setStatus('tracking');
        }
      );

      subscriptionRef.current = sub;
      setStatus('tracking');
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start location tracking';
      setError(message);
      setStatus('error');
    }
  }, [status]);

  const stopTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setStatus('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  return {
    location,
    error,
    status,
    isTracking: status === 'tracking',
    startTracking,
    stopTracking,
  };
}
