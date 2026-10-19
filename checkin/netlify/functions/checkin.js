/**
 * Front-desk / remote check-in API, backed by PMM in Salesforce.
 *
 *   GET  /api/today                      programs with a class session today
 *   GET  /api/roster?session=<id>[&q=]   who is on that session's schedule, and their status
 *   POST /api/check {session, contact, pin, action: "in"|"out", reason?}
 *
 * Drop-in schedules (Drop_In__c, e.g. ERC open hours) and lists over SEARCH_OVER people are
 * searched by name instead of listed in full; only people currently checked in are shown up front.
 * If the program has Services flagged Check_In_Reason__c, check-in asks for one and records the
 * visit against that Service.
 *
 * A check-in creates a pmdm__ServiceDelivery__c with Time In; check-out sets
 * Time Out. Hours and In Person/Remote are filled by RTS_AttendanceService
 * in Salesforce. The PIN is the last 4 digits of the phone on the Contact.
 */
const { sf, query, soqlId } = require('./lib/salesforce');

const TZ = process.env.CHECKIN_TIMEZONE || 'America/New_York';
const LATE_AFTER_MIN = 10;      // checked in more than 10 min after start -> Late
const EARLY_BEFORE_MIN = 45;    // checked out more than 45 min before end (before 3:15 for a 4:00 class) -> Left Early
const SEARCH_OVER = 20;         // longer lists switch to name search

