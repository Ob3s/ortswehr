// js/pages.js – alle Seiten v2.3.0
function waitFw(cb) { if (window.fw) cb(); else setTimeout(() => waitFw(cb), 50); }

waitFw(() => {

// ── Helpers ───────────────────────────────────────────────
function datum(d) {
  if (!d) return '–';
  const ts = d?.toDate ? d.toDate() : new Date(d);
  if (isNaN(ts)) return '–';
  return ts.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function plural(n, singular, plural_) {
  return n + ' ' + (n === 1 ? singular : plural_);
}

function dauerFormat(h) {
  if (h === null || h === undefined) return '';
  const gesamt = Math.round(h * 60);
  const std = Math.floor(gesamt / 60);
  const min = gesamt % 60;
  return min === 0 ? `${std}:00` : `${std}:${String(min).padStart(2,'0')}`;
}
function zeitZeile(u) {
  const z = u.zeitBeginn && u.zeitEnde
    ? `${u.zeitBeginn} – ${u.zeitEnde} Uhr`
    : u.zeitBeginn ? `ab ${u.zeitBeginn} Uhr` : '';
  const d = u.dauer_h ? dauerFormat(u.dauer_h) + 'h' : '';
  return [z, d].filter(Boolean).join(' · ');
}


function kurzName(vorname, nachname) {
  const v = (vorname||'').trim();
  const n = (nachname||'').trim();
  if (!n && !v) return 'Kamerad';
  if (!n) return v;
  if (!v) return n;
  return n + ', ' + v.charAt(0) + '.';
}
function anwesenheitBadge(s) {
  if (s==='bestaetigt' || s==='kommt')       return '<span style="color:#16a34a;font-size:1.1rem">✅</span>';
  if (s==='abgelehnt'  || s==='kommt_nicht') return '<span style="color:#dc2626;font-size:1.1rem">❌</span>';
  return '<span style="color:#f59e0b;font-size:1.1rem">⏳</span>'; // keine Reaktion
}
function getStats(anwesenheiten, dienstMap, einsatzMap) {
  const jetzt   = new Date();
  const vor12m  = new Date(); vor12m.setFullYear(vor12m.getFullYear()-1); vor12m.setHours(0,0,0,0);
  const jahrAkt = jetzt.getFullYear();

  let gesamtEinsatz=0, gesamtDienst=0, einsaetze=0, dienste=0, dienstStunden12m=0;
  for (const a of anwesenheiten) {
    if (a.status !== 'bestaetigt' && a.status !== 'kommt') continue;
    const dienstEintrag  = dienstMap?.get(a.uebungId)  || null;
    const einsatzEintrag = einsatzMap?.get(a.uebungId) || null;
    const eintrag   = dienstEintrag || einsatzEintrag || null;
    const typNorm   = a.typ === 'einsaetze' ? 'einsatz' : a.typ === 'dienste' ? 'dienst' : a.typ;
    const istEinsatz = typNorm === 'einsatz' || (!a.typ && !!einsatzEintrag && !dienstEintrag);
    const h = eintrag?.dauer_h ?? a.dauer_h ?? 0;
    const d = a.datum?.toDate ? a.datum.toDate() : (eintrag?.datum?.toDate?.()  || new Date(a.datum));

    if (istEinsatz) {
      // Einsätze: nur aktuelles Jahr
      if (d.getFullYear() === jahrAkt) { gesamtEinsatz += h; einsaetze++; }
    } else {
      // Dienste: nur letzte 12 Monate
      if (d >= vor12m) { gesamtDienst += h; dienste++; dienstStunden12m += h; }
    }
  }
  return {
    gesamtEinsatz:  Math.round(gesamtEinsatz*10)/10,
    gesamtDienst:   Math.round(gesamtDienst*10)/10,
    einsaetze, dienste,
    stunden12m: Math.round(dienstStunden12m*10)/10,
    ziel: dienstStunden12m >= 40,
  };
}


// ── Dienst-Sichtbarkeit ───────────────────────────────────
function dienstSichtbar(d, profil, qualis) {
  const titel = (d.titel || '').toLowerCase();
  const qs = (qualis || []).map(q => (q.bezeichnung || q.titel || q.name || '').toLowerCase());
  // AGT-Termine
  const agtTitel = ['belastungslauf', 'wärmeübung', 'fortbildungstag agt'];
  if (agtTitel.some(t => titel.includes(t))) {
    return qs.some(q => q.includes('agt'));
  }
  // Maschinist
  if (titel.includes('maschinist')) {
    return qs.some(q => q.includes('maschinist'));
  }
  // Führungskräfte
  const fuehTitel = ['führungskräfte', 'gruppenführersitzung', 'zugführersitzung', 'zug- und gruppenführer'];
  if (fuehTitel.some(t => titel.includes(t))) {
    const rolle = profil?.rolle || '';
    return ['gruppenführer','zugführer','wehrfuehrer'].includes(rolle);
  }
  return true; // alle anderen sichtbar
}
// ── Nächste Dienste ──────────────────────────────────────
function dienstKarte(d, label) {
  return `<div class="card" style="margin-bottom:0.5rem;cursor:pointer" onclick="navigate('uebung-detail',{id:'${d.id}',typ:'dienst'})">
    <div style="font-size:0.72rem;color:var(--muted);margin-bottom:0.2rem">${label}</div>
    <div style="font-weight:600">${d.titel}</div>
    <div style="font-size:0.83rem;color:var(--muted)">${datum(d.datum)}${d.zeitBeginn ? ' · '+d.zeitBeginn+' Uhr' : ''}${d.ort ? ' · '+d.ort : ''}</div>
  </div>`;
}
function renderNaechsteDienste(naechster, zweiter) {
  if (!naechster) return '<div class="card" style="font-size:0.85rem;text-align:center;color:var(--muted)">Keine bevorstehenden Dienste</div>';
  let html = dienstKarte(naechster, '📅 Nächster Dienst');
  if (zweiter) html += dienstKarte(zweiter, '📅 Weiterer Dienst');
  return html;
}

// ── Dashboard ─────────────────────────────────────────────
registerPage('dashboard', async (el) => {
  fw.setTitle('Dashboard');
  const [aSnap, diensteSnap, einsaetzeSnap, qualiSnap] = await Promise.all([
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
    fw.getDocs('dienste', fw.orderBy('datum','asc')),
    fw.getDocs('einsaetze'),
    fw.getDocs('users/'+fw.user.uid+'/qualifikationen'),
  ]);
  const meine       = aSnap.docs.map(d => ({id:d.id,...d.data()}));
  const dienstMap   = new Map(diensteSnap.docs.map(d => [d.id, d.data()]));
  const einsatzMap  = new Map(einsaetzeSnap.docs.map(d => [d.id, d.data()]));
  const meineQualis = qualiSnap.docs.map(d => d.data());
  const heute    = new Date(); heute.setHours(0,0,0,0);
  const alleDienste = diensteSnap.docs.map(d => ({id:d.id,...d.data()}));
  const kuenftige   = alleDienste.filter(d => {
    const dt = d.datum?.toDate ? d.datum.toDate() : new Date(d.datum);
    return dt >= heute && dienstSichtbar(d, fw.profil, meineQualis);
  });
  // Oegeln-Logik: chronologisch nächster immer oben
  // nächster Dienst ≠ Oegeln → 2 anzeigen (nächster + nächster Oegeln-Dienst)
  // nächster Dienst = Oegeln → nur 1 anzeigen
  const naechster = kuenftige[0] || null;
  const naechsterOegeln = kuenftige.find(d => d.ort === 'Oegeln') || null;
  const zweiter = naechster && naechsterOegeln && naechsterOegeln.id !== naechster.id ? naechsterOegeln : null;
  const stats    = getStats(meine, dienstMap, einsatzMap);

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.8rem">
      <div style="font-family:'DM Serif Display',serif;font-size:1.3rem">
        Hallo, ${fw.profil.vorname || fw.profil.email}
      </div>
      <span id="status-lampe" style="width:12px;height:12px;border-radius:50%;background:#ccc;display:inline-block;flex-shrink:0;cursor:default" title="Status wird geprüft..."></span>
    </div>

    <button class="alarm-btn" onclick="navigate('uebung-form',{typ:'einsatz',alarm:true})">🚨 Einsatz</button>

${renderNaechsteDienste(naechster, zweiter)}

    <div id="news-feed" style="margin-top:0.5rem"></div>

    <div style="text-align:center;color:#374151;font-size:0.7rem;margin-top:1.5rem;margin-bottom:0.5rem">${document.querySelector('meta[name="app-version"]')?.content||''}</div>
  `;
  checkDeepLink();
  startStatusPruefung();
  ladeNewsFeed();
});

let _newsFeedListener = null;

function renderNewsBeitrag(b, usersMap) {
  const hat = b.abstimmung?.optionen?.some(o => (o.stimmen||[]).includes(fw.user.uid));
  const gesamt = b.abstimmung?.optionen?.reduce((s,o) => s+(o.stimmen?.length||0), 0) || 0;
  const abstimmungHtml = b.abstimmung ? `
    <div style="margin-top:0.8rem;border-top:1px solid var(--border);padding-top:0.6rem">
      <div style="font-weight:600;font-size:0.88rem;margin-bottom:0.6rem">🗳️ ${b.abstimmung.frage}</div>
      ${b.abstimmung.optionen.map((o,i) => {
        const pct = gesamt ? Math.round(((o.stimmen||[]).length)/gesamt*100) : 0;
        const meineStimme = (o.stimmen||[]).includes(fw.user.uid);
        const namen = (o.stimmen||[]).map(uid => {
          const u = usersMap?.get(uid);
          return u ? kurzName(u.vorname, u.nachname) : '?';
        }).join(', ');
        if (hat) {
          // Ergebnis anzeigen nach Stimmabgabe, Option weiterhin anklickbar zum Ändern
          return `<div onclick="newsAbstimmen('${b.id}',${i})"
            style="margin-bottom:0.5rem;cursor:pointer;padding:0.5rem 0.6rem;border-radius:10px;border:2px solid ${meineStimme?'#16a34a':'#e5e7eb'};background:${meineStimme?'#f0fdf4':'transparent'}">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.25rem">
              <span style="font-weight:${meineStimme?'600':'400'}">${meineStimme?'● ':'○ '}${o.text}</span>
              <span style="color:var(--muted)">${(o.stimmen||[]).length} (${pct}%)</span>
            </div>
            <div style="height:5px;background:#e5e7eb;border-radius:3px">
              <div style="height:5px;background:${meineStimme?'#16a34a':'#9ca3af'};border-radius:3px;width:${pct}%;transition:width 0.3s"></div>
            </div>
            ${namen ? `<div style="font-size:0.7rem;color:var(--muted);margin-top:0.25rem">${namen}</div>` : ''}
          </div>`;
        } else {
          // Noch nicht abgestimmt → Option anklickbar
          return `<div onclick="newsAbstimmen('${b.id}',${i})"
            style="margin-bottom:0.4rem;cursor:pointer;padding:0.5rem 0.6rem;border-radius:10px;border:2px solid #e5e7eb;display:flex;align-items:center;gap:0.5rem">
            <span style="width:18px;height:18px;border-radius:50%;border:2px solid #9ca3af;display:inline-block;flex-shrink:0"></span>
            <span style="font-size:0.88rem">${o.text}</span>
          </div>`;
        }
      }).join('')}
      <div style="font-size:0.75rem;color:var(--muted);margin-top:0.3rem">${gesamt} Stimme${gesamt!==1?'n':''}</div>
      ${fw.isWehrfuehrer() && b.abstimmung.aenderungen?.length ? `<div style="font-size:0.72rem;color:#f59e0b;margin-top:0.3rem">⚠️ ${b.abstimmung.aenderungen.length} Stimme${b.abstimmung.aenderungen.length!==1?'n':''} geändert</div>` : ''}
    </div>` : '';
  return `<div class="card" style="margin-bottom:0.6rem">
    <div style="font-weight:600;margin-bottom:0.3rem">${b.titel||''}</div>
    <div style="font-size:0.88rem;color:var(--muted);white-space:pre-wrap">${b.inhalt||''}</div>
    ${abstimmungHtml}
    <div style="font-size:0.72rem;color:var(--muted);margin-top:0.5rem">${datum(b.erstelltAm)}</div>
    ${fw.isWehrfuehrer() ? `<button onclick="newsLoeschen('${b.id}')" style="background:none;border:none;color:#9ca3af;font-size:0.75rem;cursor:pointer;padding:0;margin-top:0.3rem">🗑 Löschen</button>` : ''}
  </div>`;
}

async function ladeNewsFeed() {
  const el = document.getElementById('news-feed');
  if (!el) return;
  // Alten Listener aufräumen
  if (_newsFeedListener) { _newsFeedListener(); _newsFeedListener = null; }

  const beitragBtn = fw.isWehrfuehrer() ? `<button class="btn btn-secondary btn-sm" onclick="navigate('news-form')">📝 Beitrag</button>` : '';
  const header = `<div class="section-header" style="display:flex;align-items:center;justify-content:space-between">Neuigkeiten${beitragBtn}</div>`;

  // usersMap einmalig laden
  const uSnap = await fw.getDocs('users');
  const usersMap = new Map(uSnap.docs.map(d => [d.id, d.data()]));

  // Live-Listener auf news
  _newsFeedListener = fw.onQuerySnapshot('news', snap => {
    const beitraege = snap.docs
      .map(d => ({id:d.id,...d.data()}))
      .sort((a,b) => (b.erstelltAm?.toMillis?.() || 0) - (a.erstelltAm?.toMillis?.() || 0));
    if (!beitraege.length) {
      el.innerHTML = header + '<div class="card" style="color:var(--muted);font-size:0.88rem">Noch keine Neuigkeiten.</div>';
      return;
    }
    el.innerHTML = header + beitraege.map(b => renderNewsBeitrag(b, usersMap)).join('');
  });
}

window.newsAbstimmen = async (newsId, optionIndex) => {
  const snap = await fw.getDoc('news/'+newsId);
  if (!snap.exists()) return;
  const b = snap.data();
  // Alte Stimme merken für Änderungs-Log
  const alteOption = b.abstimmung.optionen.findIndex(o => (o.stimmen||[]).includes(fw.user.uid));
  const hat_geaendert = alteOption !== -1 && alteOption !== optionIndex;
  const optionen = b.abstimmung.optionen.map((o,i) => ({
    ...o,
    stimmen: i===optionIndex
      ? [...new Set([...(o.stimmen||[]), fw.user.uid])]
      : (o.stimmen||[]).filter(uid => uid !== fw.user.uid)
  }));
  // Änderungs-Log für Wehrführer
  const aenderungen = b.abstimmung.aenderungen || [];
  if (hat_geaendert) {
    aenderungen.push({ uid: fw.user.uid, von: alteOption, zu: optionIndex, am: new Date().toISOString() });
  }
  await fw.updateDoc('news/'+newsId, {
    'abstimmung.optionen': optionen,
    'abstimmung.aenderungen': aenderungen,
  });
  ladeNewsFeed();
};

window.newsLoeschen = async (id) => {
  if (!confirm('Beitrag löschen?')) return;
  await fw.deleteDoc('news/'+id);
  ladeNewsFeed();
};

let _letzterStatus = null;
let _statusInterval = null;
let _statusWarnungGesendet = false; // Nur einmal warnen bis Status wieder grün

async function pruefeStatus() {
  const lampe = document.getElementById('status-lampe');
  if (!lampe) return;
  const online   = navigator.onLine;
  const notifOk  = Notification.permission === 'granted';
  const snap     = await fw.getDoc('users/'+fw.user.uid);
  const tokenOk  = !!(snap.data()?.fcmToken);
  const allesOk  = online && notifOk && tokenOk;
  const grund    = !online ? 'Kein Internet' : !notifOk ? 'Benachrichtigungen nicht erlaubt' : 'Kein Push-Token';

  lampe.style.background = allesOk ? '#22c55e' : '#ef4444';
  lampe.style.boxShadow  = `0 0 6px ${allesOk ? '#22c55e' : '#ef4444'}`;
  lampe.title = allesOk ? 'Alles bereit ✓' : grund;

  if (allesOk) {
    // Status wieder OK → Warnung zurücksetzen damit sie beim nächsten Problem erneut kommt
    _statusWarnungGesendet = false;
  } else if (!_statusWarnungGesendet && fw.profil?.notif_status !== false) {
    // Nur einmal warnen bis Status wieder grün wird
    _statusWarnungGesendet = true;
    // Echte Browser-Benachrichtigung senden (funktioniert auch wenn App im Hintergrund)
    if (Notification.permission === 'granted') {
      new Notification('⚠️ Ortswehr – Problem erkannt', {
        body: grund + ' – Einsatzalarme können möglicherweise nicht empfangen werden!',
        icon: '/ortswehr/icons/icon-192.png',
        tag: 'status-warnung', // verhindert mehrfache Anzeige
        requireInteraction: true,
      });
    }
  }
  _letzterStatus = allesOk;
}

function startStatusPruefung() {
  pruefeStatus();
  if (_statusInterval) clearInterval(_statusInterval);
  _statusInterval = setInterval(pruefeStatus, 30000);
  window.addEventListener('online',  pruefeStatus);
  window.addEventListener('offline', pruefeStatus);
}

// ── Hilfsfunktion: Liste rendern ─────────────────────────
function renderEintrag(u, meineMap) {
  const badge = anwesenheitBadge(meineMap.get(u.id));
  return `<div class="list-item" onclick="navigate('uebung-detail',{id:'${u.id}',typ:'${u.typ}'})">
    <div class="list-item-body">
      <div class="list-item-title">${u.titel}</div>
      ${u.ort ? `<div class="list-item-sub" style="margin-top:0.05rem">📍 ${u.ort}</div>` : ''}
      <div class="list-item-sub">${datum(u.datum)}${zeitZeile(u) ? ' · '+zeitZeile(u) : ''}</div>
    </div>
    <div class="list-item-right">${badge}</div>
    <div class="list-chevron">›</div>
  </div>`;
}

function renderEintragListe(liste, meineMap) {
  if (!liste.length) return '<div class="empty">Keine Einträge</div>';
  const heute = new Date(); heute.setHours(0,0,0,0);

  const zukunft = liste.filter(u => {
    const d = u.datum?.toDate ? u.datum.toDate() : new Date(u.datum);
    return d >= heute;
  }).sort((a,b) => {
    const da = a.datum?.toDate ? a.datum.toDate() : new Date(a.datum);
    const db = b.datum?.toDate ? b.datum.toDate() : new Date(b.datum);
    return da - db;
  });

  const vergangen = liste.filter(u => {
    const d = u.datum?.toDate ? u.datum.toDate() : new Date(u.datum);
    return d < heute;
  });

  // Archiv nach Jahr gruppieren
  const archivJahre = {};
  for (const u of vergangen) {
    const d = u.datum?.toDate ? u.datum.toDate() : new Date(u.datum);
    const j = d.getFullYear();
    if (!archivJahre[j]) archivJahre[j] = [];
    archivJahre[j].push(u);
  }

  // Nächste Dienste: zeige 1, oder 2 wenn der erste nicht in Oegeln ist
  let sichtbar = [];
  if (zukunft.length > 0) {
    const erster = zukunft[0];
    const erstInOegeln = erster.ort?.toLowerCase().includes('oegeln');
    sichtbar = erstInOegeln ? [erster] : zukunft.slice(0, 2);
  }
  const weitereZukunft = zukunft.slice(sichtbar.length);

  let html = '';

  // Sichtbare zukünftige Dienste
  if (sichtbar.length) {
    html += sichtbar.map(u => renderEintrag(u, meineMap)).join('');
  } else {
    html += '<div class="empty">Keine kommenden Dienste</div>';
  }

  // Weitere zukünftige Dienste einklappbar
  if (weitereZukunft.length) {
    html += `<details style="margin-top:0.2rem">
      <summary style="padding:0.6rem 0;cursor:pointer;color:var(--muted);font-size:0.85rem;list-style:none;display:flex;align-items:center;gap:0.4rem">
        <span>▸</span> Weitere Dienste (${weitereZukunft.length})
      </summary>
      ${weitereZukunft.map(u => renderEintrag(u, meineMap)).join('')}
    </details>`;
  }

  // Archiv einklappbar – Jahre als eigene Dropdowns
  if (vergangen.length) {
    const jahreInnen = Object.keys(archivJahre).sort((a,b)=>b-a).map(jahr => `
      <details style="margin-top:0.1rem">
        <summary style="padding:0.5rem 0;cursor:pointer;color:var(--muted);font-size:0.8rem;list-style:none;display:flex;align-items:center;gap:0.4rem;padding-left:0.5rem">
          <span>▸</span> ${jahr} (${archivJahre[jahr].length})
        </summary>
        ${archivJahre[jahr].map(u => renderEintrag(u, meineMap)).join('')}
      </details>`).join('');
    html += `<details style="margin-top:0.2rem">
      <summary style="padding:0.6rem 0;cursor:pointer;color:var(--muted);font-size:0.85rem;list-style:none;display:flex;align-items:center;gap:0.4rem">
        <span>▸</span> Archiv (${vergangen.length} Einträge)
      </summary>
      ${jahreInnen}
    </details>`;
  }

  return html;
}


// ── Einsatz-Liste: aktuelles Jahr oben, Archiv nach Jahr ──
function renderEinsatzListe(liste, meineMap) {
  if (!liste.length) {
    const jahrAkt = new Date().getFullYear();
    return `<div class="empty">${jahrAkt} noch kein Einsatz</div>`;
  }

  const jahrAkt = new Date().getFullYear();

  // Einträge nach Jahr gruppieren
  const jahreMap = {};
  for (const u of liste) {
    const d = u.datum?.toDate ? u.datum.toDate() : new Date(u.datum);
    const j = d.getFullYear();
    if (!jahreMap[j]) jahreMap[j] = [];
    jahreMap[j].push(u);
  }

  const alleJahre = Object.keys(jahreMap).map(Number).sort((a,b) => b-a);
  let html = '';

  // Aktuelles Jahr direkt anzeigen
  const aktEintraege = jahreMap[jahrAkt] || [];
  if (!aktEintraege.length) {
    html += `<div class="empty">${jahrAkt} noch kein Einsatz</div>`;
  } else {
    html += `<div style="font-size:0.78rem;color:var(--muted);padding:0.5rem 0 0.2rem;font-weight:600">${jahrAkt} · ${aktEintraege.length===1?'1 Einsatz':aktEintraege.length+' Einträge'}</div>`;
    html += aktEintraege.map(u => renderEintrag(u, meineMap)).join('');
  }

  // Vergangene Jahre → alle unter "Archiv" als eigene Dropdowns
  const archivJahre = alleJahre.filter(j => j !== jahrAkt);
  if (archivJahre.length) {
    const archivGesamt = archivJahre.reduce((s, j) => s + jahreMap[j].length, 0);
    const jahreInnen = archivJahre.map(jahr => {
      const eintraege = jahreMap[jahr];
      return `<details style="margin-top:0.1rem">
        <summary style="padding:0.5rem 0;cursor:pointer;color:var(--muted);font-size:0.8rem;list-style:none;display:flex;align-items:center;gap:0.4rem;padding-left:0.5rem">
          <span>▸</span> ${jahr} (${eintraege.length===1?'1 Einsatz':eintraege.length+' Einträge'})
        </summary>
        ${eintraege.map(u => renderEintrag(u, meineMap)).join('')}
      </details>`;
    }).join('');
    html += `<details style="margin-top:0.2rem">
      <summary style="padding:0.6rem 0;cursor:pointer;color:var(--muted);font-size:0.85rem;list-style:none;display:flex;align-items:center;gap:0.4rem">
        <span>▸</span> Archiv (${archivGesamt} Einträge)
      </summary>
      ${jahreInnen}
    </details>`;
  }

  return html;
}

// Collection je nach Typ
function col(typ) { return typ === 'einsatz' ? 'einsaetze' : 'dienste'; }

// ── Einsätze ──────────────────────────────────────────────
registerPage('einsaetze', async (el) => {
  fw.setTitle('Einsätze');
  fw.showHeaderAction('+ Einsatz', () => navigate('uebung-form', {typ:'einsatz', alarm:false}));
  const [uSnap, aSnap] = await Promise.all([
    fw.getDocs('einsaetze', fw.orderBy('datum','desc')),
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
  ]);
  const liste    = uSnap.docs.map(d => ({id:d.id,...d.data()}));
  const meineMap = new Map(aSnap.docs.map(d => [d.data().uebungId, d.data().status]));
  el.innerHTML = `<div class="card">${renderEinsatzListe(liste, meineMap)}</div>`;
});

// ── Dienste ───────────────────────────────────────────────
registerPage('dienste', async (el) => {
  fw.setTitle('Dienste');
  if (fw.isWehrfuehrer()) fw.showHeaderAction('+ Dienst', () => navigate('uebung-form', {typ:'dienst'}));
  const [uSnap, aSnap, dQualiSnap] = await Promise.all([
    fw.getDocs('dienste', fw.orderBy('datum','desc')),
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
    fw.getDocs('users/'+fw.user.uid+'/qualifikationen'),
  ]);
  const dQualis  = dQualiSnap.docs.map(d => d.data());
  const liste    = uSnap.docs.map(d => ({id:d.id,...d.data()})).filter(d => dienstSichtbar(d, fw.profil, dQualis));
  const meineMap = new Map(aSnap.docs.map(d => [d.data().uebungId, d.data().status]));
  el.innerHTML = `
    <div class="card">${renderEintragListe(liste, meineMap)}</div>
    ${fw.isWehrfuehrer() ? `
    <div style="margin-top:1rem">
      <button class="btn btn-secondary btn-full" onclick="kalenderImportieren()" id="kal-btn">📅 Aus Google Kalender importieren</button>
      <div id="kal-status" class="muted" style="font-size:0.8rem;text-align:center;margin-top:0.4rem"></div>
    </div>` : ''}

  `;
});

window.kalenderImportieren = async () => {
  const btn    = document.getElementById('kal-btn');
  const status = document.getElementById('kal-status');
  btn.disabled = true; btn.textContent = '⏳ Wird geladen...';
  try {
    const res = await fetch('https://europe-west3-ffw-oegeln-791ca.cloudfunctions.net/kalenderImport',
      { headers: { 'x-uid': fw.user.uid } });
    const { events, error } = await res.json();
    if (error) throw new Error(error);

    // Bestehende Dienste laden – Matching per Datum (YYYY-MM-DD)
    const snap = await fw.getDocs('dienste');
    // Map: datum-String → {id, data}
    const vorhandeneMap = new Map(snap.docs.map(d => [
      d.data().datum?.toDate?.().toISOString().slice(0,10),
      { id: d.id, data: d.data() }
    ]));

    let neu = 0, aktualisiert = 0, unveraendert = 0;
    for (const e of events) {
      const bestehend = vorhandeneMap.get(e.datum);
      const neuerEintrag = {
        titel: e.titel, datum: new Date(e.datum),
        dauer_h: e.dauer_h, beschreibung: e.beschreibung || '',
        zeitBeginn: e.zeitBeginn || null, zeitEnde: e.zeitEnde || null,
        ort: e.ort || null, typ: 'dienst',
      };

      if (!bestehend) {
        // Neu anlegen
        await fw.addDoc('dienste', { ...neuerEintrag, erstelltVon: fw.user.uid, erstelltAm: new Date() });
        neu++;
      } else {
        // Prüfen ob sich Kerndaten geändert haben
        const alt = bestehend.data;
        const geaendert =
          alt.titel !== e.titel ||
          (alt.ort || '') !== (e.ort || '') ||
          (alt.zeitBeginn || '') !== (e.zeitBeginn || '') ||
          (alt.zeitEnde || '') !== (e.zeitEnde || '') ||
          Math.abs((alt.dauer_h || 0) - (e.dauer_h || 0)) > 0.01;

        if (geaendert) {
          // Nur Kerndaten updaten – Anwesenheiten bleiben unberührt
          await fw.setDoc('dienste/' + bestehend.id, neuerEintrag);
          aktualisiert++;
        } else {
          unveraendert++;
        }
      }
    }

    const teile = [];
    if (neu > 0)          teile.push(neu + ' neu');
    if (aktualisiert > 0) teile.push(aktualisiert + ' aktualisiert');
    if (unveraendert > 0) teile.push(unveraendert + ' unverändert');
    status.textContent = teile.join(' · ');
    btn.textContent = '📅 Aus Google Kalender importieren';
    btn.disabled = false;
    if (neu > 0 || aktualisiert > 0) setTimeout(() => navigate('dienste'), 1200);
  } catch(e) {
    status.textContent = 'Fehler: ' + e.message;
    btn.textContent = '📅 Aus Google Kalender importieren';
    btn.disabled = false;
  }
};


function hatLkwFs(fs) {
  if (!fs) return false;
  return /\b(C1E|C1|CE|C)\b/.test(fs.toUpperCase());
}

window.rolleGeaendert = (rolle) => {
  const row = document.getElementById('staerke-rolle-row');
  if (row) row.style.display = rolle === 'wehrfuehrer' ? 'block' : 'none';
};

window.einsatzReagieren = async (uebungId, status) => {
  const name = kurzName(fw.profil.vorname, fw.profil.nachname);
  // Typ und Datum aus Quell-Collection ermitteln
  let typ = 'dienst', datum = new Date(), dauer_h = 0;
  const dSnap = await fw.getDoc('dienste/'+uebungId);
  if (dSnap.exists()) {
    typ = 'dienst'; datum = dSnap.data().datum?.toDate?.() || new Date(); dauer_h = dSnap.data().dauer_h || 0;
  } else {
    const eSnap = await fw.getDoc('einsaetze/'+uebungId);
    if (eSnap.exists()) { typ = 'einsatz'; datum = eSnap.data().datum?.toDate?.() || new Date(); dauer_h = eSnap.data().dauer_h || 0; }
  }
  const snap = await fw.getDocs('anwesenheiten',
    fw.where('uebungId','==',uebungId), fw.where('userId','==',fw.user.uid));
  if (snap.docs.length > 0) {
    await fw.updateDoc('anwesenheiten/'+snap.docs[0].id, {
      status, typ, datum, dauer_h,
      rolle: fw.profil.stärkeRolle || fw.profil.rolle || 'kamerad',
      fuehrerschein: fw.profil.fuehrerschein || '', aktualisiertAm: new Date()
    });
  } else {
    await fw.addDoc('anwesenheiten', {
      uebungId, userId: fw.user.uid, userName: name, typ, datum, dauer_h,
      rolle: fw.profil.stärkeRolle || fw.profil.rolle || 'kamerad',
      fuehrerschein: fw.profil.fuehrerschein || '',
      status, gemeldetAm: new Date(),
    });
  }
};


// ── Detail ────────────────────────────────────────────────
let _einsatzListener = null; // aktiver onSnapshot Listener

registerPage('uebung-detail', async (el, {id, typ}) => {
  // alten Listener aufräumen
  if (_einsatzListener) { _einsatzListener(); _einsatzListener = null; }
  const snap = await fw.getDoc(col(typ||'dienst')+'/'+id);
  if (!snap.exists()) { el.innerHTML='<div class="empty">Nicht gefunden</div>'; return; }
  const u = {id,...snap.data()};
  const isEinsatz = u.typ === 'einsatz';
  fw.setTitle(isEinsatz ? 'Einsatz' : 'Dienst');
  fw.showBack(() => navigate(u.typ === 'einsatz' ? 'einsaetze' : 'dienste'));
  if (fw.isWehrfuehrer()) fw.showHeaderAction('✏️ Edit', () => navigate('uebung-form',{id, typ: u.typ}));

  const aSnap = await fw.getDocs('anwesenheiten',
    fw.where('uebungId','==',id), fw.where('userId','==',fw.user.uid));
  const meineA = aSnap.docs[0] ? {id:aSnap.docs[0].id,...aSnap.docs[0].data()} : null;

  const eintragNavFn = `navigate('uebung-eintragen',{id:'${id}',titel:'${u.titel.replace(/'/g,"\'")}',dauer:${u.dauer_h||0},typ:'${u.typ}',datumStr:'${u.datum?.toDate?.().toISOString()||u.datum}'})`;
  const eintragBtn = fw.isWehrfuehrer()
    ? `<button class="btn btn-secondary btn-sm" onclick="${eintragNavFn}">+ Kamerad eintragen</button>`
    : '';

  el.innerHTML = `
    <div class="card">
      <span class="badge badge-blue">${isEinsatz?'⚡ Einsatz':'📅 Dienst'}</span>
      <div style="margin-top:0.6rem;font-weight:600;font-size:1.1rem">${u.titel}</div>
      <div style="margin-top:0.3rem;color:var(--muted);font-size:0.85rem">${datum(u.datum)}${zeitZeile(u) ? ' · '+zeitZeile(u) : ''}</div>
      ${u.beschreibung ? `<p class="muted" style="margin-top:0.4rem;font-size:0.85rem">${u.beschreibung}</p>` : ''}
      ${isEinsatz && !u.zeitEnde && fw.isWehrfuehrer() ? `
        <button class="btn btn-secondary btn-sm" style="margin-top:0.6rem" onclick="navigate('uebung-form',{id:'${u.id}'})">⏱ Endzeit nachtragen</button>
      ` : ''}
    </div>
    <div class="section-header">Wer kommt? <span id="einsatz-zaehler" style="font-weight:400;font-size:0.85rem"></span></div>
    <div id="einsatz-reaktionen" class="card">⏳ Lade...</div>
    <div class="card" style="display:flex;gap:0.8rem">
      <button class="btn btn-full" id="btn-kommt"
        style="background:#16a34a;color:#fff;font-size:1.1rem;padding:0.8rem"
        onclick="einsatzReagieren('${id}','kommt')">👍 Ich komme</button>
      <button class="btn btn-full" id="btn-kommt-nicht"
        style="background:#dc2626;color:#fff;font-size:1.1rem;padding:0.8rem"
        onclick="einsatzReagieren('${id}','kommt_nicht')">👎 Komme nicht</button>
    </div>
    ${fw.isWehrfuehrer() ? `<div style="padding:0 0 0.5rem">${eintragBtn}</div>` : ''}
  `;

  // Live-Listener für Reaktionen (Einsatz + Dienst)
  if (true) {
    // User-Daten + Qualifikationen vorladen
    const usersSnap = await fw.getDocs('users');
    const usersMap = new Map(usersSnap.docs.map(d => [d.id, d.data()]));
    // AGT-Map: userId → true wenn AGT-Qualifikation vorhanden
    const agtMap = new Map();
    await Promise.all(usersSnap.docs.map(async d => {
      const qSnap = await fw.getDocs('users/'+d.id+'/qualifikationen');
      const hatAgt = qSnap.docs.some(q => (q.data().bezeichnung||q.data().titel||q.data().name||'').toLowerCase().includes('agt'));
      if (hatAgt) agtMap.set(d.id, true);
    }));

    _einsatzListener = fw.onQuerySnapshot(
      'anwesenheiten',
      (snap) => {
        const alle = snap.docs.map(d => {
          const a = {id:d.id,...d.data()};
          const profil = usersMap.get(a.userId) || {};
          // Profildaten immer als Quelle nutzen (überschreibt alte/leere Einträge)
          a.rolle        = profil.stärkeRolle || profil.rolle || a.rolle || 'kamerad';
          a.fuehrerschein = profil.fuehrerschein || a.fuehrerschein || '';
          return a;
        });
        const kommen      = alle.filter(a => a.status === 'kommt' || a.status === 'bestaetigt');
        const kommenNicht = alle.filter(a => a.status === 'kommt_nicht');
        const meineR      = alle.find(a => a.userId === fw.user.uid);

        const zugf  = kommen.filter(a => a.rolle === 'zugführer').length;
        const gruf  = kommen.filter(a => a.rolle === 'gruppenführer').length;
        const kamf  = kommen.filter(a => !['zugführer','gruppenführer'].includes(a.rolle)).length;
        const agtZ  = kommen.filter(a => agtMap.get(a.userId)).length;
        const zaehler = document.getElementById('einsatz-zaehler');
        if (zaehler) zaehler.textContent = isEinsatz
          ? `👍 ${kommen.length}  👎 ${kommenNicht.length}  ·  Stärke: ${zugf}/${gruf}/${kamf}  ·  AGT: ${agtZ}`
          : `👍 ${kommen.length}  👎 ${kommenNicht.length}`;

        const container = document.getElementById('einsatz-reaktionen');
        if (container) {
          const rows = [...kommen, ...kommenNicht].map(a => {
            const kommt = a.status === 'kommt' || a.status === 'bestaetigt';
            const lkw = kommt && hatLkwFs(a.fuehrerschein);
            const agt = isEinsatz && kommt && agtMap.get(a.userId);
            const loeschBtn = fw.isWehrfuehrer()
              ? `<button onclick="teilnehmerEntfernen('${a.id}','${id}','${u.typ}')" style="background:none;border:none;cursor:pointer;font-size:0.9rem;color:#9ca3af;padding:0.1rem 0.3rem" title="Entfernen">🗑</button>`
              : '';
            return `<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:1px solid var(--border)">
              <span style="font-size:1.1rem">${kommt?'👍':'👎'}${lkw?'🚛':''}${agt?'💨':''}</span>
              <span style="flex:1;font-weight:${a.userId===fw.user.uid?'600':'400'}">${kurzName(usersMap.get(a.userId)?.vorname, usersMap.get(a.userId)?.nachname) || a.userName || 'Kamerad'}</span>
              ${loeschBtn}
            </div>`;
          }).join('');
          container.innerHTML = rows || '<div class="muted" style="text-align:center;font-size:0.85rem;padding:0.5rem">Noch keine Rückmeldungen</div>';
        }

        const btnK  = document.getElementById('btn-kommt');
        const btnKN = document.getElementById('btn-kommt-nicht');
        if (btnK && btnKN) {
          btnK.style.opacity  = meineR?.status === 'kommt'       ? '1' : '0.5';
          btnKN.style.opacity = meineR?.status === 'kommt_nicht' ? '1' : '0.5';
        }
      },
      fw.where('uebungId','==',id)
    );
    // Listener auch in window damit navigate() ihn aufräumen kann
    window._einsatzListener = _einsatzListener;
  }
});

window.teilnahmeMelden = async (uebungId, titel, dauer_h, typ, datumStr) => {
  const name = kurzName(fw.profil.vorname, fw.profil.nachname);
  await fw.addDoc('anwesenheiten', {
    uebungId, userId: fw.user.uid, userName: name,
    status: 'vorgeschlagen', uebungTitel: titel,
    dauer_h, typ, datum: new Date(datumStr), vorgeschlagenAm: new Date(),
  });
  fw.toast('Teilnahme gemeldet ⏳');
  navigate('uebung-detail', {id: uebungId, typ});
};
window.teilnehmerEntfernen = async (aId, uebungId, typ) => {
  if (!confirm('Anwesenheit entfernen?')) return;
  await fw.deleteDoc('anwesenheiten/'+aId);
  fw.toast('Entfernt'); navigate('uebung-detail', {id: uebungId, typ});
};

// ── Kamerad direkt eintragen ──────────────────────────────
registerPage('uebung-eintragen', async (el, {id, titel, dauer, typ, datumStr}) => {
  fw.setTitle('Eintragen');
  fw.showBack(() => navigate('uebung-detail',{id, typ}));
  const [usersSnap, bereitsSnap] = await Promise.all([
    fw.getDocs('users'),
    fw.getDocs('anwesenheiten', fw.where('uebungId','==',id)),
  ]);
  const bereits = new Set(bereitsSnap.docs.map(d => d.data().userId));
  const verfuegbar = usersSnap.docs.map(d => ({id:d.id,...d.data()}))
    .filter(u => !bereits.has(u.id) && u.aktiv !== false)
    .sort((a,b) => (a.nachname||'').localeCompare(b.nachname||''));
  el.innerHTML = `
    <div class="card">
      <div class="card-title">Kamerad eintragen</div>
      <p class="muted" style="font-size:0.85rem;margin-bottom:0.8rem">${titel}</p>
      ${verfuegbar.length===0 ? '<div class="empty">Alle bereits eingetragen</div>' :
        verfuegbar.map(u => `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${u.nachname||''}, ${u.vorname||''}</div>
              <div class="list-item-sub">${u.dienstgrad||'–'}</div>
            </div>
            <button class="btn btn-sm btn-success" onclick="direktEintragen('${id}','${u.id}','${kurzName(u.vorname,u.nachname)}',${dauer},'${typ}','${datumStr}')">Eintragen</button>
          </div>`).join('')}
    </div>`;
});

window.direktEintragen = async (uebungId, userId, name, dauer_h, typ, datumStr) => {
  // Profil laden damit fuehrerschein + rolle mitgespeichert werden
  const userSnap = await fw.getDoc('users/' + userId);
  const profil = userSnap.exists() ? userSnap.data() : {};
  await fw.addDoc('anwesenheiten', {
    uebungId, userId, userName: name, status:'kommt',
    dauer_h, typ, datum: new Date(datumStr), bestaetigtAm: new Date(),
    rolle: profil.stärkeRolle || profil.rolle || 'kamerad',
    fuehrerschein: profil.fuehrerschein || '',
  });
  fw.toast(name+' eingetragen ✅');
  // Seite neu laden damit neue Anwesenheit sofort sichtbar
  navigate('uebung-eintragen', {id: uebungId, titel: '', dauer: dauer_h, typ, datumStr});
};

// ── Einsatz / Dienst Form ─────────────────────────────────
registerPage('uebung-form', async (el, {id, typ: vorTyp, alarm: mitAlarm}) => {
  let u = null;
  if (id) { const s = await fw.getDoc(col(vorTyp||'dienst')+'/'+id); if (!s.exists()) { const s2 = await fw.getDoc(col('einsatz')+'/'+id); if(s2.exists()) u={id,...s2.data()}; } else { u={id,...s.data()}; } }
  const selTyp = u?.typ || vorTyp || 'dienst';
  const isEinsatz = selTyp === 'einsatz';
  fw.setTitle(u ? 'Bearbeiten' : (isEinsatz ? 'Einsatz melden' : 'Neuer Dienst'));
  fw.showBack(() => navigate(selTyp === 'einsatz' ? 'einsaetze' : 'dienste'));

  const datumVal = u?.datum?.toDate ? u.datum.toDate().toISOString().slice(0,10)
    : new Date().toISOString().slice(0,10);

  if (isEinsatz) {
    const jetztH  = new Date().getHours().toString().padStart(2,'0');
    const jetztM  = new Date().getMinutes().toString().padStart(2,'0');
    const jetztZeit = `${jetztH}:${jetztM}`;
    el.innerHTML = `
      <div class="card">
        <div style="font-family:'DM Serif Display',serif;font-size:1.3rem;color:var(--red);margin-bottom:1rem">🚨 Einsatz</div>
        <div class="form-row">
          <label>Einsatzstichwort</label>
          <input id="f-titel" value="${u?.titel||''}" placeholder="Brand, THL, Hilfeleistung…" autofocus>
        </div>
        <div class="form-row">
          <label>Beginn</label>
          <input id="f-beginn" type="time" value="${u?.zeitBeginn||jetztZeit}">
        </div>
        <div class="form-row">
          <label>Ende (optional, kann nachgetragen werden)</label>
          <input id="f-ende" type="time" value="${u?.zeitEnde||''}">
        </div>
        <input type="hidden" id="f-alarm" value="${mitAlarm ? '1' : '0'}">
        <div class="btn-row" style="margin-top:0.5rem">
          <button class="btn btn-primary btn-full" onclick="uebungSpeichern('${id||''}','einsatz')">${u ? '💾 Speichern' : mitAlarm ? '🚨 Einsatz melden & Alarm senden' : '💾 Einsatz speichern'}</button>
          ${u ? `<button class="btn btn-danger" onclick="uebungLoeschen('${id}','einsatz')">🗑 Löschen</button>` : ''}
        </div>
      </div>`;
  } else {
    // Dienst: vollständiges Formular
    el.innerHTML = `
      <div class="card">
        <div class="form-row"><label>Titel</label>
          <input id="f-titel" value="${u?.titel||''}" placeholder="Monatsübung April…">
        </div>
        <div class="form-row"><label>Datum</label><input id="f-datum" type="date" value="${datumVal}"></div>
        <div class="form-row"><label>Beginn</label><input id="f-beginn" type="time" value="${u?.zeitBeginn||''}"></div>
        <div class="form-row"><label>Ende</label><input id="f-ende" type="time" value="${u?.zeitEnde||''}"></div>
        <div class="form-row"><label>Dauer (Stunden, wird aus Zeiten berechnet)</label>
          <input id="f-dauer" type="number" step="0.5" min="0.5" value="${u?.dauer_h||2}">
        </div>
        <div class="form-row"><label>Beschreibung (optional)</label>
          <textarea id="f-beschr">${u?.beschreibung||''}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="uebungSpeichern('${id||''}','dienst')">💾 Speichern & Benachrichtigen</button>
          ${u ? `<button class="btn btn-danger" onclick="uebungLoeschen('${id}','dienst')">🗑 Löschen</button>` : ''}
        </div>
      </div>`;
  }
});

window.uebungSpeichern = async (id, forcTyp) => {
  const titel   = document.getElementById('f-titel').value.trim();
  let dauer_h = parseFloat(document.getElementById('f-dauer')?.value) || 0;
  const typ     = forcTyp === 'einsatz' ? 'einsatz' : 'dienst';
  const isEinsatz = typ === 'einsatz';

  const datumStr = isEinsatz
    ? new Date().toISOString().slice(0,10)
    : (document.getElementById('f-datum')?.value || new Date().toISOString().slice(0,10));
  const beschr     = document.getElementById('f-beschr')?.value?.trim() || '';
  const zeitBeginn = document.getElementById('f-beginn')?.value || null;
  const zeitEnde   = document.getElementById('f-ende')?.value || null;

  // Dauer aus Zeiten berechnen wenn vorhanden
  if (isEinsatz && zeitBeginn && zeitEnde) {
    const [bh, bm] = zeitBeginn.split(':').map(Number);
    const [eh, em] = zeitEnde.split(':').map(Number);
    dauer_h = Math.round(((eh*60+em) - (bh*60+bm)) / 60 * 100) / 100;
  }

  if (!titel) { fw.toast('Stichwort erforderlich', true); return; }

  const data = { titel, datum: new Date(datumStr), typ, dauer_h, beschreibung: beschr, zeitBeginn, zeitEnde };
  const isNeu = !id;
  try {
    let uebungId = id;
    if (id) {
      await fw.updateDoc(col(typ)+'/'+id, data);
    } else {
      const ref = await fw.addDoc(col(typ), {...data, erstelltVon: fw.user.uid, erstelltAm: new Date()});
      uebungId = ref.id;
    }
    const mitAlarmFlag = document.getElementById('f-alarm')?.value === '1';
  if (isNeu && mitAlarmFlag) await benachrichtigeOrtswehr(typ, titel, datumStr, dauer_h, uebungId);
  else if (isNeu && !mitAlarmFlag && typ === 'dienst') await benachrichtigeOrtswehr(typ, titel, datumStr, dauer_h, uebungId);
    fw.toast(isEinsatz ? 'Einsatz gemeldet 🚨' : 'Gespeichert ✅');
    navigate(typ === 'einsatz' ? 'einsaetze' : 'dienste');
  } catch(e) { fw.toast(e.message, true); }
};

window.uebungLoeschen = async (id, typ) => {
  if (!confirm('Wirklich löschen?')) return;
  await fw.deleteDoc(col(typ)+'/'+id);
  fw.toast('Gelöscht'); navigate(typ === 'einsatz' ? 'einsaetze' : 'dienste');
};

// ── Push ──────────────────────────────────────────────────
async function benachrichtigeOrtswehr(typ, titel, datumStr, dauer_h, uebungId) {
  const ortswehrId = fw.profil.ortswehrId;
  if (!ortswehrId) {
    fw.toast('⚠️ Keine Ortswehr zugeordnet – niemand wird benachrichtigt!', true);
    return;
  }
  const usersSnap = await fw.getDocs('users', fw.where('ortswehrId','==',ortswehrId));
  const isEinsatz = typ === 'einsatz';
  const tokens = [];
  for (const d of usersSnap.docs) {
    const u = d.data();
    if (d.id === fw.user.uid && !fw.profil.notif_selbst) { console.log('Push: Selbst übersprungen'); continue; }
    if (!u.fcmToken) { console.log('Push: Kein Token für', d.id); continue; }
    if (isEinsatz && u.notif_einsatz !== false) tokens.push(u.fcmToken);
    if (!isEinsatz && u.notif_uebung !== false) tokens.push(u.fcmToken);
  }
  if (tokens.length === 0) { fw.toast('⚠️ Keine Push-Empfänger gefunden', true); return; }
  const title = isEinsatz ? '🚨 EINSATZ ALARM' : '🔔 Neuer Dienst';
  const body  = isEinsatz
    ? titel
    : `${titel} am ${new Date(datumStr).toLocaleDateString('de-DE')} (${dauerFormat(dauer_h)}h)`;
  await sendPush(tokens, title, body, isEinsatz, uebungId);
}

async function sendPush(tokens, title, body, alarm = false, uebungId = null) {
  try {
    await fw.addDoc('push_queue', {
      tokens, title, body, alarm, uebungId,
      erstelltAm: new Date(), erstelltVon: fw.user.uid,
    });
    fw.toast(alarm ? 'Alarm gesendet 🚨' : 'Benachrichtigung gesendet ✅');
  } catch(e) {
    fw.toast('Push Fehler: ' + e.message, true);
  }
}

// ── Deep Link ─────────────────────────────────────────────
function checkDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const uebungId = params.get('uebung');
  if (uebungId) {
    window.history.replaceState({}, '', window.location.pathname);
    navigate('uebung-detail', { id: uebungId });
  }
}

// ── Profil ────────────────────────────────────────────────
registerPage('profil', async (el) => {
  fw.setTitle('Mein Profil');
  // Immer frisch laden damit notif-Felder aktuell sind
  const [meSnap, qSnap, aSnap, pDiensteSnap, pEinsaetzeSnap] = await Promise.all([
    fw.getDoc('users/'+fw.user.uid),
    fw.getDocs('users/'+fw.user.uid+'/qualifikationen'),
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
    fw.getDocs('dienste'),
    fw.getDocs('einsaetze'),
  ]);
  const me = meSnap.data() || fw.profil;
  Object.assign(fw.profil, me);
  const qualis = qSnap.docs.map(d => ({id:d.id,...d.data()}));
  const pDienstMap  = new Map(pDiensteSnap.docs.map(d => [d.id, d.data()]));
  const pEinsatzMap = new Map(pEinsaetzeSnap.docs.map(d => [d.id, d.data()]));
  const stats  = getStats(aSnap.docs.map(d => d.data()), pDienstMap, pEinsatzMap);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtEinsatz)}h</div><div class="stat-label">Einsatzstunden ${new Date().getFullYear()}</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">${stats.einsaetze===1?'Einsatz':'Einsätze'} ${new Date().getFullYear()}</div></div>
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtDienst)}h</div><div class="stat-label">Dienststunden (12 Mon.)</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.dienste}</div><div class="stat-label">${stats.dienste===1?'Dienst':'Dienste'} (12 Mon.)</div></div>
      <div class="stat-card wide ${stats.ziel?'erreicht':'fehlt'}">
        <div class="stat-zahl">${dauerFormat(stats.stunden12m)} / 40:00h</div>
        <div class="stat-label">${stats.ziel?'✅ Ziel erreicht':'⚠️ Ziel nicht erreicht'}</div>
      </div>
    </div>
    <div class="section-header">Persönliche Daten</div>
    <div class="card">
      <div class="form-row"><label>Vorname</label><input id="p-vn" value="${me.vorname||''}"></div>
      <div class="form-row"><label>Nachname</label><input id="p-nn" value="${me.nachname||''}"></div>

      <div class="form-row"><label>Führerscheinklassen (z.B. B, C, CE)</label><input id="p-fs" value="${me.fuehrerschein||''}"></div>

      <div class="form-row" style="margin-top:0.5rem">
        <label>Design</label>
        <div style="display:flex;gap:0.6rem;margin-top:0.3rem">
          <button id="theme-standard" onclick="themeWaehlen('standard')"
            class="btn btn-sm ${(me.theme||'standard')==='standard'?'btn-primary':'btn-secondary'}"
            style="flex:1">🎨 Standard</button>
          <button id="theme-klassisch" onclick="themeWaehlen('klassisch')"
            class="btn btn-sm ${(me.theme||'standard')==='klassisch'?'btn-primary':'btn-secondary'}"
            style="flex:1">🖥️ Klassisch</button>
        </div>
      </div>
      <button class="btn btn-primary btn-full" onclick="profilSpeichern()">💾 Speichern</button>
    </div>

    <div class="section-header">🔔 Benachrichtigungen</div>
    <div class="card">
      <div class="notif-row" style="display:flex;align-items:center;gap:0.8rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-weight:600">🚨 Einsatzalarm</div><div class="muted" style="font-size:0.78rem">Bei neuen Einsätzen</div></div>
        <input type="checkbox" id="n-einsatz" style="width:24px;height:24px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      </div>
      <div class="notif-row" style="display:flex;align-items:center;gap:0.8rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-weight:600">📅 Neuer Dienst</div><div class="muted" style="font-size:0.78rem">Bei neuen Diensten</div></div>
        <input type="checkbox" id="n-uebung" style="width:24px;height:24px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      </div>
      <div class="notif-row" style="display:flex;align-items:center;gap:0.8rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-weight:600">✅ Bestätigung</div><div class="muted" style="font-size:0.78rem">Wenn Teilnahme bestätigt wird</div></div>
        <input type="checkbox" id="n-best" style="width:24px;height:24px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      </div>
      <div class="notif-row" style="display:flex;align-items:center;gap:0.8rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-weight:600">⚠️ Status-Warnung</div><div class="muted" style="font-size:0.78rem">Wenn App offline oder Push nicht bereit</div></div>
        <input type="checkbox" id="n-status" style="width:24px;height:24px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      </div>
      ${fw.isWehrfuehrer() ? `
      <div class="notif-row" style="display:flex;align-items:center;gap:0.8rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-weight:600">🧪 Selbst benachrichtigen</div><div class="muted" style="font-size:0.78rem">Nur für Tests – Wehrführer erhält eigene Alarme</div></div>
        <input type="checkbox" id="n-selbst" style="width:24px;height:24px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      </div>` : ''}
      <button class="btn btn-primary btn-full" style="margin-top:0.8rem" id="notif-save-btn" onclick="notifSpeichern()">💾 Speichern</button>
    </div>

    <div class="section-header">Dienstlich</div>
    <div class="card">
      <div style="display:flex;gap:1.2rem;flex-wrap:wrap">
        <div><div class="muted" style="font-size:0.72rem">Dienstgrad</div><div class="bold">${me.dienstgrad||'–'}</div></div>
        <div><div class="muted" style="font-size:0.72rem">Eingetreten</div><div class="bold">${datum(me.eintrittsdatum)||'–'}</div></div>
      </div>
      <hr>
      <div class="card-title" style="margin-bottom:0.5rem">Lehrgänge</div>
      ${qualis.length===0 ? '<p class="muted" style="font-size:0.85rem">Keine eingetragen</p>' :
        qualis.map(q => `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${q.bezeichnung}</div>
              <div class="list-item-sub">${q.datum?datum(q.datum):''}${q.bemerkung?' · '+q.bemerkung:''}</div>
            </div>
          </div>`).join('')}
    </div>

    <div class="section-header">Passwort ändern</div>
    <div class="card">
      <div class="form-row"><label>Aktuelles Passwort</label><input id="pw-alt" type="password"></div>
      <div class="form-row"><label>Neues Passwort</label><input id="pw-neu" type="password"></div>
      <button class="btn btn-primary btn-full" onclick="passwortAendern()">🔒 Passwort ändern</button>
    </div>
    <div class="card">
      <button class="btn btn-danger btn-full" onclick="abmelden()">Abmelden</button>
      <button class="btn btn-secondary btn-full" style="margin-top:0.5rem" onclick="pruefeAufUpdate(true)">🔄 Auf Updates prüfen</button>
    </div>
  `;
  // DOM-Elemente direkt nach innerHTML setzen
  const cbEinsatz = document.getElementById('n-einsatz');
  const cbUebung  = document.getElementById('n-uebung');
  const cbBest    = document.getElementById('n-best');
  const cbStatus  = document.getElementById('n-status');
  const cbSelbst  = document.getElementById('n-selbst');
  if (cbEinsatz) cbEinsatz.checked = me.notif_einsatz !== false;
  if (cbUebung)  cbUebung.checked  = me.notif_uebung  !== false;
  if (cbBest)    cbBest.checked    = me.notif_bestaetigung !== false;
  if (cbStatus)  cbStatus.checked  = me.notif_status  !== false;
  if (cbSelbst)  cbSelbst.checked  = me.notif_selbst  === true;
});

window.themeWaehlen = async (theme) => {
  document.body.setAttribute('data-theme', theme === 'klassisch' ? 'klassisch' : '');
  await fw.setDoc('users/'+fw.user.uid, { theme });
  Object.assign(fw.profil, { theme });
  // Buttons aktualisieren
  document.getElementById('theme-standard')?.classList.toggle('btn-primary',   theme !== 'klassisch');
  document.getElementById('theme-standard')?.classList.toggle('btn-secondary',  theme === 'klassisch');
  document.getElementById('theme-klassisch')?.classList.toggle('btn-primary',  theme === 'klassisch');
  document.getElementById('theme-klassisch')?.classList.toggle('btn-secondary', theme !== 'klassisch');
  fw.toast(theme === 'klassisch' ? '🖥️ Design: Klassisch' : '🎨 Design: Standard');
};

window.profilSpeichern = async () => {
  const data = {
    vorname: document.getElementById('p-vn').value,
    nachname: document.getElementById('p-nn').value,
    fuehrerschein: document.getElementById('p-fs').value,
    ortswehrId: fw.profil.ortswehrId || null,
  };
  await fw.setDoc('users/'+fw.user.uid, data);
  Object.assign(fw.profil, data);
  fw.toast('Gespeichert ✅');
};

function initNotifCheckboxes() {
  const p = fw.profil;
  const e = document.getElementById('n-einsatz');
  const u = document.getElementById('n-uebung');
  const b = document.getElementById('n-best');
  const s = document.getElementById('n-selbst');
  if (e) e.checked = p.notif_einsatz !== false;
  if (u) u.checked = p.notif_uebung !== false;
  if (b) b.checked = p.notif_bestaetigung !== false;
  if (s) s.checked = p.notif_selbst === true;
  const st = document.getElementById('n-status');
  if (st) st.checked = p.notif_status !== false;
}

window.notifSpeichern = async () => {
  const selbstEl = document.getElementById('n-selbst');
  const data = {
    notif_einsatz:      document.getElementById('n-einsatz').checked,
    notif_uebung:       document.getElementById('n-uebung').checked,
    notif_bestaetigung: document.getElementById('n-best').checked,
    notif_selbst:       selbstEl ? selbstEl.checked : false,
    notif_status:       document.getElementById('n-status')?.checked ?? true,
  };
  await fw.setDoc('users/'+fw.user.uid, data);
  Object.assign(fw.profil, data);
  if (data.notif_einsatz || data.notif_uebung || data.notif_bestaetigung) {
    const token = await fw.registerPush();
    if (token) fw.toast('Gespeichert ✅ Push aktiv');
    else fw.toast('Gespeichert – Push nicht verfügbar', true);
  } else {
    await fw.setDoc('users/'+fw.user.uid, { fcmToken: null });
    fw.toast('Gespeichert ✅');
  }
  fw.toast('Einstellungen gespeichert ✅');
};

window.passwortAendern = async () => {
  const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } =
    await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
  const alt = document.getElementById('pw-alt').value;
  const neu = document.getElementById('pw-neu').value;
  if (!alt||!neu) { fw.toast('Bitte beide Felder ausfüllen', true); return; }
  if (neu.length < 6) { fw.toast('Mind. 6 Zeichen', true); return; }
  try {
    const cred = EmailAuthProvider.credential(fw.user.email, alt);
    await reauthenticateWithCredential(fw.user, cred);
    await updatePassword(fw.user, neu);
    fw.toast('Passwort geändert ✅');
    document.getElementById('pw-alt').value = '';
    document.getElementById('pw-neu').value = '';
  } catch(e) { fw.toast('Altes Passwort falsch', true); }
};

window.abmelden = async () => {
  const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
  await signOut(fw.auth);
};


// ── Statistik ─────────────────────────────────────────────
registerPage('statistik', async (el) => {
  fw.setTitle('Statistik');
  el.innerHTML = '<div class="empty">⏳ Lade...</div>';

  const jetzt    = new Date();
  const jahrAkt  = jetzt.getFullYear();
  const jahrVor  = jahrAkt - 1;

  // Alle Daten laden
  const [usersSnap, anwSnap, einsaetzeSnap, diensteSnap] = await Promise.all([
    fw.getDocs('users'),
    fw.getDocs('anwesenheiten'),
    fw.getDocs('einsaetze'),
    fw.getDocs('dienste'),
  ]);

  const users     = usersSnap.docs.map(d => ({id:d.id,...d.data()})).filter(u => u.aktiv !== false && u.vorname);
  const anw       = anwSnap.docs.map(d => d.data()).filter(a => a.status==='kommt' || a.status==='bestaetigt');
  const einsaetze = einsaetzeSnap.docs.map(d => ({id:d.id,...d.data()}));
  const dienste   = diensteSnap.docs.map(d => ({id:d.id,...d.data()}));

  // Hilfsfunktionen
  const jahrvon = (datum, jahr) => {
    const d = datum?.toDate ? datum.toDate() : new Date(datum);
    return d.getFullYear() === jahr;
  };

  // Lehrgänge per User laden
  const qualiSnaps = await Promise.all(users.map(u => fw.getDocs('users/'+u.id+'/qualifikationen')));
  const qualiPerUser = {};
  users.forEach((u, i) => {
    qualiPerUser[u.id] = qualiSnaps[i].docs.map(d => d.data());
  });

  // Dienste/Einsätze als Map für Stunden-Lookup
  const dienstMap  = new Map(dienste.map(d  => [d.id, d]));
  const einsatzMap = new Map(einsaetze.map(e => [e.id, e]));

  function stundenUndTyp(a) {
    // typ+datum aus Quell-Collection ermitteln (anwesenheiten haben das evtl. nicht gesetzt)
    const d = dienstMap.get(a.uebungId);
    if (d) return { typ:'dienst',  datum: d.datum,  dauer_h: d.dauer_h||0 };
    const e = einsatzMap.get(a.uebungId);
    if (e) return { typ:'einsatz', datum: e.datum,  dauer_h: e.dauer_h||0 };
    // Fallback auf gespeicherte Felder
    return { typ: a.typ||'dienst', datum: a.datum, dauer_h: a.dauer_h||0 };
  }
  function stunden(userId, typ, jahr) {
    return anw
      .filter(a => a.userId===userId)
      .reduce((s, a) => {
        const {typ:t, datum:dat, dauer_h} = stundenUndTyp(a);
        if (t !== typ) return s;
        if (!jahrvon(dat, jahr)) return s;
        return s + dauer_h;
      }, 0);
  }
  function einsatzAnzahl(userId, jahr) {
    return anw.filter(a => {
      if (a.userId !== userId) return false;
      const {typ, datum} = stundenUndTyp(a);
      return typ==='einsatz' && jahrvon(datum, jahr);
    }).length;
  }
  function lehrgangStunden(userId, jahr) {
    return (qualiPerUser[userId]||[])
      .filter(q => q.datum && jahrvon(q.datum, jahr))
      .length; // Anzahl Lehrgänge (keine Stunden gespeichert)
  }

  // Jahresvergleich gesamt
  const gesamt = (jahr) => ({
    einsaetze: einsaetze.filter(e => jahrvon(e.datum, jahr)).length,
    dienststunden: users.reduce((s,u) => s + stunden(u.id,'dienst',jahr), 0),
    lehrgangsanzahl: users.reduce((s,u) => s + lehrgangStunden(u.id,jahr), 0),
  });
  const gAkt = gesamt(jahrAkt);
  const gVor = gesamt(jahrVor);

  function diff(a, b, einheit='') {
    const d = a - b;
    const col = d > 0 ? '#16a34a' : d < 0 ? '#dc2626' : '#6b7280';
    const pfeil = d > 0 ? '▲' : d < 0 ? '▼' : '=';
    return `<span style="color:${col};font-size:0.8rem">${pfeil} ${Math.abs(d)}${einheit}</span>`;
  }

  // Pro-Kamerad-Tabelle
  const kRows = users
    .sort((a,b) => (a.nachname||'').localeCompare(b.nachname||'', 'de') || (a.vorname||'').localeCompare(b.vorname||'', 'de'))
    .map(u => {
      const dAkt = stunden(u.id,'dienst',jahrAkt);
      const dVor = stunden(u.id,'dienst',jahrVor);
      const lAkt = lehrgangStunden(u.id,jahrAkt);
      const lVor = lehrgangStunden(u.id,jahrVor);
      const eAkt = einsatzAnzahl(u.id,jahrAkt);
      const eVor = einsatzAnzahl(u.id,jahrVor);
      return {u, dAkt, dVor, lAkt, lVor, eAkt, eVor};
    }); // nur aktive Kameraden, alphabetisch

  const sumD = (jahr) => kRows.reduce((s,r) => s+(jahr===jahrAkt?r.dAkt:r.dVor),0);
  const sumL = (jahr) => kRows.reduce((s,r) => s+(jahr===jahrAkt?r.lAkt:r.lVor),0);
  const sumE = (jahr) => kRows.reduce((s,r) => s+(jahr===jahrAkt?r.eAkt:r.eVor),0);

  el.innerHTML = `
    <div class="section-header">Jahresvergleich</div>
    <div class="card">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead>
          <tr style="color:var(--muted);font-size:0.75rem">
            <th style="text-align:left;padding:0.4rem 0.3rem"></th>
            <th style="text-align:right;padding:0.4rem 0.3rem">${jahrVor}</th>
            <th style="text-align:right;padding:0.4rem 0.3rem">${jahrAkt}</th>
            <th style="text-align:right;padding:0.4rem 0.3rem">Diff</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:0.5rem 0.3rem">Einsätze</td>
            <td style="text-align:right;padding:0.5rem 0.3rem">${gVor.einsaetze}</td>
            <td style="text-align:right;padding:0.5rem 0.3rem;font-weight:600">${gAkt.einsaetze}</td>
            <td style="text-align:right;padding:0.5rem 0.3rem">${diff(gAkt.einsaetze,gVor.einsaetze)}</td>
          </tr>
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:0.5rem 0.3rem">Dienststunden</td>
            <td style="text-align:right;padding:0.5rem 0.3rem">${dauerFormat(gVor.dienststunden)}h</td>
            <td style="text-align:right;padding:0.5rem 0.3rem;font-weight:600">${dauerFormat(gAkt.dienststunden)}h</td>
            <td style="text-align:right;padding:0.5rem 0.3rem">${diff(gAkt.dienststunden,gVor.dienststunden,'h')}</td>
          </tr>
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:0.5rem 0.3rem">Lehrgänge</td>
            <td style="text-align:right;padding:0.5rem 0.3rem">${gVor.lehrgangsanzahl}</td>
            <td style="text-align:right;padding:0.5rem 0.3rem;font-weight:600">${gAkt.lehrgangsanzahl}</td>
            <td style="text-align:right;padding:0.5rem 0.3rem">${diff(gAkt.lehrgangsanzahl,gVor.lehrgangsanzahl)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-header">Pro Kamerad</div>
    <div class="card" style="padding:0;overflow:hidden">
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem;min-width:380px">
          <thead>
            <tr style="color:var(--muted);font-size:0.72rem;background:var(--panel)">
              <th style="text-align:left;padding:0.5rem 0.6rem;position:sticky;left:0;background:var(--panel);z-index:2;min-width:90px">Kamerad</th>
              <th colspan="2" style="text-align:center;padding:0.35rem 0.4rem;border-left:1px solid var(--border)">Dienste</th>
              <th colspan="2" style="text-align:center;padding:0.35rem 0.4rem;border-left:1px solid var(--border)">Lehrgänge</th>
              <th colspan="2" style="text-align:center;padding:0.35rem 0.4rem;border-left:1px solid var(--border)">Einsätze</th>
            </tr>
            <tr style="color:var(--muted);font-size:0.7rem;background:var(--panel)">
              <th style="padding:0.2rem 0.6rem;position:sticky;left:0;background:var(--panel);z-index:2;border-bottom:2px solid var(--border)"></th>
              <th style="text-align:right;padding:0.2rem 0.4rem;border-left:1px solid var(--border);border-bottom:2px solid var(--border)">${jahrVor}</th>
              <th style="text-align:right;padding:0.2rem 0.4rem;border-bottom:2px solid var(--border)">${jahrAkt}</th>
              <th style="text-align:right;padding:0.2rem 0.4rem;border-left:1px solid var(--border);border-bottom:2px solid var(--border)">${jahrVor}</th>
              <th style="text-align:right;padding:0.2rem 0.4rem;border-bottom:2px solid var(--border)">${jahrAkt}</th>
              <th style="text-align:right;padding:0.2rem 0.4rem;border-left:1px solid var(--border);border-bottom:2px solid var(--border)">${jahrVor}</th>
              <th style="text-align:right;padding:0.2rem 0.4rem;border-bottom:2px solid var(--border)">${jahrAkt}</th>
            </tr>
          </thead>
          <tbody>
            ${kRows.map((r,idx) => {
              const odd = idx%2 !== 0;
              const isKlassisch = document.body.getAttribute('data-theme') === 'klassisch';
              const zebraStyle = odd ? (isKlassisch ? 'background:rgba(0,0,0,0.07)' : 'background:rgba(255,255,255,0.08)') : '';
              return `<tr style="${zebraStyle}">
                <td class="${odd?'stat-td-sticky-odd':'stat-td-sticky'}" style="padding:0.4rem 0.6rem;font-weight:500">${kurzName(r.u.vorname, r.u.nachname)}</td>
                <td style="text-align:right;padding:0.4rem 0.4rem;border-left:1px solid var(--border);color:var(--muted)">${dauerFormat(r.dVor)}h</td>
                <td style="text-align:right;padding:0.4rem 0.4rem">${dauerFormat(r.dAkt)}h</td>
                <td style="text-align:right;padding:0.4rem 0.4rem;border-left:1px solid var(--border);color:var(--muted)">${r.lVor}</td>
                <td style="text-align:right;padding:0.4rem 0.4rem">${r.lAkt}</td>
                <td style="text-align:right;padding:0.4rem 0.4rem;border-left:1px solid var(--border);color:var(--muted)">${r.eVor}</td>
                <td style="text-align:right;padding:0.4rem 0.4rem">${r.eAkt}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border);font-weight:700;background:var(--panel)">
              <td class="stat-td-sticky" style="padding:0.4rem 0.6rem">Gesamt</td>
              <td style="text-align:right;padding:0.4rem 0.4rem;border-left:1px solid var(--border);color:var(--muted)">${dauerFormat(sumD(jahrVor))}h</td>
              <td style="text-align:right;padding:0.4rem 0.4rem">${dauerFormat(sumD(jahrAkt))}h</td>
              <td style="text-align:right;padding:0.4rem 0.4rem;border-left:1px solid var(--border);color:var(--muted)">${sumL(jahrVor)}</td>
              <td style="text-align:right;padding:0.4rem 0.4rem">${sumL(jahrAkt)}</td>
              <td style="text-align:right;padding:0.4rem 0.4rem;border-left:1px solid var(--border);color:var(--muted)">${sumE(jahrVor)}</td>
              <td style="text-align:right;padding:0.4rem 0.4rem">${sumE(jahrAkt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
});


// ── News erstellen ────────────────────────────────────────
registerPage('news-form', async (el) => {
  fw.setTitle('Beitrag erstellen');
  fw.showBack(() => navigate('dashboard'));
  let optionen = ['', ''];

  const render = () => {
    el.innerHTML = `
      <div class="card">
        <div class="form-row"><label>Titel</label><input id="nf-titel" placeholder="Überschrift" value="${document.getElementById('nf-titel')?.value||''}"></div>
        <div class="form-row"><label>Text</label><textarea id="nf-inhalt" rows="4" style="width:100%;padding:0.6rem;border:1px solid var(--border);border-radius:8px;font-size:0.9rem;resize:vertical">${document.getElementById('nf-inhalt')?.value||''}</textarea></div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin:0.5rem 0">
          <input type="checkbox" id="nf-abstimmung-cb" style="width:20px;height:20px" ${document.getElementById('nf-abstimmung-cb')?.checked?'checked':''}>
          <label for="nf-abstimmung-cb" style="font-size:0.88rem">Abstimmung hinzufügen</label>
        </div>
        <div id="nf-abstimmung-block" style="display:${document.getElementById('nf-abstimmung-cb')?.checked?'block':'none'}">
          <div class="form-row"><label>Frage</label><input id="nf-frage" value="${document.getElementById('nf-frage')?.value||''}"></div>
          ${optionen.map((o,i) => `<div class="form-row"><label>Option ${i+1}</label><input class="nf-opt" data-i="${i}" value="${o}"></div>`).join('')}
          <button class="btn btn-secondary btn-sm" onclick="nfAddOption()">+ Option</button>
        </div>
        <div class="btn-row" style="margin-top:1rem">
          <button class="btn btn-primary" onclick="newsSpeichern()">💾 Veröffentlichen</button>
        </div>
      </div>`;
    document.getElementById('nf-abstimmung-cb')?.addEventListener('change', e => {
      document.getElementById('nf-abstimmung-block').style.display = e.target.checked ? 'block' : 'none';
    });
    document.querySelectorAll('.nf-opt').forEach(inp => {
      inp.addEventListener('input', e => { optionen[+e.target.dataset.i] = e.target.value; });
    });
  };
  render();

  window.nfAddOption = () => { optionen.push(''); render(); };
  window.newsSpeichern = async () => {
    const titel  = document.getElementById('nf-titel').value.trim();
    const inhalt = document.getElementById('nf-inhalt').value.trim();
    if (!titel) { fw.toast('Titel fehlt', true); return; }
    const hatAbst = document.getElementById('nf-abstimmung-cb')?.checked;
    const data = {
      titel, inhalt,
      erstelltAm: new Date(),
      erstelltVon: fw.user.uid,
    };
    if (hatAbst) {
      const frage = document.getElementById('nf-frage').value.trim();
      const opts  = optionen.filter(o => o.trim());
      if (!frage || opts.length < 2) { fw.toast('Frage und mind. 2 Optionen erforderlich', true); return; }
      data.abstimmung = { frage, optionen: opts.map(text => ({text, stimmen:[]})) };
    }
    await fw.addDoc('news', data);
    fw.toast('Veröffentlicht ✅');
    navigate('dashboard');
  };
});

// ── Kameraden ─────────────────────────────────────────────
registerPage('kameraden', async (el) => {
  fw.setTitle('Kameraden');
  fw.showHeaderAction('+ Neu', () => navigate('kamerad-form', {}));
  const snap = await fw.getDocs('users');
  const users = snap.docs.map(d => ({id:d.id,...d.data()}))
    .sort((a,b) => (a.nachname||'').localeCompare(b.nachname||''));
  el.innerHTML = `
    <div class="card">
      ${users.map(u => `
        <div class="list-item" onclick="navigate('kamerad-detail',{id:'${u.id}'})">
          <div class="list-item-icon">👤</div>
          <div class="list-item-body">
            <div class="list-item-title">${u.nachname||''}, ${u.vorname||''}</div>
            <div class="list-item-sub">${u.dienstgrad||'–'} · ${u.aktiv===false?'<span style="color:var(--muted)">Inaktiv</span>':'Aktiv'}</div>
          </div>
          <div class="list-chevron">›</div>
        </div>`).join('')}
    </div>
    ${fw.isWehrfuehrer() ? `
    <details style="background:var(--card);border-radius:10px;padding:0.8rem;margin-top:0.8rem">
      <summary style="font-weight:600;cursor:pointer;list-style:none;display:flex;align-items:center;gap:0.5rem">🏘️ Ortswehren verwalten</summary>
      <div id="ortswehr-inline" style="margin-top:0.8rem">⏳ Lade...</div>
    </details>` : ''}
  `;
  if (fw.isWehrfuehrer()) ladeOrtswehrenInline();
});

async function ladeOrtswehrenInline() {
  const snap = await fw.getDocs('ortswehren');
  const wehren = snap.docs.map(d => ({id:d.id,...d.data()}));
  const el = document.getElementById('ortswehr-inline');
  if (!el) return;
  el.innerHTML = `
    ${wehren.map(w => `
      <div class="list-item">
        <div class="list-item-body"><div class="list-item-title">${w.name}</div></div>
        <div style="display:flex;gap:0.4rem">
          <button class="btn btn-sm btn-secondary" onclick="navigate('ortswehr-form',{id:'${w.id}'})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="ortswehrLoeschenInline('${w.id}')">🗑</button>
        </div>
      </div>`).join('') || '<p class="muted" style="font-size:0.85rem">Noch keine Ortswehren</p>'}
    <div style="margin-top:0.6rem">
      <button class="btn btn-secondary btn-sm" onclick="navigate('ortswehr-form',{})">+ Neue Ortswehr</button>
    </div>`;
}
window.ortswehrLoeschenInline = async (id) => {
  if (!confirm('Ortswehr wirklich löschen?')) return;
  await fw.deleteDoc('ortswehren/'+id);
  fw.toast('Gelöscht'); ladeOrtswehrenInline();
};

registerPage('kamerad-detail', async (el, {id}) => {
  const snap = await fw.getDoc('users/'+id);
  if (!snap.exists()) { el.innerHTML='<div class="empty">Nicht gefunden</div>'; return; }
  const u = {id,...snap.data()};
  fw.setTitle(u.vorname+' '+u.nachname);
  fw.showBack(() => navigate('kameraden'));
  fw.showHeaderAction('✏️ Edit', () => navigate('kamerad-form',{id}));

  const [aSnap, qSnap, ortSnap] = await Promise.all([
    fw.getDocs('anwesenheiten', fw.where('userId','==',id)),
    fw.getDocs('users/'+id+'/qualifikationen'),
    u.ortswehrId ? fw.getDoc('ortswehren/'+u.ortswehrId) : Promise.resolve(null),
  ]);
  const stats  = getStats(aSnap.docs.map(d => d.data()));
  const qualis = qSnap.docs.map(d => ({id:d.id,...d.data()}));
  const wehrName = ortSnap?.exists?.() ? ortSnap.data().name : '–';

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtEinsatz)}h</div><div class="stat-label">Einsatzstunden ${new Date().getFullYear()}</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">${stats.einsaetze===1?'Einsatz':'Einsätze'} ${new Date().getFullYear()}</div></div>
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtDienst)}h</div><div class="stat-label">Dienststunden (12 Mon.)</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.dienste}</div><div class="stat-label">${stats.dienste===1?'Dienst':'Dienste'} (12 Mon.)</div></div>
      <div class="stat-card wide ${stats.ziel?'erreicht':'fehlt'}">
        <div class="stat-zahl">${dauerFormat(stats.stunden12m)} / 40:00h</div>
        <div class="stat-label">${stats.ziel?'✅ Ziel erreicht':'⚠️ Ziel nicht erreicht'}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Stammdaten</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem">
        ${[['Dienstgrad',u.dienstgrad],['Ortswehr',wehrName],
           ['Eingetreten',datum(u.eintrittsdatum)],['Telefon',u.telefon],
           ['Führerschein',u.fuehrerschein],
        ].map(([l,v]) => `<div><div class="muted" style="font-size:0.72rem">${l}</div><div style="font-size:0.88rem">${v||'–'}</div></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Lehrgänge</div>
      ${qualis.length===0?'<p class="muted" style="font-size:0.85rem">Keine</p>':
        qualis.map(q=>`
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${q.bezeichnung}</div>
              <div class="list-item-sub">${q.datum?datum(q.datum):''}${q.bemerkung?' · '+q.bemerkung:''}</div>
            </div>
            <button class="btn btn-sm btn-danger" onclick="qualiLoeschen('${id}','${q.id}')">🗑</button>
          </div>`).join('')}
      <hr>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem">
        <div style="display:flex;flex-direction:column;gap:0.5rem;width:100%;margin-top:0.3rem">
          <select id="q-bez" style="width:100%">
            <option value="">– Lehrgang wählen –</option>
            ${['Truppmann','Sprechfunk','AGT','TH-Grund','Maschinist','Absturzsicherung','ABC-Grund','Truppführer','Gruppenführer','Zugführer','Wehrführer','Erste-Hilfe','Motorsäge A/B','Motorsäge C/D'].map(l=>`<option value="${l}">${l}</option>`).join('')}
          </select>
          <input id="q-dat" type="date" placeholder="Datum bestanden" style="width:100%">
          <div style="display:flex;gap:0.5rem">
            <input id="q-bem" placeholder="Bemerkung (optional)" style="flex:1">
            <button class="btn btn-primary btn-sm" onclick="qualiHinzufuegen('${id}')">+ Hinzufügen</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:0.5rem">
      ${u.aktiv === false
        ? `<button class="btn btn-primary btn-full" onclick="kameradAktiv('${id}')">✅ Kamerad aktiv setzen</button>`
        : `<button class="btn btn-secondary btn-full" onclick="kameradInaktiv('${id}')">🔕 Kamerad inaktiv setzen</button>`
      }
      <button class="btn btn-danger btn-full" onclick="kameradLoeschen('${id}')">🗑 Kamerad vollständig löschen</button>
    </div>`;
});

window.kameradAktiv = async (id) => {
  await fw.updateDoc('users/'+id, { aktiv: true });
  fw.toast('Kamerad aktiv gesetzt ✅'); navigate('kamerad-detail', {id});
};

window.kameradInaktiv = async (id) => {
  if (!confirm('Kamerad auf inaktiv setzen?')) return;
  await fw.updateDoc('users/'+id, { aktiv: false });
  fw.toast('Kamerad inaktiv gesetzt ✅'); navigate('kamerad-detail', {id});
};

window.kameradLoeschen = async (id) => {
  if (!confirm('Kamerad VOLLSTÄNDIG löschen? Dies kann nicht rückgängig gemacht werden!')) return;
  if (!confirm('Wirklich? Alle Daten dieses Kameraden werden gelöscht!')) return;
  // Qualifikationen löschen
  const qSnap = await fw.getDocs('users/'+id+'/qualifikationen');
  await Promise.all(qSnap.docs.map(d => fw.deleteDoc('users/'+id+'/qualifikationen/'+d.id)));
  // Anwesenheiten löschen
  const aSnap = await fw.getDocs('anwesenheiten', fw.where('userId','==',id));
  await Promise.all(aSnap.docs.map(d => fw.deleteDoc('anwesenheiten/'+d.id)));
  // Firestore-Dokument löschen
  await fw.deleteDoc('users/'+id);
  // Auth-Account löschen (über Cloud Function)
  try {
    const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js');
    const functions = getFunctions(fw.app, 'europe-west3');
    await httpsCallable(functions, 'deleteAuthUser')({ uid: id });
  } catch(e) {
    fw.toast('Firestore gelöscht, Auth-Account konnte nicht entfernt werden: ' + e.message, true);
    navigate('kameraden'); return;
  }
  fw.toast('Kamerad vollständig gelöscht ✅'); navigate('kameraden');
};

window.qualiHinzufuegen = async (userId) => {
  const bez = document.getElementById('q-bez').value;
  if (!bez) { fw.toast('Bitte einen Lehrgang wählen', true); return; }
  await fw.addDoc('users/'+userId+'/qualifikationen', {
    bezeichnung: bez,
    datum: document.getElementById('q-dat').value || null,
    bemerkung: document.getElementById('q-bem').value || '',
  });
  fw.toast('Hinzugefügt'); navigate('kamerad-detail',{id:userId});
};
window.qualiLoeschen = async (userId, qualiId) => {
  await fw.deleteDoc('users/'+userId+'/qualifikationen/'+qualiId);
  fw.toast('Gelöscht'); navigate('kamerad-detail',{id:userId});
};

registerPage('kamerad-form', async (el, {id}) => {
  let u = null;
  if (id) { const s=await fw.getDoc('users/'+id); if(s.exists()) u={id,...s.data()}; }
  fw.setTitle(u ? 'Bearbeiten' : 'Neuer Kamerad');
  fw.showBack(() => id ? navigate('kamerad-detail',{id}) : navigate('kameraden'));

  const owSnap = await fw.getDocs('ortswehren');
  const ortswehren = owSnap.docs.map(d => ({id:d.id,...d.data()}));
  const owOptions = ortswehren.map(o =>
    `<option value="${o.id}" ${u?.ortswehrId===o.id?'selected':''}>${o.name}</option>`).join('');

  const datumVal = u?.eintrittsdatum?.toDate ? u.eintrittsdatum.toDate().toISOString().slice(0,10) : (u?.eintrittsdatum||'');

  el.innerHTML = `
    <div class="card">
      ${!u ? `
        <div class="form-row"><label>Benutzername (wird Login)</label><input id="k-email" type="text" placeholder="vorname.nachname" autocapitalize="none"></div>
        <div class="form-row"><label>Initiales Passwort (mind. 6 Zeichen)</label><input id="k-pw" type="password"></div>
      ` : ''}
      <div class="form-row"><label>Vorname</label><input id="k-vn" value="${u?.vorname||''}"></div>
      <div class="form-row"><label>Nachname</label><input id="k-nn" value="${u?.nachname||''}"></div>
      <div class="form-row"><label>Dienstgrad</label><select id="k-dg"><option value="">– wählen –</option><option value="Feuerwehrmann-Anwärter" ${u?.dienstgrad==="Feuerwehrmann-Anwärter"?"selected":""}>Feuerwehrmann-Anwärter</option><option value="Feuerwehrmann" ${u?.dienstgrad==="Feuerwehrmann"?"selected":""}>Feuerwehrmann</option><option value="Oberfeuerwehrmann" ${u?.dienstgrad==="Oberfeuerwehrmann"?"selected":""}>Oberfeuerwehrmann</option><option value="Hauptfeuerwehrmann" ${u?.dienstgrad==="Hauptfeuerwehrmann"?"selected":""}>Hauptfeuerwehrmann</option><option value="1. Hauptfeuerwehrmann" ${u?.dienstgrad==="1. Hauptfeuerwehrmann"?"selected":""}>1. Hauptfeuerwehrmann</option><option value="Löschmeister" ${u?.dienstgrad==="Löschmeister"?"selected":""}>Löschmeister</option><option value="Oberlöschmeister" ${u?.dienstgrad==="Oberlöschmeister"?"selected":""}>Oberlöschmeister</option><option value="Hauptlöschmeister" ${u?.dienstgrad==="Hauptlöschmeister"?"selected":""}>Hauptlöschmeister</option><option value="1. Hauptlöschmeister" ${u?.dienstgrad==="1. Hauptlöschmeister"?"selected":""}>1. Hauptlöschmeister</option><option value="Brandmeister" ${u?.dienstgrad==="Brandmeister"?"selected":""}>Brandmeister</option><option value="Oberbrandmeister" ${u?.dienstgrad==="Oberbrandmeister"?"selected":""}>Oberbrandmeister</option><option value="Hauptbrandmeister" ${u?.dienstgrad==="Hauptbrandmeister"?"selected":""}>Hauptbrandmeister</option><option value="1. Hauptbrandmeister" ${u?.dienstgrad==="1. Hauptbrandmeister"?"selected":""}>1. Hauptbrandmeister</option></select></div>
      <div class="form-row"><label>Eintrittsdatum</label><input id="k-ed" type="date" value="${datumVal}"></div>
      <div class="form-row"><label>Ortswehr</label>
        <select id="k-ow">
          <option value="">– Keine Zuordnung –</option>
          ${owOptions}
        </select>
      </div>
      <div class="form-row"><label>Rolle</label>
        <select id="k-rolle" onchange="rolleGeaendert(this.value)">
          <option value="kamerad" ${u?.rolle==='kamerad'?'selected':''}>Kamerad</option>
          <option value="gruppenführer" ${u?.rolle==='gruppenführer'?'selected':''}>Gruppenführer</option>
          <option value="zugführer" ${u?.rolle==='zugführer'?'selected':''}>Zugführer</option>
          <option value="wehrfuehrer" ${u?.rolle==='wehrfuehrer'?'selected':''}>Wehrführer</option>
        </select>
        <div id="staerke-rolle-row" style="display:${u?.rolle==='wehrfuehrer'?'block':'none'};margin-top:0.5rem">
          <label style="font-size:0.82rem;color:var(--muted)">Zählt in der Einsatzstärke als</label>
          <select id="k-staerke-rolle">
            <option value="kamerad" ${(u?.stärkeRolle||'kamerad')==='kamerad'?'selected':''}>Kamerad</option>
            <option value="gruppenführer" ${u?.stärkeRolle==='gruppenführer'?'selected':''}>Gruppenführer</option>
            <option value="zugführer" ${u?.stärkeRolle==='zugführer'?'selected':''}>Zugführer</option>
          </select>
        </div>
      </div>
      <div class="form-row"><label>Führerscheinklassen</label><input id="k-fs" value="${u?.fuehrerschein||''}"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="kameradSpeichern('${id||''}')">💾 Speichern</button>
      </div>
    </div>`;
});

window.kameradSpeichern = async (id) => {
  const data = {
    vorname: document.getElementById('k-vn').value,
    nachname: document.getElementById('k-nn').value,
    dienstgrad: document.getElementById('k-dg').value,
    eintrittsdatum: document.getElementById('k-ed').value || null,
    ortswehrId: document.getElementById('k-ow').value || null,
    rolle: document.getElementById('k-rolle').value,
    stärkeRolle: document.getElementById('k-rolle').value === 'wehrfuehrer'
      ? (document.getElementById('k-staerke-rolle')?.value || 'kamerad')
      : document.getElementById('k-rolle').value,
    fuehrerschein: document.getElementById('k-fs').value,
  };
  try {
    if (id) {
      await fw.setDoc('users/'+id, data);
      fw.toast('Gespeichert ✅'); navigate('kamerad-detail',{id});
    } else {
      const loginName = document.getElementById('k-email').value.trim().toLowerCase();
      const pw = document.getElementById('k-pw').value;
      if (!loginName||!pw) { fw.toast('Benutzername und Passwort erforderlich', true); return; }
      if (pw.length < 6) { fw.toast('Passwort mind. 6 Zeichen', true); return; }
      const email = loginName.includes('@') ? loginName : loginName + '@ffw-oegeln.de';
      data.loginName = loginName;
      await window.createKamerad(email, pw, data);
      fw.toast('Kamerad angelegt ✅'); navigate('kameraden');
    }
  } catch(e) {
    fw.toast(e.message.includes('email-already') ? 'Benutzername bereits vergeben' : e.message, true);
  }
};

// ── Ortswehren ────────────────────────────────────────────
registerPage('ortswehren', async (el) => {
  fw.setTitle('Ortswehren');
  fw.showHeaderAction('+ Neu', () => navigate('ortswehr-form', {}));
  const snap = await fw.getDocs('ortswehren');
  const wehren = snap.docs.map(d => ({id:d.id,...d.data()}));
  el.innerHTML = `
    <div class="card">
      ${wehren.length===0 ? '<div class="empty">Noch keine Ortswehren angelegt.<br>Oben rechts auf "+ Neu" tippen.</div>' :
        wehren.map(w => `
          <div class="list-item" onclick="navigate('ortswehr-form',{id:'${w.id}'})">
            <div class="list-item-icon">🏘️</div>
            <div class="list-item-body">
              <div class="list-item-title">${w.name}</div>
              <div class="list-item-sub">${w.ort||''}</div>
            </div>
            <div class="list-chevron">›</div>
          </div>`).join('')}
    </div>`;
});

registerPage('ortswehr-form', async (el, {id}) => {
  let w = null;
  if (id) { const s=await fw.getDoc('ortswehren/'+id); if(s.exists()) w={id,...s.data()}; }
  fw.setTitle(w ? 'Ortswehr bearbeiten' : 'Neue Ortswehr');
  fw.showBack(() => navigate('ortswehren'));
  el.innerHTML = `
    <div class="card">
      <div class="form-row"><label>Name der Wehr</label><input id="ow-name" value="${w?.name||''}" placeholder="FFW Musterort"></div>
      <div class="form-row"><label>Ort</label><input id="ow-ort" value="${w?.ort||''}" placeholder="Musterort"></div>
      <div class="form-row"><label>Bemerkung</label><input id="ow-bem" value="${w?.bemerkung||''}"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="ortswehrSpeichern('${id||''}')">💾 Speichern</button>
        ${w ? `<button class="btn btn-danger" onclick="ortswehrLoeschen('${id}')">🗑 Löschen</button>` : ''}
      </div>
    </div>`;
});

window.ortswehrSpeichern = async (id) => {
  const data = {
    name: document.getElementById('ow-name').value.trim(),
    ort:  document.getElementById('ow-ort').value.trim(),
    bemerkung: document.getElementById('ow-bem').value.trim(),
  };
  if (!data.name) { fw.toast('Name erforderlich', true); return; }
  if (id) await fw.setDoc('ortswehren/'+id, data);
  else    await fw.addDoc('ortswehren', {...data, erstelltAm: new Date()});
  fw.toast('Gespeichert ✅'); navigate('ortswehren');
};
window.ortswehrLoeschen = async (id) => {
  if (!confirm('Ortswehr löschen?')) return;
  await fw.deleteDoc('ortswehren/'+id);
  fw.toast('Gelöscht'); navigate('ortswehren');
};

}); // end waitFw
