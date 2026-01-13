// Crafting Screen - Tool and component crafting interface
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useGameState } from '../hooks/useGameState';
import { TOOLS, COMPONENTS, getToolById, getComponentById } from '../data/tools';
import { Tool, CraftedComponent, OwnedTool, MaterialTier } from '../types/tools';

type TabType = 'owned' | 'tools' | 'components';

const TIER_COLORS: Record<MaterialTier, string> = {
  primitive: '#8B7355',
  stone: '#708090',
  copper: '#B87333',
  bronze: '#CD7F32',
  iron: '#434343',
  steel: '#71797E',
};

interface OwnedToolItemProps {
  owned: OwnedTool;
  onRepair: (instanceId: string) => void;
}

function OwnedToolItem({ owned, onRepair }: OwnedToolItemProps) {
  const tool = getToolById(owned.toolId);
  if (!tool) return null;

  const durabilityPercent = (owned.currentDurability / tool.stats.maxDurability) * 100;
  const durabilityColor =
    durabilityPercent > 50 ? '#4CAF50' :
    durabilityPercent > 25 ? '#FF9800' : '#F44336';

  return (
    <View style={styles.ownedToolItem}>
      <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[tool.tier] }]}>
        <Text style={styles.tierText}>{tool.tier.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.toolInfo}>
        <Text style={styles.toolName}>{tool.name}</Text>
        <Text style={styles.qualityText}>Quality: {owned.quality}</Text>
        <View style={styles.durabilityBar}>
          <View
            style={[
              styles.durabilityFill,
              { width: `${durabilityPercent}%`, backgroundColor: durabilityColor },
            ]}
          />
        </View>
        <Text style={styles.durabilityText}>
          {Math.round(owned.currentDurability)} / {tool.stats.maxDurability}
        </Text>
      </View>
      {tool.stats.canRepair && durabilityPercent < 100 && (
        <TouchableOpacity
          style={styles.repairButton}
          onPress={() => onRepair(owned.instanceId)}
        >
          <Text style={styles.repairButtonText}>Repair</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface ToolRecipeItemProps {
  tool: Tool;
  canCraft: boolean;
  missingRequirements: string[];
  onCraft: () => void;
}

function ToolRecipeItem({ tool, canCraft, missingRequirements, onCraft }: ToolRecipeItemProps) {
  return (
    <View style={styles.recipeItem}>
      <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[tool.tier] }]}>
        <Text style={styles.tierText}>{tool.tier.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.recipeInfo}>
        <Text style={styles.recipeName}>{tool.name}</Text>
        <Text style={styles.recipeDescription} numberOfLines={2}>
          {tool.description}
        </Text>
        <View style={styles.requirementsContainer}>
          {tool.requiredTools.length > 0 && (
            <Text style={styles.requirementLabel}>
              Tools: {tool.requiredTools.map(r => r.toolId.replace(/_/g, ' ')).join(', ')}
            </Text>
          )}
          {tool.requiredComponents.length > 0 && (
            <Text style={styles.requirementLabel}>
              Components: {tool.requiredComponents.map(c => `${c.quantity}x ${c.componentId.replace(/_/g, ' ')}`).join(', ')}
            </Text>
          )}
          {tool.materials.length > 0 && (
            <Text style={styles.requirementLabel}>
              Materials: {tool.materials.map(m => `${m.quantity}x ${m.resourceId.replace(/_/g, ' ')}`).join(', ')}
            </Text>
          )}
        </View>
        {missingRequirements.length > 0 && (
          <View style={styles.missingContainer}>
            <Text style={styles.missingLabel}>Missing:</Text>
            {missingRequirements.map((req, i) => (
              <Text key={i} style={styles.missingText}>{req}</Text>
            ))}
          </View>
        )}
      </View>
      <TouchableOpacity
        style={[styles.craftButton, !canCraft && styles.craftButtonDisabled]}
        onPress={onCraft}
        disabled={!canCraft}
      >
        <Text style={[styles.craftButtonText, !canCraft && styles.craftButtonTextDisabled]}>
          Craft
        </Text>
      </TouchableOpacity>
    </View>
  );
}

interface ComponentRecipeItemProps {
  component: CraftedComponent;
  canCraft: boolean;
  missingRequirements: string[];
  ownedCount: number;
  onCraft: () => void;
}

