// js/pages.js
// Warte bis fw verfügbar ist
function waitFw(cb) {
  if (window.fw) cb();
  else setTimeout(() => waitFw(cb), 50);
}

waitFw(() => {

// ── Hilfsfunktionen ───────────────────────────────────────
function datum(d) {
  if (!d) return '–';
  const ts = d?.toDate ? d.toDate() : new Date(d);
  return ts.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function anwesenheitBadge(status) {
  if (!status)                  return '<span class="badge badge-gray">–</span>';
  if (status === 'bestaetigt')  return '<span class="badge badge-green">✅ Bestätigt</span>';
  if (status === 'vorgeschlagen') return '<span class="badge badge-orange">⏳ Ausstehend</span>';
  if (status === 'abgelehnt')   return '<span class="badge badge-red">❌ Abgelehnt</span>';
  return '';
}

function getStats(anwesenheiten) {
  const jetzt = new Date();
  const vor12m = new Date(jetzt); vor12m.setFullYear(vor12m.getFullYear() - 1);
  let gesamt = 0, einsaetze = 0, stunden12m = 0;
  for (const a of anwesenheiten) {
    if (a.status !== 'bestaetigt') continue;
    gesamt += a.dauer_h || 0;
    if (a.typ === 'einsatz') einsaetze++;
    const d = a.datum?.toDate ? a.datum.toDate() : new Date(a.datum);
    if (d >= vor12m) stunden12m += a.dauer_h || 0;
  }
  return {
    gesamt: Math.round(gesamt * 10) / 10,
    einsaetze,
    stunden12m: Math.round(stunden12m * 10) / 10,
    ziel: stunden12m >= 40,
  };
}

// ── Dashboard ─────────────────────────────────────────────
registerPage('dashboard', async (el) => {
  fw.setTitle('Dashboard');

  // Eigene Anwesenheiten laden für Statistik
  const snap = await fw.getDocs('anwesenheiten',
    fw.where('userId', '==', fw.user.uid));
  const meine = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const stats = getStats(meine);

  // Aktuelle Übungen
  const uSnap = await fw.getDocs('uebungen', fw.orderBy('datum', 'desc'));
  const uebungen = uSnap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 6);

  // Offene Vorschläge (Wehrführer)
  let offen = 0;
  if (fw.isWehrfuehrer()) {
    const offSnap = await fw.getDocs('anwesenheiten', fw.where('status', '==', 'vorgeschlagen'));
    offen = offSnap.size;
  }

  el.innerHTML = `
    <div style="margin-bottom:0.5rem">
      <div style="font-family:'DM Serif Display',serif;font-size:1.3rem">
        Hallo, ${fw.profil.vorname || fw.profil.email} 👋
      </div>
      <div class="muted" style="font-size:0.82rem">${fw.profil.dienstgrad || ''} · ${fw.isWehrfuehrer() ? 'Wehrführer' : 'Kamerad'}</div>
    </div>

    ${offen > 0 ? `
      <div class="pending-banner" onclick="navigate('uebungen')">
        <div class="icon">⏳</div>
        <div class="text"><strong>${offen} ausstehende Anwesenheit${offen>1?'en':''}</strong>Zur Bestätigung tippen</div>
        <div>›</div>
      </div>` : ''}

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-zahl">${stats.gesamt}</div><div class="stat-label">Gesamtstunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">Einsätze</div></div>
      <div class="stat-card wide ${stats.ziel ? 'erreicht' : 'fehlt'}">
        <div class="stat-zahl">${stats.stunden12m} / 40h</div>
        <div class="stat-label">Letzte 12 Monate ${stats.ziel ? '✅ Ziel erreicht' : '⚠️ Ziel nicht erreicht'}</div>
      </div>
    </div>

    <div class="section-header">Aktuelle Übungen & Einsätze</div>
    <div class="card">
      ${uebungen.length === 0 ? '<div class="empty">Keine Übungen vorhanden</div>' :
        uebungen.map(u => {
          const mineA = meine.find(a => a.uebungId === u.id);
          return `
          <div class="list-item" onclick="navigate('uebung-detail', {id:'${u.id}'})">
            <div class="typ-dot typ-${u.typ}"></div>
            <div class="list-item-body">
              <div class="list-item-title">${u.titel}</div>
              <div class="list-item-sub">${datum(u.datum)} · ${u.dauer_h}h</div>
            </div>
            <div class="list-item-right">${anwesenheitBadge(mineA?.status)}</div>
            <div class="list-chevron">›</div>
          </div>`;
        }).join('')}
    </div>
  `;
});

// ── Übungen ───────────────────────────────────────────────
registerPage('uebungen', async (el) => {
  fw.setTitle('Übungen & Einsätze');

  const [uSnap, aSnap] = await Promise.all([
    fw.getDocs('uebungen', fw.orderBy('datum', 'desc')),
    fw.getDocs('anwesenheiten', fw.where('userId', '==', fw.user.uid))
  ]);
  const uebungen = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const meine = new Map(aSnap.docs.map(d => [d.data().uebungId, d.data().status]));

  // Offene Vorschläge für Wehrführer
  let vorschlaege = [];
  if (fw.isWehrfuehrer()) {
    const vSnap = await fw.getDocs('anwesenheiten', fw.where('status', '==', 'vorgeschlagen'));
    vorschlaege = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  el.innerHTML = `
    ${vorschlaege.length > 0 ? `
      <div class="section-header">⏳ Ausstehende Bestätigungen (${vorschlaege.length})</div>
      <div class="card" id="vorschlaege-liste"></div>
    ` : ''}
    <div class="section-header">Alle Übungen</div>
    <div class="card">
      ${uebungen.length === 0 ? '<div class="empty">Noch keine Übungen angelegt</div>' :
        uebungen.map(u => `
          <div class="list-item" onclick="navigate('uebung-detail', {id:'${u.id}'})">
            <div class="typ-dot typ-${u.typ}"></div>
            <div class="list-item-body">
              <div class="list-item-title">${u.titel}</div>
              <div class="list-item-sub">${datum(u.datum)} · ${u.dauer_h}h · <span class="badge ${u.typ==='einsatz'?'badge-red':'badge-blue'}">${u.typ==='einsatz'?'Einsatz':'Übung'}</span></div>
            </div>
            <div class="list-item-right">${anwesenheitBadge(meine.get(u.id))}</div>
            <div class="list-chevron">›</div>
          </div>`).join('')}
    </div>
  `;

  // Vorschläge rendern
  if (vorschlaege.length > 0) {
    const vEl = document.getElementById('vorschlaege-liste');
    // Namen der Kameraden nachladen
    const userIds = [...new Set(vorschlaege.map(v => v.userId))];
    const users = {};
    await Promise.all(userIds.map(async uid => {
      const s = await fw.getDoc(`users/${uid}`);
      if (s.exists()) users[uid] = s.data();
    }));
    vEl.innerHTML = vorschlaege.map(v => `
      <div class="list-item">
        <div class="list-item-body">
          <div class="list-item-title">${users[v.userId]?.vorname||''} ${users[v.userId]?.nachname||''}</div>
          <div class="list-item-sub">${v.uebungTitel || ''} · ${datum(v.datum)}</div>
        </div>
        <div class="btn-row" style="margin:0;gap:0.4rem">
          <button class="btn btn-sm btn-success" onclick="bestaetigen('${v.id}','${v.uebungId}','${v.userId}')">✅</button>
          <button class="btn btn-sm btn-danger"  onclick="ablehnen('${v.id}','${v.uebungId}','${v.userId}')">❌</button>
        </div>
      </div>`).join('');
  }

  // FAB für Wehrführer
  if (fw.isWehrfuehrer()) {
    const fab = document.createElement('button');
    fab.className = 'fab'; fab.textContent = '+';
    fab.onclick = () => navigate('uebung-form', {});
    document.getElementById('app').appendChild(fab);
    el.addEventListener('click', () => fab.remove(), { once: true, capture: true });
  }
});

window.bestaetigen = async (aId, uId, userId) => {
  await fw.updateDoc(`anwesenheiten/${aId}`, { status: 'bestaetigt', bestaetigtAm: new Date() });
  fw.toast('Bestätigt ✅');
  navigate('uebungen');
};
window.ablehnen = async (aId, uId, userId) => {
  await fw.updateDoc(`anwesenheiten/${aId}`, { status: 'abgelehnt' });
  fw.toast('Abgelehnt');
  navigate('uebungen');
};

// ── Übung Detail ──────────────────────────────────────────
registerPage('uebung-detail', async (el, { id }) => {
  const snap = await fw.getDoc(`uebungen/${id}`);
  if (!snap.exists()) { el.innerHTML = '<div class="empty">Nicht gefunden</div>'; return; }
  const u = { id, ...snap.data() };
  fw.setTitle(u.titel);
  fw.showBack(() => navigate('uebungen'));
  if (fw.isWehrfuehrer()) fw.showHeaderAction('✏️ Edit', () => navigate('uebung-form', { id }));

  // Eigene Anwesenheit
  const aSnap = await fw.getDocs('anwesenheiten',
    fw.where('uebungId', '==', id), fw.where('userId', '==', fw.user.uid));
  const meineA = aSnap.docs[0] ? { id: aSnap.docs[0].id, ...aSnap.docs[0].data() } : null;

  // Alle Anwesenheiten (Wehrführer)
  let teilnehmerHTML = '';
  if (fw.isWehrfuehrer()) {
    const allA = await fw.getDocs('anwesenheiten', fw.where('uebungId', '==', id));
    const alle = allA.docs.map(d => ({ id: d.id, ...d.data() }));
    const best = alle.filter(a => a.status === 'bestaetigt');
    teilnehmerHTML = `
      <div class="section-header">Teilnehmer (${best.length})</div>
      <div class="card">
        ${best.length === 0 ? '<div class="empty">Noch keine bestätigten Teilnehmer</div>' :
          best.map(a => `
            <div class="list-item">
              <div class="list-item-body">
                <div class="list-item-title">${a.userName || 'Kamerad'}</div>
              </div>
              <button class="btn btn-sm btn-danger" onclick="teilnehmerEntfernen('${a.id}')">🗑</button>
            </div>`).join('')}
        <div class="btn-row">
          <button class="btn btn-secondary btn-sm" onclick="navigate('uebung-eintragen', {id:'${id}', titel:'${u.titel}', dauer:${u.dauer_h}, typ:'${u.typ}', datum:'${u.datum?.toDate?.().toISOString()}'})">+ Kamerad eintragen</button>
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div class="card">
      <span class="badge ${u.typ==='einsatz'?'badge-red':'badge-blue'}">${u.typ==='einsatz'?'⚡ Einsatz':'🔥 Übung'}</span>
      <div style="margin-top:0.6rem;font-size:1rem;font-weight:600">${datum(u.datum)} · ${u.dauer_h} Stunden</div>
      ${u.beschreibung ? `<p class="muted" style="margin-top:0.4rem;font-size:0.85rem">${u.beschreibung}</p>` : ''}
    </div>

    <div class="section-header">Meine Anwesenheit</div>
    <div class="card">
      ${meineA ? `
        <div style="margin-bottom:0.7rem">${anwesenheitBadge(meineA.status)}</div>
        ${meineA.status === 'vorgeschlagen' ? '<p class="muted" style="font-size:0.83rem">Deine Teilnahme wurde gemeldet und wartet auf Bestätigung.</p>' : ''}
        ${meineA.status === 'bestaetigt' ? '<p class="muted" style="font-size:0.83rem">Deine Teilnahme wurde bestätigt.</p>' : ''}
        ${meineA.status === 'abgelehnt' ? '<p class="muted" style="font-size:0.83rem">Deine Teilnahme wurde abgelehnt.</p>' : ''}
      ` : `
        <p class="muted" style="font-size:0.85rem;margin-bottom:0.8rem">Du hast dich noch nicht für diese Übung gemeldet.</p>
        <button class="btn btn-primary" onclick="teilnahmeMelden('${id}','${u.titel}',${u.dauer_h},'${u.typ}','${u.datum?.toDate?.().toISOString()}')">
          Teilnahme melden
        </button>
      `}
    </div>
    ${teilnehmerHTML}
  `;
});

window.teilnahmeMelden = async (uebungId, titel, dauer_h, typ, datumStr) => {
  const name = `${fw.profil.vorname} ${fw.profil.nachname}`.trim() || fw.profil.email;
  await fw.addDoc('anwesenheiten', {
    uebungId, userId: fw.user.uid, userName: name,
    status: 'vorgeschlagen', uebungTitel: titel,
    dauer_h, typ, datum: new Date(datumStr),
    vorgeschlagenAm: new Date(),
  });
  fw.toast('Teilnahme gemeldet – wartet auf Bestätigung');
  navigate('uebung-detail', { id: uebungId });
};

window.teilnehmerEntfernen = async (aId) => {
  if (!confirm('Anwesenheit entfernen?')) return;
  await fw.deleteDoc(`anwesenheiten/${aId}`);
  fw.toast('Entfernt');
  history.back();
};

// ── Kamerad direkt eintragen (Wehrführer) ────────────────
registerPage('uebung-eintragen', async (el, { id, titel, dauer, typ, datum: datumStr }) => {
  fw.setTitle('Eintragen');
  fw.showBack(() => navigate('uebung-detail', { id }));

  const usersSnap = await fw.getDocs('users');
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Bereits eingetragene rausfiltern
  const bereitsSnap = await fw.getDocs('anwesenheiten', fw.where('uebungId', '==', id));
  const bereits = new Set(bereitsSnap.docs.map(d => d.data().userId));

  const verfuegbar = users.filter(u => !bereits.has(u.id));

  el.innerHTML = `
    <div class="card">
      <div class="card-title">Kamerad eintragen</div>
      <p class="muted" style="font-size:0.85rem;margin-bottom:1rem">${titel}</p>
      ${verfuegbar.length === 0 ? '<div class="empty">Alle Kameraden bereits eingetragen</div>' :
        verfuegbar.map(u => `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${u.nachname}, ${u.vorname}</div>
              <div class="list-item-sub">${u.dienstgrad || '–'}</div>
            </div>
            <button class="btn btn-sm btn-success" onclick="direktEintragen('${id}','${u.id}','${u.vorname} ${u.nachname}',${dauer},'${typ}','${datumStr}')">
              Eintragen
            </button>
          </div>`).join('')}
    </div>
  `;
});

window.direktEintragen = async (uebungId, userId, name, dauer_h, typ, datumStr) => {
  await fw.addDoc('anwesenheiten', {
    uebungId, userId, userName: name,
    status: 'bestaetigt', dauer_h, typ,
    datum: new Date(datumStr),
    bestaetigtAm: new Date(),
  });
  fw.toast(`${name} eingetragen ✅`);
  navigate('uebung-detail', { id: uebungId });
};

// ── Übung anlegen / bearbeiten ────────────────────────────
registerPage('uebung-form', async (el, { id }) => {
  let u = null;
  if (id) {
    const snap = await fw.getDoc(`uebungen/${id}`);
    if (snap.exists()) u = { id, ...snap.data() };
  }
  fw.setTitle(u ? 'Bearbeiten' : 'Neue Übung');
  fw.showBack(() => navigate('uebungen'));

  const datumVal = u?.datum?.toDate ? u.datum.toDate().toISOString().slice(0,10) : '';

  el.innerHTML = `
    <div class="card">
      <div class="form-row"><label>Titel</label><input id="f-titel" value="${u?.titel||''}" placeholder="Monatsübung April…"></div>
      <div class="form-row"><label>Datum</label><input id="f-datum" type="date" value="${datumVal}"></div>
      <div class="form-row"><label>Typ</label>
        <select id="f-typ">
          <option value="uebung"  ${u?.typ==='uebung' ?'selected':''}>Übung</option>
          <option value="einsatz" ${u?.typ==='einsatz'?'selected':''}>Einsatz</option>
        </select>
      </div>
      <div class="form-row"><label>Dauer (Stunden)</label><input id="f-dauer" type="number" step="0.5" min="0.5" value="${u?.dauer_h||2}"></div>
      <div class="form-row"><label>Beschreibung (optional)</label><textarea id="f-beschr">${u?.beschreibung||''}</textarea></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="uebungSpeichern('${id||''}')">💾 Speichern</button>
        ${u ? `<button class="btn btn-danger" onclick="uebungLoeschen('${id}')">🗑 Löschen</button>` : ''}
      </div>
    </div>
  `;
});

window.uebungSpeichern = async (id) => {
  const data = {
    titel: document.getElementById('f-titel').value.trim(),
    datum: new Date(document.getElementById('f-datum').value),
    typ:   document.getElementById('f-typ').value,
    dauer_h: parseFloat(document.getElementById('f-dauer').value),
    beschreibung: document.getElementById('f-beschr').value.trim(),
  };
  if (!data.titel || !data.datum) { fw.toast('Titel und Datum erforderlich', true); return; }
  try {
    if (id) await fw.updateDoc(`uebungen/${id}`, data);
    else    await fw.addDoc('uebungen', { ...data, erstelltVon: fw.user.uid, erstelltAm: new Date() });
    fw.toast('Gespeichert ✅');
    navigate('uebungen');
  } catch(e) { fw.toast(e.message, true); }
};

window.uebungLoeschen = async (id) => {
  if (!confirm('Übung wirklich löschen?')) return;
  await fw.deleteDoc(`uebungen/${id}`);
  fw.toast('Gelöscht');
  navigate('uebungen');
};

// ── Profil ────────────────────────────────────────────────
registerPage('profil', async (el) => {
  fw.setTitle('Mein Profil');
  const me = fw.profil;

  // Eigene Statistik
  const aSnap = await fw.getDocs('anwesenheiten', fw.where('userId', '==', fw.user.uid));
  const meine = aSnap.docs.map(d => d.data());
  const stats = getStats(meine);

  // Qualifikationen
  const qSnap = await fw.getDocs(`users/${fw.user.uid}/qualifikationen`);
  const qualis = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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
      <div class="form-row"><label>Notfallkontakt Name</label><input id="p-nkn" value="${me.notfallkontakt_name||''}"></div>
      <div class="form-row"><label>Notfallkontakt Telefon</label><input id="p-nkt" type="tel" value="${me.notfallkontakt_tel||''}"></div>
      <button class="btn btn-primary btn-full" onclick="profilSpeichern()">💾 Speichern</button>
    </div>

    <div class="section-header">Dienstlich</div>
    <div class="card">
      <div style="display:flex;gap:1rem">
        <div><div class="muted" style="font-size:0.75rem">Dienstgrad</div><div class="bold">${me.dienstgrad||'–'}</div></div>
        <div><div class="muted" style="font-size:0.75rem">Eingetreten</div><div class="bold">${me.eintrittsdatum ? datum(me.eintrittsdatum) : '–'}</div></div>
      </div>
      <hr>
      <div class="card-title" style="margin-bottom:0.5rem">Qualifikationen</div>
      ${qualis.length === 0 ? '<p class="muted" style="font-size:0.85rem">Noch keine Qualifikationen eingetragen</p>' :
        qualis.map(q => `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${q.bezeichnung}</div>
              <div class="list-item-sub">${q.datum ? datum(q.datum) : ''}${q.bemerkung ? ' · '+q.bemerkung : ''}</div>
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
});

window.profilSpeichern = async () => {
  const data = {
    vorname: document.getElementById('p-vn').value,
    nachname: document.getElementById('p-nn').value,
    telefon: document.getElementById('p-tel').value,
    email: document.getElementById('p-mail').value,
    fuehrerschein: document.getElementById('p-fs').value,
    notfallkontakt_name: document.getElementById('p-nkn').value,
    notfallkontakt_tel: document.getElementById('p-nkt').value,
  };
  await fw.setDoc(`users/${fw.user.uid}`, data);
  Object.assign(fw.profil, data);
  fw.toast('Gespeichert ✅');
};

window.passwortAendern = async () => {
  const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
  const alt = document.getElementById('pw-alt').value;
  const neu = document.getElementById('pw-neu').value;
  if (!alt || !neu) { fw.toast('Bitte beide Felder ausfüllen', true); return; }
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

// ── Kameraden (Wehrführer) ────────────────────────────────
registerPage('kameraden', async (el) => {
  fw.setTitle('Kameraden');
  fw.showHeaderAction('+ Neu', () => navigate('kamerad-form', {}));

  const snap = await fw.getDocs('users');
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (a.nachname||'').localeCompare(b.nachname||''));

  el.innerHTML = `
    <div class="card">
      ${users.map(u => `
        <div class="list-item" onclick="navigate('kamerad-detail', {id:'${u.id}'})">
          <div class="list-item-icon">👤</div>
          <div class="list-item-body">
            <div class="list-item-title">${u.nachname||''}, ${u.vorname||''}</div>
            <div class="list-item-sub">${u.dienstgrad||'–'} · ${u.aktiv===false?'<span style="color:var(--muted)">Inaktiv</span>':'Aktiv'}</div>
          </div>
          <div class="list-chevron">›</div>
        </div>`).join('')}
    </div>
  `;
});

// ── Kamerad Detail ────────────────────────────────────────
registerPage('kamerad-detail', async (el, { id }) => {
  const snap = await fw.getDoc(`users/${id}`);
  if (!snap.exists()) { el.innerHTML = '<div class="empty">Nicht gefunden</div>'; return; }
  const u = { id, ...snap.data() };
  fw.setTitle(`${u.vorname} ${u.nachname}`);
  fw.showBack(() => navigate('kameraden'));
  fw.showHeaderAction('✏️ Edit', () => navigate('kamerad-form', { id }));

  const aSnap = await fw.getDocs('anwesenheiten', fw.where('userId', '==', id));
  const stats = getStats(aSnap.docs.map(d => d.data()));

  const qSnap = await fw.getDocs(`users/${id}/qualifikationen`);
  const qualis = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-zahl">${stats.gesamt}</div><div class="stat-label">Gesamtstunden</div></div>
      <div class="stat-card"><div class="stat-zahl">${stats.einsaetze}</div><div class="stat-label">Einsätze</div></div>
      <div class="stat-card wide ${stats.ziel?'erreicht':'fehlt'}">
        <div class="stat-zahl">${stats.stunden12m} / 40h</div>
        <div class="stat-label">Letzte 12 Monate ${stats.ziel?'✅':'⚠️'}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Stammdaten</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem">
        ${[
          ['Dienstgrad', u.dienstgrad],
          ['Eingetreten', u.eintrittsdatum ? datum(u.eintrittsdatum) : '–'],
          ['Telefon', u.telefon],
          ['E-Mail', u.email],
          ['Führerschein', u.fuehrerschein],
          ['Notfallkontakt', u.notfallkontakt_name ? `${u.notfallkontakt_name} · ${u.notfallkontakt_tel}` : '–'],
        ].map(([l,v]) => `<div><div class="muted" style="font-size:0.72rem">${l}</div><div style="font-size:0.88rem">${v||'–'}</div></div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Qualifikationen</div>
      ${qualis.length === 0 ? '<p class="muted" style="font-size:0.85rem">Keine</p>' :
        qualis.map(q => `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${q.bezeichnung}</div>
              <div class="list-item-sub">${q.datum ? datum(q.datum) : ''}${q.bemerkung ? ' · '+q.bemerkung : ''}</div>
            </div>
            <button class="btn btn-sm btn-danger" onclick="qualiLoeschen('${id}','${q.id}')">🗑</button>
          </div>`).join('')}
      <hr>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.7rem">
        <input id="q-bez" placeholder="Bezeichnung" style="flex:2;min-width:120px">
        <input id="q-dat" type="date" style="flex:1;min-width:110px">
        <input id="q-bem" placeholder="Bemerkung" style="flex:2;min-width:120px">
        <button class="btn btn-primary btn-sm" onclick="qualiHinzufuegen('${id}')">+</button>
      </div>
    </div>
  `;
});

window.qualiHinzufuegen = async (userId) => {
  const bez = document.getElementById('q-bez').value.trim();
  if (!bez) return;
  await fw.addDoc(`users/${userId}/qualifikationen`, {
    bezeichnung: bez,
    datum: document.getElementById('q-dat').value || null,
    bemerkung: document.getElementById('q-bem').value || '',
  });
  fw.toast('Qualifikation hinzugefügt');
  navigate('kamerad-detail', { id: userId });
};
window.qualiLoeschen = async (userId, qualiId) => {
  await fw.deleteDoc(`users/${userId}/qualifikationen/${qualiId}`);
  fw.toast('Gelöscht');
  navigate('kamerad-detail', { id: userId });
};

// ── Kamerad anlegen / bearbeiten ──────────────────────────
registerPage('kamerad-form', async (el, { id }) => {
  let u = null;
  if (id) {
    const snap = await fw.getDoc(`users/${id}`);
    if (snap.exists()) u = { id, ...snap.data() };
  }
  fw.setTitle(u ? 'Bearbeiten' : 'Neuer Kamerad');
  fw.showBack(() => id ? navigate('kamerad-detail', { id }) : navigate('kameraden'));

  const datumVal = u?.eintrittsdatum?.toDate ? u.eintrittsdatum.toDate().toISOString().slice(0,10) : (u?.eintrittsdatum||'');

  el.innerHTML = `
    <div class="card">
      ${!u ? `
        <div class="form-row"><label>E-Mail (wird Login)</label><input id="k-email" type="email" placeholder="name@beispiel.de"></div>
        <div class="form-row"><label>Initiales Passwort</label><input id="k-pw" type="password"></div>
      ` : ''}
      <div class="form-row"><label>Vorname</label><input id="k-vn" value="${u?.vorname||''}"></div>
      <div class="form-row"><label>Nachname</label><input id="k-nn" value="${u?.nachname||''}"></div>
      <div class="form-row"><label>Dienstgrad</label><input id="k-dg" value="${u?.dienstgrad||''}"></div>
      <div class="form-row"><label>Eintrittsdatum</label><input id="k-ed" type="date" value="${datumVal}"></div>
      <div class="form-row"><label>Rolle</label>
        <select id="k-rolle">
          <option value="kamerad"      ${u?.rolle==='kamerad'?'selected':''}>Kamerad</option>
          <option value="wehrfuehrer"  ${u?.rolle==='wehrfuehrer'?'selected':''}>Wehrführer</option>
        </select>
      </div>
      <div class="form-row"><label>Telefon</label><input id="k-tel" type="tel" value="${u?.telefon||''}"></div>
      <div class="form-row"><label>E-Mail</label><input id="k-mail" type="email" value="${u?.email||''}"></div>
      <div class="form-row"><label>Führerscheinklassen</label><input id="k-fs" value="${u?.fuehrerschein||''}"></div>
      <div class="form-row"><label>Notfallkontakt Name</label><input id="k-nkn" value="${u?.notfallkontakt_name||''}"></div>
      <div class="form-row"><label>Notfallkontakt Tel</label><input id="k-nkt" type="tel" value="${u?.notfallkontakt_tel||''}"></div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="kameradSpeichern('${id||''}')">💾 Speichern</button>
      </div>
    </div>
  `;
});

window.kameradSpeichern = async (id) => {
  const data = {
    vorname: document.getElementById('k-vn').value,
    nachname: document.getElementById('k-nn').value,
    dienstgrad: document.getElementById('k-dg').value,
    eintrittsdatum: document.getElementById('k-ed').value || null,
    rolle: document.getElementById('k-rolle').value,
    telefon: document.getElementById('k-tel').value,
    email: document.getElementById('k-mail').value,
    fuehrerschein: document.getElementById('k-fs').value,
    notfallkontakt_name: document.getElementById('k-nkn').value,
    notfallkontakt_tel: document.getElementById('k-nkt').value,
  };
  try {
    if (id) {
      await fw.setDoc(`users/${id}`, data);
      fw.toast('Gespeichert ✅');
      navigate('kamerad-detail', { id });
    } else {
      // Neuen Firebase Auth User anlegen via Admin geht nicht vom Frontend
      // → Workaround: Kameraden legen sich selbst an, Wehrführer setzt Rolle
      // Hier erstmal Hinweis anzeigen
      const email = document.getElementById('k-email').value;
      const pw    = document.getElementById('k-pw').value;
      const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      const cred = await createUserWithEmailAndPassword(fw.auth, email, pw);
      await fw.setDoc(`users/${cred.user.uid}`, { ...data, email, aktiv: true });
      fw.toast('Kamerad angelegt ✅');
      navigate('kameraden');
    }
  } catch(e) {
    fw.toast(e.message.includes('email-already') ? 'E-Mail bereits vergeben' : e.message, true);
  }
};

}); // end waitFw
