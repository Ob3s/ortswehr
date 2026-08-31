const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('Dashboard lädt nach Login ohne Konsolenfehler', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await login(page);

  await expect(page.locator('#page-title')).toHaveText('Dashboard');
  await expect(page.getByText('Hallo,', { exact: false })).toBeVisible();
  expect(consoleErrors, `Konsolenfehler auf dem Dashboard: ${consoleErrors.join(' | ')}`).toEqual([]);
});
