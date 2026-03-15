/**
 * Meta Conversions API (CAPI) — Server-Side Event Relay
 *
 * Receives events from the client-side tracking script,
 * enriches with server-side data (IP, user agent), and
 * forwards to the Meta Graph API for conversion tracking.
 */

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
const API_VERSION = 'v25.0';
const META_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.error('[meta-capi] Missing META_PIXEL_ID or META_CAPI_TOKEN env vars');
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { event_name, event_source_url, event_id, fbc, fbp } = body;

  if (!event_name) {
    return jsonResponse({ error: 'event_name required' }, 400);
  }

  // Build the CAPI payload
  const eventData = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: event_id || crypto.randomUUID(),
    event_source_url: event_source_url || '',
    action_source: 'website',
    user_data: {
      client_ip_address: getClientIP(req),
      client_user_agent: req.headers.get('user-agent') || '',
    },
  };

  // Add cookie-based identifiers if present
  if (fbc) eventData.user_data.fbc = fbc;
  if (fbp) eventData.user_data.fbp = fbp;

  try {
    const metaRes = await fetch(`${META_URL}?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [eventData] }),
    });

    const metaBody = await metaRes.json();

    if (!metaRes.ok) {
      console.error('[meta-capi] Meta API error:', JSON.stringify(metaBody));
      return jsonResponse({ ok: false, error: metaBody }, metaRes.status);
    }

    return jsonResponse({ ok: true, events_received: metaBody.events_received });
  } catch (err) {
    console.error('[meta-capi] Fetch error:', err.message);
    return jsonResponse({ ok: false, error: 'Meta API request failed' }, 502);
  }
}

function getClientIP(req) {
  // Netlify sets x-nf-client-connection-ip
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://moonshotmp.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}
