// js/logic.js – reine Business-Logik-Funktionen ohne Firebase-/DOM-Abhängigkeiten, ausgelagert
// aus pages.js damit sie ohne Browser mit `node --test` testbar sind (siehe tests/unit/).
// Wird als klassisches <script> vor pages.js geladen (keine Module-Scope-Isolation nötig), die
// Funktionen werden zusätzlich explizit auf window gehängt, analog zum window.X=...-Muster,
// das der Rest der App für seitenübergreifend aufrufbare Funktionen schon verwendet.

// Stunden-Anrechnung für eine Anwesenheit: bei Diensten immer die hinterlegte Dauer.
// Bei Einsätzen gilt die pauschale 15-Minuten-Regel für "Bereitschaft" (in der Wache geblieben,
// nicht ausgerückt) – unabhängig davon, ob/wann die Einsatz-Endzeit gesetzt ist (siehe
// pruefeBereitschaftAutoEndzeit() in pages.js). Wer tatsächlich ausgerückt ist, bekommt die
// reguläre Dauer aus Beginn/Ende des Einsatzes – solange die Endzeit noch fehlt, zählen für ihn
// 0 Std., bis sie nachgetragen wird.
function einsatzStunden(a, eintrag, istEinsatz) {
  if (istEinsatz && a.status === 'bereitschaft') return 0.25;
  return eintrag?.dauer_h ?? a.dauer_h ?? 0;
}

function getStats(anwesenheiten, dienstMap, einsatzMap, jahr) {
  const jetzt   = new Date();
  const jahrAkt = jahr || jetzt.getFullYear();
  // Die rollierende 12-Monats-Zielgröße bezieht sich immer auf "heute", unabhängig vom jahr-Parameter
  const vor12m  = new Date(); vor12m.setFullYear(jetzt.getFullYear()-1); vor12m.setHours(0,0,0,0);

  let gesamtEinsatz=0, dienstRelevant=0, dienstIrrelevant=0, einsaetze=0, dienste=0;
  let dienstRelevantAnzahl=0, dienstIrrelevantAnzahl=0;
  let dienstStunden12m=0, dienste12m=0;
  for (const a of anwesenheiten) {
    if (a.status !== 'bestaetigt' && a.status !== 'kommt' && a.status !== 'bereitschaft') continue;
    const dienstEintrag  = dienstMap?.get(a.uebungId)  || null;
    const einsatzEintrag = einsatzMap?.get(a.uebungId) || null;
    const eintrag   = dienstEintrag || einsatzEintrag || null;
    const typNorm   = a.typ === 'einsaetze' ? 'einsatz' : a.typ === 'dienste' ? 'dienst' : a.typ;
    const istEinsatz = typNorm === 'einsatz' || (!a.typ && !!einsatzEintrag && !dienstEintrag);
    const h = einsatzStunden(a, eintrag, istEinsatz);
    const d = a.datum?.toDate ? a.datum.toDate() : (eintrag?.datum?.toDate?.()  || new Date(a.datum));
    // relevant: default true, explizit false nur wenn gesetzt
    const istRelevant = eintrag?.relevant !== false;

    if (istEinsatz) {
      // Ausnahme: Einsätze mit statistikIgnorieren fließen bewusst nicht in Einsatzzahlen/-stunden ein.
      if (einsatzEintrag?.statistikIgnorieren === true) continue;
      if (d.getFullYear() === jahrAkt) { gesamtEinsatz += h; einsaetze++; }
    } else {
      if (d.getFullYear() === jahrAkt) {
        dienste++;
        if (istRelevant) { dienstRelevant += h; dienstRelevantAnzahl++; }
        else             { dienstIrrelevant += h; dienstIrrelevantAnzahl++; }
      }
      if (d >= vor12m && istRelevant) { dienstStunden12m += h; dienste12m++; }
    }
  }
  const gesamtDienst = dienstRelevant + dienstIrrelevant;
  return {
    gesamtEinsatz:    Math.round(gesamtEinsatz*10)/10,
    gesamtDienst:     Math.round(gesamtDienst*10)/10,
    dienstRelevant:   Math.round(dienstRelevant*10)/10,
    dienstIrrelevant: Math.round(dienstIrrelevant*10)/10,
    dienstRelevantAnzahl, dienstIrrelevantAnzahl,
    einsaetze, dienste,
    dienste12m,       // Anzahl relevanter Dienste im rollierenden 12-Monats-Fenster (passend zu stunden12mZiel)
    stunden12m:       Math.round(dienstRelevant*10)/10,  // aktuelles Jahr, nur relevante
    ziel:             dienstStunden12m >= 40,
    stunden12mZiel:   Math.round(dienstStunden12m*10)/10,
  };
}

