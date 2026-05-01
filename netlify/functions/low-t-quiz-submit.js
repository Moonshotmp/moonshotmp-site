import { sendEmail } from './send-email.js';

const INTERNAL_TIER_VALUES = new Set([
  'hard-stop',
  'fertility-stop',
  'psa-ipss-concern',
  'eligibility-present',
  'eligibility-mixed',
  'eligibility-not-met'
]);

// Server-side label lookup. We never trust the client's tierLabel — the engine
// could be stale, the value could be tampered, and HTML interpolation of any
// client-controlled string is an XSS vector for Tom's inbox.
const TIER_LABEL_LOOKUP = {
  'hard-stop':            'Contraindication identified',
  'fertility-stop':       'Contraindication identified',
  'psa-ipss-concern':     'Contraindication identified',
  'eligibility-present':  'Eligibility factors present',
  'eligibility-mixed':    'Eligibility factors mixed',
  'eligibility-not-met':  'Eligibility factors not met'
};

const RESULT_SLUG_LOOKUP = {
  'hard-stop':            'hard-stop',
  'fertility-stop':       'fertility-stop',
  'psa-ipss-concern':     'psa-ipss',
  'eligibility-present':  'present',
  'eligibility-mixed':    'mixed',
  'eligibility-not-met':  'not-met'
};

const CTA_TEXT = {
  'hard-stop':            'Book a consultation',
  'fertility-stop':       'Book a fertility-aware consultation',
  'psa-ipss-concern':     'Book a consultation',
  'eligibility-present':  'Book lab work + consultation',
  'eligibility-mixed':    'Book a comprehensive evaluation',
  'eligibility-not-met':  'Book a comprehensive lab panel'
};

const TIER_BODY_HARD_STOP = 'Your responses describe medical history that requires evaluation before any testosterone-based therapy. Several non-testosterone evaluation paths exist and a consultation can identify the right approach for your situation.';
const TIER_BODY_FERTILITY_STOP = 'Traditional testosterone-based therapy can suppress fertility. Several non-testosterone-based approaches exist that may preserve fertility — these require clinical evaluation to determine fit.';
const TIER_BODY_PSA_IPSS = 'Your responses describe urinary or PSA findings that warrant evaluation by a urologist or primary care physician before testosterone-based therapy is considered. We\'d recommend that workup first; once cleared, a consultation here can address symptoms.';
const TIER_BODY_PRESENT = 'Your symptom pattern overlaps with patterns associated with low testosterone. ADAM has approximately 88% sensitivity and 60% specificity, meaning roughly 40% of positive screens are not associated with biochemical hypogonadism. A serum testosterone test ordered by a clinician — alongside a 60+ marker comprehensive panel — is the only way to determine whether testosterone deficiency is present and what\'s driving symptoms. Book a consultation to begin that workup.';
const TIER_BODY_MIXED = 'Your symptoms overlap with patterns associated with low testosterone, but several factors can produce similar symptoms — sleep apnea, certain medications, sleep quality. A comprehensive evaluation will identify which factors are driving symptoms and which need to be addressed first.';
const TIER_BODY_NOT_MET = 'Your symptom pattern doesn\'t strongly overlap with low-testosterone patterns. Several factors can mimic symptoms or low T can be subclinical. A comprehensive lab panel is the answer if you want to know definitively.';

// Missy-only attribution — she has FPA. Do NOT add other clinicians here.
const AUTHOR_ATTRIBUTION = 'Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC. This review is of the tool, not of your individual responses. You have not been examined or treated by Moonshot Medical.';

const RESULT_DISCLAIMER = 'This is a screening tool, not a clinical diagnosis. Only a clinician can confirm whether your symptoms are due to low testosterone or another cause. Your provider can determine whether further workup, lab testing, or treatment is appropriate based on your full clinical picture.';

const UNIVERSAL_DISCLAIMER = 'This tool does not, and is not intended to, diagnose any medical condition or recommend any specific treatment, drug, dose, or protocol. Screening tools have known false-positive and false-negative rates. Completing this quiz does not establish a provider-patient or treatment relationship, does not constitute a medical examination, and does not entitle you to any specific treatment, prescription, or service. Medical services are provided by Moonshot Medical, PLLC and are available only to patients physically located in states where our clinicians are licensed (currently Illinois). By proceeding you confirm you are at least 18 years old.';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATE_REGEX = /^[A-Z]{2}$/;

