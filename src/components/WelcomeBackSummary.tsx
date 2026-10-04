// WelcomeBackSummary - What syncs credited since the player last dismissed it: the total, a line
// per day, and whether Health Connect could share all of the history.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { dismissCreditSummary, useStepSyncStatus } from '../services/stepSync';
import { DayCredit, StepSyncResult } from '../types/health';
import { WELCOME_DAYS } from '../config/stepSync';
import { useTheme } from '../hooks/useTheme';
import { useNow } from '../hooks/useNow';
import { MINUTE_MS, formatDay, relativeDay } from '../utils/time';

/** "+1,900 steps today", "+1,900 steps on Mon 28 Sep", or "+1,900 late steps from yesterday" */
function dayLine({ startMs, steps, late }: DayCredit, nowMs: number): string {
  const day = relativeDay(startMs, nowMs);
  const count = `+${steps.toLocaleString()}`;
  if (late) return `${count} late steps from ${day}`;
  return day === 'today' || day === 'yesterday'
    ? `${count} steps ${day}`
    : `${count} steps on ${day}`;
}

/**
 * The headline. A welcome that found no steps yet says they are coming. Otherwise "since" the
 * first day only when steps were walked since then: all-late credits are steps that arrived late,
 * not a walk.
 */
function headline(credit: Extract<StepSyncResult, { status: 'synced' }>, nowMs: number): string {
  if (credit.welcome && credit.credited === 0) {
    return `Welcome to WalkForage! Steps from the last ${WELCOME_DAYS} days will appear here as your watch syncs.`;
  }
  const total = `+${credit.credited.toLocaleString()}`;
  if (credit.welcome) {
    return `Welcome to WalkForage! We've added ${total} steps from your last ${WELCOME_DAYS} days`;
  }
  if (credit.perDay.every((day) => day.late)) return `${total} late steps added`;
  const first = relativeDay(credit.perDay[0].startMs, nowMs);
  return first === 'today' ? `${total} steps today` : `${total} steps since ${first}`;
}

const DAY_REFRESH_MS = MINUTE_MS;

export function WelcomeBackSummary() {
  const credit = useStepSyncStatus((s) => s.unseenCredit);
  const now = useNow(DAY_REFRESH_MS);
  const { colors } = useTheme().theme;
  if (!credit) return null;

  const title = headline(credit, now);

  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.card,
        { backgroundColor: colors.selectedBackground, borderColor: colors.primary },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <TouchableOpacity
          onPress={dismissCreditSummary}
          accessibilityRole="button"
          accessibilityLabel="Dismiss step summary"
          hitSlop={8}
        >
          <Text style={[styles.dismiss, { color: colors.textTertiary }]}>✕</Text>
        </TouchableOpacity>
      </View>
      {credit.perDay.map((day) => (
        <Text key={day.startMs} style={[styles.day, { color: colors.textSecondary }]}>
          {dayLine(day, now)}
        </Text>
      ))}
      {credit.credited > 0 && (
        <Text style={[styles.note, { color: colors.textTertiary }]}>
          Recent days may still update as your watch syncs
        </Text>
      )}
      {credit.historyLimitedBefore !== undefined && (
        <Text style={[styles.notice, { color: colors.warningText }]}>
          {`After a reinstall, Health Connect may only share steps from ${formatDay(credit.historyLimitedBefore)} onward; earlier steps may be missing.`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  dismiss: {
    fontSize: 14,
  },
  day: {
    fontSize: 12,
    marginTop: 2,
  },
  note: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
  notice: {
    fontSize: 11,
    marginTop: 6,
  },
});
