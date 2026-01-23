export default {
  expo: {
    name: 'walkforage-app',
    slug: 'walkforage-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    plugins: [
      [
        'expo-asset',
        {
          assets: ['./assets/gis'],
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            minSdkVersion: 26,
          },
        },
      ],
      'expo-health-connect',
      [
        '@kingstinct/react-native-healthkit',
        {
          background: false,
        },
      ],
      './plugins/withHealthConnectRationale',
    ],
    scheme: 'walkforage',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSHealthShareUsageDescription: 'WalkForage uses your step count to gather resources.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.jbeshir.walkforageapp',
      permissions: ['android.permission.health.READ_STEPS'],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: 'ab28bcd9-39af-44d0-a90b-f10a36bd4ce6',
      },
    },
  },
};