// Stärke-Kategorie eines Kameraden wird live aus Lehrgängen abgeleitet statt manuell gepflegt.
// Optionaler Stichtag für historische Auswertungen (z. B. Stärke eines alten Einsatzes) – sonst
// würde die HEUTIGE Qualifikation angezeigt, nicht die zum Einsatzzeitpunkt gültige.
function staerkeKategorie(qualis, stichtag) {
  const grenze = stichtag ? new Date(stichtag) : null;
  const relevante = (qualis || []).filter(q => !grenze || (q.datum && new Date(q.datum) <= grenze));
  const qs = relevante.map(q => (q.bezeichnung || q.titel || q.name || '').toLowerCase());
  if (qs.some(q => q.includes('zugführer') || q.includes('zugfuehrer'))) return 'zugfuehrer';
  if (qs.some(q => q.includes('gruppenführer') || q.includes('gruppenfuehrer'))) return 'gruppenfuehrer';
  return 'kamerad';
}

// Pflichtfelder für einen vollständigen Dienst (nicht Einsatz)
function dienstUnvollstaendig(u) {
  if (u.typ !== 'dienst') return false;
  if (!u.titel) return true;
  if (!u.datum) return true;
  if (!u.dauer_h || u.dauer_h <= 0) return true;
  if (!u.art) return true;
  return false;
}

// Pflichtfelder für einen vollständigen Einsatz (nicht Dienst) – ohne Endzeit lässt sich
// keine Dauer berechnen (relevant für die Stunden-Anrechnung), ohne Ort fehlt der Einsatzort.
function einsatzUnvollstaendig(u) {
  if (u.typ !== 'einsatz') return false;
  if (!u.titel) return true;
  if (!u.datum) return true;
  if (!u.zeitEnde) return true;
  if (!u.ort) return true;
  return false;
}

// Sichtbarkeit eines Dienstes für einen bestimmten Kameraden: Ortswehr-Zugehörigkeit plus
// Themen-Filter (AGT/Maschinist/Führungskräfte anhand Titel-Schlüsselwörtern). dienstFilter ist
// die geladene einstellungen/dienstfilter-Konfiguration ({agt:[...], fuehrung:[...]}) - explizit
// als Parameter statt eines impliziten globalen Zustands, damit diese Funktion sowohl im Browser
// (pages.js) als auch serverseitig (Cloud Function dienstErinnerung, eigene Kopie dort da Functions
// nur ihr eigenes Verzeichnis deployen) verwendbar ist.
function dienstSichtbar(d, profil, qualis, dienstFilter) {
  // Wehrführer sieht ausnahmslos ALLE Dienste, unabhängig von Ortswehr- oder Themen-Filter (AGT/
  // Maschinist/Führungskräfte) - er muss jeden Dienst anlegen/bearbeiten/verwalten können, auch
  // wenn er selbst z. B. keine AGT- oder Maschinisten-Qualifikation eingetragen hat. Zentral hier
  // statt in jedem einzelnen Filterzweig geprüft (vorher hatten nur der Ortswehr- und der
  // Führungskräfte-Zweig einen Wehrführer-Bypass, AGT/Maschinist fehlerhaft nicht - Themen-Dienste
  // ohne passende eigene Qualifikation waren dadurch auch für den Wehrführer unsichtbar).
  if (profil?.rolle === 'wehrfuehrer') return true;

  // Ortswehr-Filter: nur Dienste der eigenen Wehren anzeigen.
  if (d.ortswehrIds?.length) {
    const meineIds = profil?.ortswehrIds?.length ? profil.ortswehrIds
      : (profil?.ortswehrId ? [profil.ortswehrId] : []);
    // Wenn User keine Wehr zugeordnet: alle sehen
    if (meineIds.length > 0 && !d.ortswehrIds.some(id => meineIds.includes(id))) return false;
  }
  const titel = (d.titel || '').toLowerCase();
  const qs = (qualis || []).map(q => (q.bezeichnung || q.titel || q.name || '').toLowerCase());
  // AGT-Termine
  const agtTitel = (dienstFilter?.agt || ['belastungslauf', 'wärmeübung', 'fortbildungstag agt']);
  if (agtTitel.some(t => titel.includes(t))) {
    return qs.some(q => q.includes('agt'));
  }
  // Maschinist
  if (titel.includes('maschinist')) {
    return qs.some(q => q.includes('maschinist'));
  }
  // Führungskräfte (Sichtbarkeit richtet sich nach der aus den Lehrgängen abgeleiteten
  // Stärke-Kategorie, nicht mehr nach einer manuell gepflegten Rolle)
  const fuehTitel = (dienstFilter?.fuehrung || ['führungskräfte', 'gruppenführersitzung', 'zugführersitzung', 'zug- und gruppenführer']);
  if (fuehTitel.some(t => titel.includes(t))) {
    return staerkeKategorie(qualis) !== 'kamerad';
  }
  return true;
}

if (typeof window !== 'undefined') {
  window.einsatzStunden       = einsatzStunden;
  window.getStats             = getStats;
  window.staerkeKategorie     = staerkeKategorie;
  window.dienstUnvollstaendig = dienstUnvollstaendig;
  window.einsatzUnvollstaendig = einsatzUnvollstaendig;
  window.dienstSichtbar       = dienstSichtbar;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { einsatzStunden, getStats, staerkeKategorie, dienstUnvollstaendig, einsatzUnvollstaendig, dienstSichtbar };
}
