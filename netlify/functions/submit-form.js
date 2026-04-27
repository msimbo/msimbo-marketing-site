/**
 * Netlify Serverless Function — Form submission proxy
 *
 * Routes:
 *   signupType === 'application'  → Salesforce REST (uses SF login)
 *                                    - If existing Info Session Lead: PATCH to promote (flip RecordType to Applicant)
 *                                    - Else: REST insert (create as Applicant). W2L can't reliably populate
 *                                      lookup fields (RTS_Cohort__c) before validation rules run.
 *   signupType === 'info_session' → Salesforce Web-to-Lead (RTS_Info_Session RecordType)
 *                                   + n8n webhook (Google Calendar invite)
 *
 * Required Netlify environment variables:
 *   SF_ORG_ID                       — Salesforce 15-char Org ID (info-session W2L only)
 *   SF_RTS_COHORT_ID                — 15-char Cohort record ID (applications only)
 *   SF_RTS_COHORT_NAME              — Human-readable cohort name (e.g., "RTS - Cohort 1 - May 2026")
 *   SF_RECORD_TYPE_ID               — 15-char RTS_Applicant RecordType Id
 *   SF_INFO_SESSION_RECORD_TYPE_ID  — 15-char RTS_Info_Session RecordType Id
 *   SF_INSTANCE_URL                 — e.g., https://ulem.my.salesforce.com
 *   SF_DUPE_CHECK_USERNAME          — integration user username (SOQL + PATCH)
 *   SF_DUPE_CHECK_PASSWORD          — integration user password + security token
 *   N8N_INFO_SESSION_WEBHOOK_URL    — https://protomated.app.n8n.cloud/webhook/<id>
 *   USE_SF_INFO_SESSION             — 'true' to route info-session to SF; anything else = legacy SwipeOne path
 *   SWIPEONE_API_KEY                — SwipeOne API key (legacy info-session fallback)
 *   SWIPEONE_WORKSPACE_ID           — SwipeOne workspace ID (legacy info-session fallback)
 */

// Lead custom field IDs (15-char) for Web-to-Lead
const SF_FIELDS = {
  dateOfBirth: '00NUV00001BuSKX',
  zipCode: '00NUV00001BlCai',
  daytimeAvailable: '00NUV00001BlCaL',
  neighborhood: '00NUV00001BlCaZ',
  primaryLanguage: '00NUV00001BlCad',
  employmentStatus: '00NUV00001BlCaR',
  educationLevel: '00NUV00001BlCaP',
  referralSource: '00NUV00001BlCae',
  motivation: '00NUV00001BlCaY',
  cohort: '00NUV00001BlCaK',
  cohortName: '00NUV00001Cdof3',
  // Info Session fields (15-char Web-to-Lead IDs). REST PATCH uses API names from SF_API_NAMES.
  infoSessionDate: '00NUV00001CLmDW',
  infoSessionSource: '00NUV00001CLmDX',
};

// API names used for REST PATCH (promote path). Fixed; no IDs needed.
const SF_API_NAMES = {
  infoSessionDate: 'RTS_Info_Session_Date__c',
  infoSessionSource: 'RTS_Info_Session_Source__c',
  infoSessionAttended: 'RTS_Info_Session_Attended__c',
  dateOfBirth: 'RTS_Date_of_Birth__c',
  zipCode: 'RTS_Zip_Code__c',
  daytimeAvailable: 'RTS_Daytime_Available__c',
  neighborhood: 'RTS_Neighborhood__c',
  primaryLanguage: 'RTS_Primary_Language__c',
  employmentStatus: 'RTS_Employment_Status__c',
  educationLevel: 'RTS_Education_Level__c',
  referralSource: 'RTS_Referral_Source__c',
  motivation: 'RTS_Motivation__c',
  cohort: 'RTS_Cohort__c',
  cohortName: 'RTS_Cohort_Name__c',
};

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (data.signupType === 'application') {
    return submitApplication(data, headers);
  }

  if (data.signupType === 'info_session') {
    if (process.env.USE_SF_INFO_SESSION === 'true') {
      return submitInfoSessionToSalesforce(data, headers);
    }
    return submitToSwipeOne(data, headers);
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown signupType' }) };
};

