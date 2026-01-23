// TechUnlockedModal - Shows details of an unlocked technology
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Technology, ERA_COLORS, ERA_NAMES } from '../types/tech';
import { TECH_BY_ID } from '../data/techTree';
import { getToolById, getComponentById } from '../data/tools';
import { useTheme } from '../hooks/useTheme';

interface TechUnlockedModalProps {
  visible: boolean;
  onClose: () => void;
  tech: Technology;
}

// Get display info for a recipe (tool or component)
function getRecipeInfo(recipeId: string): { name: string; description: string } | null {
  const tool = getToolById(recipeId);
  if (tool) {
    return { name: tool.name, description: tool.description };
  }
  const component = getComponentById(recipeId);
  if (component) {
    return { name: component.name, description: component.description };
  }
  return null;
}

export default function TechUnlockedModal({ visible, onClose, tech }: TechUnlockedModalProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const enabledRecipes = tech.enablesRecipes
    .map((id) => ({ id, ...getRecipeInfo(id) }))
    .filter((r): r is { id: string; name: string; description: string } => r.name !== undefined);

  const unlockedTechs = tech.unlocks
    .map((id) => TECH_BY_ID[id])
    .filter((t): t is Technology => t !== undefined);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: ERA_COLORS[tech.era] }]}>
              <Text style={styles.eraLabel}>{ERA_NAMES[tech.era]}</Text>
              <Text style={styles.techName}>{tech.name}</Text>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Description */}
              <View style={styles.section}>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {tech.description}
                </Text>
              </View>

              {/* Enabled Recipes */}
              {enabledRecipes.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
                    Enabled Recipes
                  </Text>
                  {enabledRecipes.map((recipe) => (
                    <View
                      key={recipe.id}
                      style={[styles.itemCard, { backgroundColor: colors.surfaceSecondary }]}
                    >
                      <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                        {recipe.name}
                      </Text>
                      <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                        {recipe.description}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Unlocked Technologies */}
              {unlockedTechs.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
                    Unlocks Technologies
                  </Text>
                  {unlockedTechs.map((unlockedTech) => (
                    <View
                      key={unlockedTech.id}
                      style={[styles.itemCard, { backgroundColor: colors.surfaceSecondary }]}
                    >
                      <View style={styles.techHeader}>
                        <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                          {unlockedTech.name}
                        </Text>
                        <View
                          style={[
                            styles.eraBadge,
                            { backgroundColor: ERA_COLORS[unlockedTech.era] },
                          ]}
                        >
                          <Text style={styles.eraBadgeText}>{ERA_NAMES[unlockedTech.era]}</Text>
                        </View>
                      </View>
                      <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                        {unlockedTech.description}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* No unlocks message */}
              {enabledRecipes.length === 0 && unlockedTechs.length === 0 && (
                <View style={styles.section}>
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                    This technology is a stepping stone to more advanced techniques.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.closeButtonText, { color: colors.textPrimary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  eraLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  techName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  itemCard: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  techHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    flex: 1,
  },
  itemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  eraBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  eraBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  closeButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
