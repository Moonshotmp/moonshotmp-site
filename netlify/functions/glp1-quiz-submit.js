import { sendEmail } from './send-email.js';

const INTERNAL_TIER_VALUES = new Set([
  'contraindication-identified',
  'specialist-evaluation',
  'eligibility-not-met-bmi',
  'eligibility-mixed',
  'eligibility-present'
]);

// Server-side label lookup. We never trust the client's tierLabel — the engine
// could be stale, the value could be tampered, and HTML interpolation of any
// client-controlled string is an XSS vector for Tom's inbox.
const TIER_LABEL_LOOKUP = {
  'contraindication-identified': 'Contraindication identified',
  'specialist-evaluation':       'Specialist evaluation indicated',
  'eligibility-not-met-bmi':     'Eligibility factors not met',
  'eligibility-mixed':           'Eligibility factors mixed',
  'eligibility-present':         'Eligibility factors present'
};

const RESULT_SLUG_LOOKUP = {
  'contraindication-identified': 'contraindication',
  'specialist-evaluation':       'specialist',
  'eligibility-not-met-bmi':     'not-met',
  'eligibility-mixed':           'mixed',
  'eligibility-present':         'present'
};

const CTA_TEXT = {
  'contraindication-identified': 'Book a non-prescription evaluation',
  'specialist-evaluation':       'Book a consultation',
  'eligibility-not-met-bmi':     'Book a comprehensive evaluation',
  'eligibility-mixed':           'Book a consultation',
  'eligibility-present':         'Book a comprehensive consultation'
};

// Tier body strings — server-side constants only. Drug-name guardrails apply:
// no semaglutide / tirzepatide / Wegovy / Zepbound / Ozempic / Mounjaro /
// Saxenda / Victoza / Trulicity / Rybelsus. Use FDA-labeling framing only.
const TIER_BODY_CONTRAINDICATION = "Based on your responses, your medical history requires clinical attention before any prescription weight-management medication is considered. Please discuss with your primary care physician or the appropriate specialist. We recommend a non-prescription evaluation path until any contraindications are addressed.";
const TIER_BODY_SPECIALIST = "Your responses describe prior bariatric surgery. Medical weight management after bariatric surgery typically requires specialist evaluation — a consultation can identify whether on-site care or a referral path fits your situation.";
const TIER_BODY_NOT_MET = "Based on your responses, the FDA labeling threshold for prescription weight-management medications (BMI of 30 or higher, or BMI of 27 or higher with a weight-related condition) is not met. Comprehensive evaluation can still be useful — a consultation can review the full clinical picture and identify which evaluation paths fit your goals.";
const TIER_BODY_MIXED = "Your responses describe a mix of factors. Some elements meet the FDA labeling expectations for prescription weight-management medications, and others — including documented prior weight-loss attempts and current readiness — require clinical evaluation to determine whether prescription therapy is appropriate. Book a consultation to discuss which evaluation path fits your situation.";
const TIER_BODY_PRESENT = "Your responses describe characteristics that the FDA labeling for prescription weight-management medications lists as relevant to candidacy. This is not a determination that you are a candidate. Only a licensed clinician, after a comprehensive in-person evaluation including medical history and laboratory testing, can determine whether any prescription therapy is appropriate. Book a consultation to begin that evaluation.";

// No-compounding disclaimer — required on every GLP-1 patient-facing message
// per universal guardrail. We do not market or sell compounded versions of
// FDA-approved medications as substitutes.
const NO_COMPOUNDING_DISCLAIMER = "We do not market or sell compounded versions of FDA-approved medications as substitutes for those products. Eligibility for any specific medication is determined by a licensed clinician after a comprehensive in-person evaluation.";

const RESULT_DISCLAIMER = "This is a screening tool, not a clinical diagnosis or prescription. " + NO_COMPOUNDING_DISCLAIMER;

// Missy-only attribution — she has FPA. Do NOT add other clinicians here.
const AUTHOR_ATTRIBUTION = "Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC. This review is of the tool, not of your individual responses. You have not been examined or treated by Moonshot Medical.";

