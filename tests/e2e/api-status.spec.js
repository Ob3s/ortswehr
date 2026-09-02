const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

// Deckt genau die Bug-Klasse ab, die die Adress-Autovervollständigung auf DEV lahmgelegt hat:
// eine eigene Cloud Function ohne öffentliche Aufruf-Berechtigung antwortet mit HTTP 403 direkt
// von Google Frontend statt mit der eigenen Logik. Vorher prüften die E2E-Tests nur den
// "golden path" (Login/Dashboard/Listen) - keine der eigenen HTTP-Functions wurde je angefasst,
// weshalb dieser Ausfall unbemerkt blieb (siehe PROJEKT-UEBERGABE.md 13.11).
test('API-Status zeigt alle acht Dienste als erreichbar (inkl. eigener Cloud Functions)', async ({ page }) => {
  await login(page);
  await page.click('#menu-btn');
  await page.getByRole('button', { name: /API-Status/ }).click();
  await expect(page.locator('#page-title')).toHaveText('API-Status');

  const badges = page.locator('[data-rolle="badge"]');
  await expect(badges).toHaveCount(8, { timeout: 5_000 });
  for (const badge of await badges.all()) {
    await expect(badge).toContainText('erreichbar', { timeout: 10_000 });
  }

  await expect(page.locator('#api-status-summary')).toContainText('Alle Dienste laufen', { timeout: 15_000 });
});
