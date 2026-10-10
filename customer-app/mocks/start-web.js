// Dev helper: start the Expo web server with mock API data (cross-platform env).
// Usage (from repo root): node customer-app/mocks/start-web.js [port]
const { spawn } = require('child_process');
const path = require('path');

const port = process.argv[2] || '8097';
const child = spawn('npx', ['expo', 'start', '--web', '--port', port], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    EXPO_PUBLIC_MOCK_API: '1',
    EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: '1',
    BROWSER: 'none',
  },
});
child.on('exit', (code) => process.exit(code ?? 0));
