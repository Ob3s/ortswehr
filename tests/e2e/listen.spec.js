const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('Einsätze-Liste rendert und zeigt den Test-Einsatz', async ({ page }) => {
  await login(page);
  await page.click('[data-page="einsaetze"]');
  await expect(page.locator('#page-title')).toHaveText('Einsätze');
  await expect(page.getByText('E2E-Test-Einsatz', { exact: false })).toBeVisible();
});

test('Dienste-Liste rendert ohne Fehler', async ({ page }) => {
  await login(page);
  await page.click('[data-page="dienste"]');
  await expect(page.locator('#page-title')).toHaveText('Dienste');
  // Leere Liste ist auf frischem DEV-Stand ok, Hauptsache kein Absturz/leere Seite
  await expect(page.locator('#main-content')).not.toBeEmpty();
});
