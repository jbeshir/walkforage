import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ToolRecipeItem } from '../src/screens/CraftingScreen';
import { lightTheme } from '../src/config/theme';
import { TOOLS } from '../src/data/tools';
import { CraftCheckResult } from '../src/services/CraftingService';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

const someTool = TOOLS[0];
const onCraft = jest.fn();

const notCraftable: CraftCheckResult = {
  canCraft: false,
  missingRequirements: ['2x stone'],
  availableMaterials: {},
  availableComponents: [],
  foodCost: 0,
  availableFoods: [],
};

const craftable: CraftCheckResult = {
  canCraft: true,
  missingRequirements: [],
  availableMaterials: {},
  availableComponents: [],
  foodCost: 0,
  availableFoods: [],
};

describe('ToolRecipeItem value comparator', () => {
  it('re-renders when craftCheck value changes even with same prop references for other props', () => {
    const { rerender } = render(
      <ToolRecipeItem
        tool={someTool}
        craftCheck={notCraftable}
        onCraft={onCraft}
        colors={lightTheme.colors}
      />
    );

    expect(screen.getByText('Missing:')).toBeTruthy();
    expect(screen.getByText('2x stone')).toBeTruthy();

    rerender(
      <ToolRecipeItem
        tool={someTool}
        craftCheck={craftable}
        onCraft={onCraft}
        colors={lightTheme.colors}
      />
    );

    expect(screen.queryByText('Missing:')).toBeNull();
  });
});
