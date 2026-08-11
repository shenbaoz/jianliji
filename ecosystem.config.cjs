module.exports = {
  apps: [
    {
      name: "znhil-resume-api",
      script: "server/index.mjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "500M",
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        BACKEND_HOST: "127.0.0.1",
        BACKEND_PORT: "3102"
      }
    }
  ]
};
