// useHealthRationaleIntent - Detects when app is opened via Health Connect rationale intent
// Returns true if app was opened to show permissions rationale
//
// When user taps "privacy policy" in Health Connect permission dialog, Android launches
// our app with ACTION_SHOW_PERMISSIONS_RATIONALE intent. Our config plugin redirects
// this to walkforage://health-rationale deep link, which this hook detects.

import { useEffect, useState } from 'react';
import { Platform, Linking } from 'react-native';

/**
 * Hook to detect if app was opened to show health permissions rationale
 * This happens when user taps "privacy policy" in Health Connect permission dialog
 */
export function useHealthRationaleIntent(): {
  showRationale: boolean;
  dismissRationale: () => void;
} {
  const [showRationale, setShowRationale] = useState(false);

  useEffect(() => {
    // Only relevant for Android - iOS uses HealthKit which has different flow
    if (Platform.OS !== 'android') return;

    // Check initial URL that launched the app
    async function checkInitialUrl() {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && isRationaleUrl(initialUrl)) {
          setShowRationale(true);
        }
      } catch (error) {
        console.warn('Failed to check initial URL:', error);
      }
    }

    checkInitialUrl();

    // Listen for URL changes (in case app is already open)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url && isRationaleUrl(url)) {
        setShowRationale(true);
      }
    });

    return () => subscription.remove();
  }, []);

  const dismissRationale = () => setShowRationale(false);

  return { showRationale, dismissRationale };
}

// Strict pattern to match only the health rationale deep link
// Matches: walkforage://health-rationale or walkforage://health-rationale/
const RATIONALE_URL_PATTERN = /^walkforage:\/\/health-rationale\/?$/;

/**
 * Check if URL is the health rationale deep link
 * Uses strict regex to avoid false positives from similar URLs
 */
function isRationaleUrl(url: string): boolean {
  return RATIONALE_URL_PATTERN.test(url);
}

export default useHealthRationaleIntent;
