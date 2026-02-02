// MapLegend - Dynamic color legend showing visible biome/lithology types
// Extracts unique types from visible tiles and displays their colors

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { GeoTile } from '../../types/gis';
import { BiomeCode } from '../../types/resources';
import { useTheme } from '../../hooks/useTheme';
import { getBiomeColor, getLithologyColor } from '../../config/overlayColors';
import { getBiomeDisplayName } from '../../config/biomes';
import { formatSnakeCase } from '../../utils/strings';

interface MapLegendProps {
  tiles: GeoTile[];
  type: 'biome' | 'lithology';
}

interface LegendItem {
  key: string;
  label: string;
  color: string;
  count: number;
}

const MAX_VISIBLE_ITEMS = 8;

export function MapLegend({ tiles, type }: MapLegendProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const legendItems = useMemo(() => {
    if (tiles.length === 0) return [];

    const countMap = new Map<string, number>();

    // Count occurrences of each type, skipping "unknown" entries
    for (const tile of tiles) {
      const key = type === 'biome' ? tile.biome.type : tile.geology.primaryLithology;
      if (key === 'unknown') continue;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    // Convert to legend items and sort by count (descending)
    const items: LegendItem[] = Array.from(countMap.entries()).map(([key, count]) => ({
      key,
      label: type === 'biome' ? getBiomeDisplayName(key as BiomeCode) : formatSnakeCase(key),
      color: type === 'biome' ? getBiomeColor(key as BiomeCode) : getLithologyColor(key),
      count,
    }));

    items.sort((a, b) => b.count - a.count);

    return items;
  }, [tiles, type]);

  if (legendItems.length === 0) return null;

  const hasMoreItems = legendItems.length > MAX_VISIBLE_ITEMS;
  const visibleItems = hasMoreItems ? legendItems.slice(0, MAX_VISIBLE_ITEMS) : legendItems;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.overlayPanel, shadowColor: colors.shadow },
      ]}
    >
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        {type === 'biome' ? 'Biomes' : 'Geology'}
      </Text>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {visibleItems.map((item) => (
          <View key={item.key} style={styles.item}>
            <View style={[styles.colorBox, { backgroundColor: item.color }]} />
            <Text
              style={[styles.label, { color: colors.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.label}
            </Text>
          </View>
        ))}
        {hasMoreItems && (
          <Text style={[styles.moreText, { color: colors.textSecondary }]}>
            +{legendItems.length - MAX_VISIBLE_ITEMS} more
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 135,
    left: 15,
    minWidth: 160,
    maxWidth: 200,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  scrollView: {
    maxHeight: 200,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  colorBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  label: {
    fontSize: 13,
    flex: 1,
  },
  moreText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
