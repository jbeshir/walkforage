// Materials Screen - View collected resources
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useGameState } from '../hooks/useGameState';
import { ResourceStack, isToolstone } from '../types/resources';
import { MaterialType, getAllMaterialTypes, getMaterialConfig } from '../config/materials';

interface ResourceItemProps {
  stack: ResourceStack;
  type: MaterialType;
}

function ResourceItem({ stack, type }: ResourceItemProps) {
  const config = getMaterialConfig(type);
  const resourceData = config.getResourceById(stack.resourceId);

  if (!resourceData) {
    return (
      <View style={styles.resourceItem}>
        <View style={[styles.colorSwatch, styles.colorSwatchUnknown]} />
        <View style={styles.resourceInfo}>
          <Text style={styles.resourceName}>{stack.resourceId}</Text>
          <Text style={styles.quantity}>x{stack.quantity}</Text>
        </View>
      </View>
    );
  }

  // Check toolstone flag - only applicable for materials that support it
  const showToolstoneBadge = config.hasToolstone && isToolstone(resourceData);

  return (
    <View style={styles.resourceItem}>
      <View style={[styles.colorSwatch, { backgroundColor: resourceData.color }]} />
      <View style={styles.resourceInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.resourceName}>{resourceData.name}</Text>
          {showToolstoneBadge && <Text style={styles.toolstoneBadge}>Toolstone</Text>}
        </View>
        <Text style={styles.resourceDescription} numberOfLines={2}>
          {resourceData.description}
        </Text>
        <View style={styles.propertiesRow}>
          <Text style={styles.property}>H:{resourceData.properties.hardness}</Text>
          <Text style={styles.property}>W:{resourceData.properties.workability}</Text>
          <Text style={styles.property}>D:{resourceData.properties.durability}</Text>
        </View>
      </View>
      <Text style={styles.quantity}>x{stack.quantity}</Text>
    </View>
  );
}

export default function InventoryScreen() {
  const { state } = useGameState();

  // Calculate totals for each material type dynamically
  const materialTotals = getAllMaterialTypes().map((type) => {
    const config = getMaterialConfig(type);
    const stacks = state.inventory[type];
    const total = stacks.reduce((sum, s) => sum + s.quantity, 0);
    return { type, config, stacks, total };
  });

  return (
    <ScrollView style={styles.container}>
      {/* Summary stats - dynamic for all material types */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Inventory Summary</Text>
        <View style={styles.summaryRow}>
          {materialTotals.map(({ type, config, total }) => (
            <View key={type} style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{total}</Text>
              <Text style={styles.summaryLabel}>{config.pluralName}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Dynamic sections for each material type */}
      {materialTotals.map(({ type, config, stacks, total }) => (
        <View key={type} style={styles.section}>
          <Text style={styles.sectionTitle}>
            {config.icon} {config.pluralName} ({total})
          </Text>
          {stacks.length === 0 ? (
            <Text style={styles.emptyText}>No {config.pluralName.toLowerCase()} collected yet</Text>
          ) : (
            stacks.map((stack) => <ResourceItem key={stack.resourceId} stack={stack} type={type} />)
          )}
        </View>
      ))}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#4CAF50',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  colorSwatchUnknown: {
    backgroundColor: '#ccc',
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
    color: '#333',
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
    color: '#666',
    marginTop: 2,
  },
  propertiesRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  property: {
    fontSize: 10,
    color: '#999',
    marginRight: 10,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  bottomPadding: {
    height: 30,
  },
});