// Mirror allowlists from quiz/low-t/scoring.js — kept in sync manually since
// this Netlify function is a separate runtime.
const FERTILITY_PLAN_VALUES = new Set([
  'currently-trying-or-12mo',
  'planning-eventually',
  'not-planning',
  'na'
]);

const PSA_TIER_VALUES = new Set([
  'le-2.5', '2.5-4.0', '4.0-10.0', 'gt-10.0', 'unknown', 'no-test'
]);

const MED_HISTORY_KEYS = new Set([
  'untreated-male-breast-cancer',
  'severe-untreated-chf',
  'active-prostate-nodule-or-elevated-psa-pending',
  'prostate-cancer-history',
  'hematocrit-hx-gt-54',
  'untreated-severe-osa',
  'severe-bph-or-luts',
  'severe-depression-with-si',
  'other'
]);

const MEDS_KEYS = new Set([
  'opioids',
  'ssri-snri',
  'beta-blockers',
  'statins',
  'glucocorticoids',
  'prior-or-current-testosterone',
  'none'
]);

// Defensive cap on multi-check array length (allowlists already bound size,
// but bound iteration before allowlist filtering too).
const MAX_CATEGORY_ARRAY_LENGTH = 20;

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

// Strip CR/LF from values used in mail headers (subject line). Defense-in-depth
// against header injection if Resend's sanitizer ever changes.
function sanitizeHeaderValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\r\n]/g, ' ').slice(0, 200);
}

function clampString(value, max) {
  if (typeof value !== 'string') return '';
  return value.slice(0, max);
}

