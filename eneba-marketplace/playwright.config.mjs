import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: {baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4178', trace: 'retain-on-failure', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {}},
  reporter: process.env.CI ? 'github' : 'list',
});
