// pm2 keeps the API running, restarts it if it crashes, and brings it back
// after a server reboot. Secrets are read from server/.env by the app itself.
module.exports = {
  apps: [
    {
      name: 'thunderstream-api',
      cwd: '/srv/thunderstream/server',
      script: 'src/index.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
      time: true,
    },
  ],
};
