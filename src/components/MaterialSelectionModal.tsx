// Material Selection Modal for Crafting
// Allows players to choose which specific materials to use when crafting tools and components

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { OwnedComponent, Craftable, getQualityTier, getUsedMaterialId } from '../types/tools';
import { MaterialType, getMaterialConfig, getAllMaterialTypes } from '../config/materials';
import { useGameState } from '../hooks/useGameState';
import {
  calculateCraftableQuality,
  calculateMaterialQualityWithWeights,
  getQualityColor,
  getQualityDisplayName,
} from '../utils/qualityCalculation';
import { getComponentById } from '../data/tools';

interface MaterialSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selection: MaterialSelection) => void;
  title: string;
  craftable: Craftable; // The tool or component being crafted
  availableMaterials: Partial<Record<MaterialType, string[]>>;
  availableComponentIds?: string[];
}

export interface MaterialSelection {
  selectedMaterials: Partial<Record<MaterialType, string>>;
  componentIds?: string[];
}

interface MaterialOptionProps {
  materialId: string;
  type: MaterialType;
  isSelected: boolean;
  quantity: number;
  onSelect: () => void;
}

function MaterialOption({ materialId, type, isSelected, quantity, onSelect }: MaterialOptionProps) {
  const config = getMaterialConfig(type);
  const material = config.getResourceById(materialId);
  if (!material) return null;

  const props = material.properties;

  return (
    <TouchableOpacity
      style={[styles.materialOption, isSelected && styles.materialOptionSelected]}
      onPress={onSelect}
    >
      <View style={[styles.materialColorSwatch, { backgroundColor: material.color }]} />
      <View style={styles.materialInfo}>
        <Text style={styles.materialName}>
          {material.name} <Text style={styles.materialQuantity}>x{quantity}</Text>
        </Text>
        <View style={styles.propertyRow}>
          <Text style={styles.propertyLabel}>H:</Text>
          <View style={styles.propertyBar}>
            <View style={[styles.propertyFill, { width: `${props.hardness * 10}%` }]} />
          </View>
          <Text style={styles.propertyLabel}>W:</Text>
          <View style={styles.propertyBar}>
            <View
              style={[
                styles.propertyFill,
                styles.workabilityFill,
                { width: `${props.workability * 10}%` },
              ]}
            />
          </View>
          <Text style={styles.propertyLabel}>D:</Text>
          <View style={styles.propertyBar}>
            <View
              style={[
                styles.propertyFill,
                styles.durabilityFill,
                { width: `${props.durability * 10}%` },
              ]}
            />
          </View>
        </View>
      </View>
      {isSelected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
}

interface ComponentOptionProps {
  component: OwnedComponent;
  isSelected: boolean;
  onSelect: () => void;
}

function ComponentOption({ component, isSelected, onSelect }: ComponentOptionProps) {
  const componentDef = getComponentById(component.componentId);
  if (!componentDef) return null;

  const qualityPercent = Math.round(component.quality * 100);

  return (
    <TouchableOpacity
      style={[styles.materialOption, isSelected && styles.materialOptionSelected]}
      onPress={onSelect}
    >
      <View style={styles.materialInfo}>
        <Text style={styles.materialName}>{componentDef.name}</Text>
        <View style={styles.componentDetails}>
          {/* Display used materials dynamically */}
          {getAllMaterialTypes().map((materialType) => {
            const materialId = getUsedMaterialId(component.materials, materialType);
            if (!materialId) return null;
            const config = getMaterialConfig(materialType);
            const material = config.getResourceById(materialId);
            return (
              <View key={materialType} style={styles.usedMaterial}>
                <View style={[styles.miniSwatch, { backgroundColor: material?.color || '#888' }]} />
                <Text style={styles.usedMaterialText}>{material?.name || materialId}</Text>
              </View>
            );
          })}
          <Text style={styles.componentQuality}>Quality: {qualityPercent}%</Text>
        </View>
      </View>
      {isSelected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
}

export default function MaterialSelectionModal({
  visible,
  onClose,
  onConfirm,
  title,
  craftable,
  availableMaterials,
  availableComponentIds = [],
}: MaterialSelectionModalProps) {
  const { getResourceCount, state } = useGameState();

  // requiredComponents is now part of Craftable interface
  const { requiredComponents } = craftable;

  // Dynamic material selection state
  const [selectedMaterials, setSelectedMaterials] = useState<Partial<Record<MaterialType, string>>>(
    {}
  );
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);

  // Track previous visibility to detect when modal opens
  const prevVisibleRef = useRef(false);

  // Get quality weights from the craftable item
  const { qualityWeights } = craftable;

  // Get material requirements directly from struct
  const { materials } = craftable;

  // Determine which material types are needed
  const requiredMaterialTypes = getAllMaterialTypes().filter(
    (type) => materials[type] !== undefined
  );
  const needsComponents = requiredComponents.length > 0;

  // Reset selections when modal opens (transitions from hidden to visible)
  useEffect(() => {
    const justOpened = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (!justOpened) return;

    // Use setTimeout to batch state updates after initial render
    // This avoids the cascading renders lint warning
    const initializeSelections = () => {
      // Initialize material selections - sort by quality and select the best one
      const initialSelections: Partial<Record<MaterialType, string>> = {};

      for (const materialType of requiredMaterialTypes) {
        const available = availableMaterials[materialType] || [];
        if (available.length > 0) {
          // Sort by quality and select the best
          const sorted = [...available].sort((a, b) => {
            const qualityA = calculateMaterialQualityWithWeights(a, materialType, qualityWeights);
            const qualityB = calculateMaterialQualityWithWeights(b, materialType, qualityWeights);
            return qualityB - qualityA;
          });
          initialSelections[materialType] = sorted[0];
        }
      }

      setSelectedMaterials(initialSelections);

      // Auto-select required components
      const autoSelectedComponents: string[] = [];
      for (const req of requiredComponents) {
        const available = availableComponentIds.filter((id) => {
          const comp = state.ownedComponents.find((c) => c.instanceId === id);
          return comp?.componentId === req.componentId;
        });
        for (let i = 0; i < req.quantity && i < available.length; i++) {
          autoSelectedComponents.push(available[i]);
        }
      }
      setSelectedComponentIds(autoSelectedComponents);
    };

    // Schedule initialization for next tick to avoid sync setState in effect
    const timeoutId = setTimeout(initializeSelections, 0);
    return () => clearTimeout(timeoutId);
  }, [
    visible,
    availableMaterials,
    availableComponentIds,
    requiredComponents,
    state.ownedComponents,
    qualityWeights,
    requiredMaterialTypes,
  ]);

  // Calculate quality preview using the craftable's weights
  const getQualityPreview = () => {
    // Build usedMaterials in the expected format
    const usedMaterials: Record<string, { resourceId: string; quantity: number }> = {};

    for (const materialType of requiredMaterialTypes) {
      const selectedId = selectedMaterials[materialType];
      const requirement = materials[materialType];
      if (selectedId && requirement) {
        usedMaterials[materialType] = {
          resourceId: selectedId,
          quantity: requirement.quantity,
        };
      }
    }

    const score = calculateCraftableQuality(craftable, usedMaterials);
    return { tier: getQualityTier(score), score };
  };

  const qualityPreview = getQualityPreview();

  // Check if selection is valid
  const isSelectionValid = () => {
    // Check all required materials are selected
    for (const materialType of requiredMaterialTypes) {
      if (!selectedMaterials[materialType]) return false;
    }

    // Check all required components have enough selections
    if (needsComponents) {
      for (const req of requiredComponents) {
        const selectedOfType = selectedComponentIds.filter((id) => {
          const comp = state.ownedComponents.find((c) => c.instanceId === id);
          return comp?.componentId === req.componentId;
        });
        if (selectedOfType.length < req.quantity) return false;
      }
    }
    return true;
  };

  const handleConfirm = () => {
    onConfirm({
      selectedMaterials,
      componentIds: selectedComponentIds.length > 0 ? selectedComponentIds : undefined,
    });
  };

  const selectMaterial = (materialType: MaterialType, materialId: string) => {
    setSelectedMaterials((prev) => ({
      ...prev,
      [materialType]: materialId,
    }));
  };

  const toggleComponent = (instanceId: string) => {
    setSelectedComponentIds((prev) => {
      if (prev.includes(instanceId)) {
        return prev.filter((id) => id !== instanceId);
      } else {
        return [...prev, instanceId];
      }
    });
  };

  // Sort materials by expected quality (best first)
  const getSortedMaterials = (materialType: MaterialType): string[] => {
    const available = availableMaterials[materialType] || [];
    return [...available].sort((a, b) => {
      const qualityA = calculateMaterialQualityWithWeights(a, materialType, qualityWeights);
      const qualityB = calculateMaterialQualityWithWeights(b, materialType, qualityWeights);
      return qualityB - qualityA; // Descending order (best first)
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Quality Preview */}
            <View style={styles.qualityPreview}>
              <Text style={styles.qualityLabel}>Quality Preview:</Text>
              <View
                style={[
                  styles.qualityBadge,
                  { backgroundColor: getQualityColor(qualityPreview.tier) },
                ]}
              >
                <Text style={styles.qualityBadgeText}>
                  {getQualityDisplayName(qualityPreview.tier)}
                </Text>
              </View>
              <Text style={styles.qualityScoreText}>
                ({Math.round(qualityPreview.score * 100)}%)
              </Text>
            </View>

            {/* Quality Weights Info */}
            <View style={styles.weightsInfo}>
              <Text style={styles.weightsTitle}>Quality Weights:</Text>
              <View style={styles.weightsRow}>
                <View style={styles.weightItem}>
                  <Text style={styles.weightLabel}>H</Text>
                  <Text style={styles.weightValue}>
                    {Math.round(qualityWeights.hardnessWeight * 100)}%
                  </Text>
                </View>
                <View style={styles.weightItem}>
                  <Text style={[styles.weightLabel, styles.workabilityLabel]}>W</Text>
                  <Text style={styles.weightValue}>
                    {Math.round(qualityWeights.workabilityWeight * 100)}%
                  </Text>
                </View>
                <View style={styles.weightItem}>
                  <Text style={[styles.weightLabel, styles.durabilityLabel]}>D</Text>
                  <Text style={styles.weightValue}>
                    {Math.round(qualityWeights.durabilityWeight * 100)}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Material Selections - Dynamic for all material types */}
            {requiredMaterialTypes.map((materialType) => {
              const config = getMaterialConfig(materialType);
              const requirement = materials[materialType]!;
              const sortedMaterials = getSortedMaterials(materialType);

              return (
                <View key={materialType} style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Select {config.singularName} ({requirement.quantity} needed)
                    {requirement.requiresToolstone && config.hasToolstone && (
                      <Text style={styles.toolstoneNote}> - Toolstone required</Text>
                    )}
                  </Text>
                  <Text style={styles.sortNote}>Sorted by expected quality (best first)</Text>
                  {sortedMaterials.length === 0 ? (
                    <Text style={styles.noOptionsText}>
                      No suitable {config.pluralName.toLowerCase()} in inventory
                    </Text>
                  ) : (
                    sortedMaterials.map((materialId) => (
                      <MaterialOption
                        key={materialId}
                        materialId={materialId}
                        type={materialType}
                        isSelected={selectedMaterials[materialType] === materialId}
                        quantity={getResourceCount(materialType, materialId)}
                        onSelect={() => selectMaterial(materialType, materialId)}
                      />
                    ))
                  )}
                </View>
              );
            })}

            {/* Component Selection */}
            {needsComponents && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select Components</Text>
                {requiredComponents.map((req) => {
                  const compDef = getComponentById(req.componentId);
                  const availableForType = availableComponentIds
                    .map((id) => state.ownedComponents.find((c) => c.instanceId === id))
                    .filter((c) => c?.componentId === req.componentId) as OwnedComponent[];

                  return (
                    <View key={req.componentId} style={styles.componentSection}>
                      <Text style={styles.componentTypeTitle}>
                        {compDef?.name || req.componentId} ({req.quantity} needed)
                      </Text>
                      {availableForType.length === 0 ? (
                        <Text style={styles.noOptionsText}>No {req.componentId} available</Text>
                      ) : (
                        availableForType.map((comp) => (
                          <ComponentOption
                            key={comp.instanceId}
                            component={comp}
                            isSelected={selectedComponentIds.includes(comp.instanceId)}
                            onSelect={() => toggleComponent(comp.instanceId)}
                          />
                        ))
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Property Legend */}
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>Property Legend:</Text>
              <Text style={styles.legendItem}>H = Hardness (tool edge sharpness)</Text>
              <Text style={styles.legendItem}>W = Workability (crafting ease)</Text>
              <Text style={styles.legendItem}>D = Durability (tool longevity)</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, !isSelectionValid() && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={!isSelectionValid()}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  !isSelectionValid() && styles.confirmButtonTextDisabled,
                ]}
              >
                Craft
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  content: {
    padding: 16,
  },
  qualityPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 10,
  },
  qualityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qualityBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  qualityScoreText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  toolstoneNote: {
    fontSize: 12,
    color: '#E65100',
    fontStyle: 'italic',
  },
  noOptionsText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    padding: 10,
  },
  materialOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  materialOptionSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  materialColorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  materialQuantity: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'normal',
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyLabel: {
    fontSize: 10,
    color: '#666',
    width: 14,
  },
  propertyBar: {
    width: 40,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  propertyFill: {
    height: '100%',
    backgroundColor: '#F44336',
    borderRadius: 3,
  },
  workabilityFill: {
    backgroundColor: '#2196F3',
  },
  durabilityFill: {
    backgroundColor: '#4CAF50',
  },
  checkmark: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  componentSection: {
    marginBottom: 12,
  },
  componentTypeTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
  },
  componentDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  usedMaterial: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  miniSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  usedMaterialText: {
    fontSize: 11,
    color: '#666',
  },
  componentQuality: {
    fontSize: 11,
    color: '#888',
  },
  weightsInfo: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  weightsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 8,
  },
  weightsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weightItem: {
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 2,
  },
  workabilityLabel: {
    color: '#2196F3',
  },
  durabilityLabel: {
    color: '#4CAF50',
  },
  weightValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sortNote: {
    fontSize: 10,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  legend: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  legendItem: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  confirmButtonTextDisabled: {
    color: '#999',
  },
});
