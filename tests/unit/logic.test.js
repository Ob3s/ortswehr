// Unit-Tests für die reine Business-Logik aus js/logic.js. Laufen ohne Browser/Firebase.
// Ausführen: node --test tests/unit   (aus dem ortswehr/-Verzeichnis)
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  einsatzStunden,
  getStats,
  staerkeKategorie,
  dienstUnvollstaendig,
  einsatzUnvollstaendig,
  dienstSichtbar,
} = require('../../js/logic.js');

test('einsatzStunden: Bereitschaft bei Einsatz ist immer 0.25h', () => {
  assert.equal(einsatzStunden({ status: 'bereitschaft' }, { dauer_h: 5 }, true), 0.25);
});

test('einsatzStunden: ausgerückt ohne Endzeit zählt 0h (nicht die alte 15-Min-Pauschale)', () => {
  assert.equal(einsatzStunden({ status: 'kommt' }, { dauer_h: null }, true), 0);
});

test('einsatzStunden: ausgerückt mit gesetzter Dauer übernimmt diese', () => {
  assert.equal(einsatzStunden({ status: 'bestaetigt' }, { dauer_h: 3.5 }, true), 3.5);
});

test('einsatzStunden: Dienst nutzt immer die hinterlegte Dauer, keine Bereitschafts-Sonderregel', () => {
  assert.equal(einsatzStunden({ status: 'bereitschaft', dauer_h: 2 }, { dauer_h: 2 }, false), 2);
});

test('staerkeKategorie: erkennt Zugführer', () => {
  assert.equal(staerkeKategorie([{ bezeichnung: 'Zugführer-Lehrgang' }]), 'zugfuehrer');
});

test('staerkeKategorie: erkennt Gruppenführer, wenn kein Zugführer vorhanden', () => {
  assert.equal(staerkeKategorie([{ bezeichnung: 'Gruppenführer-Lehrgang' }]), 'gruppenfuehrer');
});

test('staerkeKategorie: ohne passende Lehrgänge -> Kamerad', () => {
  assert.equal(staerkeKategorie([{ bezeichnung: 'Erste Hilfe' }]), 'kamerad');
  assert.equal(staerkeKategorie([]), 'kamerad');
  assert.equal(staerkeKategorie(undefined), 'kamerad');
});

test('staerkeKategorie: Stichtag ignoriert Lehrgänge danach (historische Auswertung)', () => {
  const qualis = [{ bezeichnung: 'Zugführer', datum: '2026-06-01' }];
  assert.equal(staerkeKategorie(qualis, '2026-01-01'), 'kamerad');
  assert.equal(staerkeKategorie(qualis, '2026-12-31'), 'zugfuehrer');
});

test('dienstUnvollstaendig: vollständiger Dienst ist nicht unvollständig', () => {
  assert.equal(dienstUnvollstaendig({ typ: 'dienst', titel: 'Übung', datum: '2026-08-01', dauer_h: 2, art: 'x' }), false);
});

test('dienstUnvollstaendig: fehlende Dienst-Art macht ihn unvollständig', () => {
  assert.equal(dienstUnvollstaendig({ typ: 'dienst', titel: 'Übung', datum: '2026-08-01', dauer_h: 2 }), true);
});

test('dienstUnvollstaendig: Einsätze werden nie als unvollständiger Dienst gewertet', () => {
  assert.equal(dienstUnvollstaendig({ typ: 'einsatz' }), false);
});

test('einsatzUnvollstaendig: vollständiger Einsatz ist nicht unvollständig', () => {
  assert.equal(einsatzUnvollstaendig({ typ: 'einsatz', titel: 'Brand', datum: '2026-08-01', zeitEnde: '14:00', ort: 'Hauptstr. 1' }), false);
});

test('einsatzUnvollstaendig: fehlende Endzeit macht ihn unvollständig', () => {
  assert.equal(einsatzUnvollstaendig({ typ: 'einsatz', titel: 'Brand', datum: '2026-08-01', ort: 'Hauptstr. 1' }), true);
});

test('einsatzUnvollstaendig: fehlender Ort macht ihn unvollständig', () => {
  assert.equal(einsatzUnvollstaendig({ typ: 'einsatz', titel: 'Brand', datum: '2026-08-01', zeitEnde: '14:00' }), true);
});

test('getStats: zählt einen bestätigten Einsatz im aktuellen Jahr', () => {
  const jahr = new Date().getFullYear();
  const anwesenheiten = [{ uebungId: 'e1', typ: 'einsatz', status: 'bestaetigt', datum: `${jahr}-03-01` }];
  const einsatzMap = new Map([['e1', { dauer_h: 2, datum: `${jahr}-03-01` }]]);
  const stats = getStats(anwesenheiten, new Map(), einsatzMap, jahr);
  assert.equal(stats.einsaetze, 1);
  assert.equal(stats.gesamtEinsatz, 2);
});