// ──────────────────────────────────────────────
// APPLICATION FLOW (with promote-from-info-session path)
// ──────────────────────────────────────────────

async function submitApplication(data, headers) {
  const {
    SF_RTS_COHORT_ID,
    SF_RTS_COHORT_NAME,
    SF_RECORD_TYPE_ID,
    SF_INSTANCE_URL,
    SF_DUPE_CHECK_USERNAME,
    SF_DUPE_CHECK_PASSWORD,
  } = process.env;

  const err = validateApplication(data);
  if (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err }) };
  }

  // Look up existing Lead by email (any RecordType). If they're already an Applicant,
  // reject as duplicate. If a Lead exists with any other RecordType, promote it via
  // REST PATCH (preserves history and avoids W2L-duplicate rejections).
  if (!SF_INSTANCE_URL || !SF_DUPE_CHECK_USERNAME || !SF_DUPE_CHECK_PASSWORD) {
    console.error('Missing dedupe credentials — refusing submission to avoid ghost Leads');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let existingLead;
  try {
    existingLead = await findLeadByEmail(data.email, {
      instanceUrl: SF_INSTANCE_URL,
      username: SF_DUPE_CHECK_USERNAME,
      password: SF_DUPE_CHECK_PASSWORD,
    });
  } catch (e) {
    console.error('Lead lookup failed:', e.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Submission failed. Please try again or contact program-rts@ulem.org.' }),
    };
  }

  if (existingLead) {
    if (existingLead.recordType === 'RTS_Applicant') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: "You've already applied to RTS Cohort 1 with this email. If this seems wrong, contact program-rts@ulem.org.",
        }),
      };
    }

    // Any non-Applicant RecordType (Info Session, legacy Student Lead, etc.) → promote
    // the existing Lead in-place via REST PATCH. Creating a second Lead via W2L would
    // either duplicate or (as we've seen) get silently rejected by SF.
    try {
      await promoteLeadToApplicant(existingLead, data, {
        instanceUrl: existingLead.instanceUrl,
        sessionId: existingLead.sessionId,
        recordTypeId: SF_RECORD_TYPE_ID,
        cohortId: SF_RTS_COHORT_ID,
        cohortName: SF_RTS_COHORT_NAME,
      });
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', promoted: true }) };
    } catch (e) {
      console.error('Promote-to-applicant failed:', e.message);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Submission failed. Please try again or contact program-rts@ulem.org.' }),
      };
    }
  }

  // No existing Lead → create via REST API. We can't use Web-to-Lead because it
  // doesn't reliably populate lookup fields (RTS_Cohort__c) before validation
  // rules fire, so the Cohort-required rule rejects every W2L submission.
  try {
    await createApplicantViaRest(data, {
      instanceUrl: SF_INSTANCE_URL,
      username: SF_DUPE_CHECK_USERNAME,
      password: SF_DUPE_CHECK_PASSWORD,
      recordTypeId: SF_RECORD_TYPE_ID,
      cohortId: SF_RTS_COHORT_ID,
      cohortName: SF_RTS_COHORT_NAME,
    });
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'success' }) };
  } catch (e) {
    console.error('Lead create failed:', e.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Submission failed. Please try again or contact program-rts@ulem.org.' }),
    };
  }
}

// ──────────────────────────────────────────────
// INFO SESSION FLOW (Salesforce path)
// ──────────────────────────────────────────────

