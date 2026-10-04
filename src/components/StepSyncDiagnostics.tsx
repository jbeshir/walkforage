// StepSyncDiagnostics - The step ledger next to what Health Connect last reported, for checking
// syncs on a real device (cheat menu, so also in production builds).

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useStepSyncStatus } from '../services/stepSync';
import { healthService } from '../services/HealthService';
import { localDayStart } from '../services/stepLedger';
import { SourceStepsResult, StepSyncResult } from '../types/health';
import { ThemeColors } from '../config/theme';
import { formatDay, formatTime } from '../utils/time';

function formatMoment(ms: number): string {
  return `${formatDay(ms)} ${formatTime(ms)}`;
}

function describeResult(result: StepSyncResult | null): string {
  if (!result) return 'none since the app started';
  if (result.status === 'error') return `error ${result.code}: ${result.message}`;
  const flags = [
    result.welcome && 'welcome',
    result.historyLimitedBefore !== undefined &&
      `history from ${formatMoment(result.historyLimitedBefore)}`,
  ].filter(Boolean);
  return `synced +${result.credited} at ${formatMoment(result.syncedAt)}${
    flags.length > 0 ? ` (${flags.join(', ')})` : ''
  }`;
}

export function StepSyncDiagnostics({ colors }: { colors: ThemeColors }) {
  const stepLedger = useGameStore((s) => s.stepLedger);
  const lastResult = useStepSyncStatus((s) => s.lastResult);
  const lastTotals = useStepSyncStatus((s) => s.lastTotals);
  const [bySource, setBySource] = useState<SourceStepsResult | null>(null);
  const [reading, setReading] = useState(false);

  const readTodayBySource = async () => {
    setReading(true);
    const now = Date.now();
    setBySource(await healthService.readStepsBySource(localDayStart(now), now));
    setReading(false);
  };

  const label = [styles.label, { color: colors.textTertiary }];
  const value = [styles.value, { color: colors.textPrimary }];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Step Sync</Text>
      <Text style={label}>Last synced</Text>
      <Text style={value}>{stepLedger ? formatMoment(stepLedger.lastSyncedAt) : 'never'}</Text>
      <Text style={label}>Last result</Text>
      <Text style={value}>{describeResult(lastResult)}</Text>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ledger buckets</Text>
      {stepLedger ? (
        stepLedger.buckets.map((bucket) => (
          <View
            key={bucket.startMs}
            style={[styles.row, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Text style={value}>{formatDay(bucket.startMs)}</Text>
            <Text style={label}>
              {formatMoment(bucket.startMs)} → {formatMoment(bucket.endMs)}
            </Text>
            <Text style={value}>
              credited {bucket.credited} · Health Connect{' '}
              {lastTotals.get(bucket.startMs) ?? 'not read yet'}
            </Text>
          </View>
        ))
      ) : (
        <Text style={label}>No ledger yet: the first sync gives the welcome credit.</Text>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.cheat }]}
        onPress={readTodayBySource}
        disabled={reading}
      >
        <Text style={styles.buttonText}>{reading ? 'Reading…' : 'Read today by source'}</Text>
      </TouchableOpacity>
      {bySource && (
        <View>
          <Text style={label}>Today by source: raw records, not de-duplicated</Text>
          {!bySource.ok ? (
            <Text style={[styles.value, { color: colors.danger }]}>
              {bySource.code}: {bySource.message}
            </Text>
          ) : bySource.sources.length === 0 ? (
            <Text style={value}>No step records today</Text>
          ) : (
            bySource.sources.map((source) => (
              <View
                key={source.origin}
                style={[styles.row, { backgroundColor: colors.surfaceSecondary }]}
              >
                <Text style={value}>{source.origin}</Text>
                <Text style={label}>
                  {source.steps} steps in {source.records} records
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
  },
  value: {
    fontSize: 14,
  },
  row: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
