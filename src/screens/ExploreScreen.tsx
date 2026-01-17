// Explore Screen - Main walking/gathering interface
// Uses GIS data for location-appropriate resource spawning
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocation, ZoneChangeEvent } from '../hooks/useLocation';
import { useGameState } from '../hooks/useGameState';
import { STONES_BY_ID } from '../data/stones';
import { WOODS_BY_ID } from '../data/woods';
import { resourceSpawnService } from '../services/ResourceSpawnService';
import { geoDataService } from '../services/GeoDataService';
import { LocationGeoData } from '../types/gis';
import { BiomeCode } from '../types/resources';

// Human-readable biome names
const BIOME_NAMES: Record<BiomeCode, string> = {
  tropical_moist_broadleaf: 'Tropical Rainforest',
  tropical_dry_broadleaf: 'Tropical Dry Forest',
  tropical_conifer: 'Tropical Conifer Forest',
  temperate_broadleaf_mixed: 'Temperate Forest',
  temperate_conifer: 'Conifer Forest',
  boreal: 'Boreal Forest',
  tropical_grassland: 'Savanna',
  temperate_grassland: 'Grassland',
  flooded_grassland: 'Wetland',
  montane: 'Mountain Shrubland',
  tundra: 'Tundra',
  mediterranean: 'Mediterranean',
  desert: 'Desert',
  mangrove: 'Mangrove',
};

// Format lithology name for display (capitalize, replace underscores)
function formatLithology(lithology: string): string {
  return lithology
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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
  const { state, addResource, discoverZone, addDistance } = useGameState();

  const [spawnedResources, setSpawnedResources] = useState<SpawnedResource[]>([]);
  const [geoData, setGeoData] = useState<LocationGeoData | null>(null);

  // Spawn resources based on location using GIS data
  const spawnResourcesInZone = useCallback(async (lat: number, lng: number) => {
    try {
      // Use GIS-aware spawning service
      const spawnedData = await resourceSpawnService.spawnResources(lat, lng);

      const newResources: SpawnedResource[] = spawnedData.map((data, i) => ({
        id: `${Date.now()}_${i}`,
        resourceId: data.resourceId,
        type: data.type,
        // Spawn within ~100m radius
        latitude: lat + (Math.random() - 0.5) * 0.002,
        longitude: lng + (Math.random() - 0.5) * 0.002,
        quantity: data.quantity,
      }));

      setSpawnedResources((prev) => [...prev.slice(-20), ...newResources]);
    } catch (err) {
      console.warn('Resource spawning failed:', err);
      // Error is already handled in the service with fallback to random
    }
  }, []);

  // Handle zone changes - called by useLocation when entering a new zone
  const handleZoneChange = useCallback((event: ZoneChangeEvent) => {
    discoverZone(event.zoneId);
    void spawnResourcesInZone(event.latitude, event.longitude);
  }, [discoverZone, spawnResourcesInZone]);

  const {
    location,
    error,
    isTracking,
    totalDistance,
    startTracking,
    stopTracking,
  } = useLocation({ onZoneChange: handleZoneChange });

  // Track distance changes
  useEffect(() => {
    if (totalDistance > 0) {
      addDistance(totalDistance);
    }
  }, [totalDistance, addDistance]);

  // Fetch geo data when location changes
  useEffect(() => {
    if (location) {
      geoDataService.getLocationData(location.latitude, location.longitude)
        .then(setGeoData)
        .catch((err) => console.warn('Failed to get geo data:', err));
    }
  }, [location]);

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

      {/* Terrain info overlay */}
      {geoData && (
        <View style={styles.terrainOverlay}>
          <Text style={styles.terrainLabel}>Terrain</Text>
          <View style={styles.terrainRow}>
            <Text style={styles.terrainIcon}>🪨</Text>
            <Text style={styles.terrainText}>
              {formatLithology(geoData.geology.primaryLithology)}
            </Text>
          </View>
          <View style={styles.terrainRow}>
            <Text style={styles.terrainIcon}>🌲</Text>
            <Text style={styles.terrainText}>
              {BIOME_NAMES[geoData.biome.type] || geoData.biome.type}
            </Text>
          </View>
        </View>
      )}

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
  terrainOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 120,
  },
  terrainLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  terrainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  terrainIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  terrainText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
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
