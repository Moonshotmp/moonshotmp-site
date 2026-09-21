// Bot guard for the email-only capture forms (lead magnet, peptide guide).
//
// Owner: Tom. Incident: 2026-09-15 subscription-bombing run — a botnet used
// these forms to mail real third-party addresses (gibberish first name,
// dot-scattered Gmail variants) and enrolled them in the drip.
//
// The matching client fields are added by shared/lead-magnets.js,
// shared/peptide-exit-intent.js and shared/peptide-calculator.js:
//   website    — honeypot input, hidden from people, must stay empty
//   elapsed_ms — ms between form render and submit
//
// Callers answer a blocked submission with the normal 200 {ok:true} and do
// nothing else, so the bot gets no signal to adapt to.

const MIN_ELAPSED_MS = 2500;
const MAX_ELAPSED_MS = 6 * 60 * 60 * 1000;
const MAX_GMAIL_DOTS = 3;

export function checkSubmission(data) {
  const d = data || {};

  if (typeof d.website !== 'string') return { ok: false, reason: 'no_guard_fields' };
  if (d.website !== '') return { ok: false, reason: 'honeypot' };

  const elapsed = d.elapsed_ms;
  if (!Number.isFinite(elapsed)) return { ok: false, reason: 'no_guard_fields' };
  if (elapsed < MIN_ELAPSED_MS) return { ok: false, reason: 'too_fast' };
  if (elapsed > MAX_ELAPSED_MS) return { ok: false, reason: 'stale' };

  // Gmail ignores dots, so bombers mint "j.o.h.n.d.o.e@gmail.com" variants of
  // a victim's address. Real addresses almost never carry this many.
  const email = typeof d.email === 'string' ? d.email.trim().toLowerCase() : '';
  const at = email.lastIndexOf('@');
  if (at > 0) {
    const domain = email.slice(at + 1);
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      const dots = email.slice(0, at).split('.').length - 1;
      if (dots > MAX_GMAIL_DOTS) return { ok: false, reason: 'gmail_dots' };
    }
  }

  return { ok: true, reason: null };
}

// Log the reason only — never the address. Function logs are outside the BAA.
export function logBlocked(fn, reason) {
  console.warn(`[antispam] blocked fn=${fn} reason=${reason}`);
}

// Name lands in email HTML; clamp and escape it so the form cannot be used to
// mail arbitrary markup from our domain.
export function safeName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 80)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
