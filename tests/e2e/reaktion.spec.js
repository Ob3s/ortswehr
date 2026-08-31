const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('Reaktion auf einen Einsatz setzen und Persistenz nach Reload prüfen', async ({ page }) => {
  await login(page);
  await page.click('[data-page="einsaetze"]');
  await page.getByText('E2E-Test-Einsatz', { exact: false }).click();

  await expect(page.locator('#btn-kommt')).toBeVisible();
  await page.click('#btn-kommt');

  // App zeigt die eigene Reaktion (kurzName-Format "Nachname, V.") in #einsatz-reaktionen
  await expect(page.locator('#einsatz-reaktionen')).toContainText('Wehrführer', { timeout: 10_000 });

  // Reload landet wieder auf dem Dashboard (clientseitiges Routing, keine echte URL pro Seite) -
  // erneut zum Test-Einsatz navigieren, um die Persistenz in Firestore zu prüfen (nicht nur im
  // clientseitigen State).
  await page.reload();
  await page.waitForSelector('#app:not(.hidden)', { timeout: 45_000 });
  await page.click('[data-page="einsaetze"]');
  await page.getByText('E2E-Test-Einsatz', { exact: false }).click();
  await expect(page.locator('#einsatz-reaktionen')).toContainText('Wehrführer', { timeout: 10_000 });
});
