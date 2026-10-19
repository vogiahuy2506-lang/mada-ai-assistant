module.exports = {
  apps: [{
    name: 'mada-ai',
    script: 'dist/server.mjs',
    cwd: '/home/hotro_digibook/mada-ai-assistant',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/home/hotro_digibook/.pm2/logs/mada-ai-error.log',
    out_file:   '/home/hotro_digibook/.pm2/logs/mada-ai-out.log',
    merge_logs: true,
    time: true
  }]
};
