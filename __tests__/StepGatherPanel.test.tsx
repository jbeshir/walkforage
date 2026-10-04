/** @jest-environment ./__tests__/helpers/timeZoneEnvironment.ts */
// Tests for the forage panel's sync status, credit summary and Sync button.
// Renders the real panel with useStepGathering, so every sync runs the real step sync, ledger,
// HealthService, store and persistence against the fake Health Connect (in-memory AsyncStorage),
// in Europe/London.

import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getInstallationTimeAsync } from 'expo-application';
import { dayRecord, fakeHC, fitbitBatch, hcErrors, walk } from './helpers/fakeHealthConnect';
import { availableSteps, local, seedSave, useMemoryStorage } from './helpers/stepSyncHarness';
import { setTimeZone } from './helpers/timeZone';
import { StepGatherPanel } from '../src/components/StepGatherPanel';
import { useStepGathering } from '../src/hooks/useStepGathering';
import { GameStateProvider } from '../src/hooks/useGameState';
import { ThemeProvider } from '../src/hooks/useTheme';
import { useStepSyncStatus } from '../src/services/stepSync';
import { ledgerSince } from '../src/services/stepLedger';
import { FOREGROUND_RECONCILE_MS } from '../src/config/stepSync';
import { DAY_MS, HOUR_MS, formatDay, formatTime } from '../src/utils/time';

jest.mock(
  'react-native-health-connect',
  () => jest.requireActual('./helpers/fakeHealthConnect').fakeHealthConnectModule
);

setTimeZone('Europe/London');

const NOW = local(2026, 10, 4, 18); // Sunday

const UNAVAILABLE_TEXT =
  'Health Connect is updating or unavailable. Your steps are safe and will be added next time.';
const UNSUPPORTED_TEXT = "Health Connect isn't supported on this device, so steps can't be synced.";

function ForagePanel() {
  const stepGathering = useStepGathering();
  return <StepGatherPanel stepGathering={stepGathering} geoData={null} compact />;
}