// Pick the patient-facing tier body string. Server-derived only — never let
// the client pass arbitrary copy.
function selectTierBody(internalTier) {
  switch (internalTier) {
    case 'hard-stop': return TIER_BODY_HARD_STOP;
    case 'fertility-stop': return TIER_BODY_FERTILITY_STOP;
    case 'psa-ipss-concern': return TIER_BODY_PSA_IPSS;
    case 'eligibility-present': return TIER_BODY_PRESENT;
    case 'eligibility-mixed': return TIER_BODY_MIXED;
    case 'eligibility-not-met': return TIER_BODY_NOT_MET;
    default: return '';
  }
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
  const phone = clampString(rawPhone, 32).trim();
  const ackTimestamp = clampString(rawAckTimestamp, 64);

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
  const tierBody = selectTierBody(internalTier);

  // Result booleans + summary numbers — defensive coercion. We display these
  // in the internal email; never trust raw client values for HTML.
  const adamPositive = !!(result && result.adamPositive === true);
  const rawAdamYesCount = result && result.adamYesCount;
  const adamYesCount = (Number.isFinite(rawAdamYesCount) && rawAdamYesCount >= 0 && rawAdamYesCount <= 10)
    ? Math.floor(rawAdamYesCount)
    : 0;

  const rawIpssSum = result && result.ipssSum;
  const ipssSum = (Number.isFinite(rawIpssSum) && rawIpssSum >= 0 && rawIpssSum <= 15)
    ? Math.floor(rawIpssSum)
    : 0;

  const rawBmi = result && result.bmi;
  const bmi = (Number.isFinite(rawBmi) && rawBmi > 0 && rawBmi < 200)
    ? rawBmi
    : null;

  const hasHardStopMedical = !!(result && result.hasHardStopMedical === true);
  const hasFertilityStop = !!(result && result.hasFertilityStop === true);
  const hasPsaConcern = !!(result && result.hasPsaConcern === true);
  const hasIpssConcern = !!(result && result.hasIpssConcern === true);
  const hasOsaConfounder = !!(result && result.hasOsaConfounder === true);
  const hasMedConfounder = !!(result && result.hasMedConfounder === true);

  // Allowlist-validate every profile field before interpolation. Anything that
  // doesn't match its enum is replaced with an empty string for the email.
  const rawProfile = profile || {};

  const rawMedHistory = Array.isArray(rawProfile.medicalHistoryCategories)
    ? rawProfile.medicalHistoryCategories
    : [];
  const safeMedHistory = [];
  for (let i = 0; i < rawMedHistory.length && i < MAX_CATEGORY_ARRAY_LENGTH && safeMedHistory.length < MED_HISTORY_KEYS.size; i++) {
    const cat = rawMedHistory[i];
    if (typeof cat === 'string' && MED_HISTORY_KEYS.has(cat) && safeMedHistory.indexOf(cat) === -1) {
      safeMedHistory.push(cat);
    }
  }

  const rawMeds = Array.isArray(rawProfile.medicationCategories)
    ? rawProfile.medicationCategories
    : [];
  const safeMeds = [];
  for (let i = 0; i < rawMeds.length && i < MAX_CATEGORY_ARRAY_LENGTH && safeMeds.length < MEDS_KEYS.size; i++) {
    const med = rawMeds[i];
    if (typeof med === 'string' && MEDS_KEYS.has(med) && safeMeds.indexOf(med) === -1) {
      safeMeds.push(med);
    }
  }

  const safeProfile = {
    age: Number.isFinite(rawProfile.age) && rawProfile.age >= 18 && rawProfile.age <= 120 ? Math.floor(rawProfile.age) : null,
    heightInches: Number.isFinite(rawProfile.heightInches) && rawProfile.heightInches > 0 && rawProfile.heightInches <= 96 ? rawProfile.heightInches : null,
    weightLbs: Number.isFinite(rawProfile.weightLbs) && rawProfile.weightLbs > 0 && rawProfile.weightLbs <= 1000 ? rawProfile.weightLbs : null,
    fertilityPlan: FERTILITY_PLAN_VALUES.has(rawProfile.fertilityPlan) ? rawProfile.fertilityPlan : '',
    sleepHours: Number.isFinite(rawProfile.sleepHours) && rawProfile.sleepHours >= 0 && rawProfile.sleepHours <= 24 ? rawProfile.sleepHours : null,
    medicalHistoryCount: safeMedHistory.length,
    medicalHistoryCategories: safeMedHistory,
    psaTier: PSA_TIER_VALUES.has(rawProfile.psaTier) ? rawProfile.psaTier : '',
    medicationCount: safeMeds.length,
    medicationCategories: safeMeds,
    stateCode: typeof rawProfile.stateCode === 'string' && STATE_REGEX.test(rawProfile.stateCode.toUpperCase()) ? rawProfile.stateCode.toUpperCase() : ''
  };

  // ── CTA URL ────────────────────────────────────────────────────────
  const ctaUrl = `https://moonshotmp.com/booking/?source=low-t-quiz&result=${encodeURIComponent(resultSlug)}`;

  // Pre-escaped values for HTML interpolation. Defense-in-depth even though
  // most of these come from server-side enums after validation.
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeTierLabel = escapeHtml(tierLabel);
  const safeTierBody = escapeHtml(tierBody);
  const safeCtaText = escapeHtml(ctaText);
  const safeAdamYesCount = escapeHtml(String(adamYesCount));
  const safeAckTimestamp = escapeHtml(ackTimestamp);

  // Optional ADAM context line shown on eligibility-present + eligibility-mixed only.
  const adamContextBlock = (internalTier === 'eligibility-present' || internalTier === 'eligibility-mixed')
    ? `<p style="color: #B2BFBE; font-size: 13px; line-height: 1.6; margin: 0;">Your ADAM screener: ${safeAdamYesCount} of 10 items endorsed.</p>`
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

      <h1 style="color: #F0EEE9; margin: 0 0 4px; font-size: 22px;">Your TRT Readiness Screener Result</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Moonshot Medical and Performance</p>

      <p style="color: #B2BFBE; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Hi ${safeName || 'there'},</p>

      <!-- Tier Result Card -->
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(178,191,190,0.2); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px;">Result</p>
        <p style="color: #F0EEE9; font-weight: 700; font-size: 20px; margin: 0 0 16px;">${safeTierLabel}</p>
        <p style="color: #B2BFBE; font-size: 14px; line-height: 1.7; margin: 0 0 16px;">${safeTierBody}</p>
        ${adamContextBlock}
      </div>

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
      You're receiving this because you completed the TRT Readiness Screener on moonshotmp.com.
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

  const userSubject = 'Your TRT Readiness Screener Result — Moonshot Medical';

  // ── Lead Score ──────────────────────────────────────────────────────

  let leadScore = '🔵 COLD';
  if (internalTier === 'eligibility-present') {
    leadScore = '🔥 HOT';
  } else if (
    internalTier === 'eligibility-mixed' ||
    internalTier === 'fertility-stop' ||
    internalTier === 'psa-ipss-concern'
  ) {
    leadScore = '🟡 WARM';
  } else if (internalTier === 'eligibility-not-met') {
    leadScore = '🔵 COLD';
  } else if (internalTier === 'hard-stop') {
    leadScore = '⛔ STOP';
  }

  // ── Internal Lead Notification Email ────────────────────────────────

  const safeMedHistoryJoined = escapeHtml(safeProfile.medicalHistoryCategories.join(', '));
  const safeMedsJoined = escapeHtml(safeProfile.medicationCategories.join(', '));
  const safeBmi = bmi != null ? escapeHtml(bmi.toFixed(1)) : 'Not calculable';

  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">💪 New Low-T Lead</h1>
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
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">ADAM Positive: ${adamPositive ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">ADAM Yes Count: ${safeAdamYesCount} / 10</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">IPSS Sum: ${escapeHtml(String(ipssSum))} / 15</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">BMI: ${safeBmi}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has Hard-Stop Medical: ${hasHardStopMedical ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has Fertility Stop: ${hasFertilityStop ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has PSA Concern: ${hasPsaConcern ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has IPSS Concern: ${hasIpssConcern ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has OSA Confounder: ${hasOsaConfounder ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Has Med Confounder: ${hasMedConfounder ? 'Yes' : 'No'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Profile</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Age: ${safeProfile.age != null ? escapeHtml(String(safeProfile.age)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Height (in): ${safeProfile.heightInches != null ? escapeHtml(String(safeProfile.heightInches)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Weight (lbs): ${safeProfile.weightLbs != null ? escapeHtml(String(safeProfile.weightLbs)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Fertility Plan: ${escapeHtml(safeProfile.fertilityPlan) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Sleep Hours: ${safeProfile.sleepHours != null ? escapeHtml(String(safeProfile.sleepHours)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Medical History Count: ${escapeHtml(String(safeProfile.medicalHistoryCount))}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Medical History Categories: ${safeMedHistoryJoined || 'None'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">PSA Tier: ${escapeHtml(safeProfile.psaTier) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Medication Count: ${escapeHtml(String(safeProfile.medicationCount))}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Medication Categories: ${safeMedsJoined || 'None'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">State: ${escapeHtml(safeProfile.stateCode) || 'Not specified'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Acknowledgement</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Result Ack Timestamp: ${safeAckTimestamp || 'Not provided'}</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const internalSubject = sanitizeHeaderValue(`💪 New Low-T Lead: ${name || email} — ${internalTier}`);

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
        source: 'low-t-quiz',
        recommendation: internalTier,
        budget: '',
        goal: 'low-t',
        concern: tierLabel
      })
    }).catch(err => console.error('[low-t-quiz-submit] Clinic lead sync error:', err && err.message));

    // Marketing drip webhook
    fetch(clinicApi + '/api/marketing/quiz-complete', {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        email,
        name,
        quiz_type: 'low-t',
        source: 'low-t-quiz',
        recommendation: internalTier,
        tier: internalTier,
        tierLabel: tierLabel,
        resultSlug: resultSlug,
        adamPositive: adamPositive,
        adamYesCount: adamYesCount,
        ipssSum: ipssSum,
        bmi: bmi != null ? bmi : '',
        hasHardStopMedical: hasHardStopMedical,
        hasFertilityStop: hasFertilityStop,
        hasPsaConcern: hasPsaConcern,
        hasIpssConcern: hasIpssConcern,
        hasOsaConfounder: hasOsaConfounder,
        hasMedConfounder: hasMedConfounder,
        phone: phone || '',
        marketingOptIn: optIn,
        age: safeProfile.age != null ? safeProfile.age : '',
        heightInches: safeProfile.heightInches != null ? safeProfile.heightInches : '',
        weightLbs: safeProfile.weightLbs != null ? safeProfile.weightLbs : '',
        fertilityPlan: safeProfile.fertilityPlan || '',
        sleepHours: safeProfile.sleepHours != null ? safeProfile.sleepHours : '',
        medicalHistoryCount: safeProfile.medicalHistoryCount,
        psaTier: safeProfile.psaTier || '',
        medicationCount: safeProfile.medicationCount,
        stateCode: safeProfile.stateCode || '',
        ackTimestamp: ackTimestamp || ''
      })
    }).catch(err => console.error('[low-t-quiz-submit] Marketing drip sync error:', err && err.message));

    // SMS follow-up — only if phone provided AND marketing opt-in is true.
    if (phone && optIn === true) {
      try {
        await fetch(clinicApi + '/api/webhooks/quiz-sms', {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({
            phone: phone,
            name: name,
            peptide: 'low-t-' + internalTier,
            quiz_type: 'low-t'
          })
        });
      } catch (e) {
        // Non-fatal — don't block the response
        console.error('[low-t-quiz-submit] Quiz SMS webhook error:', e && e.message);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    // Log only the message — Resend's error response may contain the email
    // payload (PHI) and Netlify Function logs are not in the BAA scope.
    console.error('[low-t-quiz-submit] Error:', err && err.message);
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
