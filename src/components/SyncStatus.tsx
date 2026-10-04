// SyncStatus - One line under the step count: when steps last synced, a sync in progress, or why
// the last sync failed with a way to retry.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useStepSyncStatus } from '../services/stepSync';
import { StepSyncResult } from '../types/health';
import { useTheme } from '../hooks/useTheme';
import { useNow } from '../hooks/useNow';
import { formatSyncAge } from '../utils/time';

type StepSyncErrorCode = Extract<StepSyncResult, { status: 'error' }>['code'];

const UNAVAILABLE_TEXT =
  'Health Connect is updating or unavailable. Your steps are safe and will be added next time.';

/** Why a sync failed, and whether retrying now can help. */
const SYNC_ERRORS: Record<StepSyncErrorCode, { text: string; retry: boolean }> = {
  permission: { text: 'Step access was revoked. Reconnect Health Connect to sync.', retry: true },
  unavailable: { text: UNAVAILABLE_TEXT, retry: true },
  rate_limited: {
    text: 'Health Connect is busy. Your steps are safe; try again in a minute.',
    retry: true,
  },
  not_initialized: {
    text: "Health Connect isn't ready. Your steps are safe; try again.",
    retry: true,
  },
  not_authorized: { text: 'Step access not granted. Connect Health Connect to sync.', retry: true },
  // A failed load needs a restart (the persistence banner says so); a load in progress syncs itself.
  not_loaded: {
    text: "Your saved game hasn't loaded, so steps can't be synced yet.",
    retry: false,
  },
  unknown: { text: 'Sync failed. Your steps are safe; try again.', retry: true },
};

const UNSUPPORTED = {
  text: "Health Connect isn't supported on this device, so steps can't be synced.",
  retry: false,
};

const AGE_REFRESH_MS = 30_000;

export interface SyncStatusProps {
  /**
   * Why the health platform can't be used, if it can't: `unsupported` on this device for good,
   * or `unavailable` for now (e.g. Health Connect is updating).
   */
  healthUnavailable: 'unsupported' | 'unavailable' | null;
  onRetry: () => void;
}

export function SyncStatus({ healthUnavailable, onRetry }: SyncStatusProps) {
  const syncing = useStepSyncStatus((s) => s.syncing);
  const lastResult = useStepSyncStatus((s) => s.lastResult);
  const lastSyncedAt = useGameStore((s) => s.stepLedger?.lastSyncedAt);
  const now = useNow(AGE_REFRESH_MS);
  const { colors } = useTheme().theme;

  if (syncing) {
    return <Text style={[styles.line, { color: colors.textTertiary }]}>Syncing…</Text>;
  }

  const error =
    healthUnavailable === 'unsupported'
      ? UNSUPPORTED
      : healthUnavailable === 'unavailable'
        ? SYNC_ERRORS.unavailable
        : lastResult?.status === 'error'
          ? SYNC_ERRORS[lastResult.code]
          : null;
  if (error) {
    return (
      <View style={styles.error}>
        <Text style={[styles.errorText, { color: colors.warningText }]}>{error.text}</Text>
        {error.retry && (
          <TouchableOpacity
            onPress={onRetry}
            accessibilityRole="button"
            style={[styles.retryButton, { borderColor: colors.info }]}
          >
            <Text style={[styles.retryText, { color: colors.info }]}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <Text style={[styles.line, { color: colors.textTertiary }]}>
      {lastSyncedAt === undefined ? 'Not synced yet' : `Synced ${formatSyncAge(lastSyncedAt, now)}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: {
    fontSize: 11,
    marginTop: 4,
  },
  error: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  errorText: {
    fontSize: 12,
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
