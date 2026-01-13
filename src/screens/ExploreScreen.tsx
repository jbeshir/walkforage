// Explore Screen - Main walking/gathering interface
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocation, getZoneId } from '../hooks/useLocation';
import { useGameState } from '../hooks/useGameState';
import { STONES, STONES_BY_ID } from '../data/stones';
import { WOODS, WOODS_BY_ID } from '../data/woods';

const { width, height } = Dimensions.get('window');

interface SpawnedResource {
  id: string;
  resourceId: string;
  type: 'stone' | 'wood';
  latitude: number;
  longitude: number;
  quantity: number;
}

export default function ExploreScreen() {
  const {
    location,
    error,
    isTracking,
    totalDistance,
    startTracking,
    stopTracking,
  } = useLocation();

  const { state, addResource, discoverZone, addDistance } = useGameState();

  const [spawnedResources, setSpawnedResources] = useState<SpawnedResource[]>([]);
  const lastProcessedZoneRef = useRef<string | null>(null);

  // Compute current zone from location (derived state)
  const currentZone = useMemo(() => {
    if (!location) return null;
    return getZoneId(location.latitude, location.longitude);
  }, [location]);

  // Spawn resources based on location (simplified - will use real data later)
  const spawnResourcesInZone = useCallback((lat: number, lng: number) => {
    const newResources: SpawnedResource[] = [];

    // Spawn 3-5 random resources nearby
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const isStone = Math.random() > 0.4;
      const resources = isStone ? STONES : WOODS;
      const resource = resources[Math.floor(Math.random() * resources.length)];

      // Spawn within ~100m radius
      const offsetLat = (Math.random() - 0.5) * 0.002;
      const offsetLng = (Math.random() - 0.5) * 0.002;

      newResources.push({
        id: `${Date.now()}_${i}`,
        resourceId: resource.id,
        type: isStone ? 'stone' : 'wood',
        latitude: lat + offsetLat,
        longitude: lng + offsetLng,
        quantity: 1 + Math.floor(Math.random() * 5),
      });
    }

    setSpawnedResources((prev) => [...prev.slice(-20), ...newResources]);
  }, []);

  // Track distance changes
  useEffect(() => {
    if (totalDistance > 0) {
      addDistance(totalDistance);
    }
  }, [totalDistance, addDistance]);

  // Handle zone changes - trigger side effects when entering new zone
  // Spawning resources on zone entry is intentional reactive behavior
  useEffect(() => {
    if (location && currentZone && currentZone !== lastProcessedZoneRef.current) {
      lastProcessedZoneRef.current = currentZone;
      discoverZone(currentZone);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      spawnResourcesInZone(location.latitude, location.longitude);
    }
  }, [location, currentZone, discoverZone, spawnResourcesInZone]);

  // Collect a resource
  const collectResource = (resource: SpawnedResource) => {
    const category = resource.type === 'stone' ? 'stones' : 'woods';
    addResource(category, resource.resourceId, resource.quantity);

    const resourceData =
      resource.type === 'stone'
        ? STONES_BY_ID[resource.resourceId]
        : WOODS_BY_ID[resource.resourceId];

    Alert.alert(
      'Collected!',
      `+${resource.quantity} ${resourceData?.name || resource.resourceId}`
    );

    setSpawnedResources((prev) => prev.filter((r) => r.id !== resource.id));
  };

  // Calculate if resource is within collection range (30 meters)
  const isInRange = (resourceLat: number, resourceLng: number): boolean => {
    if (!location) return false;
    const R = 6371000;
    const dLat = ((resourceLat - location.latitude) * Math.PI) / 180;
    const dLng = ((resourceLng - location.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((location.latitude * Math.PI) / 180) *
        Math.cos((resourceLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return distance <= 30;
  };

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation
          showsMyLocationButton
        >
          {/* Collection range circle */}
          <Circle
            center={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            radius={30}
            fillColor="rgba(66, 133, 244, 0.1)"
            strokeColor="rgba(66, 133, 244, 0.3)"
            strokeWidth={1}
          />

          {/* Resource markers */}
          {spawnedResources.map((resource) => {
            const resourceData =
              resource.type === 'stone'
                ? STONES_BY_ID[resource.resourceId]
                : WOODS_BY_ID[resource.resourceId];
            const inRange = isInRange(resource.latitude, resource.longitude);

            return (
              <Marker
                key={resource.id}
                coordinate={{
                  latitude: resource.latitude,
                  longitude: resource.longitude,
                }}
                title={resourceData?.name || resource.resourceId}
                description={`Quantity: ${resource.quantity}`}
                pinColor={inRange ? '#4CAF50' : '#9E9E9E'}
                onPress={() => {
                  if (inRange) {
                    collectResource(resource);
                  } else {
                    Alert.alert('Too far!', 'Walk closer to collect this resource.');
                  }
                }}
              />
            );
          })}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {error || 'Waiting for location...'}
          </Text>
        </View>
      )}

      {/* Stats overlay */}
      <View style={styles.statsOverlay}>
        <Text style={styles.statText}>
          Distance: {(totalDistance / 1000).toFixed(2)} km
        </Text>
        <Text style={styles.statText}>
          Zones: {state.discoveredZones.length}
        </Text>
        <Text style={styles.statText}>
          Resources: {spawnedResources.length} nearby
        </Text>
      </View>

      {/* Tracking button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.trackingButton,
            isTracking ? styles.trackingActive : styles.trackingInactive,
          ]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Text style={styles.buttonText}>
            {isTracking ? 'Stop Exploring' : 'Start Exploring'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  statsOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 5,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  trackingButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  trackingActive: {
    backgroundColor: '#f44336',
  },
  trackingInactive: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
