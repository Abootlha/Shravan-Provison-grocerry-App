#!/usr/bin/env node

/**
 * Verification script for Order Tracking System dependencies
 * Run with: node verify-tracking-dependencies.js
 */

console.log('🔍 Verifying Order Tracking System Dependencies...\n');

const dependencies = [
  { name: '@nestjs/websockets', module: '@nestjs/websockets' },
  { name: '@nestjs/platform-socket.io', module: '@nestjs/platform-socket.io' },
  { name: 'socket.io', module: 'socket.io' },
  { name: '@nestjs/bullmq', module: '@nestjs/bullmq' },
  { name: 'bullmq', module: 'bullmq' },
  { name: 'ioredis', module: 'ioredis' },
  { name: 'class-validator', module: 'class-validator' },
  { name: 'class-transformer', module: 'class-transformer' },
  { name: '@googlemaps/google-maps-services-js', module: '@googlemaps/google-maps-services-js' },
];

let allPassed = true;

dependencies.forEach(({ name, module }) => {
  try {
    require(module);
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name} - NOT INSTALLED`);
    allPassed = false;
  }
});

console.log('\n📋 Environment Variables Check:\n');

const requiredEnvVars = [
  'MONGODB_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'GOOGLE_MAPS_API_KEY',
  'SOCKET_IO_CORS_ORIGIN',
  'STALE_ORDER_THRESHOLD_MINUTES',
  'ANOMALY_THRESHOLD_HOURS',
  'ETA_RECALC_INTERVAL_MINUTES',
  'REDIS_CACHE_TTL_SECONDS',
  'ETA_CACHE_TTL_SECONDS',
  'LOCATION_THROTTLE_SECONDS',
  'MAX_CONCURRENT_JOBS',
];

require('dotenv').config();

requiredEnvVars.forEach((varName) => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}`);
  } else {
    console.log(`⚠️  ${varName} - NOT SET (using default or needs configuration)`);
  }
});

console.log('\n📊 Summary:\n');

if (allPassed) {
  console.log('✅ All required dependencies are installed!');
  console.log('✅ Project is ready for Order Tracking System implementation.');
  console.log('\n📝 Next Steps:');
  console.log('   1. Configure GOOGLE_MAPS_API_KEY in .env file');
  console.log('   2. Ensure Redis is running (redis-server)');
  console.log('   3. Proceed with Task 2: Implement Order data model and schema');
} else {
  console.log('❌ Some dependencies are missing. Run: npm install');
  process.exit(1);
}
