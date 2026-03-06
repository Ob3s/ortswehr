// js/pages.js – alle Seiten v1.5.1
function waitFw(cb) { if (window.fw) cb(); else setTimeout(() => waitFw(cb), 50); }

waitFw(() => {

// ── Helpers ───────────────────────────────────────────────
function datum(d) {
  if (!d) return '–';
  const ts = d?.toDate ? d.toDate() : new Date(d);
  if (isNaN(ts)) return '–';
  return ts.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
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

function anwesenheitBadge(s) {
  if (!s)                   return '<span class="badge badge-gray">–</span>';
  if (s==='bestaetigt')     return '<span class="badge badge-green">✅ Bestätigt</span>';
  if (s==='vorgeschlagen')  return '<span class="badge badge-orange">⏳ Ausstehend</span>';
  if (s==='abgelehnt')      return '<span class="badge badge-red">❌ Abgelehnt</span>';
  return '';
}
function getStats(anwesenheiten) {
  const vor12m = new Date(); vor12m.setFullYear(vor12m.getFullYear()-1);
  let gesamtEinsatz=0, gesamtDienst=0, einsaetze=0, dienste=0, stunden12m=0;
  for (const a of anwesenheiten) {
    if (a.status !== 'bestaetigt') continue;
    const h = a.dauer_h || 0;
    const d = a.datum?.toDate ? a.datum.toDate() : new Date(a.datum);
    if (a.typ === 'einsatz') { gesamtEinsatz += h; einsaetze++; }
    else                     { gesamtDienst  += h; dienste++;   }
    if (d >= vor12m && a.typ !== 'einsatz') stunden12m += h;
  }
  return {
    gesamtEinsatz: Math.round(gesamtEinsatz*10)/10,
    gesamtDienst:  Math.round(gesamtDienst*10)/10,
    einsaetze, dienste,
    stunden12m: Math.round(stunden12m*10)/10,
    ziel: stunden12m >= 40,
  };
}

// ── Nächste Dienste ──────────────────────────────────────
function dienstKarte(d, label) {
  return `<div class="card" style="margin-bottom:0.5rem;cursor:pointer" onclick="navigate('uebung-detail',{id:'${d.id}',typ:'dienst'})">
    <div style="font-size:0.72rem;color:var(--muted);margin-bottom:0.2rem">${label}</div>
    <div style="font-weight:600">${d.titel}</div>
    <div style="font-size:0.83rem;color:var(--muted)">${datum(d.datum)}${d.zeitBeginn ? ' · '+d.zeitBeginn+' Uhr' : ''}${d.ort ? ' · '+d.ort : ''}</div>
  </div>`;
}
function renderNaechsteDienste(naechster, naechsterOegeln) {
  if (!naechster) return '<div class="card" style="font-size:0.85rem;text-align:center;color:var(--muted)">Keine bevorstehenden Dienste</div>';
  let html = dienstKarte(naechster, '📅 Nächster Dienst');
  // Oegeln extra anzeigen wenn der nächste Dienst nicht in Oegeln ist
  if (naechsterOegeln && naechsterOegeln.id !== naechster.id) {
    html += dienstKarte(naechsterOegeln, '📅 Nächster Dienst in Oegeln');
  }
  return html;
}

// ── Dashboard ─────────────────────────────────────────────
registerPage('dashboard', async (el) => {
  fw.setTitle('Dashboard');
  const [aSnap, diensteSnap] = await Promise.all([
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
    fw.getDocs('dienste', fw.orderBy('datum','asc')),
  ]);
  const meine    = aSnap.docs.map(d => ({id:d.id,...d.data()}));
  const heute    = new Date(); heute.setHours(0,0,0,0);
  const alleDienste = diensteSnap.docs.map(d => ({id:d.id,...d.data()}));
  const kuenftige   = alleDienste.filter(d => {
    const dt = d.datum?.toDate ? d.datum.toDate() : new Date(d.datum);
    return dt >= heute;
  });
  const naechster       = kuenftige[0] || null;
  const naechsterOegeln = kuenftige.find(d => d.ort?.toLowerCase().includes('oegeln')) || null;
  const stats    = getStats(meine);

  let offen = 0;
  if (fw.isWehrfuehrer()) {
    const offSnap = await fw.getDocs('anwesenheiten', fw.where('status','==','vorgeschlagen'));
    offen = offSnap.size;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.8rem">
      <div style="font-family:'DM Serif Display',serif;font-size:1.3rem">
        Hallo, ${fw.profil.vorname || fw.profil.email}
      </div>
      <span id="status-lampe" style="width:12px;height:12px;border-radius:50%;background:#ccc;display:inline-block;flex-shrink:0;cursor:default" title="Status wird geprüft..."></span>
    </div>

    <button class="alarm-btn" onclick="navigate('uebung-form',{typ:'einsatz',alarm:true})">
      🚨 Einsatz
    </button>

${renderNaechsteDienste(naechster, naechsterOegeln)}

    ${offen > 0 ? `
      <div class="pending-banner" onclick="navigate('einsaetze')">
        <div class="icon">⏳</div>
        <div class="text"><strong>${offen} ausstehende Anwesenheit${offen>1?'en':''}</strong>Zur Bestätigung tippen</div>
        <div>›</div>
      </div>` : ''}

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtEinsatz)}h</div><div class="stat-label">Einsatzstunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">Einsätze</div></div>
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtDienst)}h</div><div class="stat-label">Dienststunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.dienste}</div><div class="stat-label">Dienste</div></div>
      <div class="stat-card wide ${stats.ziel?'erreicht':'fehlt'}">
        <div class="stat-zahl">${dauerFormat(stats.stunden12m)} / 40:00h</div>
        <div class="stat-label">Letzte 12 Monate ${stats.ziel?'✅ Ziel erreicht':'⚠️ Noch nicht erreicht'}</div>
      </div>
    </div>


    <div style="text-align:center;color:var(--border);font-size:0.7rem;margin-top:1.5rem;margin-bottom:0.5rem">v1.5.1</div>
  `;
  checkDeepLink();
  startStatusPruefung();
});

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
  return `<div class="list-item" onclick="navigate('uebung-detail',{id:'${u.id}',typ:'${u.typ}'})">
    <div class="typ-dot typ-${u.typ}"></div>
    <div class="list-item-body">
      <div class="list-item-title">${u.titel}</div>
      <div class="list-item-sub">${datum(u.datum)}${zeitZeile(u) ? ' · '+zeitZeile(u) : ''}</div>
    </div>
    <div class="list-item-right">${anwesenheitBadge(meineMap.get(u.id))}</div>
    <div class="list-chevron">›</div>
  </div>`;
}

function renderEintragListe(liste, meineMap) {
  if (!liste.length) return '<div class="empty">Keine Einträge</div>';
  const diesJahr = new Date().getFullYear();
  const aktuell  = liste.filter(u => {
    const d = u.datum?.toDate ? u.datum.toDate() : new Date(u.datum);
    return d.getFullYear() >= diesJahr;
  });
  const archiv   = liste.filter(u => {
    const d = u.datum?.toDate ? u.datum.toDate() : new Date(u.datum);
    return d.getFullYear() < diesJahr;
  });

  // Nach Jahr gruppieren fürs Archiv
  const archivJahre = {};
  for (const u of archiv) {
    const d = u.datum?.toDate ? u.datum.toDate() : new Date(u.datum);
    const j = d.getFullYear();
    if (!archivJahre[j]) archivJahre[j] = [];
    archivJahre[j].push(u);
  }

  let html = aktuell.length
    ? aktuell.map(u => renderEintrag(u, meineMap)).join('')
    : '<div class="empty">Keine Einträge dieses Jahr</div>';

  if (archiv.length) {
    html += `<details style="margin-top:0.5rem">
      <summary style="padding:0.6rem 0;cursor:pointer;color:var(--muted);font-size:0.85rem;list-style:none;display:flex;align-items:center;gap:0.4rem">
        <span>▸</span> Archiv (${archiv.length} Einträge)
      </summary>
      ${Object.keys(archivJahre).sort((a,b)=>b-a).map(jahr => `
        <div style="font-size:0.78rem;color:var(--muted);padding:0.4rem 0 0.2rem;font-weight:600">${jahr}</div>
        ${archivJahre[jahr].map(u => renderEintrag(u, meineMap)).join('')}
      `).join('')}
    </details>`;
  }
  return html;
}

async function ladeVorschlaege(el) {
  if (!fw.isWehrfuehrer()) return;
  const vSnap = await fw.getDocs('anwesenheiten', fw.where('status','==','vorgeschlagen'));
  const vorschlaege = vSnap.docs.map(d => ({id:d.id,...d.data()}));
  if (!vorschlaege.length) return;
  const userIds = [...new Set(vorschlaege.map(v=>v.userId))];
  const users = {};
  await Promise.all(userIds.map(async uid => {
    const s = await fw.getDoc('users/'+uid);
    if (s.exists()) users[uid] = s.data();
  }));
  const vEl = document.getElementById('vorschlaege-liste');
  if (!vEl) return;
  vEl.innerHTML = vorschlaege.map(v => `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">${users[v.userId]?.vorname||''} ${users[v.userId]?.nachname||''}</div>
        <div class="list-item-sub">${v.uebungTitel||''} · ${datum(v.datum)}</div>
      </div>
      <div style="display:flex;gap:0.4rem">
        <button class="btn btn-sm btn-success" onclick="bestaetigen('${v.id}','${v.uebungId}','${v.userId}','${(users[v.userId]?.vorname||'')+' '+(users[v.userId]?.nachname||'')}')">✅</button>
        <button class="btn btn-sm btn-danger"  onclick="ablehnen('${v.id}')">❌</button>
      </div>
    </div>`).join('');
}

// Collection je nach Typ
function col(typ) { return typ === 'einsatz' ? 'einsaetze' : 'dienste'; }

// ── Einsätze ──────────────────────────────────────────────
registerPage('einsaetze', async (el) => {
  fw.setTitle('Einsätze');
  fw.showHeaderAction('+ Einsatz', () => navigate('uebung-form', {typ:'einsatz', alarm:false}));
  const [uSnap, aSnap, vSnap] = await Promise.all([
    fw.getDocs('einsaetze', fw.orderBy('datum','desc')),
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
    fw.isWehrfuehrer() ? fw.getDocs('anwesenheiten', fw.where('status','==','vorgeschlagen')) : Promise.resolve({size:0, docs:[]}),
  ]);
  const liste    = uSnap.docs.map(d => ({id:d.id,...d.data()}));
  const meineMap = new Map(aSnap.docs.map(d => [d.data().uebungId, d.data().status]));
  const offen    = vSnap.size;
  el.innerHTML = `
    ${offen > 0 ? `<div class="section-header">⏳ Ausstehende Bestätigungen (${offen})</div><div class="card" id="vorschlaege-liste"></div>` : ''}
    <div class="card">${renderEintragListe(liste, meineMap)}</div>
  `;
  ladeVorschlaege(el);
});

// ── Dienste ───────────────────────────────────────────────
registerPage('dienste', async (el) => {
  fw.setTitle('Dienste');
  if (fw.isWehrfuehrer()) fw.showHeaderAction('+ Dienst', () => navigate('uebung-form', {typ:'dienst'}));
  const [uSnap, aSnap, vSnap] = await Promise.all([
    fw.getDocs('dienste', fw.orderBy('datum','desc')),
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
    fw.isWehrfuehrer() ? fw.getDocs('anwesenheiten', fw.where('status','==','vorgeschlagen')) : Promise.resolve({size:0, docs:[]}),
  ]);
  const liste    = uSnap.docs.map(d => ({id:d.id,...d.data()}));
  const meineMap = new Map(aSnap.docs.map(d => [d.data().uebungId, d.data().status]));
  const offen    = vSnap.size;
  el.innerHTML = `
    ${offen > 0 ? `<div class="section-header">⏳ Ausstehende Bestätigungen (${offen})</div><div class="card" id="vorschlaege-liste"></div>` : ''}
    <div class="card">${renderEintragListe(liste, meineMap)}</div>
    ${fw.isWehrfuehrer() ? `
    <div style="margin-top:1rem">
      <button class="btn btn-secondary btn-full" onclick="kalenderImportieren()" id="kal-btn">📅 Aus Google Kalender importieren</button>
      <div id="kal-status" class="muted" style="font-size:0.8rem;text-align:center;margin-top:0.4rem"></div>
    </div>` : ''}
  `;
  ladeVorschlaege(el);
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

    // Duplikate vermeiden
    const snap = await fw.getDocs('dienste');
    const vorhandene = new Set(snap.docs.map(d =>
      d.data().titel + '_' + d.data().datum?.toDate?.().toISOString().slice(0,10)));

    let neu = 0, skip = 0;
    for (const e of events) {
      if (vorhandene.has(e.titel + '_' + e.datum)) { skip++; continue; }
      await fw.addDoc('dienste', {
        titel: e.titel, datum: new Date(e.datum),
        dauer_h: e.dauer_h, beschreibung: e.beschreibung || '',
        zeitBeginn: e.zeitBeginn || null, zeitEnde: e.zeitEnde || null,
        ort: e.ort || null,
        typ: 'dienst', erstelltVon: fw.user.uid, erstelltAm: new Date(),
      });
      neu++;
    }
    status.textContent = `${neu} Dienste importiert, ${skip} bereits vorhanden`;
    btn.textContent = '📅 Aus Google Kalender importieren';
    btn.disabled = false;
    if (neu > 0) setTimeout(() => navigate('dienste'), 1000);
  } catch(e) {
    status.textContent = 'Fehler: ' + e.message;
    btn.textContent = '📅 Aus Google Kalender importieren';
    btn.disabled = false;
  }
};

window.bestaetigen = async (aId, uId, userId, name) => {
  await fw.updateDoc('anwesenheiten/'+aId, { status:'bestaetigt', bestaetigtAm: new Date() });
  const uSnap = await fw.getDoc('users/'+userId);
  const u = uSnap.data();
  if (u?.notif_bestaetigung && u?.fcmToken) {
    await sendPush([u.fcmToken], '✅ Teilnahme bestätigt', 'Deine Anwesenheit wurde bestätigt.', false);
  }
  fw.toast('Bestätigt ✅'); navigate('dienste');
};
window.ablehnen = async (aId) => {
  await fw.updateDoc('anwesenheiten/'+aId, { status:'abgelehnt' });
  fw.toast('Abgelehnt'); navigate('dienste');
};

// ── Detail ────────────────────────────────────────────────
registerPage('uebung-detail', async (el, {id, typ}) => {
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

  let teilnehmerHTML = '';
  if (fw.isWehrfuehrer()) {
    const allA = await fw.getDocs('anwesenheiten', fw.where('uebungId','==',id));
    const best = allA.docs.map(d => ({id:d.id,...d.data()})).filter(a => a.status==='bestaetigt');
    teilnehmerHTML = `
      <div class="section-header">Teilnehmer (${best.length})</div>
      <div class="card">
        ${best.length===0 ? '<div class="empty">Noch keine bestätigten Teilnehmer</div>' :
          best.map(a => `
            <div class="list-item">
              <div class="list-item-body"><div class="list-item-title">${a.userName||'Kamerad'}</div></div>
              <button class="btn btn-sm btn-danger" onclick="teilnehmerEntfernen('${a.id}','${id}')">🗑</button>
            </div>`).join('')}
        <div class="btn-row">
          <button class="btn btn-secondary btn-sm" onclick="navigate('uebung-eintragen',{id:'${id}',titel:'${u.titel.replace(/'/g,"\\'")}',dauer:${u.dauer_h||0},typ:'${u.typ}',datumStr:'${u.datum?.toDate?.().toISOString()||u.datum}'})">+ Kamerad eintragen</button>
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div class="card">
      <span class="badge ${isEinsatz?'badge-red':'badge-blue'}">${isEinsatz?'⚡ Einsatz':'📅 Dienst'}</span>
      <div style="margin-top:0.6rem;font-weight:600;font-size:1.1rem">${u.titel}</div>
      <div style="margin-top:0.3rem;color:var(--muted);font-size:0.85rem">${datum(u.datum)}${zeitZeile(u) ? ' · '+zeitZeile(u) : ''}</div>
      ${u.beschreibung ? `<p class="muted" style="margin-top:0.4rem;font-size:0.85rem">${u.beschreibung}</p>` : ''}
      ${isEinsatz && !u.zeitEnde && fw.isWehrfuehrer() ? `
        <button class="btn btn-secondary btn-sm" style="margin-top:0.6rem" onclick="navigate('uebung-form',{id:'${u.id}'})">⏱ Endzeit nachtragen</button>
      ` : ''}
    </div>
    <div class="section-header">Meine Anwesenheit</div>
    <div class="card">
      ${meineA ? `
        <div style="margin-bottom:0.6rem">${anwesenheitBadge(meineA.status)}</div>
        ${meineA.status==='vorgeschlagen'?'<p class="muted" style="font-size:0.83rem">Wartet auf Bestätigung durch den Wehrführer.</p>':''}
        ${meineA.status==='bestaetigt'?'<p class="muted" style="font-size:0.83rem">Deine Teilnahme wurde bestätigt.</p>':''}
        ${meineA.status==='abgelehnt'?'<p class="muted" style="font-size:0.83rem">Deine Teilnahme wurde abgelehnt.</p>':''}
      ` : `
        <p class="muted" style="font-size:0.85rem;margin-bottom:0.8rem">Du hast dich noch nicht gemeldet.</p>
        <button class="btn btn-primary" onclick="teilnahmeMelden('${id}','${u.titel.replace(/'/g,"\\'")}',${u.dauer_h||0},'${u.typ}','${u.datum?.toDate?.().toISOString()||u.datum}')">
          Teilnahme melden
        </button>
      `}
    </div>
    ${teilnehmerHTML}
  `;
});

window.teilnahmeMelden = async (uebungId, titel, dauer_h, typ, datumStr) => {
  const name = (fw.profil.vorname+' '+fw.profil.nachname).trim() || fw.profil.email;
  await fw.addDoc('anwesenheiten', {
    uebungId, userId: fw.user.uid, userName: name,
    status: 'vorgeschlagen', uebungTitel: titel,
    dauer_h, typ, datum: new Date(datumStr), vorgeschlagenAm: new Date(),
  });
  fw.toast('Teilnahme gemeldet ⏳');
  navigate('uebung-detail', {id: uebungId, typ});
};
window.teilnehmerEntfernen = async (aId, uebungId) => {
  if (!confirm('Anwesenheit entfernen?')) return;
  await fw.deleteDoc('anwesenheiten/'+aId);
  fw.toast('Entfernt'); navigate('uebung-detail', {id: uebungId, typ});
};

// ── Kamerad direkt eintragen ──────────────────────────────
registerPage('uebung-eintragen', async (el, {id, titel, dauer, typ, datumStr}) => {
  fw.setTitle('Eintragen');
  fw.showBack(() => navigate('uebung-detail',{id}));
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
            <button class="btn btn-sm btn-success" onclick="direktEintragen('${id}','${u.id}','${(u.vorname+' '+u.nachname).trim()}',${dauer},'${typ}','${datumStr}')">Eintragen</button>
          </div>`).join('')}
    </div>`;
});

window.direktEintragen = async (uebungId, userId, name, dauer_h, typ, datumStr) => {
  await fw.addDoc('anwesenheiten', {
    uebungId, userId, userName: name, status:'bestaetigt',
    dauer_h, typ, datum: new Date(datumStr), bestaetigtAm: new Date(),
  });
  fw.toast(name+' eingetragen ✅');
  navigate('uebung-detail', {id: uebungId, typ});
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
        <button class="btn btn-danger btn-full" style="margin-top:0.5rem" onclick="uebungSpeichern('${id||''}','einsatz')">${u ? '💾 Speichern' : mitAlarm ? '🚨 Einsatz melden & Alarm senden' : '💾 Einsatz speichern'}</button>
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
          ${u ? `<button class="btn btn-danger" onclick="uebungLoeschen('${id}')">🗑 Löschen</button>` : ''}
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
  console.log('Push: mitAlarmFlag =', mitAlarmFlag, 'isNeu =', isNeu, 'typ =', typ);
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
  console.log('Push: ortswehrId =', ortswehrId);
  if (!ortswehrId) {
    fw.toast('⚠️ Keine Ortswehr zugeordnet – niemand wird benachrichtigt!', true);
    return;
  }
  const usersSnap = await fw.getDocs('users', fw.where('ortswehrId','==',ortswehrId));
  console.log('Push: Nutzer in Ortswehr:', usersSnap.docs.length);
  const isEinsatz = typ === 'einsatz';
  const tokens = [];
  for (const d of usersSnap.docs) {
    const u = d.data();
    console.log('Push: Nutzer', d.id, 'fcmToken:', !!u.fcmToken, 'notif_einsatz:', u.notif_einsatz, 'selbst:', d.id === fw.user.uid);
    if (d.id === fw.user.uid && !fw.profil.notif_selbst) { console.log('Push: Selbst übersprungen'); continue; }
    if (!u.fcmToken) { console.log('Push: Kein Token für', d.id); continue; }
    if (isEinsatz && u.notif_einsatz !== false) tokens.push(u.fcmToken);
    if (!isEinsatz && u.notif_uebung !== false) tokens.push(u.fcmToken);
  }
  console.log('Push: Tokens gefunden:', tokens.length);
  if (tokens.length === 0) { fw.toast('⚠️ Keine Push-Empfänger gefunden', true); return; }
  const title = isEinsatz ? '🚨 EINSATZ ALARM' : '🔔 Neuer Dienst';
  const body  = isEinsatz
    ? titel
    : `${titel} am ${new Date(datumStr).toLocaleDateString('de-DE')} (${dauerFormat(dauer_h)}h)`;
  await sendPush(tokens, title, body, isEinsatz, uebungId);
}

async function sendPush(tokens, title, body, alarm = false, uebungId = null) {
  try {
    console.log('Push wird gesendet an', tokens.length, 'Empfänger...');
    await fw.addDoc('push_queue', {
      tokens, title, body, alarm, uebungId,
      erstelltAm: new Date(), erstelltVon: fw.user.uid,
    });
    console.log('push_queue Dokument erstellt ✅');
    fw.toast(alarm ? 'Alarm gesendet 🚨' : 'Benachrichtigung gesendet ✅');
  } catch(e) {
    console.error('Push Fehler:', e);
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
  const me = fw.profil;
  const [aSnap, qSnap] = await Promise.all([
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
    fw.getDocs('users/'+fw.user.uid+'/qualifikationen'),
  ]);
  const stats  = getStats(aSnap.docs.map(d => d.data()));
  const qualis = qSnap.docs.map(d => ({id:d.id,...d.data()}));

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtEinsatz)}h</div><div class="stat-label">Einsatzstunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">Einsätze</div></div>
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtDienst)}h</div><div class="stat-label">Dienststunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.dienste}</div><div class="stat-label">Dienste</div></div>
      <div class="stat-card wide ${stats.ziel?'erreicht':'fehlt'}">
        <div class="stat-zahl">${dauerFormat(stats.stunden12m)} / 40:00h</div>
        <div class="stat-label">Letzte 12 Monate ${stats.ziel?'✅ Ziel erreicht':'⚠️ Noch nicht erreicht'}</div>
      </div>
    </div>

    <div class="section-header">Persönliche Daten</div>
    <div class="card">
      <div class="form-row"><label>Vorname</label><input id="p-vn" value="${me.vorname||''}"></div>
      <div class="form-row"><label>Nachname</label><input id="p-nn" value="${me.nachname||''}"></div>
      <div class="form-row"><label>Telefon</label><input id="p-tel" type="tel" value="${me.telefon||''}"></div>
      <div class="form-row"><label>E-Mail</label><input id="p-mail" type="email" value="${me.email||''}"></div>
      <div class="form-row"><label>Führerscheinklassen (z.B. B, C, CE)</label><input id="p-fs" value="${me.fuehrerschein||''}"></div>
      <div class="form-row"><label>Ortswehr</label>
        <select id="p-ow">${await (async () => {
          const s = await fw.getDocs('ortswehren');
          return '<option value="">– Keine –</option>' + s.docs.map(d => `<option value="${d.id}" ${me.ortswehrId===d.id?'selected':''}>${d.data().name}</option>`).join('');
        })()}</select>
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
      <button class="btn btn-secondary btn-full" style="margin-top:0.8rem" id="notif-save-btn" onclick="notifSpeichern()">Einstellungen speichern</button>
    </div>

    <div class="section-header">Dienstlich</div>
    <div class="card">
      <div style="display:flex;gap:1.2rem;flex-wrap:wrap">
        <div><div class="muted" style="font-size:0.72rem">Dienstgrad</div><div class="bold">${me.dienstgrad||'–'}</div></div>
        <div><div class="muted" style="font-size:0.72rem">Eingetreten</div><div class="bold">${datum(me.eintrittsdatum)||'–'}</div></div>
      </div>
      <hr>
      <div class="card-title" style="margin-bottom:0.5rem">Qualifikationen</div>
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
      <button class="btn btn-secondary btn-full" onclick="passwortAendern()">🔒 Passwort ändern</button>
    </div>
    <div class="card">
      <button class="btn btn-danger btn-full" onclick="abmelden()">Abmelden</button>
      <button class="btn btn-secondary btn-full" style="margin-top:0.5rem" onclick="pruefeAufUpdate(true)">🔄 Auf Updates prüfen</button>
    </div>
  `;
  setTimeout(initNotifCheckboxes, 0);
});

