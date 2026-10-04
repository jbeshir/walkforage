// Persistence Error Banner - Non-modal warning for load and save failures
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGameStore } from '../store/gameStore';
import { useTheme } from '../hooks/useTheme';

export function PersistenceErrorBanner(): React.ReactElement | null {
  const saveError = useGameStore((s) => s.saveError);
  const loadFailed = useGameStore((s) => s.loadFailed);
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  // A failed load blocks every save (so the stored game is not overwritten), so it takes
  // precedence over a save error.
  const message = loadFailed
    ? "Couldn't load your saved game. Progress isn't being saved; restart the app to retry."
    : saveError
      ? "Progress isn't being saved"
      : null;
  if (message === null) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={message}
      pointerEvents="none"
      style={[
        styles.banner,
        {
          paddingTop: insets.top,
          backgroundColor: colors.warningBackground,
          borderBottomColor: colors.warning,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.warningText }]}>{`⚠ ${message}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