function ComponentRecipeItem({ component, canCraft, missingRequirements, ownedCount, onCraft }: ComponentRecipeItemProps) {
  return (
    <View style={styles.recipeItem}>
      <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[component.tier] }]}>
        <Text style={styles.tierText}>{component.tier.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.recipeInfo}>
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeName}>{component.name}</Text>
          {ownedCount > 0 && (
            <Text style={styles.ownedCount}>x{ownedCount}</Text>
          )}
        </View>
        <Text style={styles.recipeDescription} numberOfLines={2}>
          {component.description}
        </Text>
        <View style={styles.requirementsContainer}>
          {component.requiredTools.length > 0 && (
            <Text style={styles.requirementLabel}>
              Tools: {component.requiredTools.map(r => r.toolId.replace(/_/g, ' ')).join(', ')}
            </Text>
          )}
          {component.materials.length > 0 && (
            <Text style={styles.requirementLabel}>
              Materials: {component.materials.map(m => `${m.quantity}x ${m.resourceId.replace(/_/g, ' ')}`).join(', ')}
            </Text>
          )}
        </View>
        {missingRequirements.length > 0 && (
          <View style={styles.missingContainer}>
            <Text style={styles.missingLabel}>Missing:</Text>
            {missingRequirements.map((req, i) => (
              <Text key={i} style={styles.missingText}>{req}</Text>
            ))}
          </View>
        )}
      </View>
      <TouchableOpacity
        style={[styles.craftButton, !canCraft && styles.craftButtonDisabled]}
        onPress={onCraft}
        disabled={!canCraft}
      >
        <Text style={[styles.craftButtonText, !canCraft && styles.craftButtonTextDisabled]}>
          Craft
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CraftingScreen() {
  const {
    state,
    canCraftTool,
    canCraftComponent,
    craftTool,
    craftComponent,
    repairTool,
    hasTech,
  } = useGameState();
  const [activeTab, setActiveTab] = useState<TabType>('owned');

  const handleCraftTool = (toolId: string) => {
    const tool = getToolById(toolId);
    if (!tool) return;

    Alert.alert(
      'Craft Tool',
      `Craft ${tool.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Craft',
          onPress: () => {
            const success = craftTool(toolId);
            if (success) {
              Alert.alert('Success', `Crafted ${tool.name}!`);
            } else {
              Alert.alert('Failed', 'Could not craft tool. Check requirements.');
            }
          },
        },
      ]
    );
  };

  const handleCraftComponent = (componentId: string) => {
    const component = getComponentById(componentId);
    if (!component) return;

    Alert.alert(
      'Craft Component',
      `Craft ${component.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Craft',
          onPress: () => {
            const success = craftComponent(componentId);
            if (success) {
              Alert.alert('Success', `Crafted ${component.name}!`);
            } else {
              Alert.alert('Failed', 'Could not craft component. Check requirements.');
            }
          },
        },
      ]
    );
  };

  const handleRepairTool = (instanceId: string) => {
    const owned = state.toolInventory.ownedTools.find(t => t.instanceId === instanceId);
    if (!owned) return;
    const tool = getToolById(owned.toolId);
    if (!tool) return;

    Alert.alert(
      'Repair Tool',
      `Repair ${tool.name}? Requires ${tool.stats.repairMaterial}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Repair',
          onPress: () => {
            const success = repairTool(instanceId);
            if (success) {
              Alert.alert('Success', `Repaired ${tool.name}!`);
            } else {
              Alert.alert('Failed', 'Could not repair. Check materials.');
            }
          },
        },
      ]
    );
  };

  // Filter tools by unlocked tech
  const availableTools = TOOLS.filter(tool => hasTech(tool.requiredTech));
  const availableComponents = COMPONENTS.filter(comp => hasTech(comp.requiredTech));

  const renderOwnedTools = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Owned Tools ({state.toolInventory.ownedTools.length})
      </Text>
      {state.toolInventory.ownedTools.length === 0 ? (
        <Text style={styles.emptyText}>No tools owned yet. Craft your first tool!</Text>
      ) : (
        state.toolInventory.ownedTools.map(owned => (
          <OwnedToolItem
            key={owned.instanceId}
            owned={owned}
            onRepair={handleRepairTool}
          />
        ))
      )}

      {/* Components inventory */}
      <Text style={[styles.sectionTitle, styles.sectionTitleMarginTop]}>Components</Text>
      {Object.keys(state.toolInventory.componentInventory).length === 0 ? (
        <Text style={styles.emptyText}>No components crafted yet.</Text>
      ) : (
        Object.entries(state.toolInventory.componentInventory).map(([compId, count]) => {
          const comp = getComponentById(compId);
          if (!comp || count <= 0) return null;
          return (
            <View key={compId} style={styles.componentItem}>
              <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[comp.tier] }]}>
                <Text style={styles.tierText}>{comp.tier.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.componentName}>{comp.name}</Text>
              <Text style={styles.componentCount}>x{count}</Text>
            </View>
          );
        })
      )}
    </View>
  );

  const renderToolRecipes = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tool Recipes ({availableTools.length})</Text>
      {availableTools.length === 0 ? (
        <Text style={styles.emptyText}>Research more tech to unlock tool recipes.</Text>
      ) : (
        availableTools.map(tool => {
          const { canCraft, missingRequirements } = canCraftTool(tool.id);
          return (
            <ToolRecipeItem
              key={tool.id}
              tool={tool}
              canCraft={canCraft}
              missingRequirements={missingRequirements}
              onCraft={() => handleCraftTool(tool.id)}
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
        availableComponents.map(comp => {
          const { canCraft, missingRequirements } = canCraftComponent(comp.id);
          const ownedCount = state.toolInventory.componentInventory[comp.id] || 0;
          return (
            <ComponentRecipeItem
              key={comp.id}
              component={comp}
              canCraft={canCraft}
              missingRequirements={missingRequirements}
              ownedCount={ownedCount}
              onCraft={() => handleCraftComponent(comp.id)}
            />
          );
        })
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'owned' && styles.tabActive]}
          onPress={() => setActiveTab('owned')}
        >
          <Text style={[styles.tabText, activeTab === 'owned' && styles.tabTextActive]}>
            Owned
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tools' && styles.tabActive]}
          onPress={() => setActiveTab('tools')}
        >
          <Text style={[styles.tabText, activeTab === 'tools' && styles.tabTextActive]}>
            Tools
          </Text>
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
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  ownedToolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tierBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tierText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  toolInfo: {
    flex: 1,
  },
  toolName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  qualityText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  durabilityBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  durabilityFill: {
    height: '100%',
    borderRadius: 3,
  },
  durabilityText: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  repairButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  repairButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  componentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  componentName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  componentCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  bottomPadding: {
    height: 30,
  },
});
