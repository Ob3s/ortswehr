// js/pages.js – alle Seiten
function waitFw(cb) { if (window.fw) cb(); else setTimeout(() => waitFw(cb), 50); }

waitFw(() => {

// ── Helpers ───────────────────────────────────────────────
function datum(d) {
  if (!d) return '–';
  const ts = d?.toDate ? d.toDate() : new Date(d);
  if (isNaN(ts)) return '–';
  return ts.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
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
  let gesamt=0, einsaetze=0, stunden12m=0;
  for (const a of anwesenheiten) {
    if (a.status !== 'bestaetigt') continue;
    gesamt += a.dauer_h || 0;
    if (a.typ === 'einsatz') einsaetze++;
    const d = a.datum?.toDate ? a.datum.toDate() : new Date(a.datum);
    if (d >= vor12m) stunden12m += a.dauer_h || 0;
  }
  return {
    gesamt: Math.round(gesamt*10)/10,
    einsaetze,
    stunden12m: Math.round(stunden12m*10)/10,
    ziel: stunden12m >= 40,
  };
}

// ── Dashboard ─────────────────────────────────────────────
registerPage('dashboard', async (el) => {
  fw.setTitle('Dashboard');
  const [aSnap, uSnap] = await Promise.all([
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
    fw.getDocs('uebungen', fw.orderBy('datum','desc')),
  ]);
  const meine   = aSnap.docs.map(d => ({id:d.id,...d.data()}));
  const stats   = getStats(meine);
  const uebungen = uSnap.docs.map(d => ({id:d.id,...d.data()})).slice(0,6);
  const meineMap = new Map(meine.map(a => [a.uebungId, a.status]));

  let offen = 0;
  if (fw.isWehrfuehrer()) {
    const offSnap = await fw.getDocs('anwesenheiten', fw.where('status','==','vorgeschlagen'));
    offen = offSnap.size;
  }

  el.innerHTML = `
    <div style="margin-bottom:0.8rem">
      <div style="font-family:'DM Serif Display',serif;font-size:1.3rem">
        Hallo, ${fw.profil.vorname || fw.profil.email} 👋
      </div>
      <div class="muted" style="font-size:0.82rem">${fw.profil.dienstgrad||''} · ${fw.isWehrfuehrer()?'Wehrführer':'Kamerad'}</div>
    </div>

    <button class="alarm-btn" onclick="navigate('uebung-form',{typ:'einsatz'})">
      🚨 EINSATZ MELDEN
    </button>

    ${offen > 0 ? `
      <div class="pending-banner" onclick="navigate('uebungen')">
        <div class="icon">⏳</div>
        <div class="text"><strong>${offen} ausstehende Anwesenheit${offen>1?'en':''}</strong>Zur Bestätigung tippen</div>
        <div>›</div>
      </div>` : ''}

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-zahl">${stats.gesamt}</div><div class="stat-label">Gesamtstunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">Einsätze</div></div>
      <div class="stat-card wide ${stats.ziel?'erreicht':'fehlt'}">
        <div class="stat-zahl">${stats.stunden12m} / 40h</div>
        <div class="stat-label">Letzte 12 Monate ${stats.ziel?'✅ Ziel erreicht':'⚠️ Noch nicht erreicht'}</div>
      </div>
    </div>

    <div class="section-header">Aktuelle Übungen & Einsätze</div>
    <div class="card">
      ${uebungen.length===0 ? '<div class="empty">Keine Einträge</div>' :
        uebungen.map(u => `
          <div class="list-item" onclick="navigate('uebung-detail',{id:'${u.id}'})">
            <div class="typ-dot typ-${u.typ}"></div>
            <div class="list-item-body">
              <div class="list-item-title">${u.titel}</div>
              <div class="list-item-sub">${datum(u.datum)} · ${u.dauer_h}h</div>
            </div>
            <div class="list-item-right">${anwesenheitBadge(meineMap.get(u.id))}</div>
            <div class="list-chevron">›</div>
          </div>`).join('')}
    </div>
  `;
});

// ── Übungen ───────────────────────────────────────────────
registerPage('uebungen', async (el) => {
  fw.setTitle('Übungen & Einsätze');
  if (fw.isWehrfuehrer()) fw.showHeaderAction('+ Neu', () => navigate('uebung-form', {}));

  const [uSnap, aSnap] = await Promise.all([
    fw.getDocs('uebungen', fw.orderBy('datum','desc')),
    fw.getDocs('anwesenheiten', fw.where('userId','==',fw.user.uid)),
  ]);
  const uebungen = uSnap.docs.map(d => ({id:d.id,...d.data()}));
  const meineMap = new Map(aSnap.docs.map(d => [d.data().uebungId, d.data().status]));

  let vorschlaege = [];
  if (fw.isWehrfuehrer()) {
    const vSnap = await fw.getDocs('anwesenheiten', fw.where('status','==','vorgeschlagen'));
    vorschlaege = vSnap.docs.map(d => ({id:d.id,...d.data()}));
  }

  el.innerHTML = `
    ${vorschlaege.length > 0 ? `
      <div class="section-header">⏳ Ausstehende Bestätigungen (${vorschlaege.length})</div>
      <div class="card" id="vorschlaege-liste"></div>
    ` : ''}
    <div class="section-header">Alle Übungen & Einsätze</div>
    <div class="card">
      ${uebungen.length===0 ? '<div class="empty">Noch keine Einträge</div>' :
        uebungen.map(u => `
          <div class="list-item" onclick="navigate('uebung-detail',{id:'${u.id}'})">
            <div class="typ-dot typ-${u.typ}"></div>
            <div class="list-item-body">
              <div class="list-item-title">${u.titel}</div>
              <div class="list-item-sub">${datum(u.datum)} · ${u.dauer_h}h ·
                <span class="badge ${u.typ==='einsatz'?'badge-red':'badge-blue'}">${u.typ==='einsatz'?'Einsatz':'Übung'}</span>
              </div>
            </div>
            <div class="list-item-right">${anwesenheitBadge(meineMap.get(u.id))}</div>
            <div class="list-chevron">›</div>
          </div>`).join('')}
    </div>
  `;

  if (vorschlaege.length > 0) {
    const vEl = document.getElementById('vorschlaege-liste');
    const userIds = [...new Set(vorschlaege.map(v=>v.userId))];
    const users = {};
    await Promise.all(userIds.map(async uid => {
      const s = await fw.getDoc('users/'+uid);
      if (s.exists()) users[uid] = s.data();
    }));
    vEl.innerHTML = vorschlaege.map(v => `
      <div class="list-item">
        <div class="list-item-body">
          <div class="list-item-title">${users[v.userId]?.vorname||''} ${users[v.userId]?.nachname||''}</div>
          <div class="list-item-sub">${v.uebungTitel||''} · ${datum(v.datum)}</div>
        </div>
        <div style="display:flex;gap:0.4rem">
          <button class="btn btn-sm btn-success" onclick="bestaetigen('${v.id}','${v.uebungId}','${v.userId}','${users[v.userId]?.vorname||''} ${users[v.userId]?.nachname||''}')">✅</button>
          <button class="btn btn-sm btn-danger"  onclick="ablehnen('${v.id}')">❌</button>
        </div>
      </div>`).join('');
  }
});

window.bestaetigen = async (aId, uId, userId, name) => {
  await fw.updateDoc('anwesenheiten/'+aId, { status:'bestaetigt', bestaetigtAm: new Date() });
  // Push an Kamerad wenn gewünscht
  const uSnap = await fw.getDoc('users/'+userId);
  const u = uSnap.data();
  if (u?.notif_bestaetigung && u?.fcmToken) {
    await sendPush([u.fcmToken], '✅ Teilnahme bestätigt', 'Deine Anwesenheit wurde bestätigt.', false);
  }
  fw.toast('Bestätigt ✅'); navigate('uebungen');
};
window.ablehnen = async (aId) => {
  await fw.updateDoc('anwesenheiten/'+aId, { status:'abgelehnt' });
  fw.toast('Abgelehnt'); navigate('uebungen');
};

// ── Übung Detail ──────────────────────────────────────────
registerPage('uebung-detail', async (el, {id}) => {
  const snap = await fw.getDoc('uebungen/'+id);
  if (!snap.exists()) { el.innerHTML='<div class="empty">Nicht gefunden</div>'; return; }
  const u = {id,...snap.data()};
  fw.setTitle(u.titel);
  fw.showBack(() => navigate('uebungen'));
  if (fw.isWehrfuehrer()) fw.showHeaderAction('✏️ Edit', () => navigate('uebung-form',{id}));

  const aSnap = await fw.getDocs('anwesenheiten',
    fw.where('uebungId','==',id), fw.where('userId','==',fw.user.uid));
  const meineA = aSnap.docs[0] ? {id:aSnap.docs[0].id,...aSnap.docs[0].data()} : null;

  let teilnehmerHTML = '';
  if (fw.isWehrfuehrer()) {
    const allA = await fw.getDocs('anwesenheiten', fw.where('uebungId','==',id));
    const alle = allA.docs.map(d => ({id:d.id,...d.data()}));
    const best = alle.filter(a => a.status==='bestaetigt');
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
          <button class="btn btn-secondary btn-sm" onclick="navigate('uebung-eintragen',{id:'${id}',titel:'${u.titel.replace(/'/g,"\\'")}',dauer:${u.dauer_h},typ:'${u.typ}',datumStr:'${u.datum?.toDate?.().toISOString()||u.datum}'})">+ Kamerad eintragen</button>
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div class="card">
      <span class="badge ${u.typ==='einsatz'?'badge-red':'badge-blue'}">${u.typ==='einsatz'?'⚡ Einsatz':'🔥 Übung'}</span>
      <div style="margin-top:0.6rem;font-weight:600">${datum(u.datum)} · ${u.dauer_h} Stunden</div>
      ${u.beschreibung ? `<p class="muted" style="margin-top:0.4rem;font-size:0.85rem">${u.beschreibung}</p>` : ''}
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
        <button class="btn btn-primary" onclick="teilnahmeMelden('${id}','${u.titel.replace(/'/g,"\\'")}',${u.dauer_h},'${u.typ}','${u.datum?.toDate?.().toISOString()||u.datum}')">
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
  navigate('uebung-detail', {id: uebungId});
};
window.teilnehmerEntfernen = async (aId, uebungId) => {
  if (!confirm('Anwesenheit entfernen?')) return;
  await fw.deleteDoc('anwesenheiten/'+aId);
  fw.toast('Entfernt'); navigate('uebung-detail', {id: uebungId});
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
  navigate('uebung-detail', {id: uebungId});
};

// ── Übung/Einsatz Form ────────────────────────────────────
registerPage('uebung-form', async (el, {id, typ: vorTyp}) => {
  let u = null;
  if (id) { const s = await fw.getDoc('uebungen/'+id); if (s.exists()) u={id,...s.data()}; }
  fw.setTitle(u ? 'Bearbeiten' : (vorTyp==='einsatz' ? 'Neuer Einsatz' : 'Neue Übung'));
  fw.showBack(() => navigate('uebungen'));

  const datumVal = u?.datum?.toDate ? u.datum.toDate().toISOString().slice(0,10)
    : (u?.datum ? new Date(u.datum).toISOString().slice(0,10) : new Date().toISOString().slice(0,10));
  const selTyp = u?.typ || vorTyp || 'uebung';

  el.innerHTML = `
    <div class="card">
      <div class="form-row"><label>Titel</label>
        <input id="f-titel" value="${u?.titel||''}" placeholder="${selTyp==='einsatz'?'Brandeinsatz...':'Monatsübung April...'}">
      </div>
      <div class="form-row"><label>Datum</label><input id="f-datum" type="date" value="${datumVal}"></div>
      <div class="form-row"><label>Typ</label>
        <select id="f-typ">
          <option value="uebung"  ${selTyp==='uebung' ?'selected':''}>🔥 Übung</option>
          <option value="einsatz" ${selTyp==='einsatz'?'selected':''}>⚡ Einsatz</option>
        </select>
      </div>
      <div class="form-row"><label>Dauer (Stunden)</label>
        <input id="f-dauer" type="number" step="0.5" min="0.5" value="${u?.dauer_h||2}">
      </div>
      <div class="form-row"><label>Beschreibung (optional)</label>
        <textarea id="f-beschr">${u?.beschreibung||''}</textarea>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="uebungSpeichern('${id||''}')">💾 Speichern & Benachrichtigen</button>
        ${u ? `<button class="btn btn-danger" onclick="uebungLoeschen('${id}')">🗑 Löschen</button>` : ''}
      </div>
    </div>`;
});

window.uebungSpeichern = async (id) => {
  const titel    = document.getElementById('f-titel').value.trim();
  const datumStr = document.getElementById('f-datum').value;
  const typ      = document.getElementById('f-typ').value;
  const dauer_h  = parseFloat(document.getElementById('f-dauer').value);
  const beschr   = document.getElementById('f-beschr').value.trim();
  if (!titel || !datumStr) { fw.toast('Titel und Datum erforderlich', true); return; }
  // Übungen nur Wehrführer, Einsätze alle
  if (typ === 'uebung' && !fw.isWehrfuehrer()) { fw.toast('Nur Wehrführer können Übungen anlegen', true); return; }

  const data = { titel, datum: new Date(datumStr), typ, dauer_h, beschreibung: beschr };
  const isNeu = !id;
  try {
    let uebungId = id;
    if (id) {
      await fw.updateDoc('uebungen/'+id, data);
    } else {
      const ref = await fw.addDoc('uebungen', {...data, erstelltVon: fw.user.uid, erstelltAm: new Date()});
      uebungId = ref.id;
    }

    // Push-Benachrichtigungen senden
    if (isNeu) {
      await benachrichtigeOrtswehr(typ, titel, datumStr, dauer_h, uebungId);
    }

    fw.toast('Gespeichert ✅');
    navigate('uebungen');
  } catch(e) { fw.toast(e.message, true); }
};

window.uebungLoeschen = async (id) => {
  if (!confirm('Wirklich löschen?')) return;
  await fw.deleteDoc('uebungen/'+id);
  fw.toast('Gelöscht'); navigate('uebungen');
};

// ── Push-Benachrichtigungen senden ────────────────────────
async function benachrichtigeOrtswehr(typ, titel, datumStr, dauer_h, uebungId) {
  // Alle Kameraden derselben Ortswehr laden
  const ortswehrId = fw.profil.ortswehrId;
  let usersSnap;
  if (ortswehrId) {
    usersSnap = await fw.getDocs('users', fw.where('ortswehrId','==',ortswehrId), fw.where('aktiv','!=',false));
  } else {
    usersSnap = await fw.getDocs('users');
  }

  const isEinsatz = typ === 'einsatz';
  const tokens = [];
  for (const d of usersSnap.docs) {
    const u = d.data();
    if (d.id === fw.user.uid && !fw.profil.notif_selbst) continue;
    if (!u.fcmToken) continue;
    if (isEinsatz && u.notif_einsatz !== false) tokens.push(u.fcmToken);
    if (!isEinsatz && u.notif_uebung !== false) tokens.push(u.fcmToken);
  }

  if (tokens.length === 0) return;

  const title = isEinsatz ? '🚨 EINSATZ ALARM' : '🔔 Neue Übung';
  const body  = isEinsatz
    ? `${titel} – Sofort zum Gerätehaus!`
    : `${titel} am ${new Date(datumStr).toLocaleDateString('de-DE')} (${dauer_h}h)`;

  await sendPush(tokens, title, body, isEinsatz);
}

async function sendPush(tokens, title, body, alarm = false) {
  try {
    console.log('Push wird gesendet an', tokens.length, 'Empfänger...');
    await fw.addDoc('push_queue', {
      tokens, title, body,
      alarm: alarm,
      erstelltAm: new Date(),
      erstelltVon: fw.user.uid,
    });
    console.log('push_queue Dokument erstellt ✅');
    fw.toast('Alarm gesendet 🚨');
  } catch(e) {
    console.error('Push Fehler:', e);
    fw.toast('Push Fehler: ' + e.message, true);
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
      <div class="stat-card"><div class="stat-zahl">${stats.gesamt}</div><div class="stat-label">Gesamtstunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">Einsätze</div></div>
      <div class="stat-card wide ${stats.ziel?'erreicht':'fehlt'}">
        <div class="stat-zahl">${stats.stunden12m} / 40h</div>
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
      <button class="btn btn-primary btn-full" onclick="profilSpeichern()">💾 Speichern</button>
    </div>

    <div class="section-header">🔔 Benachrichtigungen</div>
    <div class="card">
      <div class="notif-row" style="display:flex;align-items:center;gap:0.8rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-weight:600">🚨 Einsatzalarm</div><div class="muted" style="font-size:0.78rem">Bei neuen Einsätzen</div></div>
        <input type="checkbox" id="n-einsatz" style="width:24px;height:24px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      </div>
      <div class="notif-row" style="display:flex;align-items:center;gap:0.8rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-weight:600">📅 Neue Übung</div><div class="muted" style="font-size:0.78rem">Bei neuen Übungen</div></div>
        <input type="checkbox" id="n-uebung" style="width:24px;height:24px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      </div>
      <div class="notif-row" style="display:flex;align-items:center;gap:0.8rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-weight:600">✅ Bestätigung</div><div class="muted" style="font-size:0.78rem">Wenn Teilnahme bestätigt wird</div></div>
        <input type="checkbox" id="n-best" style="width:24px;height:24px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
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
    </div>
  `;
  // Checkbox-Status direkt nach dem Rendern setzen
  initNotifCheckboxes();
});

window.profilSpeichern = async () => {
  const data = {
    vorname: document.getElementById('p-vn').value,
    nachname: document.getElementById('p-nn').value,
    telefon: document.getElementById('p-tel').value,
    email: document.getElementById('p-mail').value,
    fuehrerschein: document.getElementById('p-fs').value,
  };
  await fw.setDoc('users/'+fw.user.uid, data);
  Object.assign(fw.profil, data);
  fw.toast('Gespeichert ✅');
};

// Listener für Notif-Button (onclick funktioniert nicht in ES-Modulen)
document.addEventListener('click', e => {
  if (e.target.id === 'notif-save-btn') notifSpeichern();
});

// Checkbox-Status nach dem Rendern setzen
function initNotifCheckboxes() {
  const p = fw.profil;
  const e = document.getElementById('n-einsatz');
  const u = document.getElementById('n-uebung');
  const b = document.getElementById('n-best');
  if (e) e.checked = p.notif_einsatz !== false;
  if (u) u.checked = p.notif_uebung !== false;
  if (b) b.checked = p.notif_bestaetigung !== false;
  const s = document.getElementById('n-selbst');
  if (s) s.checked = p.notif_selbst === true;
}
window.notifSpeichern = async () => {
  const selbstEl = document.getElementById('n-selbst');
  const data = {
    notif_einsatz:      document.getElementById('n-einsatz').checked,
    notif_uebung:       document.getElementById('n-uebung').checked,
    notif_bestaetigung: document.getElementById('n-best').checked,
    notif_selbst:       selbstEl ? selbstEl.checked : false,
  };
  await fw.setDoc('users/'+fw.user.uid, data);
  Object.assign(fw.profil, data);
  // Push-Token erneuern/entfernen
  if (data.notif_einsatz || data.notif_uebung || data.notif_bestaetigung) {
    await fw.registerPush();
  } else {
    await fw.setDoc('users/'+fw.user.uid, { fcmToken: null });
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
      <div class="stat-card"><div class="stat-zahl">${stats.gesamt}</div><div class="stat-label">Gesamtstunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">Einsätze</div></div>
      <div class="stat-card wide ${stats.ziel?'erreicht':'fehlt'}">
        <div class="stat-zahl">${stats.stunden12m} / 40h</div>
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
    </div>`;
});

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

  // Ortswehren laden
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

// ── Ortswehren verwalten ──────────────────────────────────
registerPage('ortswehren', async (el) => {
  fw.setTitle('Ortswehren');
  fw.showHeaderAction('+ Neu', () => navigate('ortswehr-form', {}));
  const snap = await fw.getDocs('ortswehren');
  const wehren = snap.docs.map(d => ({id:d.id,...d.data()}));
  el.innerHTML = `
    <div class="card">
      ${wehren.length===0 ? '<div class="empty">Noch keine Ortswehren angelegt</div>' :
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
  if (!confirm('Ortswehr löschen? Kameraden bleiben erhalten.')) return;
  await fw.deleteDoc('ortswehren/'+id);
  fw.toast('Gelöscht'); navigate('ortswehren');
};

}); // end waitFw
