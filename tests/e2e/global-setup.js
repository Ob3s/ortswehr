// Legt vor dem E2E-Lauf einen Test-Einsatz in Firestore (DEV) an, den die Specs ansteuern können,
// und räumt ihn danach wieder auf (global-teardown.js). Braucht FIREBASE_DEV_SERVICE_ACCOUNT
// (Pfad zur Service-Account-JSON für ffw-oegeln-dev) als Umgebungsvariable.
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '.e2e-state.json');

module.exports = async () => {
  const saPath = process.env.FIREBASE_DEV_SERVICE_ACCOUNT;
  if (!saPath) throw new Error('FIREBASE_DEV_SERVICE_ACCOUNT nicht gesetzt');

  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore, Timestamp } = require('firebase-admin/firestore');
  const serviceAccount = require(path.resolve(saPath));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const ref = db.collection('einsaetze').doc();
  await ref.set({
    titel: 'E2E-Test-Einsatz (automatisch erzeugt, wird nach dem Lauf gelöscht)',
    datum: Timestamp.now(),
    typ: 'einsatz',
    ort: 'Teststraße 1',
    relevant: true,
    zeitBeginn: '10:00',
  });

  fs.writeFileSync(STATE_FILE, JSON.stringify({ einsatzId: ref.id }));
};
