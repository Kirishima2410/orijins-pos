module.exports = {
  apps: [
    {
      name: 'orijins-backend',
      script: 'server.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'orijins-frontend',
      script: 'npx',
      args: 'serve -s build -l 3000',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