async function submitInfoSessionToSalesforce(data, headers) {
  const {
    SF_ORG_ID,
    SF_INFO_SESSION_RECORD_TYPE_ID,
    N8N_INFO_SESSION_WEBHOOK_URL,
  } = process.env;

  if (!SF_ORG_ID) {
    console.error('Missing SF_ORG_ID');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const err = validateInfoSession(data);
  if (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err }) };
  }

  // Fire the SF Web-to-Lead and n8n webhook in parallel. Neither blocks the other.
  const sfPromise = createInfoSessionLeadViaW2L(data, { SF_ORG_ID, SF_INFO_SESSION_RECORD_TYPE_ID });
  const n8nPromise = N8N_INFO_SESSION_WEBHOOK_URL
    ? fireN8nWebhook(data, N8N_INFO_SESSION_WEBHOOK_URL)
    : Promise.resolve();

  const [sfResult, n8nResult] = await Promise.allSettled([sfPromise, n8nPromise]);

  if (sfResult.status === 'rejected') {
    console.error('Info-session SF W2L failed:', sfResult.reason);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Submission failed. Please try again or contact program-rts@ulem.org.' }),
    };
  }
  if (n8nResult.status === 'rejected') {
    // Non-blocking: SF has the lead, calendar invite will be missing. Log and succeed.
    console.error('n8n webhook failed (non-blocking):', n8nResult.reason);
  }

  return { statusCode: 200, headers, body: JSON.stringify({ status: 'success' }) };
}

async function createInfoSessionLeadViaW2L(data, env) {
  const { SF_ORG_ID, SF_INFO_SESSION_RECORD_TYPE_ID } = env;

  console.log('[info-session] SF_INFO_SESSION_RECORD_TYPE_ID =', JSON.stringify(SF_INFO_SESSION_RECORD_TYPE_ID));

  const params = new URLSearchParams();
  params.append('oid', String(SF_ORG_ID).slice(0, 15));
  params.append('first_name', data.firstName);
  params.append('last_name', data.lastName);
  params.append('email', data.email);
  params.append('phone', data.phone);
  params.append('company', 'N/A');
  params.append('lead_source', 'Wesbite_msimbo.org');

  // Deliberately do NOT send recordType param for info-session submissions.
  // The before-save flow "RTS Flow — Info Session Assign RecordType" sets RecordTypeId
  // based on RTS_Info_Session_Date__c presence. Sending the recordType param here seems
  // to cause W2L to post-assign to RTS_Applicant in this org's configuration.
  console.log('[info-session] Skipping recordType param; flow will assign RecordTypeId');

  params.append(SF_FIELDS.zipCode, data.zipCode);
  params.append(SF_FIELDS.infoSessionDate, data.infoSessionDate);
  params.append(SF_FIELDS.infoSessionSource, formatSessionLabel(data.infoSessionDate));

  const sfRes = await fetch('https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!sfRes.ok) {
    throw new Error('Salesforce W2L returned status ' + sfRes.status);
  }
}

async function fireN8nWebhook(data, webhookUrl) {
  const payload = {
    email: data.email,
    name: ((data.firstName || '') + ' ' + (data.lastName || '')).trim(),
    session: data.infoSessionDate,
    tag: 'info_session_lead',
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('n8n webhook returned status ' + res.status);
  }
}

function formatSessionLabel(isoDatetime) {
  const d = parseEasternDatetime(isoDatetime);
  if (!d) return '';
  const dayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'long', day: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  return dayFmt.format(d) + ' — ' + timeFmt.format(d);
}

// Parses values from the landing page (e.g. "2026-04-28T18:00:00"). A naive
// datetime is interpreted as America/New_York; a value with a Z or ±HH:MM
// offset is parsed as-is. Returns null for unparseable input.
function parseEasternDatetime(s) {
  if (!s) return null;
  const raw = String(s);
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, y, mo, d, h, mi, sec] = match;
  const naiveUtc = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(sec || 0)));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(naiveUtc).map(p => [p.type, p.value]));
  const asEasternWall = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    parts.hour === '24' ? 0 : +parts.hour, +parts.minute, +parts.second
  );
  const offsetMs = naiveUtc.getTime() - asEasternWall;
  return new Date(naiveUtc.getTime() + offsetMs);
}

