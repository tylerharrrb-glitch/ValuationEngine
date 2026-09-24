import { defineConfig } from '@playwright/test';

const remote = process.env.WOLF_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: remote ?? 'http://127.0.0.1:4173', acceptDownloads: true, viewport: { width: 1440, height: 900 } },
  webServer: remote ? undefined : { command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 120_000 },
});
