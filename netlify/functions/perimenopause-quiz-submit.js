import { sendEmail } from './send-email.js';

const INTERNAL_TIER_VALUES = new Set([
  'contraindication-identified',
  'eligibility-factors-present',
  'eligibility-factors-mixed',
  'eligibility-factors-not-met'
]);

// Server-side label lookup. We never trust the client's tierLabel — the engine
// could be stale, the value could be tampered, and HTML interpolation of any
// client-controlled string is an XSS vector for Tom's inbox.
const TIER_LABEL_LOOKUP = {
  'contraindication-identified': 'Contraindication identified',
  'eligibility-factors-present': 'Eligibility factors present',
  'eligibility-factors-mixed':   'Eligibility factors mixed',
  'eligibility-factors-not-met': 'Eligibility factors not met'
};

const RESULT_SLUG_LOOKUP = {
  'contraindication-identified': 'contraindication',
  'eligibility-factors-present': 'present',
  'eligibility-factors-mixed':   'mixed',
  'eligibility-factors-not-met': 'not-met'
};

const CTA_TEXT = {
  'contraindication-identified': 'Book a consultation',
  'eligibility-factors-present': 'Book hormone consultation',
  'eligibility-factors-mixed':   'Book a baseline consultation',
  'eligibility-factors-not-met': 'Book a baseline consultation'
};

const TIER_BODY_PRESENT_SEVERE = "Your responses indicate significant symptom burden in patterns associated with hormonal change. A clinical evaluation can clarify what's driving symptoms — there are several treatment paths including hormone-based and non-hormone-based options. We'd recommend booking a consultation to review symptoms and order a comprehensive hormone panel.";
const TIER_BODY_PRESENT_MODERATE = "Your responses indicate moderate symptom burden consistent with patterns associated with perimenopausal or menopausal change. Several evaluation paths exist — comprehensive hormone testing, lifestyle interventions, targeted nutrition. A clinical evaluation can clarify what's right for you.";
const TIER_BODY_MIXED = "Your symptom burden is mild. Many people in your range benefit from lifestyle and nutritional foundations before considering hormone-based options. If you'd like a baseline panel for reference, a consultation can order one.";
const TIER_BODY_NOT_MET = "You're reporting few perimenopausal symptoms. If your concern is about future hormonal change, baseline hormone panels can help establish a reference point.";
const TIER_BODY_CONTRAINDICATION = "Your responses indicate medical history that requires careful clinical evaluation before any hormone-based therapy. Non-hormone-based evaluation paths exist and are part of what a consultation would cover.";

const RED_FLAG_BODY = "Important: palpitations combined with anxiety can have causes beyond hormonal change — including thyroid disease, cardiac arrhythmias (paroxysmal atrial fibrillation), or other conditions. These need to be ruled out before assuming a perimenopausal explanation. If your palpitations are severe, sudden, or accompanied by chest pain, shortness of breath, or fainting — please see your primary care physician or an emergency department.";

// Missy-only attribution — she has FPA. Do NOT add other clinicians here.
const AUTHOR_ATTRIBUTION = 'Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC. This review is of the tool, not of your individual responses. You have not been examined or treated by Moonshot Medical.';

const RESULT_DISCLAIMER = 'This is a screening tool, not a clinical diagnosis. Only a clinician can confirm whether your symptoms are due to perimenopause, menopause, or another cause. Your provider can determine whether further workup, hormone testing, or treatment is appropriate based on your full clinical picture.';

const UNIVERSAL_DISCLAIMER = 'This tool does not, and is not intended to, diagnose any medical condition or recommend any specific treatment, drug, dose, or protocol. Screening tools have known false-positive and false-negative rates. Completing this quiz does not establish a provider-patient or treatment relationship, does not constitute a medical examination, and does not entitle you to any specific treatment, prescription, or service. Medical services are provided by Moonshot Medical, PLLC and are available only to patients physically located in states where our clinicians are licensed (currently Illinois). By proceeding you confirm you are at least 18 years old.';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATE_REGEX = /^[A-Z]{2}$/;

const MRS_TIER_VALUES = new Set(['none', 'mild', 'moderate', 'severe']);

