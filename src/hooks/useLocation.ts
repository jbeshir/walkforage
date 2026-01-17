// Location tracking hook for WalkForage
// Handles GPS, distance calculation, and zone detection

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';

export interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface ZoneChangeEvent {
  zoneId: string;
  latitude: number;
  longitude: number;
}

export interface UseLocationOptions {
  onZoneChange?: (event: ZoneChangeEvent) => void;
}

export interface LocationHookResult {
  location: LocationState | null;
  error: string | null;
  isTracking: boolean;
  totalDistance: number;
  currentZone: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

// Haversine formula for distance between two coordinates
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useLocation(options: UseLocationOptions = {}): LocationHookResult {
  const { onZoneChange } = options;

  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentZone, setCurrentZone] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Location.LocationSubscription | null>(null);

  // Ref to track the last processed zone (avoids stale closure issues)
  const lastZoneRef = useRef<string | null>(null);
  // Ref to hold the latest callback (avoids re-creating the location watcher)
  const onZoneChangeRef = useRef(onZoneChange);

  // Keep the callback ref up to date
  useEffect(() => {
    onZoneChangeRef.current = onZoneChange;
  }, [onZoneChange]);

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
          timeInterval: 5000,      // Update every 5 seconds
          distanceInterval: 10,    // Or every 10 meters
        },
        (newLocation) => {
          const newState: LocationState = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy,
            timestamp: newLocation.timestamp,
          };

          // Check for zone change
          const newZone = getZoneId(newState.latitude, newState.longitude);
          if (newZone !== lastZoneRef.current) {
            lastZoneRef.current = newZone;
            setCurrentZone(newZone);

            // Fire callback if provided
            onZoneChangeRef.current?.({
              zoneId: newZone,
              latitude: newState.latitude,
              longitude: newState.longitude,
            });
          }

          setLocation((prevLocation) => {
            // Calculate distance from last position
            if (prevLocation) {
              const distance = calculateDistance(
                prevLocation.latitude,
                prevLocation.longitude,
                newState.latitude,
                newState.longitude
              );

              // Only count movement if accuracy is reasonable and distance is plausible
              // (filters out GPS jumps)
              if (
                newState.accuracy &&
                newState.accuracy < 50 &&
                distance > 5 &&
                distance < 100 // Max 100m per update (filters GPS drift)
              ) {
                setTotalDistance((prev) => prev + distance);
              }
            }
            return newState;
          });
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
    totalDistance,
    currentZone,
    startTracking,
    stopTracking,
  };
}

// Get current zone based on location (placeholder - will be enhanced with real data)
export function getZoneId(latitude: number, longitude: number): string {
  // Create a simple grid-based zone ID
  // Each zone is approximately 500m x 500m
  const latZone = Math.floor(latitude * 222.4); // ~111.2km per degree / 500m
  const lonZone = Math.floor(longitude * 222.4 * Math.cos(latitude * Math.PI / 180));
  return `zone_${latZone}_${lonZone}`;
}
