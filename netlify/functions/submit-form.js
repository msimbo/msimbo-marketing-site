/**
 * Netlify Serverless Function — SwipeOne API Proxy
 *
 * Proxies form submissions from the landing page to SwipeOne CRM.
 * Keeps API credentials server-side.
 *
 * Required Netlify environment variables:
 *   SWIPEONE_API_KEY       — Your SwipeOne API key
 *   SWIPEONE_WORKSPACE_ID  — Your SwipeOne workspace ID
 */

exports.handler = async function (event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Parse body
  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { SWIPEONE_API_KEY } = process.env;
  let workspaceId = process.env.SWIPEONE_WORKSPACE_ID || '';

  // Handle case where workspace ID is a full URL instead of just the ID
  const wsMatch = workspaceId.match(/workspaces\/([a-f0-9]+)/);
  if (wsMatch) {
    workspaceId = wsMatch[1];
  }

  if (!SWIPEONE_API_KEY || !workspaceId) {
    console.error('Missing SwipeOne credentials in environment variables');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // Build SwipeOne contact payload
  const contactPayload = {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email,
    phone: data.phone || '',
    address: {
      zipcode: data.zipCode || '',
    },
  };

  // Store the selected info session date in the Subscription Created Date field
  if (data.signupType === 'info_session' && data.infoSessionDate) {
    contactPayload.subscription_created_date = new Date(data.infoSessionDate).toISOString();
  }

  try {
    // Step 1: Create or update contact in SwipeOne
    const contactRes = await fetch(
      `https://api.swipeone.com/api/workspaces/${workspaceId}/contacts`,
      {
        method: 'POST',
        headers: {
          'x-api-key': SWIPEONE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactPayload),
      }
    );

    const contactData = await contactRes.json();

    if (!contactRes.ok) {
      console.error('SwipeOne contact creation failed:', contactData);
      return {
        statusCode: contactRes.status,
        headers,
        body: JSON.stringify({ error: 'Failed to create contact', detail: contactData.message }),
      };
    }

    const contactId = contactData.data?.contact?._id;

    // Step 2: Tag the contact based on signup type
    if (contactId) {
      // Fetch existing tags to reuse them by name instead of creating duplicates
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

      // Build the tag to apply — use existing name if found, otherwise create
      function resolveTag(label, color) {
        const existing = existingTagNames.get(label);
        return existing ? existing : { label, color };
      }

      const tagLabel = data.signupType === 'info_session' ? 'Info Session Lead' : 'Application Lead';
      const tags = [
        resolveTag(tagLabel, 'red'),
        resolveTag('Landing Page', 'blue'),
      ];

      // Add info session date as a tag so it's visible on the contact
      if (data.signupType === 'info_session' && data.infoSessionDate) {
        const d = new Date(data.infoSessionDate);
        const dateLabel = `Session: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        tags.push(resolveTag(dateLabel, 'cyan'));
      }

      await fetch(
        `https://api.swipeone.com/api/contacts/${contactId}/tags`,
        {
          method: 'POST',
          headers: {
            'x-api-key': SWIPEONE_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tags }),
        }
      ).catch(function (err) {
        console.error('Tag assignment failed (non-blocking):', err.message);
      });

      // Step 3: Fire an event for tracking
      const eventType = data.signupType === 'info_session'
        ? 'info_session_registered'
        : 'application_submitted';

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
        {
          method: 'POST',
          headers: {
            'x-api-key': SWIPEONE_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        }
      ).catch(function (err) {
        console.error('Event firing failed (non-blocking):', err.message);
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'success', contactId }),
    };

  } catch (err) {
    console.error('SwipeOne API error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
