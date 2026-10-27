import { geoFromContext } from './shared/geo.js';
import { sendEmail } from './send-email.js';
import { sendQuizSmsIfConsented } from './shared/sms-consent.js';
import { safeName } from './shared/antispam.js';
import { PEPTIDES } from '../../quiz/peptides/recommendation.js';

// Escape any client-supplied text before it lands in email HTML.
const esc = (v, max = 120) => (typeof v === 'string' || typeof v === 'number')
  ? String(v).trim().slice(0, max)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  : '';

// The browser sends only peptide keys; names, prices and copy come from the
// server-side catalog so a direct POST cannot put its own content in an email.
const fromCatalog = (key) =>
  (typeof key === 'string' && Object.hasOwn(PEPTIDES, key)) ? { key, ...PEPTIDES[key] } : null;

export default async function handler(req, context) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let data;
  try {
    data = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const {
    name, email, phone,
    sms_consent: smsConsent,
    goal, goalLabel,
    concern, concernLabel,
    severity, duration, experience,
    therapy, convenience, budget,
    recommendation
  } = data;
  const rec = recommendation && typeof recommendation === 'object' ? recommendation : {};

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400 });
  }

  const primary = fromCatalog(rec.primary) || {};
  const secondary = fromCatalog(rec.secondary);
  const displayName = safeName(name);

  // ── Secondary Recommendation Card (if present) ─────────────────────
  let secondaryHtml = '';
  if (secondary) {
    secondaryHtml = `
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p style="color: #B2BFBE; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Also Worth Considering</p>
        <p style="color: #F0EEE9; font-weight: 700; font-size: 18px; margin: 0 0 6px;">${secondary.name || ''}</p>
        <p style="color: #B2BFBE; font-size: 14px; line-height: 1.5; margin: 0 0 10px;">${secondary.tagline || ''}</p>
        <p style="color: #F0EEE9; font-size: 14px; font-weight: 600; margin: 0;">$${secondary.price || '-'}/month</p>
      </div>`;
  }

  // ── User Results Email ──────────────────────────────────────────────

  const userHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">

      <h1 style="color: #F0EEE9; margin: 0 0 4px; font-size: 22px;">Your Peptide Protocol Recommendation</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Moonshot Medical and Performance</p>

      <p style="color: #B2BFBE; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Hi ${displayName || 'there'},</p>
      <p style="color: #B2BFBE; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Based on your answers, here\u2019s your personalized peptide recommendation.</p>

      <!-- Primary Recommendation Card -->
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(178,191,190,0.2); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px;">${primary.category || 'Recommended Peptide'}</p>
        <p style="color: #F0EEE9; font-weight: 700; font-size: 24px; margin: 0 0 4px;">${primary.name || ''}</p>
        ${primary.fullName ? `<p style="color: #B2BFBE; font-size: 13px; margin: 0 0 16px;">${primary.fullName}</p>` : ''}
        ${primary.tagline ? `<p style="color: #B2BFBE; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${primary.tagline}</p>` : ''}

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #B2BFBE; font-size: 13px;">Monthly Cost</td>
            <td style="padding: 8px 0; color: #F0EEE9; font-size: 14px; font-weight: 600; text-align: right;">$${primary.price || '-'}/month</td>
          </tr>
        </table>
      </div>

      <!-- Secondary Recommendation -->
      ${secondaryHtml}

      <!-- What's Included -->
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 12px;">What\u2019s Included</p>
        <ul style="color: #B2BFBE; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Pharmaceutical-grade compound from a licensed 503A pharmacy</li>
          <li>Medical oversight and dosing protocol by a board-certified provider</li>
          <li>Ongoing monitoring and protocol adjustments</li>
        </ul>
      </div>

      <!-- CTA -->
      <div style="text-align: center; padding: 24px 0;">
        <p style="color: #B2BFBE; font-size: 14px; margin: 0 0 16px;">Ready to get started?</p>
        <a href="https://moonshotmp.com/booking/" style="display: inline-block; background: #B2BFBE; color: #101921; padding: 14px 32px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 4px;">Book Your Peptide Consultation</a>
        <p style="color: #B2BFBE; font-size: 13px; margin: 16px 0 0;">Questions? Call <a href="tel:2244354280" style="color: #B2BFBE;">(224) 435-4280</a></p>
      </div>

    </div>

    <p style="color: #666; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
      This recommendation is based on your quiz responses and does not constitute medical advice.<br>
      A licensed provider will review your health history before prescribing any peptide therapy.<br>
      Moonshot Medical and Performance &middot; 542 Busse Hwy, Park Ridge, IL 60068
    </p>
    <p style="color: #666; font-size: 11px; text-align: center; margin-top: 16px;">
      <a href="https://moonshotmp.com/unsubscribe?email=${encodeURIComponent(email)}"
         style="color: #666; text-decoration: underline;">Unsubscribe from future emails</a>
    </p>
  </div>
