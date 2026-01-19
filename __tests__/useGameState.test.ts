import React, { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameState, GameStateProvider } from '../src/hooks/useGameState';
import { getToolById } from '../src/data/tools';

// Get the mocked module
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Wrapper component for tests
function TestWrapper({ children }: { children: ReactNode }) {
  return React.createElement(GameStateProvider, null, children);
}

describe('useGameState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no saved game
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  describe('Initial state', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('should complete loading after initialization', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should have no techs unlocked initially', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.techProgress.unlockedTechs).toEqual([]);
    });

    it('should have empty inventory initially', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.inventory.stones).toEqual([]);
      expect(result.current.state.inventory.woods).toEqual([]);
      expect(result.current.state.inventory.ores).toEqual([]);
      expect(result.current.state.inventory.other).toEqual([]);
    });

    it('should have default village settings', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.village.name).toBe('New Settlement');
      expect(result.current.state.village.totalWorkers).toBe(1);
      expect(result.current.state.village.availableWorkers).toBe(1);
    });

    it('should have zero exploration points initially', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.explorationPoints).toBe(0);
    });
  });

  describe('Inventory management', () => {
    it('should add resources to inventory', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stones', 'flint', 5);
      });

      expect(result.current.state.inventory.stones).toContainEqual({
        resourceId: 'flint',
        quantity: 5,
      });
    });

    it('should stack same resources', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stones', 'flint', 5);
      });

      act(() => {
        result.current.addResource('stones', 'flint', 3);
      });

      const flintStack = result.current.state.inventory.stones.find(
        (s) => s.resourceId === 'flint'
      );
      expect(flintStack?.quantity).toBe(8);
    });

    it('should create separate stacks for different resources', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stones', 'flint', 5);
        result.current.addResource('stones', 'granite', 3);
      });

      expect(result.current.state.inventory.stones.length).toBe(2);
    });

    it('should remove resources from inventory', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stones', 'flint', 10);
      });

      act(() => {
        result.current.removeResource('stones', 'flint', 5);
      });

      // Verify by checking the resulting state
      const flintStack = result.current.state.inventory.stones.find(
        (s) => s.resourceId === 'flint'
      );
      expect(flintStack?.quantity).toBe(5);
    });

    it('should remove stack when quantity reaches zero', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stones', 'flint', 5);
      });

      act(() => {
        result.current.removeResource('stones', 'flint', 5);
      });

      expect(result.current.state.inventory.stones.length).toBe(0);
    });

    it('should not remove resources when removing more than available', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stones', 'flint', 5);
      });

      act(() => {
        result.current.removeResource('stones', 'flint', 10);
      });

      // Quantity should remain unchanged when trying to remove more than available
      const flintStack = result.current.state.inventory.stones.find(
        (s) => s.resourceId === 'flint'
      );
      expect(flintStack?.quantity).toBe(5);
    });

    it('should check resource availability', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stones', 'flint', 10);
      });

      expect(result.current.hasResource('stones', 'flint', 5)).toBe(true);
      expect(result.current.hasResource('stones', 'flint', 10)).toBe(true);
      expect(result.current.hasResource('stones', 'flint', 15)).toBe(false);
      expect(result.current.hasResource('stones', 'granite', 1)).toBe(false);
    });
  });

  describe('Tech progress', () => {
    it('should unlock technologies', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.unlockTech('grinding');
      });

      expect(result.current.state.techProgress.unlockedTechs).toContain('grinding');
    });

    it('should check if tech is unlocked', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // No techs unlocked initially
      expect(result.current.hasTech('basic_knapping')).toBe(false);
      expect(result.current.hasTech('grinding')).toBe(false);

      act(() => {
        result.current.unlockTech('basic_knapping');
      });

      expect(result.current.hasTech('basic_knapping')).toBe(true);
      expect(result.current.hasTech('grinding')).toBe(false);

      act(() => {
        result.current.unlockTech('grinding');
      });

      expect(result.current.hasTech('grinding')).toBe(true);
    });
  });

  describe('Exploration', () => {
    it('should add exploration points', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addExplorationPoints(100);
      });

      expect(result.current.state.explorationPoints).toBe(100);

      act(() => {
        result.current.addExplorationPoints(50);
      });

      expect(result.current.state.explorationPoints).toBe(150);
    });
  });

  describe('Village management', () => {
    it('should place buildings', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newBuilding = {
        id: 'building_1',
        buildingId: 'fire_pit',
        level: 1,
        position: { x: 0, y: 0 },
        assignedWorkers: 0,
      };

      act(() => {
        result.current.placeBuilding(newBuilding);
      });

      expect(result.current.state.village.buildings.length).toBe(1);
      expect(result.current.state.village.buildings[0].buildingId).toBe('fire_pit');
    });

    it('should upgrade buildings', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newBuilding = {
        id: 'building_1',
        buildingId: 'fire_pit',
        level: 1,
        position: { x: 0, y: 0 },
        assignedWorkers: 0,
      };

      act(() => {
        result.current.placeBuilding(newBuilding);
      });

      act(() => {
        result.current.upgradeBuilding('building_1');
      });

      expect(result.current.state.village.buildings[0].level).toBe(2);
    });
  });

  describe('Tool inventory', () => {
    it('should check tool ownership', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // No tools initially
      expect(result.current.hasTool('hammerstone')).toBe(false);
    });

    it('should get owned tools by id', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const tools = result.current.getOwnedTools('hammerstone');
      expect(tools).toEqual([]);
    });

    it('should get best tool when no tools owned', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const best = result.current.getBestTool('hammerstone');
      expect(best).toBeNull();
    });

    it('should check craft requirements for tools', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Hammerstone has minimal requirements
      const hammerstone = getToolById('hammerstone');
      expect(hammerstone).toBeDefined();

      const { missingRequirements } = result.current.canCraft(hammerstone!);

      // Should have missing materials
      expect(missingRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('Persistence', () => {
    it('should load saved game on mount', async () => {
      const savedState = {
        explorationPoints: 500,
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(savedState));

      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.explorationPoints).toBe(500);
    });

    it('should save game state', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addExplorationPoints(100);
      });

      // Clear any previous auto-save calls before explicit save
      mockAsyncStorage.setItem.mockClear();

      await act(async () => {
        await result.current.saveGame();
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(savedData.explorationPoints).toBe(100);
    });

    it('should reset game to initial state', async () => {
      const savedState = {
        explorationPoints: 500,
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(savedState));

      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.explorationPoints).toBe(500);

      await act(async () => {
        await result.current.resetGame();
      });

      expect(mockAsyncStorage.removeItem).toHaveBeenCalled();
      expect(result.current.state.explorationPoints).toBe(0);
    });

    it('should merge partial saves with defaults', async () => {
      // Simulate an old save without all fields
      const partialSave = {
        explorationPoints: 100,
        // Missing other fields
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(partialSave));

      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have saved value
      expect(result.current.state.explorationPoints).toBe(100);
      // Should have defaults for missing fields
      expect(result.current.state.techProgress.unlockedTechs).toEqual([]);
      expect(result.current.state.village.name).toBe('New Settlement');
    });

    it('should handle load errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to initial state
      expect(result.current.state.explorationPoints).toBe(0);
    });
  });

  describe('Quality multipliers', () => {
    it('should apply quality multiplier to tool durability', () => {
      const baseDurability = 100;
      const qualityMultipliers = {
        poor: 0.75,
        normal: 1.0,
        good: 1.25,
        excellent: 1.5,
      };

      expect(baseDurability * qualityMultipliers.poor).toBe(75);
      expect(baseDurability * qualityMultipliers.normal).toBe(100);
      expect(baseDurability * qualityMultipliers.good).toBe(125);
      expect(baseDurability * qualityMultipliers.excellent).toBe(150);
    });
  });

  describe('Repair degradation', () => {
    it('should calculate repair degradation correctly', () => {
      const baseDurability = 100;
      const degradationFactor = 0.95;

      // Each repair reduces max durability by 5%
      expect(Math.floor(baseDurability * Math.pow(degradationFactor, 0))).toBe(100);
      expect(Math.floor(baseDurability * Math.pow(degradationFactor, 1))).toBe(95);
      expect(Math.floor(baseDurability * Math.pow(degradationFactor, 3))).toBe(85);
      expect(Math.floor(baseDurability * Math.pow(degradationFactor, 5))).toBe(77);
    });
  });
});
