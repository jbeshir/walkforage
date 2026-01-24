// Forage Screen - Main walking/gathering interface
// Shows map with current location and terrain info
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocation } from '../hooks/useLocation';
import { useGameState } from '../hooks/useGameState';
import { useTheme } from '../hooks/useTheme';
import { useStepGathering } from '../hooks/useStepGathering';
import { useGeoData } from '../providers/GeoDataProvider';
import { StepGatherPanel } from '../components/StepGatherPanel';
import { LocationGeoData } from '../types/gis';
import { MaterialType } from '../config/materials';
import { getBiomeDisplayName } from '../config/biomes';
import { formatSnakeCase } from '../utils/strings';

const { width, height } = Dimensions.get('window');

export default function ForageScreen() {
  const { addResource } = useGameState();
  const { theme } = useTheme();
  const { colors } = theme;
  const { geoDataService } = useGeoData();
  const [geoData, setGeoData] = useState<LocationGeoData | null>(null);

  // Step gathering integration
  const handleStepGather = useCallback(
    (category: MaterialType, resourceId: string, quantity: number) => {
      addResource(category, resourceId, quantity);
    },
    [addResource]
  );

  const stepGathering = useStepGathering({
    onGather: handleStepGather,
    autoSyncInterval: 60000, // Sync every minute
  });

  const { location, error, status, startTracking } = useLocation();

  // Auto-start tracking on mount
  useEffect(() => {
    void startTracking();
  }, [startTracking]);

  // Get user-friendly status message
  const getStatusMessage = () => {
    if (error) return error;
    switch (status) {
      case 'requesting_permission':
        return 'Requesting location permission...';
      case 'getting_location':
        return 'Getting your location...';
      case 'idle':
        return 'Starting location services...';
      default:
        return 'Waiting for location...';
    }
  };

  // Fetch geo data when location changes
  useEffect(() => {
    if (location && geoDataService) {
      geoDataService
        .getLocationData(location.latitude, location.longitude)
        .then(setGeoData)
        .catch((err: Error) => console.warn('Failed to get geo data:', err));
    }
  }, [location, geoDataService]);

  const { overlayPanel } = colors;

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
        />
      ) : (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {getStatusMessage()}
          </Text>
          {status === 'error' && (
            <Text
              style={[styles.retryText, { color: colors.primary }]}
              onPress={() => void startTracking()}
            >
              Tap to retry
            </Text>
          )}
        </View>
      )}

      {/* Terrain info overlay */}
      {geoData && (
        <View
          style={[
            styles.terrainOverlay,
            { backgroundColor: overlayPanel, shadowColor: colors.shadow },
          ]}
        >
          <Text style={[styles.terrainLabel, { color: colors.textSecondary }]}>Terrain</Text>
          <View style={styles.terrainRow}>
            <Text style={styles.terrainIcon}>🪨</Text>
            <Text style={[styles.terrainText, { color: colors.textPrimary }]}>
              {formatSnakeCase(geoData.geology.primaryLithology)}
            </Text>
          </View>
          <View style={styles.terrainRow}>
            <Text style={styles.terrainIcon}>🌲</Text>
            <Text style={[styles.terrainText, { color: colors.textPrimary }]}>
              {getBiomeDisplayName(geoData.biome.type)}
            </Text>
          </View>
        </View>
      )}

      {/* Forage panel */}
      <View style={styles.forageOverlay}>
        <StepGatherPanel
          stepGathering={stepGathering}
          geoData={geoData}
          hasLocation={location !== null}
          compact={true}
        />
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
  },
  loadingText: {
    fontSize: 16,
  },
  retryText: {
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
  },
  terrainOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 12,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 120,
  },
  terrainLabel: {
    fontSize: 12,
    fontWeight: '600',
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
  },
  forageOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
});
