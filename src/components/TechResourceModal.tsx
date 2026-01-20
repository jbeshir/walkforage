// TechResourceModal - Select specific materials to spend on tech research
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TechResourceCost } from '../types/tech';
import { ResourceStack } from '../types/resources';
import { MaterialType } from '../types/tools';
import { STONES_BY_ID } from '../data/stones';
import { WOODS_BY_ID } from '../data/woods';

export interface ResourceSelection {
  stone: { resourceId: string; quantity: number }[];
  wood: { resourceId: string; quantity: number }[];
}

interface TechResourceModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selection: ResourceSelection) => void;
  techName: string;
  resourceCosts: TechResourceCost[];
  availableStones: ResourceStack[];
  availableWoods: ResourceStack[];
}

interface MaterialPickerProps {
  type: MaterialType;
  required: number;
  stacks: ResourceStack[];
  selected: { resourceId: string; quantity: number }[];
  onSelect: (resourceId: string, quantity: number) => void;
}

function MaterialPicker({ type, required, stacks, selected, onSelect }: MaterialPickerProps) {
  const lookup = type === 'stone' ? STONES_BY_ID : WOODS_BY_ID;
  const icon = type === 'stone' ? '🪨' : '🪵';

  const totalSelected = selected.reduce((sum, s) => sum + s.quantity, 0);
  const remaining = required - totalSelected;

  return (
    <View style={styles.pickerSection}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>
          {icon} {type === 'stone' ? 'Stone' : 'Wood'}: {totalSelected}/{required}
        </Text>
        {remaining > 0 && <Text style={styles.remainingText}>Need {remaining} more</Text>}
        {remaining === 0 && <Text style={styles.completeText}>Complete</Text>}
      </View>

      {stacks.length === 0 ? (
        <Text style={styles.emptyText}>No {type} available</Text>
      ) : (
        stacks.map((stack) => {
          const material = lookup[stack.resourceId];
          const selectedItem = selected.find((s) => s.resourceId === stack.resourceId);
          const selectedQty = selectedItem?.quantity || 0;
          const maxSelectable = Math.min(stack.quantity, selectedQty + remaining);

          return (
            <View key={stack.resourceId} style={styles.materialRow}>
              <View
                style={[styles.materialSwatch, { backgroundColor: material?.color || '#888' }]}
              />
              <View style={styles.materialInfo}>
                <Text style={styles.materialName}>{material?.name || stack.resourceId}</Text>
                <Text style={styles.materialAvailable}>Available: {stack.quantity}</Text>
              </View>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={[styles.qtyButtonSmall, selectedQty === 0 && styles.qtyButtonDisabled]}
                  onPress={() => onSelect(stack.resourceId, 0)}
                  disabled={selectedQty === 0}
                >
                  <Text style={styles.qtyButtonTextSmall}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.qtyButtonSmall, selectedQty === 0 && styles.qtyButtonDisabled]}
                  onPress={() => onSelect(stack.resourceId, Math.max(0, selectedQty - 10))}
                  disabled={selectedQty === 0}
                >
                  <Text style={styles.qtyButtonTextSmall}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.qtyButton, selectedQty === 0 && styles.qtyButtonDisabled]}
                  onPress={() => onSelect(stack.resourceId, Math.max(0, selectedQty - 1))}
                  disabled={selectedQty === 0}
                >
                  <Text style={styles.qtyButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyDisplay}>{selectedQty}</Text>
                <TouchableOpacity
                  style={[
                    styles.qtyButton,
                    selectedQty >= maxSelectable && styles.qtyButtonDisabled,
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
                    selectedQty >= maxSelectable && styles.qtyButtonDisabled,
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
                    selectedQty >= maxSelectable && styles.qtyButtonDisabled,
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
  availableStones,
  availableWoods,
}: Omit<TechResourceModalProps, 'visible'>) {
  const [selectedStones, setSelectedStones] = useState<{ resourceId: string; quantity: number }[]>(
    []
  );
  const [selectedWoods, setSelectedWoods] = useState<{ resourceId: string; quantity: number }[]>(
    []
  );

  const stoneCost = resourceCosts.find((c) => c.resourceType === 'stone')?.quantity || 0;
  const woodCost = resourceCosts.find((c) => c.resourceType === 'wood')?.quantity || 0;

  const handleStoneSelect = (resourceId: string, quantity: number) => {
    setSelectedStones((prev) => {
      const filtered = prev.filter((s) => s.resourceId !== resourceId);
      if (quantity > 0) {
        return [...filtered, { resourceId, quantity }];
      }
      return filtered;
    });
  };

  const handleWoodSelect = (resourceId: string, quantity: number) => {
    setSelectedWoods((prev) => {
      const filtered = prev.filter((s) => s.resourceId !== resourceId);
      if (quantity > 0) {
        return [...filtered, { resourceId, quantity }];
      }
      return filtered;
    });
  };

  const totalStoneSelected = selectedStones.reduce((sum, s) => sum + s.quantity, 0);
  const totalWoodSelected = selectedWoods.reduce((sum, s) => sum + s.quantity, 0);

  const canConfirm =
    (stoneCost === 0 || totalStoneSelected === stoneCost) &&
    (woodCost === 0 || totalWoodSelected === woodCost);

  const handleConfirm = () => {
    onConfirm({
      stone: selectedStones.filter((s) => s.quantity > 0),
      wood: selectedWoods.filter((s) => s.quantity > 0),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Research {techName}</Text>
        <View style={styles.closeButton} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.instructionText}>
          Select which materials to spend on this research:
        </Text>

        {stoneCost > 0 && (
          <MaterialPicker
            type="stone"
            required={stoneCost}
            stacks={availableStones}
            selected={selectedStones}
            onSelect={handleStoneSelect}
          />
        )}

        {woodCost > 0 && (
          <MaterialPicker
            type="wood"
            required={woodCost}
            stacks={availableWoods}
            selected={selectedWoods}
            onSelect={handleWoodSelect}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm}
        >
          <Text style={[styles.confirmButtonText, !canConfirm && styles.confirmButtonTextDisabled]}>
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
  availableStones,
  availableWoods,
}: TechResourceModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible && (
        <TechResourceModalContent
          onClose={onClose}
          onConfirm={onConfirm}
          techName={techName}
          resourceCosts={resourceCosts}
          availableStones={availableStones}
          availableWoods={availableWoods}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    width: 60,
  },
  closeButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  instructionText: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerSection: {
    backgroundColor: '#2a2a2a',
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
    borderBottomColor: '#444',
    paddingBottom: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  remainingText: {
    fontSize: 12,
    color: '#FF9800',
  },
  completeText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  materialSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  materialAvailable: {
    fontSize: 11,
    color: '#888',
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
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonSmall: {
    paddingHorizontal: 6,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#3d8b40',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  qtyButtonDisabled: {
    backgroundColor: '#444',
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
    color: '#fff',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#444',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonTextDisabled: {
    color: '#888',
  },
});
