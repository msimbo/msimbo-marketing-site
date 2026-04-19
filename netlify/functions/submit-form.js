/**
 * Netlify Serverless Function — Form submission proxy
 *
 * Routes:
 *   signupType === 'application' → Salesforce Web-to-Lead (RTS Cohort 1)
 *   signupType === 'info_session' → SwipeOne CRM (marketing nurture)
 *
 * Required Netlify environment variables:
 *   SF_ORG_ID                 — Salesforce 15-char Org ID (e.g., 00D50000000cxiS)
 *   SF_RTS_COHORT_ID          — 15-char Cohort record ID (e.g., a1JUV000005GKMT)
 *   SF_RECORD_TYPE_ID         — 15-char RTS_Applicant RecordType Id (e.g., 012UV000003WmSn)
 *   SF_INSTANCE_URL           — e.g., https://ulem.my.salesforce.com
 *   SF_DUPE_CHECK_USERNAME    — integration user username (for SOQL duplicate check)
 *   SF_DUPE_CHECK_PASSWORD    — integration user password + security token
 *   SWIPEONE_API_KEY          — SwipeOne API key (for info-session flow)
 *   SWIPEONE_WORKSPACE_ID     — SwipeOne workspace ID
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
    return submitToSalesforce(data, headers);
  }

  return submitToSwipeOne(data, headers);
};

// ──────────────────────────────────────────────
// SALESFORCE APPLICATION FLOW
// ──────────────────────────────────────────────

async function submitToSalesforce(data, headers) {
  const {
    SF_ORG_ID,
    SF_RTS_COHORT_ID,
    SF_RECORD_TYPE_ID,
    SF_INSTANCE_URL,
    SF_DUPE_CHECK_USERNAME,
    SF_DUPE_CHECK_PASSWORD,
  } = process.env;

  if (!SF_ORG_ID) {
    console.error('Missing SF_ORG_ID');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // Server-side validation
  const err = validateApplication(data);
  if (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err }) };
  }

  // Duplicate check (best-effort; non-blocking if creds missing)
  if (SF_INSTANCE_URL && SF_DUPE_CHECK_USERNAME && SF_DUPE_CHECK_PASSWORD) {
    try {
      const isDuplicate = await checkDuplicateLead(data.email, {
        instanceUrl: SF_INSTANCE_URL,
        username: SF_DUPE_CHECK_USERNAME,
        password: SF_DUPE_CHECK_PASSWORD,
      });
      if (isDuplicate) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            error: "You've already applied to RTS Cohort 1 with this email. If this seems wrong, contact program-rts@ulem.org.",
          }),
        };
      }
    } catch (e) {
      console.error('Duplicate check failed (continuing):', e.message);
    }
  }

  // Combine motivation answers into one field
  const motivationCombined =
    'Where I am now:\n' + data.motivationNow + '\n\n' +
    'Success after RTS:\n' + data.motivationGoal;

  // Build Web-to-Lead form-encoded body
  const params = new URLSearchParams();
  // Web-to-Lead requires a 15-char Org ID — slice defensively in case an 18-char ID was provided.
  params.append('oid', String(SF_ORG_ID).slice(0, 15));
  params.append('first_name', data.firstName);
  params.append('last_name', data.lastName);
  params.append('email', data.email);
  params.append('phone', data.phone);
  params.append('company', 'N/A');
  params.append('lead_source', 'Wesbite_msimbo.org');

  // recordType hidden field sets the RecordTypeId at create time. Web-to-Lead accepts 15-char.
  if (SF_RECORD_TYPE_ID) params.append('recordType', String(SF_RECORD_TYPE_ID).slice(0, 15));

  params.append(SF_FIELDS.dateOfBirth, data.dateOfBirth);
  params.append(SF_FIELDS.zipCode, data.zipCode);
  params.append(SF_FIELDS.daytimeAvailable, data.daytimeAvailable ? '1' : '0');
  params.append(SF_FIELDS.neighborhood, data.neighborhood);
  params.append(SF_FIELDS.primaryLanguage, data.primaryLanguage);
  params.append(SF_FIELDS.employmentStatus, data.employmentStatus);
  params.append(SF_FIELDS.educationLevel, data.educationLevel);
  params.append(SF_FIELDS.referralSource, data.referralSource);
  params.append(SF_FIELDS.motivation, motivationCombined);
  // Cohort lookup field — use 15-char truncation to be safe
  if (SF_RTS_COHORT_ID) params.append(SF_FIELDS.cohort, String(SF_RTS_COHORT_ID).slice(0, 15));

  try {
    const sfRes = await fetch('https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    // Salesforce Web-to-Lead always returns 200 with HTML — there's no JSON response.
    // The only way to verify the lead was created is via a subsequent SOQL query.
    if (!sfRes.ok) {
      console.error('Salesforce W2L returned status:', sfRes.status);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Submission failed. Please try again or contact program-rts@ulem.org.' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'success' }),
    };
  } catch (err) {
    console.error('Salesforce W2L error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

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

  // Age check (18+)
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

async function checkDuplicateLead(email, sfCreds) {
  // Salesforce SOAP login to get session ID, then SOQL via REST
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
    headers: {
      'Content-Type': 'text/xml; charset=UTF-8',
      'SOAPAction': 'login',
    },
    body: loginBody,
  });

  const loginText = await loginRes.text();
  const sessionMatch = loginText.match(/<sessionId>([^<]+)<\/sessionId>/);
  const serverUrlMatch = loginText.match(/<serverUrl>([^<]+)<\/serverUrl>/);
  if (!sessionMatch || !serverUrlMatch) {
    throw new Error('Salesforce login failed');
  }

  const sessionId = sessionMatch[1];
  const instanceHost = serverUrlMatch[1].replace(/^https:\/\//, '').replace(/\/.*$/, '');

  const soql = `SELECT Id FROM Lead WHERE Email = '${escapeSOQL(email)}' AND IsConverted = false AND RTS_Cohort__c != null LIMIT 1`;
  const queryUrl = `https://${instanceHost}/services/data/v62.0/query?q=${encodeURIComponent(soql)}`;

  const queryRes = await fetch(queryUrl, {
    headers: { 'Authorization': 'Bearer ' + sessionId },
  });

  if (!queryRes.ok) throw new Error('SOQL query failed: ' + queryRes.status);

  const queryData = await queryRes.json();
  return (queryData.records && queryData.records.length > 0);
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
// SWIPEONE INFO-SESSION FLOW (unchanged)
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
