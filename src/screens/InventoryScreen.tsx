// Materials Screen - View collected resources
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useGameState } from '../hooks/useGameState';
import { useTheme } from '../hooks/useTheme';
import { ResourceStack, isToolstone } from '../types/resources';
import { MaterialType, getAllMaterialTypes, getMaterialConfig } from '../config/materials';
import { ThemeColors } from '../config/theme';
import { getResourceIcon } from '../utils/icons';

interface ResourceItemProps {
  stack: ResourceStack;
  type: MaterialType;
  colors: ThemeColors;
}

function ResourceItem({ stack, type, colors }: ResourceItemProps) {
  const config = getMaterialConfig(type);
  const resourceData = config.getResourceById(stack.resourceId);

  if (!resourceData) {
    return (
      <View style={[styles.resourceItem, { borderBottomColor: colors.borderLight }]}>
        <View style={[styles.colorSwatch, { backgroundColor: colors.border }]} />
        <View style={styles.resourceInfo}>
          <Text style={[styles.resourceName, { color: colors.textPrimary }]}>
            {stack.resourceId}
          </Text>
          <Text style={[styles.quantity, { color: colors.primary }]}>x{stack.quantity}</Text>
        </View>
      </View>
    );
  }

  // Check toolstone flag - only applicable for materials that support it
  const showToolstoneBadge = config.hasToolstone && isToolstone(resourceData);

  // Get property schema for dynamic display
  const schema = config.propertySchema;

  // Get icon if available
  const icon = getResourceIcon(type, stack.resourceId);

  return (
    <View style={[styles.resourceItem, { borderBottomColor: colors.borderLight }]}>
      {icon ? (
        <Image source={icon} style={styles.resourceIcon} cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.colorSwatch, { backgroundColor: resourceData.color }]} />
      )}
      <View style={styles.resourceInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.resourceName, { color: colors.textPrimary }]}>
            {resourceData.name}
          </Text>
          {showToolstoneBadge && <Text style={styles.toolstoneBadge}>Toolstone</Text>}
        </View>
        <Text
          style={[styles.resourceDescription, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {resourceData.description}
        </Text>
        <View style={styles.propertiesRow}>
          {schema.map((propDef) => {
            const value = resourceData.properties[propDef.id] ?? 0;
            return (
              <Text
                key={propDef.id}
                style={[
                  styles.property,
                  { color: colors.textTertiary, backgroundColor: colors.surfaceSecondary },
                ]}
              >
                {propDef.abbreviation}:{value}
              </Text>
            );
          })}
        </View>
      </View>
      <Text style={[styles.quantity, { color: colors.primary }]}>x{stack.quantity}</Text>
    </View>
  );
}

export default function InventoryScreen() {
  const { state } = useGameState();
  const { theme } = useTheme();
  const { colors } = theme;

  // Track collapsed sections (default all expanded)
  const [collapsedSections, setCollapsedSections] = useState<Set<MaterialType>>(new Set());

  const toggleSection = (type: MaterialType) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Calculate totals for each material type dynamically
  const materialTotals = getAllMaterialTypes().map((type) => {
    const config = getMaterialConfig(type);
    const stacks = state.inventory[type];
    const total = stacks.reduce((sum, s) => sum + s.quantity, 0);
    return { type, config, stacks, total };
  });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Summary stats - dynamic for all material types */}
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: colors.surface, shadowColor: colors.shadow },
        ]}
      >
        <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Inventory Summary</Text>
        <View style={styles.summaryRow}>
          {materialTotals.map(({ type, config, total }) => (
            <View key={type} style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{total}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                {config.pluralName}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Dynamic sections for each material type */}
      {materialTotals.map(({ type, config, stacks, total }) => {
        const isCollapsed = collapsedSections.has(type);
        return (
          <View
            key={type}
            style={[
              styles.section,
              { backgroundColor: colors.surface, shadowColor: colors.shadow },
            ]}
          >
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(type)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {config.icon} {config.pluralName} ({total})
              </Text>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>
                {isCollapsed ? '▶' : '▼'}
              </Text>
            </TouchableOpacity>
            {!isCollapsed &&
              (stacks.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                  No {config.pluralName.toLowerCase()} collected yet
                </Text>
              ) : (
                stacks.map((stack) => (
                  <ResourceItem key={stack.resourceId} stack={stack} type={type} colors={colors} />
                ))
              ))}
          </View>
        );
      })}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    margin: 15,
    padding: 20,
    borderRadius: 15,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chevron: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  resourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  resourceInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  toolstoneBadge: {
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#78909C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    fontWeight: '600',
  },
  resourceDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  propertiesRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  property: {
    fontSize: 10,
    marginRight: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 30,
  },
});
