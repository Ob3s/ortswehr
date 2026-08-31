const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '.e2e-state.json');

module.exports = async () => {
  if (!fs.existsSync(STATE_FILE)) return;
  const { einsatzId } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const saPath = process.env.FIREBASE_DEV_SERVICE_ACCOUNT;

  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (!getApps().length) {
    const serviceAccount = require(path.resolve(saPath));
    initializeApp({ credential: cert(serviceAccount) });
  }
  const db = getFirestore();

  const anwSnap = await db.collection('anwesenheiten').where('uebungId', '==', einsatzId).get();
  await Promise.all(anwSnap.docs.map(d => d.ref.delete()));
  await db.collection('einsaetze').doc(einsatzId).delete();

  fs.unlinkSync(STATE_FILE);
};
