const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('API-Status zeigt alle vier Dienste als erreichbar', async ({ page }) => {
  await login(page);
  await page.click('[data-page="kameraden"]');
  await page.getByRole('button', { name: /API-Status/ }).click();
  await expect(page.locator('#page-title')).toHaveText('API-Status');

  const badges = page.locator('[data-rolle="badge"]');
  await expect(badges).toHaveCount(4, { timeout: 5_000 });
  for (const badge of await badges.all()) {
    await expect(badge).toContainText('erreichbar', { timeout: 10_000 });
  }
});
