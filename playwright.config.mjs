import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8788',
    viewport: { width: 1200, height: 800 },
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] }
  },
  webServer: { command: 'node tests/server.mjs', url: 'http://localhost:8788', reuseExistingServer: true }
});