function validateInfoSession(data) {
  const required = ['firstName', 'lastName', 'email', 'phone', 'zipCode', 'infoSessionDate'];
  for (const k of required) {
    if (!data[k] || String(data[k]).trim().length === 0) return 'Missing required field: ' + k;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Invalid email address';
  if (!/^[0-9]{5}$/.test(data.zipCode)) return 'Invalid zip code';
  const phoneDigits = String(data.phone).replace(/\D/g, '');
  if (phoneDigits.length < 10) return 'Invalid phone number';
  if (isNaN(new Date(data.infoSessionDate).getTime())) return 'Invalid info session date';
  return null;
}

// ──────────────────────────────────────────────
// APPLICATION VALIDATION
// ──────────────────────────────────────────────

function validateApplication(data) {
  const required = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'zipCode', 'neighborhood', 'primaryLanguage', 'employmentStatus', 'educationLevel', 'referralSource', 'motivationNow', 'motivationGoal'];
  for (const k of required) {
    if (!data[k] || String(data[k]).trim().length === 0) return 'Missing required field: ' + k;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Invalid email address';
  if (!/^[0-9]{5}$/.test(data.zipCode)) return 'Invalid zip code';
  const phoneDigits = String(data.phone).replace(/\D/g, '');
  if (phoneDigits.length < 10) return 'Invalid phone number';
  if (!data.daytimeAvailable) return 'Daytime availability is required for this program';

  const dob = new Date(data.dateOfBirth);
  if (isNaN(dob.getTime())) return 'Invalid date of birth';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  if (age < 18) return 'You must be 18 or older to apply';
  if (age > 120) return 'Invalid date of birth';

  if (String(data.motivationNow).trim().length < 50) return 'Motivation (where you are now) must be at least 50 characters';
  if (String(data.motivationGoal).trim().length < 50) return 'Motivation (success after RTS) must be at least 50 characters';

  return null;
}

// ──────────────────────────────────────────────
// SALESFORCE REST API (login, lookup, PATCH)
// ──────────────────────────────────────────────

async function sfLogin(sfCreds) {
  const loginBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Body>
    <urn:login>
      <urn:username>${escapeXml(sfCreds.username)}</urn:username>
      <urn:password>${escapeXml(sfCreds.password)}</urn:password>
    </urn:login>
  </soapenv:Body>
</soapenv:Envelope>`;

  const loginRes = await fetch('https://login.salesforce.com/services/Soap/u/62.0', {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', 'SOAPAction': 'login' },
    body: loginBody,
  });

  const loginText = await loginRes.text();
  const sessionMatch = loginText.match(/<sessionId>([^<]+)<\/sessionId>/);
  const serverUrlMatch = loginText.match(/<serverUrl>([^<]+)<\/serverUrl>/);
  if (!sessionMatch || !serverUrlMatch) {
    const faultMatch = loginText.match(/<faultcode>([^<]+)<\/faultcode>/);
    const faultStrMatch = loginText.match(/<faultstring>([^<]+)<\/faultstring>/);
    throw new Error('Salesforce login failed: ' + (faultMatch ? faultMatch[1] : 'unknown') + ' — ' + (faultStrMatch ? faultStrMatch[1].slice(0, 200) : loginText.slice(0, 200)));
  }

  return {
    sessionId: sessionMatch[1],
    instanceUrl: 'https://' + serverUrlMatch[1].replace(/^https:\/\//, '').replace(/\/.*$/, ''),
  };
}

async function findLeadByEmail(email, sfCreds) {
  const { sessionId, instanceUrl } = await sfLogin(sfCreds);

  const soql = `SELECT Id, Email, RecordType.DeveloperName, IsConverted FROM Lead WHERE Email = '${escapeSOQL(email)}' AND IsConverted = false ORDER BY CreatedDate DESC LIMIT 1`;
  const queryUrl = `${instanceUrl}/services/data/v62.0/query?q=${encodeURIComponent(soql)}`;

  const queryRes = await fetch(queryUrl, { headers: { 'Authorization': 'Bearer ' + sessionId } });
  if (!queryRes.ok) throw new Error('SOQL query failed: ' + queryRes.status);

  const queryData = await queryRes.json();
  if (!queryData.records || queryData.records.length === 0) return null;

  const record = queryData.records[0];
  return {
    id: record.Id,
    email: record.Email,
    recordType: record.RecordType && record.RecordType.DeveloperName,
    sessionId,
    instanceUrl,
  };
}

async function promoteLeadToApplicant(existingLead, data, opts) {
  const { instanceUrl, sessionId, recordTypeId, cohortId, cohortName } = opts;

  const motivationCombined =
    'Where I am now:\n' + data.motivationNow + '\n\n' +
    'Success after RTS:\n' + data.motivationGoal;

  const body = {
    FirstName: data.firstName,
    LastName: data.lastName,
    Phone: data.phone,
    Company: 'N/A',
    LeadSource: 'Wesbite_msimbo.org',
    [SF_API_NAMES.dateOfBirth]: data.dateOfBirth,
    [SF_API_NAMES.zipCode]: data.zipCode,
    [SF_API_NAMES.daytimeAvailable]: Boolean(data.daytimeAvailable),
    [SF_API_NAMES.neighborhood]: data.neighborhood,
    [SF_API_NAMES.primaryLanguage]: data.primaryLanguage,
    [SF_API_NAMES.employmentStatus]: data.employmentStatus,
    [SF_API_NAMES.educationLevel]: data.educationLevel,
    [SF_API_NAMES.referralSource]: data.referralSource,
    [SF_API_NAMES.motivation]: motivationCombined,
  };

  if (recordTypeId) body.RecordTypeId = String(recordTypeId).slice(0, 15);
  if (cohortId) body[SF_API_NAMES.cohort] = String(cohortId).slice(0, 15);
  if (cohortName) body[SF_API_NAMES.cohortName] = cohortName;

  const patchUrl = `${instanceUrl}/services/data/v62.0/sobjects/Lead/${existingLead.id}`;

  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + sessionId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Lead PATCH failed: ' + res.status + ' ' + text);
  }
}

async function createApplicantViaRest(data, opts) {
  const { instanceUrl, username, password, recordTypeId, cohortId, cohortName } = opts;
  const { sessionId, instanceUrl: resolvedUrl } = await sfLogin({ username, password });

  const motivationCombined =
    'Where I am now:\n' + data.motivationNow + '\n\n' +
    'Success after RTS:\n' + data.motivationGoal;

  const body = {
    FirstName: data.firstName,
    LastName: data.lastName,
    Email: data.email,
    Phone: data.phone,
    Company: 'N/A',
    LeadSource: 'Wesbite_msimbo.org',
    [SF_API_NAMES.dateOfBirth]: data.dateOfBirth,
    [SF_API_NAMES.zipCode]: data.zipCode,
    [SF_API_NAMES.daytimeAvailable]: Boolean(data.daytimeAvailable),
    [SF_API_NAMES.neighborhood]: data.neighborhood,
    [SF_API_NAMES.primaryLanguage]: data.primaryLanguage,
    [SF_API_NAMES.employmentStatus]: data.employmentStatus,
    [SF_API_NAMES.educationLevel]: data.educationLevel,
    [SF_API_NAMES.referralSource]: data.referralSource,
    [SF_API_NAMES.motivation]: motivationCombined,
  };

  if (recordTypeId) body.RecordTypeId = String(recordTypeId).slice(0, 15);
  if (cohortId) body[SF_API_NAMES.cohort] = String(cohortId).slice(0, 15);
  if (cohortName) body[SF_API_NAMES.cohortName] = cohortName;

  const url = `${instanceUrl || resolvedUrl}/services/data/v62.0/sobjects/Lead/`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + sessionId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Lead INSERT failed: ' + res.status + ' ' + text);
  }
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeSOQL(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ──────────────────────────────────────────────
// LEGACY SWIPEONE INFO-SESSION FLOW
// Kept as fallback when USE_SF_INFO_SESSION is not set.
// Remove once SF path is verified stable.
// ──────────────────────────────────────────────

async function submitToSwipeOne(data, headers) {
  const { SWIPEONE_API_KEY } = process.env;
  let workspaceId = process.env.SWIPEONE_WORKSPACE_ID || '';

  const wsMatch = workspaceId.match(/workspaces\/([a-f0-9]+)/);
  if (wsMatch) workspaceId = wsMatch[1];

  if (!SWIPEONE_API_KEY || !workspaceId) {
    console.error('Missing SwipeOne credentials');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const contactPayload = {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email,
    phone: data.phone || '',
    address: { zipcode: data.zipCode || '' },
  };

  if (data.signupType === 'info_session' && data.infoSessionDate) {
    contactPayload.subscription_created_date = new Date(data.infoSessionDate).toISOString();
  }

  try {
    const contactRes = await fetch(
      `https://api.swipeone.com/api/workspaces/${workspaceId}/contacts`,
      {
        method: 'POST',
        headers: { 'x-api-key': SWIPEONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(contactPayload),
      }
    );

    const contactData = await contactRes.json();

    if (!contactRes.ok) {
      console.error('SwipeOne contact creation failed:', contactData);
      return { statusCode: contactRes.status, headers, body: JSON.stringify({ error: 'Failed to create contact', detail: contactData.message }) };
    }

    const contactId = contactData.data?.contact?._id;

    if (contactId) {
      let existingTags = [];
      try {
        const tagsRes = await fetch(
          `https://api.swipeone.com/api/workspaces/${workspaceId}/tags`,
          { headers: { 'x-api-key': SWIPEONE_API_KEY } }
        );
        const tagsData = await tagsRes.json();
        existingTags = tagsData.data?.tags || [];
      } catch (e) {
        console.error('Failed to fetch tags (non-blocking):', e.message);
      }

      const existingTagNames = new Map(existingTags.map(t => [t.label, t.name]));
      function resolveTag(label, color) {
        const existing = existingTagNames.get(label);
        return existing ? existing : { label, color };
      }

      const tagLabel = data.signupType === 'info_session' ? 'Info Session Lead' : 'Application Lead';
      const tags = [
        resolveTag(tagLabel, 'red'),
        resolveTag('Landing Page', 'blue'),
      ];

      if (data.signupType === 'info_session' && data.infoSessionDate) {
        const d = new Date(data.infoSessionDate);
        const dateLabel = `Session: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        tags.push(resolveTag(dateLabel, 'cyan'));
      }

      await fetch(
        `https://api.swipeone.com/api/contacts/${contactId}/tags`,
        { method: 'POST', headers: { 'x-api-key': SWIPEONE_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }) }
      ).catch(err => console.error('Tag assignment failed (non-blocking):', err.message));

      const eventType = data.signupType === 'info_session' ? 'info_session_registered' : 'application_submitted';
      const eventPayload = {
        type: eventType,
        contact: { email: data.email },
        properties: {
          lead_source: data.leadSource || 'Landing Page',
          utm_source: data.utmSource || '',
          utm_medium: data.utmMedium || '',
          utm_campaign: data.utmCampaign || '',
          utm_content: data.utmContent || '',
          utm_term: data.utmTerm || '',
          zip_code: data.zipCode || '',
          submitted_at: data.submittedAt || new Date().toISOString(),
        },
      };
      if (data.signupType === 'info_session' && data.infoSessionDate) {
        eventPayload.properties.info_session_date = data.infoSessionDate;
      }

      await fetch(
        `https://api.swipeone.com/api/workspaces/${workspaceId}/events`,
        { method: 'POST', headers: { 'x-api-key': SWIPEONE_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(eventPayload) }
      ).catch(err => console.error('Event firing failed (non-blocking):', err.message));
    }

    return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', contactId }) };
  } catch (err) {
    console.error('SwipeOne API error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
