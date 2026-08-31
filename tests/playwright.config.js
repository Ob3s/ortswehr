// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 150_000,
  fullyParallel: false, // teilen sich einen DEV-Testuser/dieselben Firestore-Daten
  workers: 1, // ein gemeinsamer Testuser/Datensatz - parallele Logins bremsen sich sonst gegenseitig aus
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: require.resolve('./e2e/global-setup.js'),
  globalTeardown: require.resolve('./e2e/global-teardown.js'),
  use: {
    baseURL: process.env.ORTSWEHR_BASE_URL || 'https://ob3s.github.io/ortswehr-dev/',
    trace: 'retain-on-failure',
  },
});