function renderPanel() {
  return render(
    <ThemeProvider>
      <GameStateProvider>
        <ForagePanel />
      </GameStateProvider>
    </ThemeProvider>
  );
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Advances fake time in small steps until `check` passes. */
async function eventually(check: () => void): Promise<void> {
  for (let step = 0; ; step++) {
    try {
      check();
      return;
    } catch (error) {
      if (step === 200) throw error;
    }
    await advance(50);
  }
}

/** Renders the panel and waits for the sync the app runs once the saved game has loaded. */
async function renderAfterStartSync() {
  renderPanel();
  await eventually(() => expect(useStepSyncStatus.getState().lastResult).not.toBeNull());
}

function syncButton() {
  return screen.getByLabelText('Sync steps');
}

describe('StepGatherPanel sync UI', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    Platform.OS = 'android';
    fakeHC.reset();
    useMemoryStorage();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('credit summary', () => {
    /** Last synced yesterday at 18:00, with Friday and Saturday credited. */
    function seedSyncedYesterday(): void {
      seedSave({
        availableSteps: 100,
        stepLedger: {
          buckets: [
            { startMs: local(2026, 10, 2), endMs: local(2026, 10, 3), credited: 3000 },
            { startMs: local(2026, 10, 3), endMs: local(2026, 10, 4), credited: 4000 },
          ],
          lastSyncedAt: local(2026, 10, 3, 18),
        },
      });
      fakeHC.upsert([
        dayRecord(local(2026, 10, 2), 3500), // +500 that arrived after Friday was fully synced
        dayRecord(local(2026, 10, 3), 5200), // +1200, some walked after yesterday's 18:00 sync
        ...fitbitBatch(local(2026, 10, 4, 9), local(2026, 10, 4, 10), 500), // +2000 today
      ]);
    }

    it('shows the total and a line per day after the sync on app start', async () => {
      seedSyncedYesterday();

      await renderAfterStartSync();

      expect(screen.getByText(`+3,700 steps since ${formatDay(local(2026, 10, 2))}`)).toBeTruthy();
      expect(
        screen.getByText(`+500 late steps from ${formatDay(local(2026, 10, 2))}`)
      ).toBeTruthy();
      expect(screen.getByText('+1,200 steps yesterday')).toBeTruthy();
      expect(screen.getByText('+2,000 steps today')).toBeTruthy();
      expect(screen.getByText('Recent days may still update as your watch syncs')).toBeTruthy();
      expect(screen.getByText('3,800 steps')).toBeTruthy();
      expect(screen.queryByText(/may only share steps/)).toBeNull();
    });

    it('adds automatic syncs to the summary until it is dismissed', async () => {
      seedSyncedYesterday();
      await renderAfterStartSync();

      fakeHC.upsert(walk(local(2026, 10, 4, 18), local(2026, 10, 4, 18, 3), 200)); // +600
      await advance(FOREGROUND_RECONCILE_MS);

      expect(screen.getByText(`+4,300 steps since ${formatDay(local(2026, 10, 2))}`)).toBeTruthy();
      expect(screen.getByText('+2,600 steps today')).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Dismiss step summary'));
      expect(screen.queryByText(/steps since/)).toBeNull();
      expect(screen.getByText('4,400 steps')).toBeTruthy();

      fakeHC.upsert(walk(local(2026, 10, 4, 18, 6), local(2026, 10, 4, 18, 7), 100)); // +100
      await advance(FOREGROUND_RECONCILE_MS);

      // The headline and the day line: only today was credited, so not "since today"
      expect(screen.getAllByText('+100 steps today')).toHaveLength(2);
      expect(screen.queryByText(/since/)).toBeNull();
      expect(screen.queryByText(/late steps/)).toBeNull();
    });

    it('does not say "since" a past day when every credit is late data', async () => {
      seedSave({
        availableSteps: 100,
        stepLedger: {
          buckets: [
            { startMs: local(2026, 10, 2), endMs: local(2026, 10, 3), credited: 3000 },
            { startMs: local(2026, 10, 3), endMs: local(2026, 10, 4), credited: 4000 },
          ],
          lastSyncedAt: local(2026, 10, 4, 9),
        },
      });
      fakeHC.upsert([dayRecord(local(2026, 10, 2), 3500), dayRecord(local(2026, 10, 3), 4000)]);

      await renderAfterStartSync();

      expect(screen.getByText('+500 late steps added')).toBeTruthy();
      expect(
        screen.getByText(`+500 late steps from ${formatDay(local(2026, 10, 2))}`)
      ).toBeTruthy();
      expect(screen.queryByText(/since/)).toBeNull();
    });

    it('welcomes a new game whose health data has no steps yet', async () => {
      await renderAfterStartSync();

      expect(useStepSyncStatus.getState().lastResult).toMatchObject({ welcome: true, credited: 0 });
      expect(
        screen.getByText(
          'Welcome to WalkForage! Steps from the last 7 days will appear here as your watch syncs.'
        )
      ).toBeTruthy();
      expect(screen.queryByText(/Recent days may still update/)).toBeNull();

      // The watch catches up: the next sync's steps join the welcome.
      fakeHC.upsert(fitbitBatch(local(2026, 10, 4, 9), local(2026, 10, 4, 10), 500));
      await advance(FOREGROUND_RECONCILE_MS);

      expect(
        screen.getByText("Welcome to WalkForage! We've added +2,000 steps from your last 7 days")
      ).toBeTruthy();
      expect(screen.getByText('+2,000 steps today')).toBeTruthy();
    });

    it('welcomes a new game with the steps of the last 7 days', async () => {
      fakeHC.upsert([
        dayRecord(local(2026, 9, 26), 9999), // before the welcome week
        ...Array.from({ length: 7 }, (_, i) => dayRecord(local(2026, 9, 27 + i), 1000)),
        ...fitbitBatch(local(2026, 10, 4, 9), local(2026, 10, 4, 9, 30), 250),
      ]);

      await renderAfterStartSync();

      expect(
        screen.getByText("Welcome to WalkForage! We've added +7,500 steps from your last 7 days")
      ).toBeTruthy();
      for (let day = 27; day <= 30; day++) {
        expect(screen.getByText(`+1,000 steps on ${formatDay(local(2026, 9, day))}`)).toBeTruthy();
      }
      expect(screen.getByText(`+1,000 steps on ${formatDay(local(2026, 10, 1))}`)).toBeTruthy();
      expect(screen.getByText(`+1,000 steps on ${formatDay(local(2026, 10, 2))}`)).toBeTruthy();
      expect(screen.getByText('+1,000 steps yesterday')).toBeTruthy();
      expect(screen.getByText('+500 steps today')).toBeTruthy();
      expect(screen.queryByText(/late steps/)).toBeNull();
      expect(availableSteps()).toBe(7500);
    });

    it('says Health Connect may not share older steps when access is granted days after a reinstall', async () => {
      // A 35-day-old backup restored onto an install 10 days ago, reconnected only today
      jest.mocked(getInstallationTimeAsync).mockResolvedValue(new Date(NOW - 10 * DAY_MS));
      fakeHC.firstGrantAt = NOW - HOUR_MS;
      seedSave({ availableSteps: 0, stepLedger: ledgerSince(NOW - 35 * DAY_MS) });
      fakeHC.upsert([dayRecord(local(2026, 10, 1), 2000)]);

      await renderAfterStartSync();

      expect(screen.getByText('+2,000 steps on ' + formatDay(local(2026, 10, 1)))).toBeTruthy();
      expect(
        screen.getByText(
          `After a reinstall, Health Connect may only share steps from ${formatDay(NOW - 30 * DAY_MS)} onward; earlier steps may be missing.`
        )
      ).toBeTruthy();
    });
  });

  describe('sync status', () => {
    beforeEach(() => {
      seedSave({ availableSteps: 1234, stepLedger: ledgerSince(local(2026, 10, 4, 8)) });
      fakeHC.upsert(walk(local(2026, 10, 4, 12), local(2026, 10, 4, 12, 10), 50)); // 500
    });

    it('shows why a sync failed with a Retry, and keeps the steps unchanged', async () => {
      fakeHC.failAlways('aggregateRecord', hcErrors.rateLimited());
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await renderAfterStartSync();

      expect(
        screen.getByText('Health Connect is busy. Your steps are safe; try again in a minute.')
      ).toBeTruthy();
      expect(screen.getByText('1,234 steps')).toBeTruthy();
      expect(availableSteps()).toBe(1234);
      expect(screen.queryByLabelText('Dismiss step summary')).toBeNull();

      fakeHC.clearFailures();
      fireEvent.press(screen.getByText('Retry'));

      await eventually(() => expect(screen.getAllByText('+500 steps today')).toHaveLength(2));
      expect(screen.getByText('Synced just now')).toBeTruthy();
      expect(screen.queryByText('Retry')).toBeNull();
      expect(availableSteps()).toBe(1734);
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    });

    it('explains that Health Connect is unavailable instead of hiding the panel', async () => {
      fakeHC.initializeResult = false; // e.g. while Health Connect updates
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await renderAfterStartSync();

      expect(screen.getByText(UNAVAILABLE_TEXT)).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
      expect(screen.getByText('1,234 steps')).toBeTruthy();
      expect(fakeHC.callsTo('aggregateRecord')).toHaveLength(0);

      fakeHC.initializeResult = true;
      fireEvent.press(screen.getByText('Retry'));

      await eventually(() => expect(screen.getAllByText('+500 steps today')).toHaveLength(2));
      expect(screen.queryByText(UNAVAILABLE_TEXT)).toBeNull();
      consoleWarn.mockRestore();
    });

    it('says when the device does not support Health Connect, without promising a later sync', async () => {
      fakeHC.sdkStatus = 1; // SDK_UNAVAILABLE: e.g. an Android version that is too old
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await renderAfterStartSync();

      expect(screen.getByText(UNSUPPORTED_TEXT)).toBeTruthy();
      expect(screen.queryByText(UNAVAILABLE_TEXT)).toBeNull();
      expect(screen.queryByText('Retry')).toBeNull();
      expect(screen.getByText('1,234 steps')).toBeTruthy();
      consoleWarn.mockRestore();
    });

    it('disables Sync while a sync runs and says "Up to date" when nothing is new', async () => {
      fakeHC.latencyMs = 1000;
      renderPanel();

      // The app-start sync is still reading when the panel has loaded.
      await eventually(() => expect(syncButton().props.disabled).toBe(true));
      expect(useStepSyncStatus.getState().syncing).toBe(true);
      expect(screen.getByText('Syncing…')).toBeTruthy();

      await eventually(() => expect(useStepSyncStatus.getState().lastResult).not.toBeNull());
      expect(syncButton().props.disabled).toBe(false);
      fireEvent.press(screen.getByLabelText('Dismiss step summary'));

      fireEvent.press(syncButton());
      await eventually(() => expect(syncButton().props.disabled).toBe(true));
      await eventually(() => expect(syncButton().props.disabled).toBe(false));

      const { lastResult } = useStepSyncStatus.getState();
      expect(lastResult).toMatchObject({ status: 'synced', credited: 0 });
      const syncedAt = lastResult?.status === 'synced' ? lastResult.syncedAt : NaN;
      expect(screen.getByText(`Up to date (synced ${formatTime(syncedAt)})`)).toBeTruthy();
      expect(screen.queryByText(/No new steps/)).toBeNull();
      expect(screen.queryByText(/steps since/)).toBeNull();
    });

    it('shows how long ago steps synced', async () => {
      await renderAfterStartSync();
      expect(screen.getByText('Synced just now')).toBeTruthy();

      await advance(150_000);

      expect(screen.getByText('Synced 2 min ago')).toBeTruthy();
    });
  });

  describe('health access states', () => {
    it('offers to install Health Connect when it needs installing or updating', async () => {
      fakeHC.sdkStatus = 2; // SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await renderAfterStartSync();

      expect(screen.getByText('Health Connect app is required to track steps')).toBeTruthy();
      expect(screen.getByText('Install Health Connect')).toBeTruthy();
      consoleWarn.mockRestore();
    });

    it('asks to reconnect when access was revoked after syncing', async () => {
      seedSave({ availableSteps: 10, stepLedger: ledgerSince(local(2026, 10, 4, 8)) });
      fakeHC.granted = false;

      await renderAfterStartSync();

      expect(
        screen.getByText(
          "Step access is off. Reconnect to add the steps you've walked since your last sync."
        )
      ).toBeTruthy();
      expect(screen.getByText('Reconnect Health')).toBeTruthy();
    });

    it('asks a new player to connect', async () => {
      fakeHC.granted = false;

      await renderAfterStartSync();

      expect(screen.getByText('Connect health to gather resources with steps')).toBeTruthy();
      expect(screen.getByText('Connect Health')).toBeTruthy();
    });
  });
});
