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

      expect(result.current.state.unlockedTechs).toEqual([]);
    });

    it('should have empty inventory initially', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.inventory.stone).toEqual([]);
      expect(result.current.state.inventory.wood).toEqual([]);
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
        result.current.addResource('stone', 'flint', 5);
      });

      expect(result.current.state.inventory.stone).toContainEqual({
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
        result.current.addResource('stone', 'flint', 5);
      });

      act(() => {
        result.current.addResource('stone', 'flint', 3);
      });

      const flintStack = result.current.state.inventory.stone.find((s) => s.resourceId === 'flint');
      expect(flintStack?.quantity).toBe(8);
    });

    it('should create separate stacks for different resources', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stone', 'flint', 5);
        result.current.addResource('stone', 'granite', 3);
      });

      expect(result.current.state.inventory.stone.length).toBe(2);
    });

    it('should remove resources from inventory', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stone', 'flint', 10);
      });

      act(() => {
        result.current.removeResource('stone', 'flint', 5);
      });

      // Verify by checking the resulting state
      const flintStack = result.current.state.inventory.stone.find((s) => s.resourceId === 'flint');
      expect(flintStack?.quantity).toBe(5);
    });

    it('should remove stack when quantity reaches zero', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stone', 'flint', 5);
      });

      act(() => {
        result.current.removeResource('stone', 'flint', 5);
      });

      expect(result.current.state.inventory.stone.length).toBe(0);
    });

    it('should not remove resources when removing more than available', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stone', 'flint', 5);
      });

      act(() => {
        result.current.removeResource('stone', 'flint', 10);
      });

      // Quantity should remain unchanged when trying to remove more than available
      const flintStack = result.current.state.inventory.stone.find((s) => s.resourceId === 'flint');
      expect(flintStack?.quantity).toBe(5);
    });

    it('should check resource availability', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.addResource('stone', 'flint', 10);
      });

      expect(result.current.hasResource('stone', 'flint', 5)).toBe(true);
      expect(result.current.hasResource('stone', 'flint', 10)).toBe(true);
      expect(result.current.hasResource('stone', 'flint', 15)).toBe(false);
      expect(result.current.hasResource('stone', 'granite', 1)).toBe(false);
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

      expect(result.current.state.unlockedTechs).toContain('grinding');
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
      expect(result.current.state.unlockedTechs).toEqual([]);
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

  describe('Persistence integrity (Stage 2)', () => {
    it('migrates an unversioned legacy save and tags it to the current schema', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ explorationPoints: 42 }));

      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.explorationPoints).toBe(42);
      expect(result.current.state.unlockedTechs).toEqual([]);

      mockAsyncStorage.setItem.mockClear();

      await act(async () => {
        await result.current.saveGame();
      });

      const written = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(written.schemaVersion).toBe(1);
    });

    it('falls back to INITIAL_STATE on corrupt JSON', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('{ this is not valid json');

      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.state.explorationPoints).toBe(0);
      expect(result.current.state.unlockedTechs).toEqual([]);
      expect(result.current.state.inventory.stone).toEqual([]);
    });

    it('sanitises non-finite and negative numeric fields to safe defaults', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          availableSteps: NaN,
          totalStepsGathered: 'x',
          explorationPoints: -5,
        })
      );

      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const stepState = result.current.getStepGatheringState();
      expect(result.current.state.explorationPoints).toBe(0);
      expect(stepState.availableSteps).toBe(0);
      expect(stepState.totalStepsGathered).toBe(0);
    });

    it('falls back to defaults when array fields are not arrays', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({ ownedTools: 'corrupt', unlockedTechs: { bad: true } })
      );

      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(Array.isArray(result.current.state.ownedTools)).toBe(true);
      expect(result.current.state.ownedTools).toEqual([]);
      expect(Array.isArray(result.current.state.unlockedTechs)).toBe(true);
      expect(result.current.state.unlockedTechs).toEqual([]);
    });

    it('drops malformed inventory stack elements and coerces quantities', async () => {
      const save = JSON.stringify({
        inventory: {
          stone: [
            { resourceId: 'flint', quantity: 'bad' },
            { quantity: 5 },
            'garbage',
            null,
            { resourceId: 'granite', quantity: 3.9 },
          ],
        },
      });
      mockAsyncStorage.getItem.mockResolvedValueOnce(save);

      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const stone = result.current.state.inventory.stone;
      expect(stone).toContainEqual({ resourceId: 'flint', quantity: 0 });
      expect(stone).toContainEqual({ resourceId: 'granite', quantity: 3 });
      expect(stone).toHaveLength(2);
    });

    it('serializes writes so the latest queued save wins and writes do not interleave', async () => {
      const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let resolveFirst!: () => void;
      let resolveSecond!: () => void;
      const first = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      const second = new Promise<void>((resolve) => {
        resolveSecond = resolve;
      });
      mockAsyncStorage.setItem.mockReset();
      mockAsyncStorage.setItem
        .mockReturnValueOnce(first as unknown as Promise<void>)
        .mockReturnValueOnce(second as unknown as Promise<void>);

      act(() => {
        result.current.addExplorationPoints(100);
      });

      let save1!: Promise<void>;
      act(() => {
        save1 = result.current.saveGame();
      });

      await act(async () => {
        await Promise.resolve();
      });
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.addExplorationPoints(50);
      });

      let save2!: Promise<void>;
      act(() => {
        save2 = result.current.saveGame();
      });

      await act(async () => {
        await Promise.resolve();
      });
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveFirst();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2);
      const secondWritten = JSON.parse(mockAsyncStorage.setItem.mock.calls[1][1]);
      expect(secondWritten.explorationPoints).toBe(150);

      await act(async () => {
        resolveSecond();
        await save1;
        await save2;
      });
    });

    it('flags saveError after repeated save failures and clears it on success', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const { result } = renderHook(() => useGameState(), { wrapper: TestWrapper });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        mockAsyncStorage.setItem.mockReset();
        mockAsyncStorage.setItem
          .mockRejectedValueOnce(new Error('disk full'))
          .mockRejectedValueOnce(new Error('disk full'))
          .mockRejectedValueOnce(new Error('disk full'));

        for (let i = 0; i < 3; i++) {
          await act(async () => {
            await result.current.saveGame();
          });
        }

        await waitFor(() => {
          expect(result.current.saveError).toBe(true);
        });

        mockAsyncStorage.setItem.mockResolvedValueOnce(undefined as unknown as void);

        await act(async () => {
          await result.current.saveGame();
        });

        await waitFor(() => {
          expect(result.current.saveError).toBe(false);
        });
      } finally {
        consoleError.mockRestore();
      }
    });
  });
});
