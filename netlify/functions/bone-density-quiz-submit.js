import { sendEmail } from './send-email.js';

const ALLOWED_TIERS = new Set(['A', 'B', 'C', 'D']);

const TIER_BODY = {
  A: 'Per AACE, Endocrine Society, and NOF guidelines, a low-trauma fracture after age 40 is itself diagnostic of osteoporosis, even before a DEXA scan. A clinical evaluation is the appropriate next step — it should include a DEXA scan, bone-relevant lab work, and a discussion of treatment options. We offer DEXA scans on-site in Park Ridge ($150) and full clinical evaluation.',
  B: "Your responses describe risk factors associated with elevated likelihood of low bone density. The most accurate way to know your bones' actual condition is a DEXA scan — it's the medical gold standard. Moonshot offers DEXA scans on-site in Park Ridge for $150, no referral needed.",
  C: 'You have one or more risk factors for bone density loss. A DEXA scan is reasonable based on these inputs and would establish a baseline you can track over time. For most adults with risk factors, getting a baseline by age 50 (women) or 60 (men) is the standard recommendation.',
  D: "Based on your responses, your risk factors for low bone density are minimal. A DEXA is reasonable but not urgent based on these inputs. If you're approaching standard screening ages or want a longevity baseline, the scan is still valuable as a reference point."
};

// Server-side label lookup. We never trust the client's tierLabel — the engine
// could be stale, the value could be tampered, and HTML interpolation of any
// client-controlled string is an XSS vector for Tom's inbox.
const TIER_LABEL_LOOKUP = {
  A: 'Eligibility factors present',
  B: 'Eligibility factors present',
  C: 'Eligibility factors mixed',
  D: 'Eligibility factors not met'
};

const TIER_CTA_SERVICE = {
  A: 'consult-with-dexa',
  B: 'dexa',
  C: 'dexa',
  D: 'consult'
};

const TIER_CTA_TEXT = {
  A: 'Book consult with DEXA included',
  B: 'Book DEXA scan ($150)',
  C: 'Book DEXA scan ($150)',
  D: 'Discuss baseline scan with a clinician'
};

const RESULT_SLUG_LOOKUP = {
  A: 'clinical-indication',
  B: 'high',
  C: 'moderate',
  D: 'low'
};

const AUTHOR_ATTRIBUTION = 'Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC. This review is of the tool, not of your individual responses. You have not been examined or treated by Moonshot Medical.';

const RESULT_DISCLAIMER = 'This is a screening tool, not a diagnosis. Only a DXA scan can diagnose osteoporosis or osteopenia. Your provider can determine whether scanning, treatment, or further workup is appropriate based on your full clinical picture.';

const UNIVERSAL_DISCLAIMER = 'This tool does not, and is not intended to, diagnose any medical condition or recommend any specific treatment, drug, dose, or protocol. Screening tools have known false-positive and false-negative rates. Completing this quiz does not establish a provider-patient or treatment relationship, does not constitute a medical examination, and does not entitle you to any specific treatment, prescription, or service. Medical services are provided by Moonshot Medical, PLLC and are available only to patients physically located in states where our clinicians are licensed (currently Illinois). By proceeding you confirm you are at least 18 years old.';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEX_VALUES = new Set(['male', 'female', 'prefer-not']);
const YES_NO_VALUES = new Set(['yes', 'no']);
const YES_NO_UNKNOWN_VALUES = new Set(['yes', 'no', 'unknown']);
const MENOPAUSE_VALUES = new Set(['yes', 'no', 'na']);
const STATE_REGEX = /^[A-Z]{2}$/;

// Strip HTML-significant characters before any value gets interpolated into an
// email body. Mail clients render anchors / images / CSS, so an unescaped
// user-controlled value can plant phishing UI in Tom's inbox.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip CR/LF + control chars from values used in mail headers (subject line).
// Defense-in-depth against header injection if Resend's sanitizer ever changes.
function sanitizeHeaderValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\r\n]/g, ' ').slice(0, 200);
}

