// useStepGathering when Health Connect is missing or needs an update.
// Kept in its own suite: the healthService singleton caches a successful initialization for the
// session, so these need a module registry where it never initialized.

import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react';
import { fakeHC } from './helpers/fakeHealthConnect';
import { useStepGathering } from '../src/hooks/useStepGathering';
import { GameStateProvider } from '../src/hooks/useGameState';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);

function TestWrapper({ children }: { children: ReactNode }) {
  return React.createElement(GameStateProvider, null, children);
}

describe('useStepGathering without a usable Health Connect', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    fakeHC.reset();
  });

  it('reports unavailable and never reads when the SDK is unavailable', async () => {
    fakeHC.sdkStatus = 1; // SDK_UNAVAILABLE

    const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.permissionStatus).toBe('unavailable');
    expect(result.current.needsInstall).toBe(false);
    expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
  });

  it('asks for an install when the provider needs an update', async () => {
    fakeHC.sdkStatus = 2; // SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED

    const { result } = renderHook(() => useStepGathering(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.needsInstall).toBe(true);
    expect(fakeHC.callsTo('readRecords')).toHaveLength(0);
  });
});
