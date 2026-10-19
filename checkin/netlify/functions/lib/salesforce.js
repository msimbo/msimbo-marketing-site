/**
 * Minimal Salesforce REST client for the check-in app.
 *
 * Auth, in order of preference:
 *   SF_CLIENT_ID + SF_CLIENT_SECRET + SF_LOGIN_URL — OAuth client-credentials flow
 *     against the "ULEM Check-In" External Client App (ULEM_Checkin), whose run-as
 *     user is a dedicated integration user. This is the production setup.
 *     SF_LOGIN_URL must be the org's My Domain (https://ulem.my.salesforce.com):
 *     Salesforce rejects client-credentials logins at login.salesforce.com.
 *   SF_ACCESS_TOKEN + SF_INSTANCE_URL — a session token, e.g. from
 *     `sf org display -o ulem --json`. Local prototyping only; it expires.
 */

const API = 'v62.0';
let cached = null;

async function getSession() {
  const { SF_CLIENT_ID, SF_CLIENT_SECRET, SF_LOGIN_URL, SF_ACCESS_TOKEN, SF_INSTANCE_URL } = process.env;
  if (SF_CLIENT_ID && SF_CLIENT_SECRET) {
    if (cached && cached.expires > Date.now()) return cached;
    if (!SF_LOGIN_URL) throw new Error('SF_LOGIN_URL must be set to the My Domain URL, e.g. https://ulem.my.salesforce.com');
    const res = await fetch(`${SF_LOGIN_URL.replace(/\/+$/, '')}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: SF_CLIENT_ID,
        client_secret: SF_CLIENT_SECRET,
      }),
    });
    if (!res.ok) throw new Error(`Salesforce login failed: ${res.status} ${await res.text()}`);
    const body = await res.json();
    cached = { token: body.access_token, instanceUrl: body.instance_url, expires: Date.now() + 50 * 60 * 1000 };
    return cached;
  }
  if (SF_ACCESS_TOKEN && SF_INSTANCE_URL) {
    return { token: SF_ACCESS_TOKEN, instanceUrl: SF_INSTANCE_URL };
  }
  throw new Error('Salesforce credentials are not configured');
}

async function sf(method, path, body, retried = false) {
  const { token, instanceUrl } = await getSession();
  const res = await fetch(`${instanceUrl}/services/data/${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Token revoked or expired before our 50-minute cache ran out: log in again and retry once.
  if (res.status === 401 && cached && !retried) {
    cached = null;
    return sf(method, path, body, true);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Salesforce ${method} ${path.split('?')[0]}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function query(soql) {
  let res = await sf('GET', `/query?q=${encodeURIComponent(soql)}`);
  const records = res.records;
  while (!res.done) {
    res = await sf('GET', res.nextRecordsUrl.replace(`/services/data/${API}`, ''));
    records.push(...res.records);
  }
  return records;
}

/** Quote a value for SOQL. Ids are validated separately; this guards free text. */
function soqlId(id) {
  if (!/^[a-zA-Z0-9]{15,18}$/.test(id || '')) throw new Error('Invalid id');
  return `'${id}'`;
}

module.exports = { sf, query, soqlId };
