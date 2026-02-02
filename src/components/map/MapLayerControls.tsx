// MapLayerControls - Floating layer toggle buttons for map overlays
// Allows switching between biome overlay and lithology overlay

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export type MapLayerType = 'biome' | 'lithology';

interface MapLayerControlsProps {
  activeLayer: MapLayerType;
  onLayerChange: (layer: MapLayerType) => void;
  isLoading?: boolean;
}

interface LayerOption {
  type: MapLayerType;
  icon: string;
  label: string;
}

const LAYER_OPTIONS: LayerOption[] = [
  { type: 'biome', icon: '🌲', label: 'Biome' },
  { type: 'lithology', icon: '🪨', label: 'Geology' },
];

export function MapLayerControls({ activeLayer, onLayerChange, isLoading }: MapLayerControlsProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.overlayPanel, shadowColor: colors.shadow },
      ]}
    >
      {LAYER_OPTIONS.map((option) => {
        const isActive = activeLayer === option.type;
        return (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.button,
              isActive && { backgroundColor: colors.selectedBackground },
              { borderColor: colors.borderLight },
            ]}
            onPress={() => onLayerChange(option.type)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{option.icon}</Text>
            <Text
              style={[styles.label, { color: isActive ? colors.primary : colors.textSecondary }]}
            >
              {option.label}
            </Text>
            {isLoading && isActive && (
              <View style={[styles.loadingDot, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 15,
    flexDirection: 'column',
    borderRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    overflow: 'hidden',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
});
