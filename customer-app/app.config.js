const fs = require('fs');
const path = require('path');

// Static settings (ios/android/plugins/permissions) live in app.json and arrive
// here as `config`. This file only layers env-dependent values on top of it.

const DEV_DEFAULTS = {
  API_BASE_URL: 'http://localhost:3000/api/v1',
  TRACKING_URL: 'http://localhost:3000/tracking',
};

// Reads process.env first (EAS build profile `env`, shell), then this app's
// .env / .env.local. Never reads other packages' env files (e.g. backend/.env).
const loadEnvValue = (key, fallback = '') => {
  if (process.env[key]) {
    return process.env[key];
  }

  const candidateFiles = [
    path.join(__dirname, '.env.local'),
    path.join(__dirname, '.env'),
  ];

  for (const file of candidateFiles) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.startsWith(`${key}=`)) continue;
      const value = trimmed.slice(key.length + 1).trim();
      if (value) return value;
    }
  }

  return fallback;
};

const isProductionBuild = () => {
  if (loadEnvValue('PUBLIC_NODE_ENV').trim().toLowerCase() === 'production') return true;
  return ['production', 'preview'].includes(process.env.EAS_BUILD_PROFILE || '');
};

const isLocalUrl = (url) => !url || /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(url);

module.exports = ({ config }) => {
  const production = isProductionBuild();

  // Production URLs must come from the environment (EAS profile env); there is
  // deliberately no localhost fallback for production builds.
  const apiBaseUrl = loadEnvValue('API_BASE_URL', production ? '' : DEV_DEFAULTS.API_BASE_URL);
  const trackingUrl = loadEnvValue('TRACKING_URL', production ? '' : DEV_DEFAULTS.TRACKING_URL);
  const serviceUrl = (key) => loadEnvValue(key, apiBaseUrl);

  if (production && (isLocalUrl(apiBaseUrl) || isLocalUrl(trackingUrl))) {
    console.warn(
      '[app.config] Production build without a public API_BASE_URL/TRACKING_URL. ' +
        'Set them in eas.json build profile env (or EAS environment variables). The app will refuse to start.',
    );
  }

  const googleMapsApiKey = loadEnvValue('GOOGLE_MAPS_API_KEY');
  const plugins = [...(config.plugins || [])];
  const hasMapsPlugin = plugins.some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === 'react-native-maps');
  if (googleMapsApiKey && !hasMapsPlugin) {
    plugins.push([
      'react-native-maps',
      {
        iosGoogleMapsApiKey: googleMapsApiKey,
        androidGoogleMapsApiKey: googleMapsApiKey,
      },
    ]);
  }

  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        ...(config.ios && config.ios.config),
        googleMapsApiKey,
      },
    },
    android: {
      ...config.android,
      config: {
        ...(config.android && config.android.config),
        googleMaps: {
          ...(config.android && config.android.config && config.android.config.googleMaps),
          apiKey: googleMapsApiKey,
        },
      },
    },
    plugins,
    extra: {
      ...config.extra,
      PUBLIC_NODE_ENV: production ? 'production' : 'development',
      API_BASE_URL: apiBaseUrl,
      AUTH_SERVICE_URL: serviceUrl('AUTH_SERVICE_URL'),
      USER_SERVICE_URL: serviceUrl('USER_SERVICE_URL'),
      RIDER_SERVICE_URL: serviceUrl('RIDER_SERVICE_URL'),
      ORDER_SERVICE_URL: serviceUrl('ORDER_SERVICE_URL'),
      PRODUCT_SERVICE_URL: serviceUrl('PRODUCT_SERVICE_URL'),
      CART_SERVICE_URL: serviceUrl('CART_SERVICE_URL'),
      LOCATION_SERVICE_URL: serviceUrl('LOCATION_SERVICE_URL'),
      TRACKING_URL: trackingUrl,
      // Public (client) key only. Secrets such as MAPMYINDIA_CLIENT_SECRET must
      // never be embedded in the app bundle.
      MAPMYINDIA_API_KEY: loadEnvValue('MAPMYINDIA_API_KEY', loadEnvValue('MAPPLS_API_KEY')),
    },
  };
};
