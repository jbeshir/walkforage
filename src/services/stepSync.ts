// stepSync - The one place steps are credited from Health Connect/HealthKit into the game.
// Every trigger (mount, permission grant, interval, Sync button) shares a single in-flight sync,
// so overlapping triggers can never read and credit the same window twice.

import { create } from 'zustand';
import { healthService } from './HealthService';
import { useGameStore } from '../store/gameStore';
import { saveGame } from '../store/persistence';
import { StepSyncResult } from '../types/health';

interface StepSyncStatus {
  syncing: boolean;
  lastResult: StepSyncResult | null;
}

/** Ephemeral sync state for the UI. */
export const useStepSyncStatus = create<StepSyncStatus>()(() => ({
  syncing: false,
  lastResult: null,
}));

let inFlight: Promise<StepSyncResult> | null = null;

/** Sync steps, or join the sync already running. */
export function syncSteps(): Promise<StepSyncResult> {
  if (!inFlight) {
    useStepSyncStatus.setState({ syncing: true });
    inFlight = runSync().then((result) => {
      inFlight = null;
      useStepSyncStatus.setState({ syncing: false, lastResult: result });
      return result;
    });
  }
  return inFlight;
}

async function runSync(): Promise<StepSyncResult> {
  const store = useGameStore.getState();
  // Before hydration (or after a failed load) the store holds initial state, not the player's
  // game; syncing against it would credit the wrong window and save over their game.
  if (store.isLoading || store.loadFailed) {
    return {
      status: 'error',
      code: 'not_loaded',
      message: store.loadFailed ? 'Saved game could not be loaded' : 'Saved game is still loading',
    };
  }
  if (healthService.getPermissionStatus() !== 'authorized') {
    return { status: 'error', code: 'not_authorized', message: 'Step access not granted' };
  }

  const { lastSyncTimestamp } = store.getStepGatheringState();
  const now = Date.now();

  if (lastSyncTimestamp === 0) {
    // First sync ever: start counting from now rather than crediting history.
    store.applyStepSync(0, now);
    await saveGame();
    return { status: 'synced', credited: 0 };
  }

  if (now <= lastSyncTimestamp) {
    // Clock is at or behind the sync position: nothing to read until time catches up.
    return { status: 'synced', credited: 0 };
  }

  const read = await healthService.readSteps(lastSyncTimestamp, now);
  if (!read.ok) {
    return { status: 'error', code: read.code, message: read.message };
  }

  // The position moves to the end of the window actually read, not to the time the read returned,
  // so steps starting while the read was in flight are picked up next time.
  useGameStore.getState().applyStepSync(read.steps, now);
  await saveGame();
  return { status: 'synced', credited: read.steps };
}