const UNIVERSAL_DISCLAIMER = 'This tool does not, and is not intended to, diagnose any medical condition or recommend any specific treatment, drug, dose, or protocol. Screening tools have known false-positive and false-negative rates. Completing this quiz does not establish a provider-patient or treatment relationship, does not constitute a medical examination, and does not entitle you to any specific treatment, prescription, or service. Medical services are provided by Moonshot Medical, PLLC and are available only to patients physically located in states where our clinicians are licensed (currently Illinois). By proceeding you confirm you are at least 18 years old.';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATE_REGEX = /^[A-Z]{2}$/;

// Mirror allowlists from quiz/glp1/scoring.js — kept in sync manually since
// this Netlify function is a separate runtime.
const SEX_VALUES = new Set(['male', 'female', 'prefer-not']);
const PRIOR_ATTEMPT_VALUES = new Set(['yes', 'no', 'prefer-not']);
const PREGNANCY_VALUES = new Set(['yes', 'no']);
const BARIATRIC_VALUES = new Set(['yes', 'no']);

const COMORBIDITY_KEYS = new Set([
  't2d-or-prediabetes',
  'high-blood-pressure',
  'high-cholesterol',
  'sleep-apnea',
  'pcos',
  'nafld',
  'cardiovascular-disease',
  'none'
]);

