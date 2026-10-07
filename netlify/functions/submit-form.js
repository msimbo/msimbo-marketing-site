/**
 * Netlify Serverless Function — Form submission proxy
 *
 * Routes:
 *   signupType === 'application'  → Salesforce REST (uses SF login)
 *                                    - If existing Info Session Lead: PATCH to promote (flip RecordType to Applicant)
 *                                    - Else: REST insert (create as Applicant). W2L can't reliably populate
 *                                      lookup fields (RTS_Cohort__c) before validation rules run.
 *                                    - If existing RTS Applicant who already applied to the current cohort: 409
 *                                    - Any promoted Lead (Info Session, waitlist, prior cohort): PATCH onto the
 *                                      current cohort. Status 'RTS - Assessment Complete' if they passed the
 *                                      assessment in the last 12 months, else 'RTS - Assessment Pending' with
 *                                      fresh attempts. Previous-cycle details are archived to Description.
 *                                    - Possible duplicates / returning applicants get a coordinator Task
 *   signupType === 'waitlist'     → Salesforce REST insert (RTS_Applicant RecordType,
 *                                   Status='RTS - Waitlisted', linked to the current cohort)
 *   signupType === 'info_session' → Salesforce Web-to-Lead (RTS_Info_Session RecordType)
 *                                   + n8n webhook (Google Calendar invite)
 *
 * The current cohort is looked up at submit time: the RTS_Cohort__c with Status__c = 'Recruiting'
 * and the latest Start_Date__c. Opening a new cohort is a Salesforce data change, not a redeploy.
 *
 * Required Netlify environment variables:
 *   SF_ORG_ID                       — Salesforce 15-char Org ID (info-session W2L only)
 *   SF_RTS_COHORT_ID                — Fallback cohort ID for applications if no cohort is Recruiting
 *   SF_RTS_COHORT_NAME              — Fallback cohort name (e.g., "RTS - Cohort 2 - Fall 2026 (FY27 - C1)")
 *   SF_RTS_COHORT_2_ID              — Fallback cohort ID for the waitlist if no cohort is Recruiting
 *   SF_RTS_COHORT_2_NAME            — Fallback cohort name for the waitlist
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
  instructorInviteSent: 'RTS_Instructor_Invite_Sent__c',
  cmInviteSent: 'RTS_CM_Invite_Sent__c',
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

  if (data.signupType === 'waitlist') {
    return submitWaitlist(data, headers);
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

  let cohort;
  try {
    cohort = await resolveRecruitingCohort(
      { fallbackId: SF_RTS_COHORT_ID, fallbackName: SF_RTS_COHORT_NAME },
      existingLead || { username: SF_DUPE_CHECK_USERNAME, password: SF_DUPE_CHECK_PASSWORD },
    );
  } catch (e) {
    console.error('Cohort lookup failed:', e.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Submission failed. Please try again or contact program-rts@ulem.org.' }),
    };
  }

  if (existingLead) {
    // Only block a full application (DOB is set by the application form) to the
    // cohort currently recruiting. Waitlist sign-ups and prior-cohort applicants
    // re-apply by being moved onto the current cohort.
    const appliedToCurrentCohort =
      existingLead.recordType === 'RTS_Applicant' &&
      existingLead.hasApplication &&
      sameSfId(existingLead.cohortId, cohort.id);

    if (appliedToCurrentCohort) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: "You've already applied to the current RTS cohort with this email. If this seems wrong, contact program-rts@ulem.org.",
        }),
      };
    }

    // Any other existing Lead (Info Session, waitlist, prior cohort, legacy Student Lead, etc.)
    // → promote the existing Lead in-place via REST PATCH. Creating a second Lead via W2L would
    // either duplicate or (as we've seen) get silently rejected by SF.
    try {
      // Every promoted Lead restarts the pipeline: Assessment Pending (assessment email),
      // or Assessment Complete when they passed within the last 12 months.
      const outcome = await promoteLeadToApplicant(existingLead, data, {
        instanceUrl: existingLead.instanceUrl,
        sessionId: existingLead.sessionId,
        recordTypeId: SF_RECORD_TYPE_ID,
        cohortId: cohort.id,
        cohortName: cohort.name,
      });
      await createReapplicantTask(existingLead.id, data, existingLead, {
        otherLeadIds: existingLead.otherLeadIds,
        ...outcome,
      }).catch((e) => console.error('Re-applicant task failed:', e.message));
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
    const created = await createApplicantViaRest(data, {
      instanceUrl: SF_INSTANCE_URL,
      username: SF_DUPE_CHECK_USERNAME,
      password: SF_DUPE_CHECK_PASSWORD,
      recordTypeId: SF_RECORD_TYPE_ID,
      cohortId: cohort.id,
      cohortName: cohort.name,
    });
    // A new email can still be a returning person (different email, or converted before).
    await createReapplicantTask(created.id, data, created, {})
      .catch((e) => console.error('Re-applicant task failed:', e.message));
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
// WAITLIST FLOW (Cohort 2 early-notice list)
// ──────────────────────────────────────────────

async function submitWaitlist(data, headers) {
  const {
    SF_RTS_COHORT_2_ID,
    SF_RTS_COHORT_2_NAME,
    SF_RECORD_TYPE_ID,
    SF_INSTANCE_URL,
    SF_DUPE_CHECK_USERNAME,
    SF_DUPE_CHECK_PASSWORD,
  } = process.env;

  const err = validateWaitlist(data);
  if (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err }) };
  }

  if (!SF_INSTANCE_URL || !SF_DUPE_CHECK_USERNAME || !SF_DUPE_CHECK_PASSWORD) {
    console.error('Missing SF credentials for waitlist insert');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // If a Lead already exists with this email, treat as "already on the list"
  // and succeed silently rather than creating a duplicate.
  let existingLead;
  try {
    existingLead = await findLeadByEmail(data.email, {
      instanceUrl: SF_INSTANCE_URL,
      username: SF_DUPE_CHECK_USERNAME,
      password: SF_DUPE_CHECK_PASSWORD,
    });
  } catch (e) {
    console.error('Waitlist lookup failed:', e.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Submission failed. Please try again or contact program-rts@ulem.org.' }),
    };
  }

  if (existingLead) {
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'success', alreadyOnList: true }) };
  }

  try {
    const cohort = await resolveRecruitingCohort(
      { fallbackId: SF_RTS_COHORT_2_ID, fallbackName: SF_RTS_COHORT_2_NAME },
      { username: SF_DUPE_CHECK_USERNAME, password: SF_DUPE_CHECK_PASSWORD },
    );
    await createWaitlistViaRest(data, {
      instanceUrl: SF_INSTANCE_URL,
      username: SF_DUPE_CHECK_USERNAME,
      password: SF_DUPE_CHECK_PASSWORD,
      recordTypeId: SF_RECORD_TYPE_ID,
      cohortId: cohort.id,
      cohortName: cohort.name,
    });
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'success' }) };
  } catch (e) {
    console.error('Waitlist Lead create failed:', e.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Submission failed. Please try again or contact program-rts@ulem.org.' }),
    };
  }
}

function validateWaitlist(data) {
  const required = ['firstName', 'lastName', 'email', 'phone'];
  for (const k of required) {
    if (!data[k] || String(data[k]).trim().length === 0) return 'Missing required field: ' + k;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Invalid email address';
  const phoneDigits = String(data.phone).replace(/\D/g, '');
  if (phoneDigits.length < 10) return 'Invalid phone number';
  return null;
}

async function createWaitlistViaRest(data, opts) {
  const { username, password, recordTypeId, cohortId, cohortName } = opts;
  const { sessionId, instanceUrl } = await sfLogin({ username, password });

  const body = {
    FirstName: data.firstName,
    LastName: data.lastName,
    Email: data.email,
    Phone: data.phone,
    Company: 'N/A',
    LeadSource: 'Wesbite_msimbo.org',
    Status: 'RTS - Waitlisted',
  };

  if (recordTypeId) body.RecordTypeId = String(recordTypeId).slice(0, 15);
  if (cohortId) body[SF_API_NAMES.cohort] = String(cohortId).slice(0, 15);
  if (cohortName) body[SF_API_NAMES.cohortName] = cohortName;

  const url = `${instanceUrl}/services/data/v62.0/sobjects/Lead/`;

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
    throw new Error('Waitlist Lead INSERT failed: ' + res.status + ' ' + text);
  }
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

// Fields read off an existing Lead so a re-application can archive the previous
// cycle and decide whether the assessment carries over.
const PREVIOUS_CYCLE_FIELDS = [
  'Status', 'Description', 'RTS_Cohort_Name__c',
  'RTS_Assessment_Status__c', 'RTS_Assessment_Date__c', 'RTS_Assessment_Attempts__c', 'RTS_Assessment_Notes__c',
  'RTS_CCAT_Score__c', 'RTS_CBST2_Score__c', 'RTS_CLIK_Score__c',
  'RTS_Instructor_Interview_DateTime__c', 'RTS_Instructor_Interview_Outcome__c', 'RTS_Instructor_Interview_Notes__c',
  'RTS_CM_Interview_DateTime__c', 'RTS_CM_Interview_Outcome__c', 'RTS_CM_Interview_Notes__c',
  'RTS_Decision__c', 'RTS_Decision_Reason__c', 'RTS_Decision_Date__c',
  'RTS_Offer_Sent_Date__c', 'RTS_Offer_Response__c', 'RTS_Offer_Response_Date__c',
];

// Which Lead to reuse when several share an email: an RTS Applicant first, then an
// Info Session sign-up, then anything else (Donor, Student, ...). Newest wins within a tier.
const RECORD_TYPE_PRIORITY = ['RTS_Applicant', 'RTS_Info_Session'];

async function findLeadByEmail(email, sfCreds) {
  const { sessionId, instanceUrl } = await sfLogin(sfCreds);

  const soql = `SELECT Id, Email, RecordType.DeveloperName, ${SF_API_NAMES.cohort}, ${SF_API_NAMES.dateOfBirth}, ${PREVIOUS_CYCLE_FIELDS.join(', ')} FROM Lead WHERE Email = '${escapeSOQL(email)}' AND IsConverted = false ORDER BY CreatedDate DESC LIMIT 20`;
  const queryData = await sfQuery(soql, { sessionId, instanceUrl });
  if (!queryData.records || queryData.records.length === 0) return null;

  const rank = (r) => {
    const i = RECORD_TYPE_PRIORITY.indexOf(r.RecordType && r.RecordType.DeveloperName);
    return i === -1 ? RECORD_TYPE_PRIORITY.length : i;
  };
  // Array.prototype.sort is stable, so CreatedDate DESC order holds within a tier.
  const records = queryData.records.slice().sort((x, y) => rank(x) - rank(y));
  const record = records[0];

  return {
    id: record.Id,
    email: record.Email,
    status: record.Status,
    recordType: record.RecordType && record.RecordType.DeveloperName,
    cohortId: record[SF_API_NAMES.cohort],
    hasApplication: Boolean(record[SF_API_NAMES.dateOfBirth]),
    record,
    otherLeadIds: records.slice(1).map((r) => r.Id),
    sessionId,
    instanceUrl,
  };
}

// The cohort new applicants join: the RTS_Cohort__c in Recruiting status with the
// latest start date (same rule as RTS Flow 1c). Env vars are only a fallback for
// when no cohort is marked Recruiting.
async function resolveRecruitingCohort(fallback, sfAuth) {
  const session = sfAuth.sessionId ? sfAuth : await sfLogin(sfAuth);
  const soql = "SELECT Id, Name FROM RTS_Cohort__c WHERE Status__c = 'Recruiting' ORDER BY Start_Date__c DESC NULLS LAST LIMIT 1";
  const queryData = await sfQuery(soql, session);
  const record = queryData.records && queryData.records[0];
  if (record) return { id: record.Id, name: record.Name };

  if (!fallback.fallbackId) throw new Error('No Recruiting RTS cohort and no fallback cohort env var');
  console.warn('No Recruiting RTS cohort found; using env fallback', fallback.fallbackName);
  return { id: fallback.fallbackId, name: fallback.fallbackName };
}

async function sfQuery(soql, { sessionId, instanceUrl }) {
  const queryUrl = `${instanceUrl}/services/data/v62.0/query?q=${encodeURIComponent(soql)}`;
  const queryRes = await fetch(queryUrl, { headers: { 'Authorization': 'Bearer ' + sessionId } });
  if (!queryRes.ok) throw new Error('SOQL query failed: ' + queryRes.status + ' ' + (await queryRes.text()).slice(0, 200));
  return queryRes.json();
}

// Compares 15- and 18-char Salesforce IDs.
function sameSfId(a, b) {
  return Boolean(a && b) && String(a).slice(0, 15) === String(b).slice(0, 15);
}

async function promoteLeadToApplicant(existingLead, data, opts) {
  const { instanceUrl, sessionId, recordTypeId, cohortId, cohortName } = opts;
  const previous = existingLead.record;

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

  // A re-application starts a new cycle. Keep the old interview/decision/offer details
  // readable in Description, then clear them so the Lead doesn't look further along
  // than it is and the invitation flows (which only send while the flags are false) fire again.
  const history = describePreviousCycle(previous);
  if (history) {
    body.Description = (history + (previous.Description ? '\n\n' + previous.Description : '')).slice(0, 32000);
  }
  Object.assign(body, {
    RTS_Instructor_Interview_DateTime__c: null,
    RTS_Instructor_Interview_Outcome__c: null,
    RTS_Instructor_Interview_Notes__c: null,
    RTS_CM_Interview_DateTime__c: null,
    RTS_CM_Interview_Outcome__c: null,
    RTS_CM_Interview_Notes__c: null,
    RTS_Decision__c: null,
    RTS_Decision_Reason__c: null,
    RTS_Decision_Date__c: null,
    RTS_Offer_Sent_Date__c: null,
    RTS_Offer_Response__c: null,
    RTS_Offer_Response_Date__c: null,
    [SF_API_NAMES.instructorInviteSent]: false,
    [SF_API_NAMES.cmInviteSent]: false,
  });

  // A pass in the last 12 months carries over: straight to Assessment Complete, no
  // assessment email. Everyone else re-takes it with a fresh 2 attempts (Flow 8 caps
  // retakes at Attempts < 2, and new Leads default to Attempts = 1, Status Not Started).
  const passedOn = recentAssessmentPass(previous);
  if (passedOn) {
    body.Status = 'RTS - Assessment Complete';
  } else {
    body.Status = 'RTS - Assessment Pending';
    Object.assign(body, {
      RTS_Assessment_Status__c: 'Not Started',
      RTS_Assessment_Attempts__c: 1,
      RTS_Assessment_Date__c: null,
      RTS_Assessment_Notes__c: null,
      RTS_CCAT_Score__c: null,
      RTS_CBST2_Score__c: null,
      RTS_CLIK_Score__c: null,
    });
  }

  const patchUrl = `${instanceUrl}/services/data/v62.0/sobjects/Lead/${existingLead.id}`;

  // The Application Received email (assessment link) fires only when Status
  // changes to Assessment Pending. A lead already sitting there has to leave it first.
  if (body.Status === 'RTS - Assessment Pending' && existingLead.status === body.Status) {
    const stepRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + sessionId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Status: 'Open - Not Contacted' }),
    });
    if (!stepRes.ok) {
      throw new Error('Lead status reset failed: ' + stepRes.status + ' ' + (await stepRes.text()));
    }
  }

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

  return { passedOn, archivedHistory: Boolean(history) };
}

// Date string of an assessment pass within the last 12 months, else null.
function recentAssessmentPass(lead) {
  if (!lead || lead.RTS_Assessment_Status__c !== 'Passed' || !lead.RTS_Assessment_Date__c) return null;
  const passed = new Date(lead.RTS_Assessment_Date__c + 'T00:00:00Z');
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return passed >= cutoff ? lead.RTS_Assessment_Date__c : null;
}

// Plain-text summary of an earlier application, or '' when the Lead has none
// (e.g. an Info Session sign-up applying for the first time).
function describePreviousCycle(lead) {
  if (!lead) return '';
  const day = (v) => (v ? String(v).slice(0, 10) : '');
  const lines = [];
  const add = (label, ...parts) => {
    const text = parts.filter(Boolean).join(', ');
    if (text) lines.push(label + ': ' + text);
  };

  const assessed = lead.RTS_Assessment_Status__c && lead.RTS_Assessment_Status__c !== 'Not Started';
  if (assessed) {
    const scores = [['CCAT', lead.RTS_CCAT_Score__c], ['CBST2', lead.RTS_CBST2_Score__c], ['CLIK', lead.RTS_CLIK_Score__c]]
      .filter(([, v]) => v != null).map(([k, v]) => k + ' ' + v).join(' / ');
    add('Assessment', lead.RTS_Assessment_Status__c, day(lead.RTS_Assessment_Date__c),
      lead.RTS_Assessment_Attempts__c != null && 'attempts ' + lead.RTS_Assessment_Attempts__c, scores);
    add('Assessment notes', lead.RTS_Assessment_Notes__c);
  }
  add('Instructor interview', day(lead.RTS_Instructor_Interview_DateTime__c), lead.RTS_Instructor_Interview_Outcome__c);
  add('Instructor interview notes', lead.RTS_Instructor_Interview_Notes__c);
  add('Case manager interview', day(lead.RTS_CM_Interview_DateTime__c), lead.RTS_CM_Interview_Outcome__c);
  add('Case manager interview notes', lead.RTS_CM_Interview_Notes__c);
  add('Decision', lead.RTS_Decision__c, lead.RTS_Decision_Reason__c, day(lead.RTS_Decision_Date__c));
  add('Offer', lead.RTS_Offer_Sent_Date__c && 'sent ' + day(lead.RTS_Offer_Sent_Date__c),
    lead.RTS_Offer_Response__c, day(lead.RTS_Offer_Response_Date__c));

  if (lines.length === 0) return '';
  return [
    `--- Previous application, archived ${new Date().toISOString().slice(0, 10)} on re-apply ---`,
    `Cohort: ${lead.RTS_Cohort_Name__c || 'unknown'}; status was ${lead.Status}`,
    ...lines,
    '---',
  ].join('\n');
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

  const created = await res.json();
  return { id: created.id, sessionId, instanceUrl: instanceUrl || resolvedUrl };
}

// ──────────────────────────────────────────────
// RE-APPLICANT REVIEW TASK
// Same person under a different email (matched on phone + last name), extra RTS
// Leads with the same email, or an earlier converted application can't be merged safely
// from here (families share phones). Leave a Task for the coordinator instead.
// ──────────────────────────────────────────────

const COORDINATOR_USERNAME = 'bguzman@ulem.org';

async function createReapplicantTask(leadId, data, session, context) {
  const { otherLeadIds = [], passedOn = null, archivedHistory = false } = context;
  const matches = new Map(); // Id -> description

  const describe = (r, why) => `${r.Name} <${r.Email || 'no email'}> ${r.RecordType ? r.RecordType.DeveloperName : ''} ${r.Status || ''} — ${why} — ${session.instanceUrl}/${r.Id}`.replace(/\s+/g, ' ');

  if (otherLeadIds.length) {
    const ids = otherLeadIds.map((id) => `'${escapeSOQL(id)}'`).join(',');
    const q = await sfQuery(`SELECT Id, Name, Email, Status, RecordType.DeveloperName FROM Lead WHERE Id IN (${ids}) AND RecordType.DeveloperName IN ('RTS_Applicant', 'RTS_Info_Session')`, session);
    for (const r of q.records || []) matches.set(r.Id, describe(r, 'same email'));
  }

  // SOSL phone search ignores formatting, so (781) 300-3549 matches 7813003549.
  const digits = String(data.phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (digits.length >= 10) {
    const sosl = `FIND {${digits}} IN PHONE FIELDS RETURNING Lead(Id, Name, LastName, Email, Status, RecordType.DeveloperName WHERE IsConverted = false)`;
    const res = await fetch(`${session.instanceUrl}/services/data/v62.0/search?q=${encodeURIComponent(sosl)}`, {
      headers: { 'Authorization': 'Bearer ' + session.sessionId },
    });
    if (!res.ok) throw new Error('SOSL search failed: ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const found = await res.json();
    const lastName = String(data.lastName || '').trim().toLowerCase();
    for (const r of found.searchRecords || []) {
      if (r.Id === leadId || matches.has(r.Id)) continue;
      const isRts = r.RecordType && RECORD_TYPE_PRIORITY.includes(r.RecordType.DeveloperName);
      if (isRts && String(r.LastName || '').trim().toLowerCase() === lastName) matches.set(r.Id, describe(r, 'same phone and last name'));
    }
  }

  const converted = await sfQuery(
    `SELECT Id, Name, Email, Status, RecordType.DeveloperName, ConvertedContactId FROM Lead WHERE Email = '${escapeSOQL(data.email)}' AND IsConverted = true AND RecordType.DeveloperName = 'RTS_Applicant'`,
    session,
  );
  for (const r of converted.records || []) {
    matches.set(r.Id, describe(r, `earlier RTS application, converted to Contact ${session.instanceUrl}/${r.ConvertedContactId}`));
  }

  if (!passedOn && matches.size === 0) return;

  const lines = [];
  if (passedOn) {
    lines.push(`Returning applicant who passed the assessment on ${passedOn}. They were placed in RTS - Assessment Complete and did not get the assessment email. Move them to RTS - Interview 1 Requested when ready.`);
  }
  if (archivedHistory) lines.push('Their previous application is summarised at the top of the Description field.');
  if (matches.size) {
    lines.push('Possible earlier records for this person. Review and merge into this Lead if they are the same person:');
    for (const m of matches.values()) lines.push('- ' + m);
  }

  const owner = await sfQuery(`SELECT Id FROM User WHERE Username = '${COORDINATOR_USERNAME}' AND IsActive = true LIMIT 1`, session);
  const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const task = {
    Subject: passedOn ? 'Returning RTS applicant: assessment already passed' : 'Possible duplicate RTS applicant: review',
    WhoId: leadId,
    ActivityDate: due,
    Status: 'Not Started',
    Priority: 'Normal',
    Description: lines.join('\n').slice(0, 32000),
  };
  if (owner.records && owner.records[0]) task.OwnerId = owner.records[0].Id;

  const res = await fetch(`${session.instanceUrl}/services/data/v62.0/sobjects/Task/`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + session.sessionId, 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Task create failed: ' + res.status + ' ' + (await res.text()).slice(0, 200));
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
