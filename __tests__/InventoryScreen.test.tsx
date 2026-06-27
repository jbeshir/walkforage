import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ResourceItem } from '../src/screens/InventoryScreen';
import { lightTheme } from '../src/config/theme';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../src/utils/icons', () => ({ getResourceIcon: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

describe('ResourceItem scientific names', () => {
  it('shows scientific names for wood and food resources', () => {
    render(
      <ResourceItem
        stack={{ resourceId: 'european_oak', quantity: 3 }}
        type="wood"
        colors={lightTheme.colors}
      />
    );
    expect(screen.getByText('Quercus robur')).toBeTruthy();

    render(
      <ResourceItem
        stack={{ resourceId: 'wild_garlic', quantity: 2 }}
        type="food"
        colors={lightTheme.colors}
      />
    );
    expect(screen.getByText('Allium ursinum')).toBeTruthy();
  });

  it('does not show a scientific name line for stones', () => {
    render(
      <ResourceItem
        stack={{ resourceId: 'flint', quantity: 1 }}
        type="stone"
        colors={lightTheme.colors}
      />
    );

    expect(screen.queryByText('Quercus robur')).toBeNull();
  });
});
