async function login(page) {
  const email = process.env.ORTSWEHR_TEST_LOGIN;
  const pass = process.env.ORTSWEHR_TEST_PASSWORD;
  if (!email || !pass) {
    throw new Error('ORTSWEHR_TEST_LOGIN / ORTSWEHR_TEST_PASSWORD nicht gesetzt (GitHub Secrets in CI, lokal per .env/Umgebungsvariable)');
  }
  await page.goto('index.html'); // KEIN führender Slash - würde den /ortswehr-dev/-Pfad der baseURL überschreiben
  await page.fill('#login-email', email);
  await page.fill('#login-pass', pass);
  await page.click('#login-btn');
  // Erster Login braucht länger (Firestore-Realtime-Kanal-Aufbau ohne warmen Cache), daher
  // großzügiges Timeout statt der sonst üblichen ~5s.
  await page.waitForSelector('#app:not(.hidden)', { timeout: 25_000 });
}

module.exports = { login };
