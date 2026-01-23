// TechResourceModal - Select specific materials to spend on tech research
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TechResourceCost } from '../types/tech';
import { ResourceStack } from '../types/resources';
import { MaterialType, getMaterialConfig, getAllMaterialTypes } from '../config/materials';
import { useTheme } from '../hooks/useTheme';
import { ThemeColors } from '../config/theme';

// Selected resources for each material type
export interface ResourceSelection {
  materials: Partial<Record<MaterialType, { resourceId: string; quantity: number }[]>>;
}

interface TechResourceModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selection: ResourceSelection) => void;
  techName: string;
  resourceCosts: TechResourceCost[];
  availableMaterials: Partial<Record<MaterialType, ResourceStack[]>>;
}

interface MaterialPickerProps {
  type: MaterialType;
  required: number;
  stacks: ResourceStack[];
  selected: { resourceId: string; quantity: number }[];
  onSelect: (resourceId: string, quantity: number) => void;
  colors: ThemeColors;
}

function MaterialPicker({
  type,
  required,
  stacks,
  selected,
  onSelect,
  colors,
}: MaterialPickerProps) {
  const config = getMaterialConfig(type);

  const totalSelected = selected.reduce((sum, s) => sum + s.quantity, 0);
  const remaining = required - totalSelected;

  return (
    <View style={[styles.pickerSection, { backgroundColor: colors.surfaceSecondary }]}>
      <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>
          {config.icon} {config.singularName}: {totalSelected}/{required}
        </Text>
        {remaining > 0 && (
          <Text style={[styles.remainingText, { color: colors.warning }]}>
            Need {remaining} more
          </Text>
        )}
        {remaining === 0 && (
          <Text style={[styles.completeText, { color: colors.success }]}>Complete</Text>
        )}
      </View>

      {stacks.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
          No {config.singularName.toLowerCase()} available
        </Text>
      ) : (
        stacks.map((stack) => {
          const material = config.getResourceById(stack.resourceId);
          const selectedItem = selected.find((s) => s.resourceId === stack.resourceId);
          const selectedQty = selectedItem?.quantity || 0;
          const maxSelectable = Math.min(stack.quantity, selectedQty + remaining);

          return (
            <View
              key={stack.resourceId}
              style={[styles.materialRow, { borderBottomColor: colors.border }]}
            >
              <View
                style={[
                  styles.materialSwatch,
                  { backgroundColor: material?.color || colors.border, borderColor: colors.border },
                ]}
              />
              <View style={styles.materialInfo}>
                <Text style={[styles.materialName, { color: colors.textPrimary }]}>
                  {material?.name || stack.resourceId}
                </Text>
                <Text style={[styles.materialAvailable, { color: colors.textTertiary }]}>
                  Available: {stack.quantity}
                </Text>
              </View>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={[
                    styles.qtyButtonSmall,
                    { backgroundColor: colors.primaryDark },
                    selectedQty === 0 && { backgroundColor: colors.border },
                  ]}
                  onPress={() => onSelect(stack.resourceId, 0)}
                  disabled={selectedQty === 0}
                >
                  <Text style={styles.qtyButtonTextSmall}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.qtyButtonSmall,
                    { backgroundColor: colors.primaryDark },
                    selectedQty === 0 && { backgroundColor: colors.border },
                  ]}
                  onPress={() => onSelect(stack.resourceId, Math.max(0, selectedQty - 10))}
                  disabled={selectedQty === 0}
                >
                  <Text style={styles.qtyButtonTextSmall}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.qtyButton,
                    { backgroundColor: colors.primary },
                    selectedQty === 0 && { backgroundColor: colors.border },
                  ]}
                  onPress={() => onSelect(stack.resourceId, Math.max(0, selectedQty - 1))}
                  disabled={selectedQty === 0}
                >
                  <Text style={styles.qtyButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={[styles.qtyDisplay, { color: colors.textPrimary }]}>
                  {selectedQty}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.qtyButton,
                    { backgroundColor: colors.primary },
                    selectedQty >= maxSelectable && { backgroundColor: colors.border },
                  ]}
                  onPress={() =>
                    onSelect(stack.resourceId, Math.min(maxSelectable, selectedQty + 1))
                  }
                  disabled={selectedQty >= maxSelectable}
                >
                  <Text style={styles.qtyButtonText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.qtyButtonSmall,
                    { backgroundColor: colors.primaryDark },
                    selectedQty >= maxSelectable && { backgroundColor: colors.border },
                  ]}
                  onPress={() =>
                    onSelect(stack.resourceId, Math.min(maxSelectable, selectedQty + 10))
                  }
                  disabled={selectedQty >= maxSelectable}
                >
                  <Text style={styles.qtyButtonTextSmall}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.qtyButtonSmall,
                    { backgroundColor: colors.primaryDark },
                    selectedQty >= maxSelectable && { backgroundColor: colors.border },
                  ]}
                  onPress={() => onSelect(stack.resourceId, maxSelectable)}
                  disabled={selectedQty >= maxSelectable}
                >
                  <Text style={styles.qtyButtonTextSmall}>Max</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