test('getStats: Ausnahme statistikIgnorieren schließt einen Einsatz komplett aus', () => {
  const jahr = new Date().getFullYear();
  const anwesenheiten = [{ uebungId: 'e1', typ: 'einsatz', status: 'bestaetigt', datum: `${jahr}-03-01` }];
  const einsatzMap = new Map([['e1', { dauer_h: 2, datum: `${jahr}-03-01`, statistikIgnorieren: true }]]);
  const stats = getStats(anwesenheiten, new Map(), einsatzMap, jahr);
  assert.equal(stats.einsaetze, 0);
  assert.equal(stats.gesamtEinsatz, 0);
});

test('getStats: abgelehnte/unbeantwortete Anwesenheiten zählen nicht', () => {
  const jahr = new Date().getFullYear();
  const anwesenheiten = [{ uebungId: 'e1', typ: 'einsatz', status: 'kommt_nicht', datum: `${jahr}-03-01` }];
  const einsatzMap = new Map([['e1', { dauer_h: 2, datum: `${jahr}-03-01` }]]);
  const stats = getStats(anwesenheiten, new Map(), einsatzMap, jahr);
  assert.equal(stats.einsaetze, 0);
});

test('dienstSichtbar: normaler Dienst ist für alle in der eigenen Ortswehr sichtbar', () => {
  const d = { titel: 'Übung Löschangriff', ortswehrIds: ['ow1'] };
  const profil = { rolle: 'kamerad', ortswehrIds: ['ow1'] };
  assert.equal(dienstSichtbar(d, profil, []), true);
});

test('dienstSichtbar: AGT-Termin nur für AGT-Träger sichtbar (Kernbug: nicht einfach "hat man einen Dienst")', () => {
  const d = { titel: 'Belastungslauf AGT', ortswehrIds: ['ow1'] };
  const profil = { rolle: 'kamerad', ortswehrIds: ['ow1'] };
  assert.equal(dienstSichtbar(d, profil, []), false, 'ohne AGT-Qualifikation nicht sichtbar');
  assert.equal(dienstSichtbar(d, profil, [{ bezeichnung: 'AGT-Träger' }]), true, 'mit AGT-Qualifikation sichtbar');
});

test('dienstSichtbar: Maschinisten-Dienst nur für Maschinisten sichtbar', () => {
  const d = { titel: 'Maschinisten-Fortbildung', ortswehrIds: ['ow1'] };
  const profil = { rolle: 'kamerad', ortswehrIds: ['ow1'] };
  assert.equal(dienstSichtbar(d, profil, []), false);
  assert.equal(dienstSichtbar(d, profil, [{ bezeichnung: 'Maschinist' }]), true);
});

test('dienstSichtbar: Wehrführer sieht AGT-/Maschinisten-Dienste auch ohne eigene passende Qualifikation (Regressionstest 2026-09-01: der Wehrführer-Bypass fehlte bisher in diesen beiden Zweigen, obwohl er in Ortswehr- und Führungskräfte-Zweig existierte - er muss jeden Dienst anlegen/verwalten können)', () => {
  const wf = { rolle: 'wehrfuehrer' };
  assert.equal(dienstSichtbar({ titel: 'Belastungslauf AGT', ortswehrIds: ['ow1'] }, wf, []), true);
  assert.equal(dienstSichtbar({ titel: 'Maschinisten-Fortbildung', ortswehrIds: ['ow1'] }, wf, []), true);
});

test('dienstSichtbar: Führungskräfte-Termin nur für Gruppen-/Zugführer oder Wehrführer sichtbar', () => {
  const d = { titel: 'Gruppenführersitzung', ortswehrIds: ['ow1'] };
  const kamerad = { rolle: 'kamerad', ortswehrIds: ['ow1'] };
  assert.equal(dienstSichtbar(d, kamerad, []), false);
  assert.equal(dienstSichtbar(d, kamerad, [{ bezeichnung: 'Gruppenführer' }]), true);
  assert.equal(dienstSichtbar(d, { rolle: 'wehrfuehrer' }, []), true);
});

test('dienstSichtbar: fremde Ortswehr ist nicht sichtbar (außer Wehrführer)', () => {
  const d = { titel: 'Übung', ortswehrIds: ['ow-fremd'] };
  assert.equal(dienstSichtbar(d, { rolle: 'kamerad', ortswehrIds: ['ow1'] }, []), false);
  assert.equal(dienstSichtbar(d, { rolle: 'wehrfuehrer', ortswehrIds: ['ow1'] }, []), true);
});

test('getStats: nicht-relevanter Dienst zählt separat (dienstIrrelevant), nicht in dienstRelevant', () => {
  const jahr = new Date().getFullYear();
  const anwesenheiten = [{ uebungId: 'd1', typ: 'dienst', status: 'kommt', datum: `${jahr}-03-01` }];
  const dienstMap = new Map([['d1', { dauer_h: 3, datum: `${jahr}-03-01`, relevant: false }]]);
  const stats = getStats(anwesenheiten, dienstMap, new Map(), jahr);
  assert.equal(stats.dienstRelevant, 0);
  assert.equal(stats.dienstIrrelevant, 3);
});