const MED_HISTORY_KEYS = new Set([
  'mtc-or-men2',
  'pancreatitis',
  'severe-gastroparesis',
  't1d',
  'eating-disorder',
  'suicidal-ideation-or-recent-psych-hospitalization',
  'severe-esrd',
  'severe-diabetic-retinopathy-on-insulin',
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

// Recompute BMI server-side from allowlist-validated height/weight. Never trust
// the client's `result.bmi` — a tampered or buggy client could submit a value
// that doesn't match the height/weight shown elsewhere in the lead email.
function serverComputeBmi(heightInches, weightLbs) {
  if (!Number.isFinite(heightInches) || heightInches <= 0) return null;
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) return null;
  const meters = heightInches * 0.0254;
  const kg = weightLbs * 0.45359237;
  return kg / (meters * meters);
}

// Pick the patient-facing tier body string. Server-derived only — never let
// the client pass arbitrary copy.
function selectTierBody(internalTier) {
  switch (internalTier) {
    case 'contraindication-identified': return TIER_BODY_CONTRAINDICATION;
    case 'specialist-evaluation': return TIER_BODY_SPECIALIST;
    case 'eligibility-not-met-bmi': return TIER_BODY_NOT_MET;
    case 'eligibility-mixed': return TIER_BODY_MIXED;
    case 'eligibility-present': return TIER_BODY_PRESENT;
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

  // Allowlist-validate every profile field before interpolation. Anything that
  // doesn't match its enum is replaced with an empty string for the email.
  const rawProfile = profile || {};

  const rawComorbidities = Array.isArray(rawProfile.comorbidityCategories)
    ? rawProfile.comorbidityCategories
    : [];
  const safeComorbidities = [];
  for (let i = 0; i < rawComorbidities.length && i < MAX_CATEGORY_ARRAY_LENGTH && safeComorbidities.length < COMORBIDITY_KEYS.size; i++) {
    const c = rawComorbidities[i];
    if (typeof c === 'string' && COMORBIDITY_KEYS.has(c) && safeComorbidities.indexOf(c) === -1) {
      safeComorbidities.push(c);
    }
  }

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

  // ASCVD numbers — each validated independently; out-of-range → null.
  const rawAscvd = (rawProfile.ascvd && typeof rawProfile.ascvd === 'object') ? rawProfile.ascvd : {};
  const totalCholesterol = (Number.isFinite(rawAscvd.totalCholesterol) && rawAscvd.totalCholesterol >= 50 && rawAscvd.totalCholesterol <= 500)
    ? rawAscvd.totalCholesterol
    : null;
  const ldl = (Number.isFinite(rawAscvd.ldl) && rawAscvd.ldl >= 0 && rawAscvd.ldl <= 400)
    ? rawAscvd.ldl
    : null;
  const hdl = (Number.isFinite(rawAscvd.hdl) && rawAscvd.hdl >= 10 && rawAscvd.hdl <= 150)
    ? rawAscvd.hdl
    : null;

  // Server cap mirrors the client textarea clamp (200 chars). The engine only
  // forwards a length count, but bound it tight for parity / defense-in-depth.
  const rawOtherConditionLength = rawProfile.otherConditionLength;
  const otherConditionLength = (Number.isFinite(rawOtherConditionLength) && rawOtherConditionLength >= 0 && rawOtherConditionLength <= 200)
    ? Math.floor(rawOtherConditionLength)
    : 0;

  const safeProfile = {
    age: Number.isFinite(rawProfile.age) && rawProfile.age >= 18 && rawProfile.age <= 120 ? Math.floor(rawProfile.age) : null,
    sex: SEX_VALUES.has(rawProfile.sex) ? rawProfile.sex : '',
    heightInches: Number.isFinite(rawProfile.heightInches) && rawProfile.heightInches > 0 && rawProfile.heightInches <= 96 ? rawProfile.heightInches : null,
    weightLbs: Number.isFinite(rawProfile.weightLbs) && rawProfile.weightLbs > 0 && rawProfile.weightLbs <= 1000 ? rawProfile.weightLbs : null,
    comorbidityCount: safeComorbidities.length,
    comorbidityCategories: safeComorbidities,
    priorAttempt: PRIOR_ATTEMPT_VALUES.has(rawProfile.priorAttempt) ? rawProfile.priorAttempt : '',
    medicalHistoryCount: safeMedHistory.length,
    medicalHistoryCategories: safeMedHistory,
    pregnancyOrPlanning: PREGNANCY_VALUES.has(rawProfile.pregnancyOrPlanning) ? rawProfile.pregnancyOrPlanning : '',
    bariatricHistory: BARIATRIC_VALUES.has(rawProfile.bariatricHistory) ? rawProfile.bariatricHistory : '',
    otherConditionLength: otherConditionLength,
    readiness: Number.isFinite(rawProfile.readiness) && rawProfile.readiness >= 1 && rawProfile.readiness <= 5 ? Math.floor(rawProfile.readiness) : null,
    stateCode: typeof rawProfile.stateCode === 'string' && STATE_REGEX.test(rawProfile.stateCode.toUpperCase()) ? rawProfile.stateCode.toUpperCase() : ''
  };

  // Server-derived BMI from the allowlist-validated height/weight. Never trust
  // `result.bmi` — recompute so the lead email and webhook payloads cannot be
  // tricked into showing a falsified value.
  const bmi = serverComputeBmi(safeProfile.heightInches, safeProfile.weightLbs);

  // Re-derive every result flag from safeProfile rather than result.* so the
  // internal email and marketing-drip webhook payload stay consistent with the
  // actual profile data Tom sees in the lead notification. The medical-history
  // allowlist contains hard-stop keys + 'none', so any survivor that isn't
  // 'none' is a hard-stop. The engine clamps otherConditionLength to a
  // non-zero value when the raw text is non-empty.
  const hasComorbidity = safeProfile.comorbidityCategories.some(c => c !== 'none' && c !== '');
  const hasMedicalHardStop = safeProfile.medicalHistoryCategories.some(k => k !== 'none' && k !== '');
  const hasPregnancyHardStop = safeProfile.pregnancyOrPlanning === 'yes';
  const hasOtherConditionHardStop = safeProfile.otherConditionLength > 0;
  const hasBariatricModifier = safeProfile.bariatricHistory === 'yes';
  const bmiMeetsThreshold = Number.isFinite(bmi) && (bmi >= 30 || (bmi >= 27 && hasComorbidity));
  const bmiBorderline = Number.isFinite(bmi) && bmi >= 27 && bmi < 30 && !hasComorbidity;
  const bmiBelowThreshold = Number.isFinite(bmi) && bmi < 27;
  const priorAttemptYes = safeProfile.priorAttempt === 'yes';
  const readinessAdequate = Number.isFinite(safeProfile.readiness) && safeProfile.readiness >= 3;

  // ── CTA URL ────────────────────────────────────────────────────────
  const ctaUrl = `https://moonshotmp.com/booking/?source=glp1-quiz&result=${encodeURIComponent(resultSlug)}`;

  // Pre-escaped values for HTML interpolation. Defense-in-depth even though
  // most of these come from server-side enums after validation.
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeTierLabel = escapeHtml(tierLabel);
  const safeTierBody = escapeHtml(tierBody);
  const safeCtaText = escapeHtml(ctaText);
  const safeAckTimestamp = escapeHtml(ackTimestamp);

  // BMI line — only render when computable.
  const bmiBlock = Number.isFinite(bmi)
    ? `<p style="color: #B2BFBE; font-size: 13px; line-height: 1.6; margin: 0;">Your BMI: ${escapeHtml(bmi.toFixed(1))}</p>`
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

      <h1 style="color: #F0EEE9; margin: 0 0 4px; font-size: 22px;">Your GLP-1 Readiness Screener Result</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Moonshot Medical and Performance</p>

      <p style="color: #B2BFBE; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Hi ${safeName || 'there'},</p>

      <!-- Tier Result Card -->
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(178,191,190,0.2); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px;">Result</p>
        <p style="color: #F0EEE9; font-weight: 700; font-size: 20px; margin: 0 0 16px;">${safeTierLabel}</p>
        <p style="color: #B2BFBE; font-size: 14px; line-height: 1.7; margin: 0 0 16px;">${safeTierBody}</p>
        ${bmiBlock}
      </div>

      <!-- Result-page-specific disclaimer (includes no-compounding line) -->
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
      You're receiving this because you completed the GLP-1 Readiness Screener on moonshotmp.com.
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

  const userSubject = 'Your GLP-1 Readiness Screener Result — Moonshot Medical';

  // ── Lead Score ──────────────────────────────────────────────────────

  let leadScore = '🔵 COLD';
  if (internalTier === 'eligibility-present') {
    leadScore = '🔥 HOT';
  } else if (internalTier === 'eligibility-mixed' || internalTier === 'specialist-evaluation') {
    leadScore = '🟡 WARM';
  } else if (internalTier === 'eligibility-not-met-bmi') {
    leadScore = '🔵 COLD';
  } else if (internalTier === 'contraindication-identified') {
    leadScore = '⛔ STOP';
  }

  // ── Internal Lead Notification Email ────────────────────────────────

  const safeComorbiditiesJoined = escapeHtml(safeProfile.comorbidityCategories.join(', '));
  const safeMedHistoryJoined = escapeHtml(safeProfile.medicalHistoryCategories.join(', '));
  const safeBmi = Number.isFinite(bmi) ? escapeHtml(bmi.toFixed(1)) : 'Not calculable';

  // ASCVD card only when at least one value is non-null.
  const hasAscvdValues = (totalCholesterol !== null || ldl !== null || hdl !== null);
  const ascvdBlock = hasAscvdValues
    ? `
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">ASCVD (lipid panel)</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Total Cholesterol: ${totalCholesterol !== null ? escapeHtml(String(totalCholesterol)) : 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">LDL: ${ldl !== null ? escapeHtml(String(ldl)) : 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">HDL: ${hdl !== null ? escapeHtml(String(hdl)) : 'Not provided'}</p>
      </div>`
    : '';

  // Catch-all flag — Q9 free-text was non-empty. Length only; raw text never sent.
  const catchAllBlock = (otherConditionLength > 0)
    ? `<p style="color: #F59E0B; margin: 0 0 24px; font-size: 14px;">⚠️ Catch-all triggered — patient flagged something not in the structured options (${escapeHtml(String(otherConditionLength))} chars). Ask about it on consult.</p>`
    : '<p style="margin: 0 0 24px;"></p>';

  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">⚖️ New GLP-1 Lead</h1>
      <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Lead Score: ${leadScore}</p>
      ${catchAllBlock}

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
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">BMI: ${safeBmi}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has Comorbidity: ${hasComorbidity ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has Medical Hard-Stop: ${hasMedicalHardStop ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has Pregnancy Hard-Stop: ${hasPregnancyHardStop ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has Other-Condition Hard-Stop: ${hasOtherConditionHardStop ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Has Bariatric Modifier: ${hasBariatricModifier ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">BMI Meets Threshold: ${bmiMeetsThreshold ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">BMI Borderline: ${bmiBorderline ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">BMI Below Threshold: ${bmiBelowThreshold ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Prior Attempt Yes: ${priorAttemptYes ? 'Yes' : 'No'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Readiness Adequate: ${readinessAdequate ? 'Yes' : 'No'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Profile</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Age: ${safeProfile.age != null ? escapeHtml(String(safeProfile.age)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Sex: ${escapeHtml(safeProfile.sex) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Height (in): ${safeProfile.heightInches != null ? escapeHtml(String(safeProfile.heightInches)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Weight (lbs): ${safeProfile.weightLbs != null ? escapeHtml(String(safeProfile.weightLbs)) : 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Comorbidity Count: ${escapeHtml(String(safeProfile.comorbidityCount))}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Comorbidity Categories: ${safeComorbiditiesJoined || 'None'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Prior Attempt: ${escapeHtml(safeProfile.priorAttempt) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Medical History Count: ${escapeHtml(String(safeProfile.medicalHistoryCount))}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Medical History Categories: ${safeMedHistoryJoined || 'None'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Pregnancy / Planning: ${escapeHtml(safeProfile.pregnancyOrPlanning) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Bariatric History: ${escapeHtml(safeProfile.bariatricHistory) || 'Not specified'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Other Condition Length: ${escapeHtml(String(safeProfile.otherConditionLength))} chars</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Readiness: ${safeProfile.readiness != null ? escapeHtml(String(safeProfile.readiness)) : 'Not specified'} / 5</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">State: ${escapeHtml(safeProfile.stateCode) || 'Not specified'}</p>
      </div>

      ${ascvdBlock}

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Acknowledgement</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Result Ack Timestamp: ${safeAckTimestamp || 'Not provided'}</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const internalSubject = sanitizeHeaderValue(`⚖️ New GLP-1 Lead: ${name || email} — ${internalTier}`);

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
        source: 'glp1-quiz',
        recommendation: internalTier,
        budget: '',
        goal: 'glp1',
        concern: tierLabel,
        attribution: data && data.attribution && typeof data.attribution === 'object' ? data.attribution : null
      })
    }).catch(err => console.error('[glp1-quiz-submit] Clinic lead sync error:', err && err.message));

    // Marketing drip webhook
    fetch(clinicApi + '/api/marketing/quiz-complete', {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        email,
        name,
        quiz_type: 'glp1',
        source: 'glp1-quiz',
        recommendation: internalTier,
        tier: internalTier,
        tierLabel: tierLabel,
        resultSlug: resultSlug,
        bmi: Number.isFinite(bmi) ? bmi : '',
        hasComorbidity: hasComorbidity,
        hasMedicalHardStop: hasMedicalHardStop,
        hasPregnancyHardStop: hasPregnancyHardStop,
        hasOtherConditionHardStop: hasOtherConditionHardStop,
        hasBariatricModifier: hasBariatricModifier,
        bmiMeetsThreshold: bmiMeetsThreshold,
        bmiBorderline: bmiBorderline,
        bmiBelowThreshold: bmiBelowThreshold,
        priorAttemptYes: priorAttemptYes,
        readinessAdequate: readinessAdequate,
        phone: phone || '',
        marketingOptIn: optIn,
        age: safeProfile.age != null ? safeProfile.age : '',
        sex: safeProfile.sex || '',
        heightInches: safeProfile.heightInches != null ? safeProfile.heightInches : '',
        weightLbs: safeProfile.weightLbs != null ? safeProfile.weightLbs : '',
        comorbidityCount: safeProfile.comorbidityCount,
        priorAttempt: safeProfile.priorAttempt || '',
        medicalHistoryCount: safeProfile.medicalHistoryCount,
        pregnancyOrPlanning: safeProfile.pregnancyOrPlanning || '',
        bariatricHistory: safeProfile.bariatricHistory || '',
        otherConditionLength: safeProfile.otherConditionLength,
        readiness: safeProfile.readiness != null ? safeProfile.readiness : '',
        stateCode: safeProfile.stateCode || '',
        ackTimestamp: ackTimestamp || ''
      })
    }).catch(err => console.error('[glp1-quiz-submit] Marketing drip sync error:', err && err.message));

    // SMS follow-up — only if phone provided AND marketing opt-in is true.
    if (phone && optIn === true) {
      try {
        await fetch(clinicApi + '/api/webhooks/quiz-sms', {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({
            phone: phone,
            name: name,
            peptide: 'glp1-' + internalTier,
            quiz_type: 'glp1'
          })
        });
      } catch (e) {
        // Non-fatal — don't block the response
        console.error('[glp1-quiz-submit] Quiz SMS webhook error:', e && e.message);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    // Log only the message — Resend's error response may contain the email
    // payload (PHI) and Netlify Function logs are not in the BAA scope.
    console.error('[glp1-quiz-submit] Error:', err && err.message);
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