</body>
</html>`.trim();

  const userSubject = 'Your Peptide Protocol Recommendation \u00b7 Moonshot Medical';

  // ── Lead Score ──────────────────────────────────────────────────────

  let leadScore = '\uD83D\uDFE2 NEW';
  // Budget keys come from quiz-engine.js budgetOptions.
  if (budget === '300-400' || budget === '400+' || experience === 'current' || experience === 'past' || therapy === 'yes-moonshot') {
    leadScore = '\uD83D\uDD25 HOT';
  } else if ((budget === '200-300') && (convenience === 'very' || convenience === 'somewhat')) {
    leadScore = '\uD83D\uDFE1 WARM';
  }

  // ── Internal Lead Notification Email ────────────────────────────────

  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">\uD83E\uDDEC New Peptide Quiz Lead</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Lead Score: ${leadScore}</p>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Contact</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Name: ${displayName || 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Email: ${esc(email, 254)}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Phone: ${esc(phone, 40) || 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">SMS Consent: ${smsConsent === true ? 'Yes' : 'No'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Goal &amp; Concern</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Goal: ${esc(goalLabel || goal) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Concern: ${esc(concernLabel || concern) || 'Not specified'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Profile</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Severity: ${esc(severity) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Duration: ${esc(duration) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Peptide Experience: ${esc(experience) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Current Therapy: ${esc(therapy) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Budget: ${esc(budget) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Convenience: ${esc(convenience) || 'Not specified'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Recommendation</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Primary: ${primary.name || '-'} at $${primary.price || '-'}/mo</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Secondary: ${secondary ? `${secondary.name} at $${secondary.price}/mo` : 'None'}</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const internalSubject = `\uD83E\uDDEC New Peptide Quiz Lead: ${name || email} · ${primary.name || 'Unknown'}`;

  // ── Send Both Emails ────────────────────────────────────────────────

  try {
    const [userSend, internalSend] = await Promise.all([
      sendEmail({
        to: email,
        subject: userSubject,
        html: userHtml,
        headers: {
          'List-Unsubscribe': `<https://moonshotmp.com/unsubscribe?email=${encodeURIComponent(email)}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      }),
      sendEmail({ to: 'hello@moonshotmp.com', subject: internalSubject, html: internalHtml })
    ]);
    // sendEmail resolves { ok: false } instead of throwing; surface it.
    if (!internalSend || !internalSend.ok) {
      console.error('[peptide-quiz-submit] Internal lead email failed:', internalSend && internalSend.error);
    }
    if (!userSend || !userSend.ok) {
      throw new Error('Results email failed: ' + ((userSend && userSend.error) || 'unknown'));
    }

    // ── Webhook syncs (non-blocking) ──────────────────────────────────
    const clinicApi = process.env.CLINIC_API_BASE || 'https://api.moonshotclinic.com';
    const geo = geoFromContext(context);
    const webhookHeaders = {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': 'moonshot',
      'X-Webhook-Key': process.env.CLINIC_LEAD_WEBHOOK_KEY || ''
    };

    // Lead webhook
    fetch(clinicApi + '/api/leads/webhook', {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        name,
        email,
        phone,
        source: 'peptide-quiz',
        quiz_type: 'peptide',
        state: '',
        geo_state: geo.geo_state,
        geo_country: geo.geo_country,
        recommendation: primary.name || '',
        budget: budget || '',
        goal: goalLabel || '',
        concern: concernLabel || '',
        attribution: data && data.attribution && typeof data.attribution === 'object' ? data.attribution : null
      })
    }).catch(err => console.error('[peptide-quiz-submit] Clinic lead sync error:', err.message));

    // Marketing drip webhook
    fetch(clinicApi + '/api/marketing/quiz-complete', {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        email,
        name,
        quiz_type: 'peptide',
        state: '',
        geo_state: geo.geo_state,
        geo_country: geo.geo_country,
        source: 'peptide-quiz',
        recommendation: primary.key || '',
        goal: goal || '',
        goalLabel: goalLabel || '',
        concern: concern || '',
        concernLabel: concernLabel || '',
        budget: budget || '',
        severity: severity || '',
        duration: duration || '',
        experience: experience || '',
        therapy: therapy || '',
        convenience: convenience || '',
        phone: phone || '',
        secondaryRecommendation: secondary ? { key: secondary.key, name: secondary.name, price: secondary.price } : null,
      })
    }).catch(err => console.error('[peptide-quiz-submit] Marketing drip sync error:', err.message));

    // SMS follow-up: only with a phone AND the separate, unticked SMS consent
    // box ticked (Tom, 2026-10-16 TCPA rule; same gate as every quiz funnel).
    await sendQuizSmsIfConsented({
      clinicApi,
      headers: webhookHeaders,
      phone,
      name,
      quizType: 'peptide',
      smsConsent,
      logTag: 'peptide-quiz-submit'
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[peptide-quiz-submit] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