window.profilSpeichern = async () => {
  const data = {
    vorname: document.getElementById('p-vn').value,
    nachname: document.getElementById('p-nn').value,
    telefon: document.getElementById('p-tel').value,
    email: document.getElementById('p-mail').value,
    fuehrerschein: document.getElementById('p-fs').value,
    ortswehrId: document.getElementById('p-ow')?.value || fw.profil.ortswehrId || null,
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
    </div>`;
});

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
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtEinsatz)}h</div><div class="stat-label">Einsatzstunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">Einsätze</div></div>
      <div class="stat-card"><div class="stat-zahl">${dauerFormat(stats.gesamtDienst)}h</div><div class="stat-label">Dienststunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.dienste}</div><div class="stat-label">Dienste</div></div>
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
           ['E-Mail',u.email],['Führerschein',u.fuehrerschein],
        ].map(([l,v]) => `<div><div class="muted" style="font-size:0.72rem">${l}</div><div style="font-size:0.88rem">${v||'–'}</div></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Qualifikationen</div>
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
        <input id="q-bez" placeholder="Bezeichnung" style="flex:2;min-width:120px">
        <input id="q-dat" type="date" style="flex:1;min-width:110px">
        <input id="q-bem" placeholder="Bemerkung" style="flex:2;min-width:100px">
        <button class="btn btn-primary btn-sm" onclick="qualiHinzufuegen('${id}')">+</button>
      </div>
    </div>
    <div class="card">
      <button class="btn btn-danger btn-full" onclick="kameradLoeschen('${id}')">🗑 Kamerad löschen</button>
    </div>`;
});

window.kameradLoeschen = async (id) => {
  if (!confirm('Kamerad wirklich löschen? Alle Anwesenheiten bleiben erhalten.')) return;
  await fw.setDoc('users/'+id, { aktiv: false });
  fw.toast('Kamerad deaktiviert'); navigate('kameraden');
};

window.qualiHinzufuegen = async (userId) => {
  const bez = document.getElementById('q-bez').value.trim();
  if (!bez) return;
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
        <div class="form-row"><label>E-Mail (wird Login)</label><input id="k-email" type="email" placeholder="name@beispiel.de"></div>
        <div class="form-row"><label>Initiales Passwort (mind. 6 Zeichen)</label><input id="k-pw" type="password"></div>
      ` : ''}
      <div class="form-row"><label>Vorname</label><input id="k-vn" value="${u?.vorname||''}"></div>
      <div class="form-row"><label>Nachname</label><input id="k-nn" value="${u?.nachname||''}"></div>
      <div class="form-row"><label>Dienstgrad</label><input id="k-dg" value="${u?.dienstgrad||''}"></div>
      <div class="form-row"><label>Eintrittsdatum</label><input id="k-ed" type="date" value="${datumVal}"></div>
      <div class="form-row"><label>Ortswehr</label>
        <select id="k-ow">
          <option value="">– Keine Zuordnung –</option>
          ${owOptions}
        </select>
      </div>
      <div class="form-row"><label>Rolle</label>
        <select id="k-rolle">
          <option value="kamerad" ${u?.rolle==='kamerad'?'selected':''}>Kamerad</option>
          <option value="wehrfuehrer" ${u?.rolle==='wehrfuehrer'?'selected':''}>Wehrführer</option>
        </select>
      </div>
      <div class="form-row"><label>Telefon</label><input id="k-tel" type="tel" value="${u?.telefon||''}"></div>
      <div class="form-row"><label>E-Mail</label><input id="k-mail" type="email" value="${u?.email||''}"></div>
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
    telefon: document.getElementById('k-tel').value,
    email: document.getElementById('k-mail').value,
    fuehrerschein: document.getElementById('k-fs').value,
  };
  try {
    if (id) {
      await fw.setDoc('users/'+id, data);
      fw.toast('Gespeichert ✅'); navigate('kamerad-detail',{id});
    } else {
      const email = document.getElementById('k-email').value.trim();
      const pw    = document.getElementById('k-pw').value;
      if (!email||!pw) { fw.toast('E-Mail und Passwort erforderlich', true); return; }
      if (pw.length < 6) { fw.toast('Passwort mind. 6 Zeichen', true); return; }
      await window.createKamerad(email, pw, data);
      fw.toast('Kamerad angelegt ✅'); navigate('kameraden');
    }
  } catch(e) {
    fw.toast(e.message.includes('email-already') ? 'E-Mail bereits vergeben' : e.message, true);
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
