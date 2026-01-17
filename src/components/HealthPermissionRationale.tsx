// HealthPermissionRationale - Displays when Health Connect requests permission rationale
// Shown when user taps "privacy policy" link in Health Connect permission dialog

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';

export interface HealthPermissionRationaleProps {
  onClose: () => void;
}

export function HealthPermissionRationale({ onClose }: HealthPermissionRationaleProps) {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Why WalkForage Needs Step Data</Text>

        <Text style={styles.section}>How We Use Your Steps</Text>
        <Text style={styles.paragraph}>
          WalkForage uses your step count to let you gather in-game resources. The more you walk in
          real life, the more stones and wood you can collect in the game.
        </Text>

        <Text style={styles.section}>What Data We Access</Text>
        <Text style={styles.bulletPoint}>• Step count (read-only)</Text>
        <Text style={styles.paragraph}>
          We only read your step count. We do not access any other health data such as heart rate,
          sleep, weight, or other metrics.
        </Text>

        <Text style={styles.section}>How Your Data Is Handled</Text>
        <Text style={styles.bulletPoint}>• Your step data stays on your device</Text>
        <Text style={styles.bulletPoint}>• We do not upload health data to any server</Text>
        <Text style={styles.bulletPoint}>• We do not share your data with third parties</Text>
        <Text style={styles.bulletPoint}>• We do not use your data for advertising</Text>

        <Text style={styles.section}>Your Control</Text>
        <Text style={styles.paragraph}>
          You can revoke access at any time through Health Connect settings. However, step gathering
          is the core gameplay mechanic, so the game requires step data to function.
        </Text>

        <TouchableOpacity
          style={styles.learnMoreButton}
          onPress={() =>
            Linking.openURL(
              'https://developer.android.com/health-and-fitness/guides/health-connect'
            )
          }
        >
          <Text style={styles.learnMoreText}>Learn more about Health Connect</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  section: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#555',
    lineHeight: 28,
    paddingLeft: 10,
  },
  learnMoreButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    alignItems: 'center',
  },
  learnMoreText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default HealthPermissionRationale;