function clampString(value, max) {
  if (typeof value !== 'string') return '';
  return value.slice(0, max);
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
    });
  }

  let data;
  try {
    data = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const {
    name: rawName,
    email: rawEmail,
    phone: rawPhone,
    marketingOptIn,
    result,
    profile,
    ackTimestamp: rawAckTimestamp
  } = data || {};

  // Length-clamp and basic-shape validate user-controlled string fields.
  const name = clampString(rawName, 80);
  const email = clampString(rawEmail, 254).trim();
  const phone = clampString(rawPhone, 32);
  const ackTimestamp = clampString(rawAckTimestamp, 64);

  if (!email || !EMAIL_REGEX.test(email)) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const tier = result && result.tier;
  if (!tier || !ALLOWED_TIERS.has(tier)) {
    return new Response(JSON.stringify({ error: 'invalid_tier' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Permissive on marketingOptIn — old browsers may not send it cleanly.
  // Default to false if undefined; reject only if it's explicitly a non-boolean primitive.
  let optIn = false;
  if (marketingOptIn === undefined || marketingOptIn === null) {
    optIn = false;
  } else if (typeof marketingOptIn === 'boolean') {
    optIn = marketingOptIn;
  } else {
    return new Response(JSON.stringify({ error: 'invalid_marketing_opt_in' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Derive label and slug from tier — never trust the client's copies. They
  // could be stale or tampered.
  const tierLabel = TIER_LABEL_LOOKUP[tier];
  const resultSlug = RESULT_SLUG_LOOKUP[tier];

  const ostScoreRaw = result && result.ostScore !== undefined ? result.ostScore : null;
  const ostScore = ostScoreRaw === null || typeof ostScoreRaw === 'number' ? ostScoreRaw : null;
  const riskFactorCount = result && typeof result.riskFactorCount === 'number' ? result.riskFactorCount : 0;

  // Allowlist-validate every profile field before interpolation. Anything that
  // doesn't match its enum is replaced with an empty string for the email.
  const rawProfile = profile || {};
  const safeProfile = {
    age: typeof rawProfile.age === 'number' && rawProfile.age >= 18 && rawProfile.age <= 120 ? rawProfile.age : null,
    sex: SEX_VALUES.has(rawProfile.sex) ? rawProfile.sex : '',
    weightKg: typeof rawProfile.weightKg === 'number' && rawProfile.weightKg > 0 ? rawProfile.weightKg : null,
    heightLoss: YES_NO_UNKNOWN_VALUES.has(rawProfile.heightLoss) ? rawProfile.heightLoss : '',
    priorFragilityFracture: YES_NO_VALUES.has(rawProfile.priorFragilityFracture) ? rawProfile.priorFragilityFracture : '',
    parentalHipFracture: YES_NO_VALUES.has(rawProfile.parentalHipFracture) ? rawProfile.parentalHipFracture : '',
    smokingOrAlcohol: YES_NO_VALUES.has(rawProfile.smokingOrAlcohol) ? rawProfile.smokingOrAlcohol : '',
    medicationCount: typeof rawProfile.medicationCount === 'number' ? rawProfile.medicationCount : 0,
    prematureMenopause: MENOPAUSE_VALUES.has(rawProfile.prematureMenopause) ? rawProfile.prematureMenopause : '',
    secondaryConditionCount: typeof rawProfile.secondaryConditionCount === 'number' ? rawProfile.secondaryConditionCount : 0,
    stateCode: typeof rawProfile.stateCode === 'string' && STATE_REGEX.test(rawProfile.stateCode.toUpperCase()) ? rawProfile.stateCode.toUpperCase() : ''
  };

  // ── CTA URL ────────────────────────────────────────────────────────
  const ctaService = TIER_CTA_SERVICE[tier];
  const ctaText = TIER_CTA_TEXT[tier];
  const ctaUrl = `https://moonshotmp.com/booking/?source=bone-density-quiz&result=${encodeURIComponent(resultSlug)}&service=${encodeURIComponent(ctaService)}`;

  // Pre-escaped values for HTML interpolation. Defense-in-depth even though
  // most of these come from server-side enums after validation.
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeTierLabel = escapeHtml(tierLabel);
  const safeAckTimestamp = escapeHtml(ackTimestamp);
  const safeOstScore = ostScore == null ? 'N/A' : escapeHtml(String(ostScore));
  const safeRiskFactorCount = escapeHtml(String(riskFactorCount));

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

      <h1 style="color: #F0EEE9; margin: 0 0 4px; font-size: 22px;">Your Bone Density Screener Result</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Moonshot Medical and Performance</p>

      <p style="color: #B2BFBE; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Hi ${safeName || 'there'},</p>

      <!-- Tier Result Card -->
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(178,191,190,0.2); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px;">Result</p>
        <p style="color: #F0EEE9; font-weight: 700; font-size: 20px; margin: 0 0 16px;">${safeTierLabel}</p>
        <p style="color: #B2BFBE; font-size: 14px; line-height: 1.7; margin: 0;">${escapeHtml(TIER_BODY[tier])}</p>
      </div>

      <!-- Result-page-specific disclaimer -->
      <div style="background: rgba(255,255,255,0.04); border-radius: 6px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 13px; line-height: 1.6; margin: 0;">${escapeHtml(RESULT_DISCLAIMER)}</p>
      </div>

      <!-- CTA -->
      <div style="text-align: center; padding: 24px 0;">
        <a href="${ctaUrl}" style="display: inline-block; background: #B2BFBE; color: #101921; padding: 14px 32px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 4px;">${escapeHtml(ctaText)}</a>
        <p style="color: #B2BFBE; font-size: 13px; margin: 16px 0 0;">Questions? Call <a href="tel:2244354280" style="color: #B2BFBE;">(224) 435-4280</a></p>
      </div>

      <!-- Author attribution -->
      <div style="background: rgba(255,255,255,0.04); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #B2BFBE; font-size: 12px; line-height: 1.6; margin: 0;">${escapeHtml(AUTHOR_ATTRIBUTION)}</p>
      </div>

    </div>

    <p style="color: #666; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
      ${escapeHtml(UNIVERSAL_DISCLAIMER)}
    </p>
    <p style="color: #666; font-size: 11px; text-align: center; margin-top: 16px; line-height: 1.5;">
      Moonshot Medical and Performance &middot; 542 Busse Hwy, Park Ridge, IL 60068
    </p>
    <p style="color: #666; font-size: 11px; text-align: center; margin-top: 16px;">
      <a href="https://moonshotmp.com/unsubscribe?email=${encodeURIComponent(email)}"
         style="color: #666; text-decoration: underline;">Unsubscribe from future emails</a>
    </p>
  </div>
</body>
</html>`.trim();

  const userSubject = 'Your Bone Density Screener Result — Moonshot Medical';

  // ── Lead Score ──────────────────────────────────────────────────────

  let leadScore = '🟢 NEW';
  if (tier === 'A' || (tier === 'B' && safeProfile.priorFragilityFracture === 'yes')) {
    leadScore = '🔥 HOT';
  } else if (tier === 'B' || tier === 'C') {
    leadScore = '🟡 WARM';
  }

  // ── Internal Lead Notification Email ────────────────────────────────

  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">🦴 New Bone Density Lead</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Lead Score: ${leadScore}</p>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Contact</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Name: ${safeName || 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Email: ${safeEmail}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Phone: ${safePhone || 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Marketing Opt-In: ${optIn ? 'Yes' : 'No'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Result</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Tier: ${escapeHtml(tier)}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Tier Label: ${safeTierLabel}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">OST Score: ${safeOstScore}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Risk Factor Count: ${safeRiskFactorCount}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Profile</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Age: ${safeProfile.age != null ? escapeHtml(String(safeProfile.age)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Sex: ${escapeHtml(safeProfile.sex) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Weight (kg): ${safeProfile.weightKg != null ? escapeHtml(String(safeProfile.weightKg)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Height Loss: ${escapeHtml(safeProfile.heightLoss) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Prior Fragility Fracture: ${escapeHtml(safeProfile.priorFragilityFracture) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Parental Hip Fracture: ${escapeHtml(safeProfile.parentalHipFracture) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Smoking or Alcohol: ${escapeHtml(safeProfile.smokingOrAlcohol) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Medication Count: ${escapeHtml(String(safeProfile.medicationCount))}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Premature Menopause: ${escapeHtml(safeProfile.prematureMenopause) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Secondary Condition Count: ${escapeHtml(String(safeProfile.secondaryConditionCount))}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">State: ${escapeHtml(safeProfile.stateCode) || 'Not specified'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Acknowledgement</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Timestamp: ${safeAckTimestamp || 'Not provided'}</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const internalSubject = sanitizeHeaderValue(`🦴 New Bone Density Lead: ${name || email} — Tier ${tier}`);

  // ── Send Both Emails ────────────────────────────────────────────────

  try {
    await Promise.all([
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

    // ── Webhook syncs (non-blocking) ──────────────────────────────────
    const clinicApi = process.env.CLINIC_API_BASE || 'https://api.moonshotclinic.com';
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
        source: 'bone-density-quiz',
        recommendation: 'tier-' + tier,
        budget: '',
        goal: 'bone-density',
        concern: tierLabel,
        attribution: data && data.attribution && typeof data.attribution === 'object' ? data.attribution : null
      })
    }).catch(err => console.error('[bone-density-quiz-submit] Clinic lead sync error:', err && err.message));

    // Marketing drip webhook
    fetch(clinicApi + '/api/marketing/quiz-complete', {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        email,
        name,
        quiz_type: 'bone-density',
        source: 'bone-density-quiz',
        recommendation: tier,
        tier: tier,
        tierLabel: tierLabel,
        resultSlug: resultSlug,
        ostScore: ostScore,
        riskFactorCount: riskFactorCount,
        phone: phone || '',
        marketingOptIn: optIn,
        age: safeProfile.age != null ? safeProfile.age : '',
        sex: safeProfile.sex || '',
        stateCode: safeProfile.stateCode || '',
        ackTimestamp: ackTimestamp || ''
      })
    }).catch(err => console.error('[bone-density-quiz-submit] Marketing drip sync error:', err && err.message));

    // SMS follow-up — only if phone provided AND marketing opt-in is true.
    // Bone density traffic is colder than peptide; we are intentionally
    // more conservative with SMS here than the peptide handler.
    if (phone && optIn) {
      try {
        await fetch(clinicApi + '/api/webhooks/quiz-sms', {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({
            phone: phone,
            name: name,
            peptide: 'bone-density-tier-' + tier,
            quiz_type: 'bone-density'
          })
        });
      } catch (e) {
        // Non-fatal — don't block the response
        console.error('[bone-density-quiz-submit] Quiz SMS webhook error:', e && e.message);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    // Log only the message — Resend's error response may contain the email
    // payload (PHI) and Netlify Function logs are not in the BAA scope.
    console.error('[bone-density-quiz-submit] Error:', err && err.message);
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
