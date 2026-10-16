// "Prefer we call you?" form on /booking/.
//
// Owner: Tom. The form posted to this path from May 2026 while no function
// existed, so every request 404'd and the lead sat in the visitor's own
// browser. This mails the front desk and files the lead in the clinic CRM.
//
// Answers {ok:true} only once the internal email is accepted, so the page
// shows its receipt only for a request someone will actually see.

import { geoFromContext } from './shared/geo.js';
import { sendEmail } from './send-email.js';
import { checkSubmission, logBlocked, safeName } from './shared/antispam.js';

const INBOX = 'hello@moonshotmp.com';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// US numbers only: 10 digits, or 11 with a leading country code 1.
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits[0] === '1') return digits;
  return '';
}

function formatPhone(digits) {
  const d = digits.length === 11 ? digits.slice(1) : digits;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// Short slugs only (quiz name, result tier, page path). Anything else is
// dropped so the email and CRM never carry free text from the request.
function slug(raw, max = 60) {
  if (typeof raw !== 'string') return '';
  const v = raw.trim().slice(0, max);
  return /^[A-Za-z0-9_\-./]*$/.test(v) ? v : '';
}

function pageUrl(raw) {
  if (typeof raw !== 'string') return '';
  try {
    const u = new URL(raw);
    if (u.hostname !== 'moonshotmp.com' && !u.hostname.endsWith('.moonshotmp.com')) return '';
    return u.origin + u.pathname;
  } catch (e) {
    return '';
  }
}

function row(label, value) {
  return `<p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">${label}: ${value || 'unknown'}</p>`;
}

export default async function handler(req, context) {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  let data;
  try {
    data = await req.json();
  } catch (e) {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  if (!data || typeof data !== 'object') {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const name = typeof data.name === 'string' ? data.name.trim().slice(0, 80) : '';
  const htmlName = safeName(data.name);
  const phone = normalizePhone(data.phone);

  if (!name || !phone) {
    return json({ ok: false, error: 'Name and a 10-digit phone number are required' }, 400);
  }

  // Timing and honeypot checks only. The Gmail-dots rule exists to stop
  // forms from mailing third parties; this form mails only our own inbox,
  // so an unusual optional email must not drop a real phone request.
  const guard = checkSubmission({ website: data.website, elapsed_ms: data.elapsed_ms });
  if (!guard.ok) {
    logBlocked('booking-callback', guard.reason);
    // A person can trip the timing checks (tab open for hours, autofill and
    // an instant submit). Answer those with an error so the page tells them
    // to call or text instead of showing a receipt for a dropped request.
    // Honeypot and missing guard fields stay silent, so a bot learns nothing.
    if (guard.reason === 'too_fast' || guard.reason === 'stale') {
      return json({ ok: false, error: 'Please call or text us' }, 422);
    }
    return json({ ok: true });
  }

  // Optional. The clinic lead webhook files a lead only with an email (its
  // phone-only path is reserved for the chat and voice agents), so the CRM
  // sync runs only when the visitor gives one; the email to the front desk
  // is the record either way.
  const rawEmail = typeof data.email === 'string' ? data.email.trim() : '';
  const email = rawEmail.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(rawEmail) ? rawEmail : '';

  const source = slug(data.source);
  const result = slug(data.result);
  const page = pageUrl(data.page_url);
  const geo = geoFromContext(context);
  const displayPhone = formatPhone(phone);

  const html = `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">Callback Request</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">From the booking page. Call within 1 business day.</p>
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Contact</p>
        ${row('Name', htmlName)}
        ${row('Phone', `<a href="tel:+1${phone.slice(-10)}" style="color: #F0EEE9;">${displayPhone}</a>`)}
        ${row('Email', email || 'not given')}
      </div>
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Source</p>
        ${row('Source', source)}
        ${row('Result', result)}
        ${row('Page', page)}
        ${row('Location', [geo.geo_state, geo.geo_country].filter(Boolean).join(', '))}
      </div>
    </div>
  </div>
</body>
</html>`;

  const sent = await sendEmail({
    to: INBOX,
    subject: `Callback request: ${name} ${displayPhone}`,
    html,
  });
  if (!sent || !sent.ok) {
    console.error('[booking-callback] internal email failed');
    return json({ ok: false, error: 'Email send failed' }, 502);
  }

  // The email above is the receipt of record; a CRM sync failure is logged
  // and does not fail the request.
  if (email) {
    const clinicApi = process.env.CLINIC_API_BASE || 'https://api.moonshotclinic.com';
    try {
      const res = await fetch(clinicApi + '/api/leads/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Slug': 'moonshot',
          'X-Webhook-Key': process.env.CLINIC_LEAD_WEBHOOK_KEY || '',
        },
        // 'website_form' is the clinic webhook's allowlisted value for site forms.
        body: JSON.stringify({
          name,
          email,
          phone,
          source: 'website_form',
          quiz_type: 'callback_request',
          state: '',
          geo_state: geo.geo_state,
          geo_country: geo.geo_country,
          booking_source: source,
          booking_result: result,
          page_url: page,
        }),
      });
      if (!res.ok) console.error('[booking-callback] clinic lead sync status', res.status);
    } catch (err) {
      console.error('[booking-callback] clinic lead sync error:', err.message);
    }
  }

  return json({ ok: true });
}
