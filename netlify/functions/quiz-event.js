/**
 * quiz-event.js — First-party analytics endpoint
 * ==============================================
 * Replaces the third-party tracker stack (GA4 / Google Ads / Meta CAPI / Ahrefs)
 * for quiz funnel measurement on health-data pages.
 *
 * Accepts ONLY generic, non-health funnel events:
 *   { quiz: 'peptide' | 'hormone' | 'body-comp', event: '<slug>', screen?: string|number, timestamp?: ISO string }
 *
 * REJECTS any payload that contains health-condition values, symptom severity,
 * peptide/drug names, or medical history terms — even in nested fields.
 *
 * Logs to Netlify Functions console for now.
 * TODO: Replace console logging with Postgres insert once a first-party analytics
 *       DB is provisioned. No raw-event retention beyond 90 days. Aggregate counts only.
 */

// Allowed quiz slugs (low-cardinality enum). Anything else → 400.
// `site` is reserved for site-wide generic CTAs (booking modal, phone tap)
// where there is no quiz context but we still want a generic funnel signal.
const ALLOWED_QUIZZES = new Set(['peptide', 'hormone', 'body-comp', 'bone-density', 'site']);

// Allowed event names (generic funnel only, no health values).
const ALLOWED_EVENTS = new Set([
  'quiz_start',
  'quiz_step',
  'screen_advance',
  'quiz_back',
  'quiz_retake',
  'quiz_email_submit',
  'quiz_info_submit',
  'quiz_complete',
  'quiz_results_view',
  'quiz_cta_click',
  'lead_capture',
  'cta_click',
  'chat_open',
  'exit_intent_shown',
]);

// Health-data terms that must NEVER appear anywhere in the payload.
// Reject the request if any of these substrings appear (case-insensitive)
// in any string value of the request body.
const HEALTH_TERMS = [
  // Symptom / concern keywords
  'libido', 'arousal', 'erectile', 'sexual', 'menopause', 'perimenopause',
  'hormone', 'testosterone', 'estrogen', 'progesterone', 'cortisol', 'thyroid',
  'ibs', 'leaky', 'gut', 'nsaid', 'tendon', 'wound', 'wrinkle',
  'hair-loss', 'hair loss', 'fatigue', 'brain-fog', 'brain fog',
  'depression', 'anxiety', 'insomnia', 'inflammation',
  // Severity / chronicity values
  'mild', 'moderate', 'significant', 'severe',
  // Peptide / drug names
  'bpc-157', 'bpc157', 'tb-500', 'tb500', 'ghk-cu', 'ghk',
  'pt-141', 'pt141', 'sermorelin', 'ipamorelin', 'cjc-1295', 'cjc1295',
  'wolverine', 'glow-stack', 'glow stack', 'semaglutide', 'tirzepatide',
  'glp-1', 'glp1', 'enclomiphene', 'clomiphene',
  // Classification labels
  'low-testosterone', 'low testosterone', 'optimal', 'borderline', 'deficient',
  // Goal categories that imply health context
  'injury', 'post-surgical', 'post surgical', 'gut-inflammation',
];

function containsHealthTerm(value) {
  if (typeof value !== 'string') return false;
  const lower = value.toLowerCase();
  for (const term of HEALTH_TERMS) {
    if (lower.indexOf(term) !== -1) return true;
  }
  return false;
}

function deepHasHealthTerm(obj) {
  if (obj == null) return false;
  if (typeof obj === 'string') return containsHealthTerm(obj);
  if (typeof obj !== 'object') return false;
  for (const key in obj) {
    // Reject suspicious key names too.
    if (containsHealthTerm(key)) return true;
    if (deepHasHealthTerm(obj[key])) return true;
  }
  return false;
}

function badRequest(reason) {
  return new Response(JSON.stringify({ status: 'error', reason }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', reason: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return badRequest('invalid_json');
  }

  if (!body || typeof body !== 'object') return badRequest('invalid_body');

  const { quiz, event, screen, timestamp } = body;

  // Strict validation
  if (typeof quiz !== 'string' || !ALLOWED_QUIZZES.has(quiz)) {
    return badRequest('invalid_quiz');
  }
  if (typeof event !== 'string' || !ALLOWED_EVENTS.has(event)) {
    return badRequest('invalid_event');
  }
  // screen is optional; if present must be a short string or small int.
  if (screen !== undefined && screen !== null) {
    const screenStr = String(screen);
    if (screenStr.length > 24) return badRequest('invalid_screen');
    if (containsHealthTerm(screenStr)) return badRequest('disallowed_value');
  }
  // timestamp is optional; if present must be a valid ISO string.
  if (timestamp !== undefined && timestamp !== null) {
    if (typeof timestamp !== 'string' || isNaN(Date.parse(timestamp))) {
      return badRequest('invalid_timestamp');
    }
  }

  // Only the four documented fields are allowed; reject any extra fields.
  // `quiz` is a trusted enum (validated above) so we exclude it from the
  // health-term scan — the slug `hormone` is a category label here, not a
  // health-condition value attached to a user. The OTHER fields must be
  // free of health terms.
  const allowedKeys = new Set(['quiz', 'event', 'screen', 'timestamp']);
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) return badRequest('unexpected_field');
  }
  const scanTarget = { event, screen, timestamp };
  if (deepHasHealthTerm(scanTarget)) return badRequest('disallowed_value');

  // TODO: Replace this console log with a Postgres insert (or Netlify Blobs
  // append) once a first-party analytics DB is provisioned. Retain raw events
  // for at most 90 days; aggregate to counts after 24 hours. Never JOIN against
  // patient records.
  const record = {
    quiz,
    event,
    screen: screen != null ? String(screen) : null,
    ts: timestamp || new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log('[quiz-event]', JSON.stringify(record));

  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
