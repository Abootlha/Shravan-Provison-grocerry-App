const fs = require('fs');
const path = require('path');

const ENV_DEFAULTS = {
  production: {
    API_BASE_URL: 'https://api.lumioui.com/api/v1',
    TRACKING_URL: 'https://api.lumioui.com/tracking',
  },
  development: {
    API_BASE_URL: 'http://localhost:3000/api/v1',
    TRACKING_URL: 'http://localhost:3000/tracking',
  },
};

const loadEnvValue = (key, fallback = '') => {
  if (process.env[key]) {
    return process.env[key];
  }

  const candidateFiles = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '.env.local'),
    path.join(__dirname, '..', '..', 'backend', '.env'),
  ];

  for (const file of candidateFiles) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.startsWith(`${key}=`)) continue;
      return trimmed.slice(key.length + 1);
    }
  }

  return fallback;
};

const getNodeEnv = () => (loadEnvValue('PUBLIC_NODE_ENV', 'development').trim().toLowerCase() === 'production'
  ? 'production'
  : 'development');

const getEnvDefault = (key) => ENV_DEFAULTS[getNodeEnv()][key] || '';

module.exports = () => ({
  expo: {
    name: 'Rider App',
    slug: 'rider-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1E3A8A',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.shravankirana.rider',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'We need your location to show your position on the map and track deliveries.',
        NSLocationAlwaysUsageDescription:
          'We need your location to track deliveries even when the app is in the background.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'We need your location to track deliveries and show your position on the map.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1E3A8A',
      },
      package: 'com.shravankirana.rider',
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'CALL_PHONE',
      ],
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow ShravanKirana to use your location for delivery tracking.',
        },
      ],
    ],
    extra: {
      PUBLIC_NODE_ENV: getNodeEnv(),
      LOCAL_IP: loadEnvValue('LOCAL_IP', '192.168.1.7'),
      AUTH_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('AUTH_SERVICE_URL', getEnvDefault('API_BASE_URL')),
      RIDER_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('RIDER_SERVICE_URL', getEnvDefault('API_BASE_URL')),
      ORDER_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('ORDER_SERVICE_URL', getEnvDefault('API_BASE_URL')),
      TRACKING_URL: getNodeEnv() === 'production' ? getEnvDefault('TRACKING_URL') : loadEnvValue('TRACKING_URL', getEnvDefault('TRACKING_URL')),
      MAPMYINDIA_API_KEY: loadEnvValue('MAPMYINDIA_API_KEY', loadEnvValue('MAPPLS_API_KEY')),
      MAPMYINDIA_CLIENT_ID: loadEnvValue('MAPMYINDIA_CLIENT_ID'),
      MAPMYINDIA_CLIENT_SECRET: loadEnvValue('MAPMYINDIA_CLIENT_SECRET'),
    },
  },
});
