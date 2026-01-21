// Crafting Screen - Tool and component crafting interface
// Updated for lithic era material selection system

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useGameState } from '../hooks/useGameState';
import { CraftCheckResult } from '../services/CraftingService';
import {
  TOOLS,
  COMPONENTS,
  getToolById,
  isCraftingTool,
  isGatheringTool,
  getToolTypeLabels,
  getComponentById,
} from '../data/tools';
import {
  Tool,
  CraftedComponent,
  OwnedTool,
  OwnedComponent,
  getQualityTier,
  calculateGatheringBonus,
  getUsedMaterialId,
} from '../types/tools';
import { ERA_COLORS, ERA_LABELS } from '../types/tech';
import { getMaterialConfig, getAllMaterialTypes, getMaterialIcon } from '../config/materials';
import MaterialSelectionModal, { MaterialSelection } from '../components/MaterialSelectionModal';
import { getQualityColor, getQualityDisplayName } from '../utils/qualityCalculation';

type TabType = 'owned' | 'tools' | 'components';

interface OwnedToolItemProps {
  owned: OwnedTool;
}

function OwnedToolItem({ owned }: OwnedToolItemProps) {
  const tool = getToolById(owned.toolId);
  if (!tool) return null;

  const qualityTier = getQualityTier(owned.quality);
  const qualityColor = getQualityColor(qualityTier);
  const gatheringBonus = calculateGatheringBonus(tool, owned.quality);

  return (
    <View style={styles.ownedToolItem}>
      <View style={styles.toolInfo}>
        <View style={styles.toolNameRow}>
          <View style={[styles.qualityBadge, { backgroundColor: qualityColor }]}>
            <Text style={styles.qualityBadgeText}>{getQualityDisplayName(qualityTier)}</Text>
          </View>
          <Text style={styles.qualityPercent}>{Math.round(owned.quality * 100)}%</Text>
          {gatheringBonus > 0 && (
            <Text style={styles.gatheringBonus}>+{gatheringBonus.toFixed(1)}</Text>
          )}
        </View>

        {/* Materials used - dynamically rendered */}
        <View style={styles.materialsRow}>
          {getAllMaterialTypes().map((materialType) => {
            const materialId = getUsedMaterialId(owned.materials, materialType);
            if (!materialId) return null;
            const config = getMaterialConfig(materialType);
            const material = config.getResourceById(materialId);
            return (
              <View key={materialType} style={styles.materialTag}>
                <View
                  style={[styles.materialSwatch, { backgroundColor: material?.color || '#888' }]}
                />
                <Text style={styles.materialTagText}>{material?.name || materialId}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Badge showing tool type (Crafting/Gathering) */
function ToolTypeBadge({ toolId }: { toolId: string }) {
  const labels = getToolTypeLabels(toolId);
  if (labels.length === 0) return null;

  return (
    <View style={styles.toolTypeRow}>
      {labels.map((label) => (
        <View
          key={label}
          style={[
            styles.toolTypeBadge,
            label === 'Crafting' ? styles.toolTypeCrafting : styles.toolTypeGathering,
          ]}
        >
          <Text style={styles.toolTypeBadgeText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

interface OwnedComponentItemProps {
  component: OwnedComponent;
}

function OwnedComponentItem({ component }: OwnedComponentItemProps) {
  const componentDef = getComponentById(component.componentId);
  if (!componentDef) return null;

  const qualityPercent = Math.round(component.quality * 100);

  return (
    <View style={styles.ownedComponentItem}>
      <View style={[styles.eraBadge, { backgroundColor: ERA_COLORS[componentDef.era] }]}>
        <Text style={styles.eraText}>{ERA_LABELS[componentDef.era]}</Text>
      </View>
      <View style={styles.componentInfo}>
        <Text style={styles.componentName}>{componentDef.name}</Text>
        <View style={styles.materialsRow}>
          {/* Display used materials dynamically */}
          {getAllMaterialTypes().map((materialType) => {
            const materialId = getUsedMaterialId(component.materials, materialType);
            if (!materialId) return null;
            const config = getMaterialConfig(materialType);
            const material = config.getResourceById(materialId);
            return (
              <View key={materialType} style={styles.materialTag}>
                <View
                  style={[styles.materialSwatch, { backgroundColor: material?.color || '#888' }]}
                />
                <Text style={styles.materialTagText}>{material?.name || materialId}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <Text style={styles.componentQualityText}>{qualityPercent}%</Text>
    </View>
  );
}

interface ToolRecipeItemProps {
  tool: Tool;
  craftCheck: CraftCheckResult;
  onCraft: () => void;
}

function ToolRecipeItem({ tool, craftCheck, onCraft }: ToolRecipeItemProps) {
  return (
    <View style={styles.recipeItem}>
      <View style={[styles.eraBadge, { backgroundColor: ERA_COLORS[tool.era] }]}>
        <Text style={styles.eraText}>{ERA_LABELS[tool.era]}</Text>
      </View>
      <View style={styles.recipeInfo}>
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeName}>{tool.name}</Text>
          <ToolTypeBadge toolId={tool.id} />
        </View>
        <Text style={styles.recipeDescription} numberOfLines={2}>
          {tool.description}
        </Text>
        <View style={styles.requirementsContainer}>
          {tool.requiredTools.length > 0 && (
            <Text style={styles.requirementLabel}>
              Tools: {tool.requiredTools.map((id) => id.replace(/_/g, ' ')).join(', ')}
            </Text>
          )}
          {tool.requiredComponents.length > 0 && (
            <Text style={styles.requirementLabel}>
              Components:{' '}
              {tool.requiredComponents
                .map((c) => `${c.quantity}x ${c.componentId.replace(/_/g, ' ')}`)
                .join(', ')}
            </Text>
          )}
          {(tool.materials.stone || tool.materials.wood) && (
            <Text style={styles.requirementLabel}>
              Materials:{' '}
              {[
                tool.materials.stone &&
                  `${tool.materials.stone.quantity}x stone${tool.materials.stone.requiresToolstone ? ' (toolstone)' : ''}`,
                tool.materials.wood && `${tool.materials.wood.quantity}x wood`,
              ]
                .filter(Boolean)
                .join(', ')}
            </Text>
          )}
        </View>
        {craftCheck.missingRequirements.length > 0 && (
          <View style={styles.missingContainer}>
            <Text style={styles.missingLabel}>Missing:</Text>
            {craftCheck.missingRequirements.map((req, i) => (
              <Text key={i} style={styles.missingText}>
                {req}
              </Text>
            ))}
          </View>
        )}
      </View>
      <TouchableOpacity
        style={[styles.craftButton, !craftCheck.canCraft && styles.craftButtonDisabled]}
        onPress={onCraft}
        disabled={!craftCheck.canCraft}
      >
        <Text
          style={[styles.craftButtonText, !craftCheck.canCraft && styles.craftButtonTextDisabled]}
        >
          Craft
        </Text>
      </TouchableOpacity>
    </View>
  );
}

interface ComponentRecipeItemProps {
  component: CraftedComponent;
  craftCheck: CraftCheckResult;
  ownedCount: number;
  onCraft: () => void;
}

function ComponentRecipeItem({
  component,
  craftCheck,
  ownedCount,
  onCraft,
}: ComponentRecipeItemProps) {
  return (
    <View style={styles.recipeItem}>
      <View style={[styles.eraBadge, { backgroundColor: ERA_COLORS[component.era] }]}>
        <Text style={styles.eraText}>{ERA_LABELS[component.era]}</Text>
      </View>
      <View style={styles.recipeInfo}>
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeName}>{component.name}</Text>
          {ownedCount > 0 && <Text style={styles.ownedCount}>x{ownedCount}</Text>}
        </View>
        <Text style={styles.recipeDescription} numberOfLines={2}>
          {component.description}
        </Text>
        <View style={styles.requirementsContainer}>
          {component.requiredTools.length > 0 && (
            <Text style={styles.requirementLabel}>
              Tools: {component.requiredTools.map((id) => id.replace(/_/g, ' ')).join(', ')}
            </Text>
          )}
          {(component.materials.stone || component.materials.wood) && (
            <Text style={styles.requirementLabel}>
              Materials:{' '}
              {[
                component.materials.stone && `${component.materials.stone.quantity}x stone`,
                component.materials.wood && `${component.materials.wood.quantity}x wood`,
              ]
                .filter(Boolean)
                .join(', ')}
            </Text>
          )}
        </View>
        {craftCheck.missingRequirements.length > 0 && (
          <View style={styles.missingContainer}>
            <Text style={styles.missingLabel}>Missing:</Text>
            {craftCheck.missingRequirements.map((req, i) => (
              <Text key={i} style={styles.missingText}>
                {req}
              </Text>
            ))}
          </View>
        )}
      </View>
      <TouchableOpacity
        style={[styles.craftButton, !craftCheck.canCraft && styles.craftButtonDisabled]}
        onPress={onCraft}
        disabled={!craftCheck.canCraft}
      >
        <Text
          style={[styles.craftButtonText, !craftCheck.canCraft && styles.craftButtonTextDisabled]}
        >
          Craft
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CraftingScreen() {
  const { state, canCraft, craft, hasTech, getOwnedComponents } = useGameState();
  const [activeTab, setActiveTab] = useState<TabType>('owned');

  // Modal state - stores the actual craftable object instead of just id/type
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<{
    craftable: Tool | CraftedComponent;
    craftCheck: CraftCheckResult;
  } | null>(null);

  // Unified handler for crafting any craftable (tool or component)
  // Always shows material selection modal as a confirmation prompt
  const handleCraft = (craftable: Tool | CraftedComponent) => {
    const craftCheck = canCraft(craftable);
    if (!craftCheck.canCraft) return;

    setSelectedRecipe({ craftable, craftCheck });
    setModalVisible(true);
  };

  const handleMaterialConfirm = (selection: MaterialSelection) => {
    if (!selectedRecipe) return;

    setModalVisible(false);
    const { craftable } = selectedRecipe;

    const result = craft({
      craftable,
      selectedMaterials: selection.selectedMaterials,
      selectedComponentIds: selection.componentIds,
    });

    if (result.success) {
      Alert.alert('Success', `Crafted ${craftable.name}!`);
    } else {
      Alert.alert('Failed', result.error || 'Could not craft.');
    }

    setSelectedRecipe(null);
  };

  // Filter tools by unlocked tech
  const availableTools = TOOLS.filter((tool) => hasTech(tool.requiredTech));
  const availableComponents = COMPONENTS.filter((comp) => hasTech(comp.requiredTech));

  // Track which tool groups are expanded (collapsed by default)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroupExpanded = (toolId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const renderOwnedTools = () => {
    // Split owned tools into crafting and gathering categories
    const craftingTools = state.ownedTools.filter((owned) => isCraftingTool(owned.toolId));
    const gatheringTools = state.ownedTools.filter((owned) => isGatheringTool(owned.toolId));

    // Group tools by toolId and sort by quality (highest first)
    const groupToolsByType = (tools: OwnedTool[]) => {
      const groups = new Map<string, OwnedTool[]>();
      for (const tool of tools) {
        const existing = groups.get(tool.toolId) || [];
        existing.push(tool);
        groups.set(tool.toolId, existing);
      }
      // Sort each group by quality (highest first)
      for (const [, group] of groups) {
        group.sort((a, b) => b.quality - a.quality);
      }
      // Sort groups by highest quality tool
      return Array.from(groups.entries()).sort((a, b) => {
        return b[1][0].quality - a[1][0].quality;
      });
    };

    const craftingGroups = groupToolsByType(craftingTools);
    const gatheringGroups = groupToolsByType(gatheringTools);

    const renderToolGroup = (toolId: string, tools: OwnedTool[]) => {
      const toolDef = getToolById(toolId);
      const count = tools.length;
      const isExpanded = expandedGroups.has(toolId);
      const bestTool = tools[0]; // First is best (sorted by quality)
      const bestQualityTier = getQualityTier(bestTool.quality);
      const bestQualityColor = getQualityColor(bestQualityTier);
      const gatheringBonus = toolDef ? calculateGatheringBonus(toolDef, bestTool.quality) : 0;

      return (
        <View key={toolId} style={styles.toolGroup}>
          <TouchableOpacity
            style={styles.toolGroupHeader}
            onPress={() => toggleGroupExpanded(toolId)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.eraBadge,
                { backgroundColor: ERA_COLORS[toolDef?.era || 'lower_paleolithic'] },
              ]}
            >
              <Text style={styles.eraText}>{ERA_LABELS[toolDef?.era || 'lower_paleolithic']}</Text>
            </View>
            <View style={styles.toolGroupInfo}>
              <View style={styles.toolGroupNameRow}>
                <Text style={styles.toolGroupName}>{toolDef?.name || toolId}</Text>
                {count > 1 && <Text style={styles.toolGroupCount}>x{count}</Text>}
              </View>
              <View style={styles.toolGroupSummary}>
                <View style={[styles.qualityBadgeSmall, { backgroundColor: bestQualityColor }]}>
                  <Text style={styles.qualityBadgeTextSmall}>
                    {getQualityDisplayName(bestQualityTier)}
                  </Text>
                </View>
                {gatheringBonus > 0 && toolDef?.gatheringMaterial && (
                  <>
                    <Text style={styles.gatheringBonusSmall}>+{gatheringBonus.toFixed(1)}</Text>
                    <Text style={styles.gatheringMaterialSmall}>
                      {getMaterialIcon(toolDef.gatheringMaterial)}
                    </Text>
                  </>
                )}
              </View>
            </View>
            <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>
          {isExpanded &&
            tools.map((owned) => <OwnedToolItem key={owned.instanceId} owned={owned} />)}
        </View>
      );
    };

    return (
      <View style={styles.section}>
        {/* Crafting Tools */}
        <Text style={styles.sectionTitle}>
          Crafting Tools ({craftingGroups.length} {craftingGroups.length === 1 ? 'type' : 'types'})
        </Text>
        <Text style={styles.sectionSubtitle}>Used as prerequisites for other tools</Text>
        {craftingGroups.length === 0 ? (
          <Text style={styles.emptyText}>No crafting tools yet.</Text>
        ) : (
          craftingGroups.map(([toolId, tools]) => renderToolGroup(toolId, tools))
        )}

        {/* Gathering Tools */}
        <Text style={[styles.sectionTitle, styles.sectionTitleMarginTop]}>
          Gathering Tools ({gatheringGroups.length}{' '}
          {gatheringGroups.length === 1 ? 'type' : 'types'})
        </Text>
        <Text style={styles.sectionSubtitle}>Provide bonuses when gathering resources</Text>
        {gatheringGroups.length === 0 ? (
          <Text style={styles.emptyText}>No gathering tools yet.</Text>
        ) : (
          gatheringGroups.map(([toolId, tools]) => renderToolGroup(toolId, tools))
        )}

        {/* Components inventory */}
        <Text style={[styles.sectionTitle, styles.sectionTitleMarginTop]}>
          Components ({state.ownedComponents.length})
        </Text>
        {state.ownedComponents.length === 0 ? (
          <Text style={styles.emptyText}>No components crafted yet.</Text>
        ) : (
          state.ownedComponents.map((comp) => (
            <OwnedComponentItem key={comp.instanceId} component={comp} />
          ))
        )}
      </View>
    );
  };

  const renderToolRecipes = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tool Recipes ({availableTools.length})</Text>
      {availableTools.length === 0 ? (
        <Text style={styles.emptyText}>Research more tech to unlock tool recipes.</Text>
      ) : (
        availableTools.map((tool) => {
          const craftCheck = canCraft(tool);
          return (
            <ToolRecipeItem
              key={tool.id}
              tool={tool}
              craftCheck={craftCheck}
              onCraft={() => handleCraft(tool)}
            />
          );
        })
      )}
    </View>
  );

  const renderComponentRecipes = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Component Recipes ({availableComponents.length})</Text>
      {availableComponents.length === 0 ? (
        <Text style={styles.emptyText}>Research more tech to unlock component recipes.</Text>
      ) : (
        availableComponents.map((comp) => {
          const craftCheck = canCraft(comp);
          const ownedCount = getOwnedComponents(comp.id).length;
          return (
            <ComponentRecipeItem
              key={comp.id}
              component={comp}
              craftCheck={craftCheck}
              ownedCount={ownedCount}
              onCraft={() => handleCraft(comp)}
            />
          );
        })
      )}
    </View>
  );

  // Get modal props - unified for both tools and components
  const getModalProps = () => {
    if (!selectedRecipe) return null;
    const { craftable, craftCheck } = selectedRecipe;

    return {
      title: `Craft ${craftable.name}`,
      craftable,
      availableMaterials: craftCheck.availableMaterials,
      availableComponentIds: craftCheck.availableComponents,
    };
  };

  const modalProps = getModalProps();

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'owned' && styles.tabActive]}
          onPress={() => setActiveTab('owned')}
        >
          <Text style={[styles.tabText, activeTab === 'owned' && styles.tabTextActive]}>Owned</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tools' && styles.tabActive]}
          onPress={() => setActiveTab('tools')}
        >
          <Text style={[styles.tabText, activeTab === 'tools' && styles.tabTextActive]}>Tools</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'components' && styles.tabActive]}
          onPress={() => setActiveTab('components')}
        >
          <Text style={[styles.tabText, activeTab === 'components' && styles.tabTextActive]}>
            Components
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {activeTab === 'owned' && renderOwnedTools()}
        {activeTab === 'tools' && renderToolRecipes()}
        {activeTab === 'components' && renderComponentRecipes()}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Material Selection Modal */}
      {modalProps && (
        <MaterialSelectionModal
          visible={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setSelectedRecipe(null);
          }}
          onConfirm={handleMaterialConfirm}
          {...modalProps}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
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
  sectionTitleMarginTop: {
    marginTop: 20,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: -12,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  ownedToolItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  toolGroup: {
    marginBottom: 8,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    overflow: 'hidden',
  },
  toolGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  toolGroupInfo: {
    flex: 1,
    marginLeft: 10,
  },
  toolGroupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolGroupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  toolGroupCount: {
    fontSize: 12,
    color: '#888',
    marginLeft: 6,
  },
  toolGroupSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 10,
    color: '#888',
    marginLeft: 8,
  },
  qualityBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  qualityBadgeTextSmall: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  gatheringBonusSmall: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 6,
  },
  gatheringMaterialSmall: {
    fontSize: 10,
    marginLeft: 2,
  },
  ownedComponentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  eraBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eraText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  toolInfo: {
    flex: 1,
  },
  componentInfo: {
    flex: 1,
  },
  toolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  componentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  qualityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  qualityBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  materialsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  materialTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 2,
  },
  materialSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  materialTagText: {
    fontSize: 10,
    color: '#666',
  },
  gatheringBonus: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 8,
  },
  qualityPercent: {
    fontSize: 10,
    color: '#888',
    marginLeft: 6,
  },
  componentQualityText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  recipeItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recipeInfo: {
    flex: 1,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  toolTypeRow: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  toolTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  toolTypeCrafting: {
    backgroundColor: '#7E57C2',
  },
  toolTypeGathering: {
    backgroundColor: '#26A69A',
  },
  toolTypeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  ownedCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 8,
  },
  recipeDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  requirementsContainer: {
    marginTop: 8,
  },
  requirementLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  missingContainer: {
    marginTop: 6,
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 6,
  },
  missingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 2,
  },
  missingText: {
    fontSize: 10,
    color: '#F57C00',
  },
  craftButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 10,
    alignSelf: 'center',
  },
  craftButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  craftButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  craftButtonTextDisabled: {
    color: '#999',
  },
  bottomPadding: {
    height: 30,
  },
});