exports.handler = async (event) => {
  const route = (event.path || '').replace(/^.*\/(api|\.netlify\/functions\/checkin)/, '');
  try {
    if (event.httpMethod === 'GET' && route === '/today') return ok(await today());
    if (event.httpMethod === 'GET' && route === '/roster') return ok(await roster(event.queryStringParameters.session, event.queryStringParameters.q));
    if (event.httpMethod === 'POST' && route === '/check') return await check(JSON.parse(event.body || '{}'));
    return json(404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Something went wrong. Please see the front desk.' });
  }
};

// ---------- today's sessions, grouped by program ----------

async function today() {
  const { start, end, date } = localDayBounds(new Date());
  const sessions = await query(`
    SELECT Id, pmdm__SessionStart__c, pmdm__SessionEnd__c, Delivery_Mode__c, pmdm__ServiceSchedule__r.Drop_In__c,
           pmdm__ServiceSchedule__r.pmdm__Service__r.Name,
           pmdm__ServiceSchedule__r.pmdm__Service__r.pmdm__Program__c,
           pmdm__ServiceSchedule__r.pmdm__Service__r.pmdm__Program__r.Name,
           pmdm__ServiceSchedule__r.pmdm__Service__r.pmdm__Program__r.pmdm__ShortSummary__c,
           pmdm__ServiceSchedule__r.pmdm__Service__r.pmdm__Program__r.pmdm__Description__c
    FROM pmdm__ServiceSession__c
    WHERE pmdm__SessionStart__c >= ${start} AND pmdm__SessionStart__c < ${end}
      AND pmdm__Status__c != 'Canceled' AND pmdm__ServiceSchedule__c != null
    ORDER BY pmdm__SessionStart__c`);
  const programs = new Map();
  for (const s of sessions) {
    const service = s.pmdm__ServiceSchedule__r.pmdm__Service__r;
    if (!programs.has(service.pmdm__Program__c)) {
      const prog = service.pmdm__Program__r;
      programs.set(service.pmdm__Program__c, {
        id: service.pmdm__Program__c, name: prog.Name, summary: prog.pmdm__ShortSummary__c || firstSentence(prog.pmdm__Description__c), sessions: [],
      });
    }
    programs.get(service.pmdm__Program__c).sessions.push({
      id: s.Id, service: service.Name, start: iso(s.pmdm__SessionStart__c), end: iso(s.pmdm__SessionEnd__c), mode: s.Delivery_Mode__c,
      dropIn: s.pmdm__ServiceSchedule__r.Drop_In__c,
    });
  }
  return { date, timezone: TZ, programs: [...programs.values()] };
}

// ---------- roster for one session ----------

async function loadSession(sessionId) {
  const [s] = await query(`
    SELECT Id, Name, pmdm__SessionStart__c, pmdm__SessionEnd__c, Delivery_Mode__c, pmdm__ServiceSchedule__c,
           pmdm__ServiceSchedule__r.Drop_In__c,
           pmdm__ServiceSchedule__r.pmdm__Service__c, pmdm__ServiceSchedule__r.pmdm__Service__r.Name,
           pmdm__ServiceSchedule__r.pmdm__Service__r.pmdm__Program__c,
           pmdm__ServiceSchedule__r.pmdm__Service__r.pmdm__Program__r.Name
    FROM pmdm__ServiceSession__c WHERE Id = ${soqlId(sessionId)}`);
  if (!s) throw new Error('Session not found');
  return s;
}

async function participants(session) {
  const rows = await query(`
    SELECT pmdm__Contact__c, pmdm__ProgramEngagement__c, pmdm__Contact__r.FirstName, pmdm__Contact__r.LastName
    FROM pmdm__ServiceParticipant__c
    WHERE pmdm__ServiceSchedule__c = ${soqlId(session.pmdm__ServiceSchedule__c)} AND pmdm__Status__c = 'Enrolled'`);
  const byContact = new Map();
  for (const r of rows) if (!byContact.has(r.pmdm__Contact__c)) byContact.set(r.pmdm__Contact__c, r);
  return byContact;
}

async function deliveries(sessionId) {
  const rows = await query(`
    SELECT Id, pmdm__Contact__c, Time_In__c, Time_Out__c, pmdm__Quantity__c
    FROM pmdm__ServiceDelivery__c WHERE pmdm__ServiceSession__c = ${soqlId(sessionId)}`);
  return new Map(rows.map((d) => [d.pmdm__Contact__c, d]));
}

async function reasons(session) {
  const rows = await query(`
    SELECT Id, Name FROM pmdm__Service__c
    WHERE pmdm__Program__c = ${soqlId(session.pmdm__ServiceSchedule__r.pmdm__Service__r.pmdm__Program__c)}
      AND Check_In_Reason__c = true AND pmdm__Status__c = 'Active'
    ORDER BY Name`);
  return rows.map((r) => ({ id: r.Id, name: r.Name }));
}

async function roster(sessionId, search) {
  const session = await loadSession(sessionId);
  const [people, delivered, reasonList] = await Promise.all([participants(session), deliveries(sessionId), reasons(session)]);
  let list = [...people.values()].map((p) => {
    const d = delivered.get(p.pmdm__Contact__c);
    const first = p.pmdm__Contact__r.FirstName || '';
    const last = p.pmdm__Contact__r.LastName || '';
    return {
      id: p.pmdm__Contact__c,
      name: `${first} ${last.charAt(0)}.`.trim(),
      state: !d || !d.Time_In__c ? 'out' : d.Time_Out__c ? 'done' : 'in',
      timeIn: d && iso(d.Time_In__c), timeOut: d && iso(d.Time_Out__c),
      match: `${first} ${last}`.toLowerCase(),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  // Long lists aren't sent in full: only who's here now, plus matches for a 2+ letter search.
  const searchMode = session.pmdm__ServiceSchedule__r.Drop_In__c || list.length > SEARCH_OVER;
  if (searchMode) {
    const term = (search || '').trim().toLowerCase();
    list = list.filter((p) => p.state === 'in'
      || (term.length >= 2 && p.match.split(/\s+/).some((w) => w.startsWith(term))));
  }
  list.forEach((p) => delete p.match);
  return { session: sessionSummary(session), searchMode, reasons: reasonList, people: list };
}

// ---------- check in / out ----------

async function check({ session: sessionId, contact: contactId, pin, action, reason }) {
  if (!['in', 'out'].includes(action) || !/^\d{4}$/.test(pin || '')) return json(400, { error: 'Enter your 4-digit PIN.' });
  const session = await loadSession(sessionId);
  const person = (await participants(session)).get(contactId);
  if (!person) return json(404, { error: "You're not on today's list. Please see the front desk." });

  const [contact] = await query(`SELECT FirstName, MobilePhone, Phone, HomePhone FROM Contact WHERE Id = ${soqlId(contactId)}`);
  const phone = (contact.MobilePhone || contact.Phone || contact.HomePhone || '').replace(/\D/g, '');
  if (phone.length < 4 || phone.slice(-4) !== pin) return json(401, { error: "That PIN doesn't match. Try again or see the front desk." });

  const existing = (await deliveries(sessionId)).get(contactId);
  const now = new Date();
  const start = new Date(session.pmdm__SessionStart__c);
  const end = new Date(session.pmdm__SessionEnd__c);
  const dropIn = session.pmdm__ServiceSchedule__r.Drop_In__c;

  if (action === 'in') {
    if (existing && existing.Time_In__c) return json(409, { error: `You already checked in at ${clock(existing.Time_In__c)}.` });
    const reasonList = await reasons(session);
    const chosen = reasonList.find((r) => r.id === reason);
    if (reasonList.length && !chosen) return json(400, { error: 'Choose what brings you in today.' });
    const late = !dropIn && now - start > LATE_AFTER_MIN * 60000;
    await sf('POST', '/sobjects/pmdm__ServiceDelivery__c', {
      Name: `${chosen ? chosen.name : session.pmdm__ServiceSchedule__r.pmdm__Service__r.Name} ${localDate(now)}`.slice(0, 80),
      pmdm__Service__c: chosen ? chosen.id : session.pmdm__ServiceSchedule__r.pmdm__Service__c,
      pmdm__ServiceSession__c: session.Id,
      pmdm__ProgramEngagement__c: person.pmdm__ProgramEngagement__c,
      pmdm__Contact__c: contactId,
      pmdm__DeliveryDate__c: localDate(now),
      pmdm__AttendanceStatus__c: late ? 'Late' : 'Present',
      Time_In__c: now.toISOString(),
    });
    return ok({ firstName: contact.FirstName, action, time: now.toISOString(), status: late ? 'Late' : 'Present', reason: chosen && chosen.name });
  }

  if (!existing || !existing.Time_In__c) return json(409, { error: "You haven't checked in today yet." });
  if (existing.Time_Out__c) return json(409, { error: `You already checked out at ${clock(existing.Time_Out__c)}.` });
  const update = { Time_Out__c: now.toISOString() };
  if (!dropIn && end - now > EARLY_BEFORE_MIN * 60000) update.pmdm__AttendanceStatus__c = 'Left Early';
  await sf('PATCH', `/sobjects/pmdm__ServiceDelivery__c/${existing.Id}`, update);
  const [after] = await query(`SELECT pmdm__Quantity__c FROM pmdm__ServiceDelivery__c WHERE Id = ${soqlId(existing.Id)}`);
  return ok({ firstName: contact.FirstName, action, time: now.toISOString(), hours: after.pmdm__Quantity__c });
}

// ---------- helpers ----------

function sessionSummary(s) {
  return {
    id: s.Id, program: s.pmdm__ServiceSchedule__r.pmdm__Service__r.pmdm__Program__r.Name,
    service: s.pmdm__ServiceSchedule__r.pmdm__Service__r.Name,
    start: iso(s.pmdm__SessionStart__c), end: iso(s.pmdm__SessionEnd__c), mode: s.Delivery_Mode__c,
    dropIn: s.pmdm__ServiceSchedule__r.Drop_In__c,
  };
}

/** Fallback for the program card when a Program has no Short Summary. */
function firstSentence(text) {
  if (!text) return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  const sentence = flat.match(/^.*?[.!?](\s|$)/);
  return (sentence ? sentence[0] : flat).trim();
}

/** Salesforce returns "+0000" offsets, which Safari's Date parser rejects; send plain ISO. */
function iso(sfDate) {
  return sfDate ? new Date(sfDate).toISOString() : null;
}

function localDate(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function offsetFor(d) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(d).find((p) => p.type === 'timeZoneName').value; // "GMT-04:00"
  return name === 'GMT' ? '+00:00' : name.replace('GMT', '');
}

/** SOQL datetime literals for local midnight today and tomorrow. */
function localDayBounds(now) {
  const date = localDate(now);
  const next = localDate(new Date(now.getTime() + 26 * 3600000));
  return { date, start: `${date}T00:00:00${offsetFor(now)}`, end: `${next}T00:00:00${offsetFor(new Date(now.getTime() + 26 * 3600000))}` };
}

function clock(iso) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function ok(body) { return json(200, body); }
function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
