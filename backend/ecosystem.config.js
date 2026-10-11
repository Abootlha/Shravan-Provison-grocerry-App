// PM2 process file for the production backend. See docs/DEPLOYMENT.md.
//
// Deployed layout (managed by scripts/deploy/remote-deploy.sh):
//   <DEPLOY_PATH>/releases/<release>/ecosystem.config.js   <- this file
//   <DEPLOY_PATH>/current -> releases/<release>
//   <DEPLOY_PATH>/shared/.env, <DEPLOY_PATH>/shared/logs/
//
// The app runs from <DEPLOY_PATH>/current, not from the release directory, so a
// `pm2 reload` always starts whichever release `current` points at. The app
// reads its config from `.env` in its working directory (the shared file,
// linked into every release).
const path = require('path');

// PM2 loads this file through its real path, so __dirname is the release dir.
const inRelease = path.basename(path.dirname(__dirname)) === 'releases';
const deployRoot =
  process.env.DEPLOY_PATH ||
  (inRelease ? path.resolve(__dirname, '..', '..') : null);

const appDir = deployRoot ? path.join(deployRoot, 'current') : __dirname;
const logDir = deployRoot
  ? path.join(deployRoot, 'shared', 'logs')
  : path.join(__dirname, 'logs');

// Default 1 instance: the /orders Socket.IO namespace has no Redis adapter and
// clients fall back to HTTP long-polling, which needs sticky sessions that PM2
// cluster mode does not provide. Only raise this (PM2_INSTANCES=2 or "max" in
// shared/.env) once every gateway uses the Redis adapter and clients connect
// with the websocket transport only. Changing it needs `pm2 delete` + redeploy.
function parseInstances(value) {
  if (!value) return 1;
  if (value === 'max') return 'max';
  const n = Number(value);
  return Number.isInteger(n) && n !== 0 ? n : 1;
}

module.exports = {
  apps: [
    {
      name: 'shravan-backend',
      cwd: appDir,
      script: path.join(appDir, 'dist', 'main.js'),
      // Cluster mode gives zero-downtime `pm2 reload`, even with one instance.
      exec_mode: 'cluster',
      instances: parseInstances(process.env.PM2_INSTANCES),
      // main.ts calls process.send('ready') after app.listen().
      wait_ready: true,
      listen_timeout: 60000,
      // Time for Nest shutdown hooks (Mongo, Redis, BullMQ) before SIGKILL.
      kill_timeout: 15000,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '1G',
      min_uptime: '20s',
      max_restarts: 10,
      exp_backoff_restart_delay: 200,
      out_file: path.join(logDir, 'out.log'),
      error_file: path.join(logDir, 'error.log'),
      merge_logs: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
