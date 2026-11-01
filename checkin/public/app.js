(() => {
  const TZ = 'America/New_York';
  const IDLE_MS = 60000;          // go back to the program list after a minute of no use
  const DONE_MS = 5000;           // confirmation screen auto-dismiss
  const $ = (id) => document.getElementById(id);
  const state = { programs: [], session: null, person: null, pin: '', busy: false, people: [], reasons: [], reason: null };
  let idleTimer, doneTimer, refreshTimer;

  const time = (iso) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // The access key arrives in the check-in link as #k=... (Safari can strip query strings) or ?k=...,
  // or is typed on the locked screen. It is kept on this device, and left in the #hash so that
  // "Add to Home Screen" captures a link that still carries it.
  const KEY_STORE = 'checkinKey';
  const installed = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  let accessKey = '';
  try { accessKey = localStorage.getItem(KEY_STORE) || ''; } catch (e) { /* storage blocked */ }
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  const linkKey = hash.get('k') || params.get('k');
  // In the installed app the launch link holds whatever key it was installed with, which goes stale
  // when the key changes, so a key saved on the device wins there. In a browser a new link always wins.
  if (linkKey && !(installed && accessKey)) setKey(linkKey);
  else if (accessKey) setKey(accessKey);
  params.delete('k');

  function setKey(k) {
    accessKey = k.trim();
    try { localStorage.setItem(KEY_STORE, accessKey); } catch (e) { /* keeps working for this visit */ }
    params.delete('k');
    hash.set('k', accessKey);
    history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : '') + `#${hash}`);
    // The home-screen app is built from this manifest, so it needs the key (start_url carries it).
    $('manifest').href = `/api/manifest?k=${encodeURIComponent(accessKey)}`;
  }

  $('key-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const k = $('key-input').value.trim();
    if (!k) return;
    setKey(k);
    $('key-input').value = '';
    loadPrograms();
  });

  async function api(path, body) {
    const headers = { 'X-Checkin-Key': accessKey };
    const res = await fetch(`/api${path}`, body
      ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { headers });
    const data = await res.json().catch(() => ({}));
    if (data.needKey) { show('locked'); throw Object.assign(new Error(data.error), { status: res.status }); }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
    return data;
  }

  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
    clearInterval(refreshTimer);
    if (name === 'roster') refreshTimer = setInterval(loadRoster, 30000);
    window.scrollTo(0, 0);
  }

  // ---------- programs ----------
  async function loadPrograms() {
    show('programs');
    const box = $('programs');
    try {
      const data = await api('/today');
      state.programs = data.programs;
      if (!data.programs.length) {
        box.innerHTML = '<div class="empty">There are no classes scheduled today. Please see the front desk.</div>';
        return;
      }
      box.innerHTML = data.programs.map((p) => `
        <button class="card" data-program="${esc(p.id)}">
          <h2>${esc(p.name)}</h2>
          ${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ''}
          ${p.sessions.map((s) => `<div class="when">${s.dropIn ? 'Open' : esc(s.service) + ' &middot;'} ${time(s.start)}&ndash;${time(s.end)}${s.dropIn ? ' &middot; Drop-in' : ''}
            ${s.mode ? `<span class="chip ${s.mode === 'Remote' ? 'remote' : ''}">${esc(s.mode)}</span>` : ''}</div>`).join('')}
        </button>`).join('');
    } catch (e) {
      box.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  }

  $('programs').addEventListener('click', (e) => {
    const card = e.target.closest('[data-program]');
    if (!card) return;
    const program = state.programs.find((p) => p.id === card.dataset.program);
    // One session per program per day is the normal case; take the one happening now or next.
    const now = Date.now();
    state.session = program.sessions.find((s) => new Date(s.end) > now) || program.sessions[program.sessions.length - 1];
    $('roster-title').textContent = program.name;
    $('roster-sub').textContent = state.session.dropIn
      ? `Open ${time(state.session.start)}–${time(state.session.end)} today.`
      : `${state.session.service} · ${time(state.session.start)}–${time(state.session.end)}${state.session.mode ? ` · ${state.session.mode}` : ''}. Tap your name.`;
    $('people').innerHTML = ''; $('here').innerHTML = ''; $('q').value = '';
    show('roster');
    loadRoster();
  });

  // ---------- roster ----------
  const card = (p) => `
    <button class="person ${p.state}" data-person="${esc(p.id)}" ${p.state === 'done' ? 'aria-disabled="true"' : ''}>
      <span class="name">${esc(p.name)}</span>
      <span class="state">${p.state === 'in' ? `In since ${time(p.timeIn)}` : p.state === 'done' ? `Done ${time(p.timeIn)}–${time(p.timeOut)}` : 'Not checked in'}</span>
    </button>`;

  async function loadRoster() {
    if (!state.session) return;
    const term = $('q').value.trim();
    try {
      const data = await api(`/roster?session=${encodeURIComponent(state.session.id)}&q=${encodeURIComponent(term)}`);
      if (term !== $('q').value.trim()) return;   // a newer search is on its way
      if (data.deskOnly) {
        state.people = []; $('search').hidden = true; $('here-label').hidden = $('people-label').hidden = true; $('here').innerHTML = '';
        $('people').innerHTML = `<div class="empty">${esc(data.message)}</div>`;
        return;
      }
      state.people = data.people;
      state.reasons = data.reasons || [];
      $('search').hidden = !data.searchMode;
      if (!data.searchMode) {
        $('here-label').hidden = $('people-label').hidden = true; $('here').innerHTML = '';
        $('people').innerHTML = data.people.length ? data.people.map(card).join('')
          : '<div class="empty">No one is on this class list yet. Please see the front desk.</div>';
        return;
      }
      const here = data.people.filter((p) => p.state === 'in');
      const found = term.length >= 2 ? data.people.filter((p) => p.match !== false && (p.state !== 'in' || matches(p, term))) : [];
      $('here-label').hidden = !here.length;
      $('here').innerHTML = here.map(card).join('');
      $('people-label').hidden = term.length < 2;
      $('people-label').textContent = found.length ? 'Is this you?' : '';
      $('people').innerHTML = term.length < 2 ? '<p class="hint">Start typing your name to check in.</p>'
        : found.length ? found.map(card).join('') : '<div class="empty">No match. Check the spelling, or see the front desk.</div>';
    } catch (e) {
      $('people').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  }
  const matches = (p, term) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(term.toLowerCase()));

  let searchTimer;
  $('q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadRoster, 250); });

  function pickPerson(e) {
    const btn = e.target.closest('[data-person]');
    if (!btn) return;
    const person = state.people.find((p) => p.id === btn.dataset.person);
    if (person.state === 'done') return;
    state.person = person;
    state.reason = null;
    if (person.state === 'out' && state.reasons.length) {
      $('reason-title').textContent = `Hi ${person.name.split(' ')[0]}.`;
      $('reasons').innerHTML = state.reasons.map((r) => `<button class="reason" data-reason="${esc(r.id)}">${esc(r.name)}</button>`).join('');
      show('reason');
      return;
    }
    askPin();
  }
  $('people').addEventListener('click', pickPerson);
  $('here').addEventListener('click', pickPerson);

  $('reasons').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-reason]');
    if (!btn) return;
    state.reason = state.reasons.find((r) => r.id === btn.dataset.reason);
    askPin();
  });

  function askPin() {
    const person = state.person;
    state.pin = '';
    $('pin-title').textContent = `Hi ${person.name.split(' ')[0]}.`;
    $('submit').textContent = person.state === 'in' ? 'Check out' : 'Check in';
    $('pin-error').textContent = '';
    renderPin();
    show('pin');
  }

  // ---------- PIN ----------
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];
  $('keypad').innerHTML = keys.map((k) => `<button class="key ${k.length > 1 ? 'ghost' : ''}" data-key="${k}" aria-label="${k === 'del' ? 'Delete' : k === 'clear' ? 'Clear' : k}">${k === 'del' ? '&#9003;' : k === 'clear' ? 'Clear' : k}</button>`).join('');

  function renderPin() {
    [...$('dots').children].forEach((d, i) => d.classList.toggle('on', i < state.pin.length));
    $('submit').disabled = state.pin.length !== 4 || state.busy;
  }

  function press(k) {
    if (state.busy) return;
    $('pin-error').textContent = '';
    if (k === 'del') state.pin = state.pin.slice(0, -1);
    else if (k === 'clear') state.pin = '';
    else if (state.pin.length < 4) state.pin += k;
    renderPin();
  }

  $('keypad').addEventListener('click', (e) => { const k = e.target.closest('[data-key]'); if (k) press(k.dataset.key); });
  document.addEventListener('keydown', (e) => {
    if ($('screen-pin').hidden) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter' && !$('submit').disabled) $('submit').click();
  });

  $('submit').addEventListener('click', async () => {
    const action = state.person.state === 'in' ? 'out' : 'in';
    state.busy = true; renderPin();
    $('submit').textContent = action === 'in' ? 'Checking in…' : 'Checking out…';
    try {
      const r = await api('/check', { session: state.session.id, contact: state.person.id, pin: state.pin, action, reason: state.reason && state.reason.id });
      $('done-title').textContent = action === 'in' ? `You're checked in, ${r.firstName}.` : `See you next time, ${r.firstName}.`;
      $('done-sub').textContent = action === 'in'
        ? `Checked in at ${time(r.time)}${r.reason ? ` for ${r.reason}` : ''}${r.status === 'Late' ? ' (marked late)' : ''}. Remember to check out when you leave.`
        : `Checked out at ${time(r.time)}${r.hours != null ? ` · ${Number(r.hours).toFixed(2)} hours today` : ''}.`;
      show('done');
      clearTimeout(doneTimer);
      doneTimer = setTimeout(() => { if (!$('screen-done').hidden) { $('q').value = ''; show('roster'); loadRoster(); } }, DONE_MS);
    } catch (e) {
      $('pin-error').textContent = e.message;
      state.pin = '';
      $('submit').textContent = action === 'in' ? 'Check in' : 'Check out';
    } finally {
      state.busy = false; renderPin();
    }
  });

  // ---------- navigation, idle, clock ----------
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (!go) return;
    if (go.dataset.go === 'programs') loadPrograms();
    else { $('q').value = ''; show('roster'); loadRoster(); }
  });

  ['click', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if ($('screen-programs').hidden) loadPrograms(); }, IDLE_MS);
  }, { passive: true }));

  const tick = () => { $('clock').textContent = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date()); };
  tick(); setInterval(tick, 15000);

  loadPrograms();
})();