// Inner content component that resets state on mount
function TechResourceModalContent({
  onClose,
  onConfirm,
  techName,
  resourceCosts,
  availableMaterials,
}: Omit<TechResourceModalProps, 'visible'>) {
  const { theme } = useTheme();
  const { colors } = theme;

  // Dynamic selected materials state
  const [selectedMaterials, setSelectedMaterials] = useState<
    Partial<Record<MaterialType, { resourceId: string; quantity: number }[]>>
  >({});

  // Get required material types from costs
  const requiredMaterialTypes = getAllMaterialTypes().filter((type) =>
    resourceCosts.some((c) => c.resourceType === type && c.quantity > 0)
  );

  // Get cost for a material type
  const getCostForType = (type: MaterialType): number => {
    return resourceCosts.find((c) => c.resourceType === type)?.quantity || 0;
  };

  // Handle material selection for any type
  const handleMaterialSelect = (type: MaterialType, resourceId: string, quantity: number) => {
    setSelectedMaterials((prev) => {
      const currentSelections = prev[type] || [];
      const filtered = currentSelections.filter((s) => s.resourceId !== resourceId);
      if (quantity > 0) {
        return { ...prev, [type]: [...filtered, { resourceId, quantity }] };
      }
      return { ...prev, [type]: filtered };
    });
  };

  // Calculate total selected for each type and check if can confirm
  const canConfirm = requiredMaterialTypes.every((type) => {
    const cost = getCostForType(type);
    const selected = selectedMaterials[type] || [];
    const totalSelected = selected.reduce((sum, s) => sum + s.quantity, 0);
    return cost === 0 || totalSelected === cost;
  });

  const handleConfirm = () => {
    // Filter out empty selections
    const materials: Partial<Record<MaterialType, { resourceId: string; quantity: number }[]>> = {};
    for (const type of requiredMaterialTypes) {
      const selected = selectedMaterials[type] || [];
      const filtered = selected.filter((s) => s.quantity > 0);
      if (filtered.length > 0) {
        materials[type] = filtered;
      }
    }
    onConfirm({ materials });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeButtonText, { color: colors.cheat }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Research {techName}</Text>
        <View style={styles.closeButton} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={[styles.instructionText, { color: colors.textTertiary }]}>
          Select which materials to spend on this research:
        </Text>

        {requiredMaterialTypes.map((type) => {
          const cost = getCostForType(type);
          if (cost === 0) return null;

          return (
            <MaterialPicker
              key={type}
              type={type}
              required={cost}
              stacks={availableMaterials[type] || []}
              selected={selectedMaterials[type] || []}
              onSelect={(resourceId, quantity) => handleMaterialSelect(type, resourceId, quantity)}
              colors={colors}
            />
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            { backgroundColor: colors.primary },
            !canConfirm && { backgroundColor: colors.border },
          ]}
          onPress={handleConfirm}
          disabled={!canConfirm}
        >
          <Text style={[styles.confirmButtonText, !canConfirm && { color: colors.textTertiary }]}>
            Research
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Wrapper component that handles the Modal
export default function TechResourceModal({
  visible,
  onClose,
  onConfirm,
  techName,
  resourceCosts,
  availableMaterials,
}: TechResourceModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible && (
        <TechResourceModalContent
          onClose={onClose}
          onConfirm={onConfirm}
          techName={techName}
          resourceCosts={resourceCosts}
          availableMaterials={availableMaterials}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 60,
  },
  closeButtonText: {
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  instructionText: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 12,
  },
  completeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  materialSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 12,
    borderWidth: 1,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '500',
  },
  materialAvailable: {
    fontSize: 11,
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonSmall: {
    paddingHorizontal: 6,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  qtyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  qtyButtonTextSmall: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  qtyDisplay: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  confirmButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
