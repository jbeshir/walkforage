// Persistence Error Banner - Non-modal warning for save failures
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGameState } from '../hooks/useGameState';
import { useTheme } from '../hooks/useTheme';

export function PersistenceErrorBanner(): React.ReactElement | null {
  const { saveError } = useGameState();
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  if (!saveError) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel="Progress isn't being saved"
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
      <Text style={[styles.text, { color: colors.warningText }]}>
        {"⚠ Progress isn't being saved"}
      </Text>
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
