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
    path.join(__dirname, '..', 'backend', '.env'),
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
    name: 'ShravanKirana Customer',
    slug: 'shravankirana-customer',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#F8CB46',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.shravankirana.customer',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F8CB46',
      },
      package: 'com.shravankirana.customer',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    scheme: 'shravankirana',
    extra: {
      PUBLIC_NODE_ENV: getNodeEnv(),
      LOCAL_IP: loadEnvValue('LOCAL_IP', '192.168.31.166'),
      API_BASE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('API_BASE_URL', getEnvDefault('API_BASE_URL')),
      AUTH_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('AUTH_SERVICE_URL', loadEnvValue('API_BASE_URL', getEnvDefault('API_BASE_URL'))),
      USER_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('USER_SERVICE_URL', loadEnvValue('API_BASE_URL', getEnvDefault('API_BASE_URL'))),
      RIDER_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('RIDER_SERVICE_URL', loadEnvValue('API_BASE_URL', getEnvDefault('API_BASE_URL'))),
      ORDER_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('ORDER_SERVICE_URL', loadEnvValue('API_BASE_URL', getEnvDefault('API_BASE_URL'))),
      PRODUCT_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('PRODUCT_SERVICE_URL', loadEnvValue('API_BASE_URL', getEnvDefault('API_BASE_URL'))),
      CART_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('CART_SERVICE_URL', loadEnvValue('API_BASE_URL', getEnvDefault('API_BASE_URL'))),
      LOCATION_SERVICE_URL: getNodeEnv() === 'production' ? getEnvDefault('API_BASE_URL') : loadEnvValue('LOCATION_SERVICE_URL', loadEnvValue('API_BASE_URL', getEnvDefault('API_BASE_URL'))),
      TRACKING_URL: getNodeEnv() === 'production' ? getEnvDefault('TRACKING_URL') : loadEnvValue('TRACKING_URL', getEnvDefault('TRACKING_URL')),
      MAPMYINDIA_API_KEY: loadEnvValue('MAPMYINDIA_API_KEY', loadEnvValue('MAPPLS_API_KEY')),
      MAPMYINDIA_CLIENT_ID: loadEnvValue('MAPMYINDIA_CLIENT_ID'),
      MAPMYINDIA_CLIENT_SECRET: loadEnvValue('MAPMYINDIA_CLIENT_SECRET'),
    },
  },
});