// Mirrors MENSTRUAL_STATUS_VALUES from quiz/perimenopause/scoring.js — kept in
// sync manually since this Netlify function is a separate runtime.
const MENSTRUAL_STATUS_VALUES = new Set([
  'regular',
  'irregular',
  'less-than-12-months-since-lmp',
  '12-or-more-months-since-lmp',
  'hyst-with-ovaries',
  'hyst-with-oophorectomy',
  'on-hormonal-contraception-or-hrt'
]);

const CONTRAINDICATION_CATEGORY_VALUES = new Set([
  'clots',
  'cancer',
  'liver',
  'stroke',
  'cardiac',
  'htn',
  'migraine-aura',
  'unexplained-bleeding',
  'pregnancy',
  'other'
]);

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

// Derive an MRS tier from a raw score if the client-supplied tier label is
// missing or invalid. Cutoffs match scoring.js: ≤4 none, ≤8 mild, ≤16
// moderate, ≥17 severe.
function deriveMrsTier(score) {
  if (typeof score !== 'number' || score < 0) return 'none';
  if (score <= 4) return 'none';
  if (score <= 8) return 'mild';
  if (score <= 16) return 'moderate';
  return 'severe';
}

// Pick the patient-facing tier body string. Server-derived only — never let
// the client pass arbitrary copy.
function selectTierBody(internalTier, mrsTier) {
  if (internalTier === 'contraindication-identified') return TIER_BODY_CONTRAINDICATION;
  if (internalTier === 'eligibility-factors-present') {
    return mrsTier === 'severe' ? TIER_BODY_PRESENT_SEVERE : TIER_BODY_PRESENT_MODERATE;
  }
  if (internalTier === 'eligibility-factors-mixed') return TIER_BODY_MIXED;
  return TIER_BODY_NOT_MET;
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
    ackTimestamp: rawAckTimestamp,
    redFlagAckTimestamp: rawRedFlagAckTimestamp
  } = data || {};

  // Length-clamp and basic-shape validate user-controlled string fields.
  const name = clampString(rawName, 80);
  const email = clampString(rawEmail, 254).trim();
  const phone = clampString(rawPhone, 32);
  const ackTimestamp = clampString(rawAckTimestamp, 64);
  const redFlagAckTimestamp = clampString(rawRedFlagAckTimestamp, 64);

  if (!email || !EMAIL_REGEX.test(email)) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const internalTier = result && result.internalTier;
  if (!internalTier || !INTERNAL_TIER_VALUES.has(internalTier)) {
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

  // Derive label, slug, body, CTA from internalTier — never trust the client's
  // copies. They could be stale or tampered.
  const tierLabel = TIER_LABEL_LOOKUP[internalTier];
  const resultSlug = RESULT_SLUG_LOOKUP[internalTier];
  const ctaText = CTA_TEXT[internalTier];

  // MRS score: clamp to valid range. Out of range → 0.
  const rawMrsScore = result && result.mrsScore;
  const mrsScore = (Number.isFinite(rawMrsScore) && rawMrsScore >= 0 && rawMrsScore <= 44)
    ? Math.floor(rawMrsScore)
    : 0;

  // MRS tier: trust client value if it's in the enum, otherwise derive from
  // the score we just clamped.
  const rawMrsTier = result && result.mrsTier;
  const mrsTier = MRS_TIER_VALUES.has(rawMrsTier) ? rawMrsTier : deriveMrsTier(mrsScore);

  const hasHrtContraindication = !!(result && result.hasHrtContraindication === true);
  const hasRedFlag = !!(result && result.hasRedFlag === true);

  const tierBody = selectTierBody(internalTier, mrsTier);

  // Allowlist-validate every profile field before interpolation. Anything that
  // doesn't match its enum is replaced with an empty string for the email.
  const rawProfile = profile || {};

  const rawCategories = Array.isArray(rawProfile.contraindicationCategories)
    ? rawProfile.contraindicationCategories
    : [];
  const safeCategories = [];
  for (let i = 0; i < rawCategories.length && safeCategories.length < CONTRAINDICATION_CATEGORY_VALUES.size; i++) {
    const cat = rawCategories[i];
    if (typeof cat === 'string' && CONTRAINDICATION_CATEGORY_VALUES.has(cat) && safeCategories.indexOf(cat) === -1) {
      safeCategories.push(cat);
    }
  }

  const safeProfile = {
    age: Number.isFinite(rawProfile.age) && rawProfile.age >= 18 && rawProfile.age <= 120 ? rawProfile.age : null,
    menstrualStatus: MENSTRUAL_STATUS_VALUES.has(rawProfile.menstrualStatus) ? rawProfile.menstrualStatus : '',
    mrsScore: Number.isFinite(rawProfile.mrsScore) && rawProfile.mrsScore >= 0 && rawProfile.mrsScore <= 44 ? Math.floor(rawProfile.mrsScore) : 0,
    mrsTier: MRS_TIER_VALUES.has(rawProfile.mrsTier) ? rawProfile.mrsTier : '',
    contraindicationCount: Number.isFinite(rawProfile.contraindicationCount) && rawProfile.contraindicationCount >= 0 ? Math.floor(rawProfile.contraindicationCount) : 0,
    contraindicationCategories: safeCategories,
    stateCode: typeof rawProfile.stateCode === 'string' && STATE_REGEX.test(rawProfile.stateCode.toUpperCase()) ? rawProfile.stateCode.toUpperCase() : ''
  };

  // ── CTA URL ────────────────────────────────────────────────────────
  const ctaUrl = `https://moonshotmp.com/booking/?source=perimenopause-quiz&severity=${encodeURIComponent(resultSlug)}`;

  // Pre-escaped values for HTML interpolation. Defense-in-depth even though
  // most of these come from server-side enums after validation.
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeTierLabel = escapeHtml(tierLabel);
  const safeTierBody = escapeHtml(tierBody);
  const safeCtaText = escapeHtml(ctaText);
  const safeMrsScore = escapeHtml(String(mrsScore));
  const safeMrsTier = escapeHtml(mrsTier);
  const safeAckTimestamp = escapeHtml(ackTimestamp);
  const safeRedFlagAckTimestamp = escapeHtml(redFlagAckTimestamp);
  const safeRedFlagBody = escapeHtml(RED_FLAG_BODY);

  // Optional red-flag block in the user email body.
  const redFlagBlock = hasRedFlag
    ? `
      <div style="background: rgba(255, 99, 71, 0.08); border: 1px solid rgba(255, 99, 71, 0.3); border-radius: 6px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 13px; margin: 0 0 8px;">Please read</p>
        <p style="color: #B2BFBE; font-size: 13px; line-height: 1.7; margin: 0;">${safeRedFlagBody}</p>
      </div>`
    : '';

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

      <h1 style="color: #F0EEE9; margin: 0 0 4px; font-size: 22px;">Your Perimenopause Screener Result</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Moonshot Medical and Performance</p>

      <p style="color: #B2BFBE; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Hi ${safeName || 'there'},</p>

      <!-- Tier Result Card -->
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(178,191,190,0.2); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px;">Result</p>
        <p style="color: #F0EEE9; font-weight: 700; font-size: 20px; margin: 0 0 16px;">${safeTierLabel}</p>
        <p style="color: #B2BFBE; font-size: 14px; line-height: 1.7; margin: 0 0 16px;">${safeTierBody}</p>
        <p style="color: #B2BFBE; font-size: 13px; line-height: 1.6; margin: 0;">Your MRS symptom score: ${safeMrsScore}</p>
      </div>
${redFlagBlock}
      <!-- Result-page-specific disclaimer -->
      <div style="background: rgba(255,255,255,0.04); border-radius: 6px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 13px; line-height: 1.6; margin: 0;">${escapeHtml(RESULT_DISCLAIMER)}</p>
      </div>

      <!-- CTA -->
      <div style="text-align: center; padding: 24px 0;">
        <a href="${ctaUrl}" style="display: inline-block; background: #B2BFBE; color: #101921; padding: 14px 32px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 4px;">${safeCtaText}</a>
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
      You're receiving this because you completed the Perimenopause Screener on moonshotmp.com.
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

  const userSubject = 'Your Perimenopause Screener Result — Moonshot Medical';

  // ── Lead Score ──────────────────────────────────────────────────────

  let leadScore = '🔵 COLD';
  if (internalTier === 'eligibility-factors-present' && mrsTier === 'severe') {
    leadScore = '🔥 HOT';
  } else if (
    (internalTier === 'eligibility-factors-present' && mrsTier === 'moderate') ||
    internalTier === 'contraindication-identified'
  ) {
    leadScore = '🟡 WARM';
  } else if (internalTier === 'eligibility-factors-mixed') {
    leadScore = '🟢 NEW';
  } else if (internalTier === 'eligibility-factors-not-met') {
    leadScore = '🔵 COLD';
  }

  // ── Internal Lead Notification Email ────────────────────────────────

  const safeCategoriesJoined = escapeHtml(safeProfile.contraindicationCategories.join(', '));

  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">🌙 New Perimenopause Lead</h1>
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
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Internal Tier: ${escapeHtml(internalTier)}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Tier Label: ${safeTierLabel}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">MRS Score: ${safeMrsScore}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">MRS Tier: ${safeMrsTier || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has HRT Contraindication: ${hasHrtContraindication ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Has Red Flag (palpitations + anxiety): ${hasRedFlag ? 'Yes' : 'No'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Profile</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Age: ${safeProfile.age != null ? escapeHtml(String(safeProfile.age)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Menstrual Status: ${escapeHtml(safeProfile.menstrualStatus) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">MRS Score (profile): ${escapeHtml(String(safeProfile.mrsScore))}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">MRS Tier (profile): ${escapeHtml(safeProfile.mrsTier) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Contraindication Count: ${escapeHtml(String(safeProfile.contraindicationCount))}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Contraindication Categories: ${safeCategoriesJoined || 'None'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">State: ${escapeHtml(safeProfile.stateCode) || 'Not specified'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Acknowledgement</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Result Ack Timestamp: ${safeAckTimestamp || 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Red-Flag Ack Timestamp: ${safeRedFlagAckTimestamp || 'Not provided'}</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const internalSubject = sanitizeHeaderValue(`🌙 New Perimenopause Lead: ${name || email} — ${tierLabel || 'tier ?'}`);

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
        source: 'perimenopause-quiz',
        recommendation: internalTier,
        budget: '',
        goal: 'perimenopause',
        concern: tierLabel,
        attribution: data && data.attribution && typeof data.attribution === 'object' ? data.attribution : null
      })
    }).catch(err => console.error('[perimenopause-quiz-submit] Clinic lead sync error:', err && err.message));

    // Marketing drip webhook
    fetch(clinicApi + '/api/marketing/quiz-complete', {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        email,
        name,
        quiz_type: 'perimenopause',
        source: 'perimenopause-quiz',
        recommendation: internalTier,
        tier: internalTier,
        tierLabel: tierLabel,
        resultSlug: resultSlug,
        mrsScore: mrsScore,
        mrsTier: mrsTier,
        hasHrtContraindication: hasHrtContraindication,
        hasRedFlag: hasRedFlag,
        phone: phone || '',
        marketingOptIn: optIn,
        age: safeProfile.age != null ? safeProfile.age : '',
        menstrualStatus: safeProfile.menstrualStatus || '',
        contraindicationCount: safeProfile.contraindicationCount,
        stateCode: safeProfile.stateCode || '',
        ackTimestamp: ackTimestamp || '',
        redFlagAckTimestamp: redFlagAckTimestamp || ''
      })
    }).catch(err => console.error('[perimenopause-quiz-submit] Marketing drip sync error:', err && err.message));

    // SMS follow-up — only if phone provided AND marketing opt-in is true.
    // Perimenopause traffic mirrors the bone-density conservative posture.
    if (phone && optIn === true) {
      try {
        await fetch(clinicApi + '/api/webhooks/quiz-sms', {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({
            phone: phone,
            name: name,
            peptide: 'perimenopause-' + internalTier,
            quiz_type: 'perimenopause'
          })
        });
      } catch (e) {
        // Non-fatal — don't block the response
        console.error('[perimenopause-quiz-submit] Quiz SMS webhook error:', e && e.message);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    // Log only the message — Resend's error response may contain the email
    // payload (PHI) and Netlify Function logs are not in the BAA scope.
    console.error('[perimenopause-quiz-submit] Error:', err && err.message);
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
