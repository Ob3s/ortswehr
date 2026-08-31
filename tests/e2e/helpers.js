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
  // Erster Login braucht länger (Firestore-Realtime-Kanal-Aufbau ohne warmen Cache), auf
  // CI-Runnern mit spürbarer Varianz trotz IPv6-Fix - daher etwas großzügiger als lokal nötig.
  await page.waitForSelector('#app:not(.hidden)', { timeout: 45_000 });
}

module.exports = { login };
