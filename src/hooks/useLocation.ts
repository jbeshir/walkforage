// Location tracking hook for WalkForage
// Handles GPS for map display

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

export interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface LocationHookResult {
  location: LocationState | null;
  error: string | null;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

export function useLocation(): LocationHookResult {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [subscription, setSubscription] = useState<Location.LocationSubscription | null>(null);

  const startTracking = useCallback(async () => {
    try {
      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        setError('Location permission denied');
        return;
      }

      // Start watching position
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
            timestamp: newLocation.timestamp,
          };
          setLocation(newState);
        }
      );

      setSubscription(sub);
      setIsTracking(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start location tracking');
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
    setIsTracking(false);
  }, [subscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [subscription]);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking,
  };
}
