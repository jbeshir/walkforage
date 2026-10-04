/** @jest-environment ./__tests__/helpers/timeZoneEnvironment.ts */
// Tests for the step sync diagnostics in the cheat menu: the ledger next to Health Connect's last
// totals, and the raw per-source read. Real step sync, ledger, HealthService and store against the
// fake Health Connect, in Europe/London.

import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  fakeHC,
  fitbitBatch,
  walk,
  FITBIT_ORIGIN,
  ON_DEVICE_ORIGIN,
} from './helpers/fakeHealthConnect';
import { local, seedSave, useMemoryStorage } from './helpers/stepSyncHarness';
import { setTimeZone } from './helpers/timeZone';
import CheatScreen from '../src/screens/CheatScreen';
import { ThemeProvider } from '../src/hooks/useTheme';
import { syncSteps } from '../src/services/stepSync';
import { ledgerSince } from '../src/services/stepLedger';
import { loadGame } from '../src/store/persistence';
import { formatDay, formatTime } from '../src/utils/time';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../src/utils/icons', () => ({ getResourceIcon: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

setTimeZone('Europe/London');

const NOW = local(2026, 10, 4, 18);

function renderDiagnostics(): void {
  render(
    <ThemeProvider>
      <CheatScreen />
    </ThemeProvider>
  );
  fireEvent.press(screen.getByText('Sync'));
}

describe('CheatScreen step sync diagnostics', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    Platform.OS = 'android';
    fakeHC.reset();
    useMemoryStorage();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists each ledger bucket with its credited mark and the last Health Connect total', async () => {
    seedSave({ availableSteps: 0, stepLedger: ledgerSince(local(2026, 10, 3, 8)) });
    fakeHC.upsert(fitbitBatch(local(2026, 10, 3, 9), local(2026, 10, 3, 10), 250)); // 1000
    fakeHC.upsert(fitbitBatch(local(2026, 10, 4, 9), local(2026, 10, 4, 10), 500)); // 2000
    const lunchWalk = fakeHC.upsert(walk(local(2026, 10, 4, 12), local(2026, 10, 4, 12, 10), 10));
    await loadGame();
    await syncSteps();
    // The walk is deleted: Health Connect's total drops below the credited mark, which stays.
    fakeHC.delete(lunchWalk);
    jest.setSystemTime(NOW + 60_000);
    await syncSteps('recent');

    renderDiagnostics();

    expect(screen.getByText(`${formatDay(NOW + 60_000)} ${formatTime(NOW + 60_000)}`)).toBeTruthy();
    expect(
      screen.getByText(`synced +0 at ${formatDay(NOW + 60_000)} ${formatTime(NOW + 60_000)}`)
    ).toBeTruthy();
    const firstBucket = `${formatDay(local(2026, 10, 3, 8))} ${formatTime(local(2026, 10, 3, 8))}`;
    const midnight = `${formatDay(local(2026, 10, 4))} ${formatTime(local(2026, 10, 4))}`;
    const nextMidnight = `${formatDay(local(2026, 10, 5))} ${formatTime(local(2026, 10, 5))}`;
    expect(screen.getByText(`${firstBucket} → ${midnight}`)).toBeTruthy();
    expect(screen.getByText('credited 1000 · Health Connect 1000')).toBeTruthy();
    expect(screen.getByText(`${midnight} → ${nextMidnight}`)).toBeTruthy();
    expect(screen.getByText('credited 2100 · Health Connect 2000')).toBeTruthy();
  });

  it('reads today by source, grouping raw records by origin', async () => {
    seedSave({ availableSteps: 0, stepLedger: ledgerSince(local(2026, 10, 4, 8)) });
    fakeHC.upsert([
      ...fitbitBatch(local(2026, 10, 4, 9), local(2026, 10, 4, 10), 500), // 2000 in 4 records
      ...walk(local(2026, 10, 4, 9), local(2026, 10, 4, 9, 30), 40, ON_DEVICE_ORIGIN), // same walk
      ...walk(local(2026, 10, 3, 20), local(2026, 10, 3, 21), 10, ON_DEVICE_ORIGIN), // yesterday
    ]);
    await loadGame();
    await syncSteps();
    renderDiagnostics();

    fireEvent.press(screen.getByText('Read today by source'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Today by source: raw records, not de-duplicated')).toBeTruthy();
    expect(screen.getByText(FITBIT_ORIGIN)).toBeTruthy();
    expect(screen.getByText('2000 steps in 4 records')).toBeTruthy();
    expect(screen.getByText(ON_DEVICE_ORIGIN)).toBeTruthy();
    expect(screen.getByText('1200 steps in 30 records')).toBeTruthy();
    // The sync credited Health Connect's de-duplicated total, not the raw sum.
    expect(screen.getByText('credited 2000 · Health Connect 2000')).toBeTruthy();
  });

  it('says when there is no ledger yet', () => {
    renderDiagnostics();

    expect(screen.getByText('never')).toBeTruthy();
    expect(screen.getByText('none since the app started')).toBeTruthy();
    expect(
      screen.getByText('No ledger yet: the first sync gives the welcome credit.')
    ).toBeTruthy();
  });
});
