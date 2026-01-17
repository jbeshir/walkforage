// Custom Expo config plugin to handle Health Connect rationale intent detection
// This modifies MainActivity to pass the rationale intent to React Native via deep link
//
// Flow:
// 1. User taps "privacy policy" in Health Connect permissions dialog
// 2. Android launches MainActivity with ACTION_SHOW_PERMISSIONS_RATIONALE (Android 13-)
//    or VIEW_PERMISSION_USAGE (Android 14+)
// 3. Our modified onCreate() detects this and sets the intent data to our deep link
// 4. React Native's Linking.getInitialURL() returns this deep link
// 5. useHealthRationaleIntent hook detects it and shows the rationale modal
//
// Note: expo-health-connect already handles the AndroidManifest.xml configuration:
// - Intent filter for ACTION_SHOW_PERMISSIONS_RATIONALE on MainActivity (Android 13-)
// - Activity alias ViewPermissionUsageActivity for VIEW_PERMISSION_USAGE (Android 14+)
// The deep link scheme is configured via "scheme": "walkforage" in app.json.
// This plugin only handles the JavaScript-level intent detection.

const { withMainActivity } = require('@expo/config-plugins');

// Modify MainActivity.kt to detect rationale intents and pass to React Native
const withMainActivityRationale = (config) => {
  return withMainActivity(config, async (config) => {
    let contents = config.modResults.contents;

    // Check if already modified
    if (contents.includes('SHOW_PERMISSIONS_RATIONALE')) {
      return config;
    }

    // Add Uri import if not present
    if (!contents.includes('import android.net.Uri')) {
      contents = contents.replace(/(package [^\n]+\n)/, '$1\nimport android.net.Uri\n');
    }

    // The rationale check code to insert
    const rationaleCheckCode = `
        // Check if launched from Health Connect rationale intent
        // This happens when user taps "privacy policy" in Health Connect permissions dialog
        val action = intent?.action
        if (action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" ||
            action == "android.intent.action.VIEW_PERMISSION_USAGE") {
            // Set the intent data to our deep link so React Native can detect it
            // via Linking.getInitialURL()
            intent.data = Uri.parse("walkforage://health-rationale")
        }`;

    // Check if onCreate already exists
    if (contents.includes('override fun onCreate')) {
      // Insert our code at the beginning of existing onCreate, after the opening brace
      contents = contents.replace(
        /(override fun onCreate\s*\([^)]*\)\s*\{)/,
        `$1${rationaleCheckCode}`
      );
    } else {
      // No existing onCreate - add a new one after class declaration
      const onCreateMethod = `
    override fun onCreate(savedInstanceState: android.os.Bundle?) {${rationaleCheckCode}
        super.onCreate(savedInstanceState)
    }
`;
      contents = contents.replace(
        /(class MainActivity\s*:\s*ReactActivity\(\)\s*\{)/,
        `$1\n${onCreateMethod}`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = function withHealthConnectRationale(config) {
  return withMainActivityRationale(config);
};
