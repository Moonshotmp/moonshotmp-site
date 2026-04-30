/**
 * Meta CAPI tracker — DISABLED 2026-04-30
 * ========================================
 * This file previously auto-detected the page type (`/booking/`, `/quiz/results`,
 * `/medical/`, `/learn/`, `/blood-work/`, `/rehab/`, `tel:` clicks) and fired
 * `Schedule`, `CompleteRegistration`, `ViewContent`, and `Contact` events to
 * `/.netlify/functions/meta-capi`, which relayed to the Meta Graph API with
 * client IP, user agent, and `_fbp`/`_fbc` cookies — i.e. identifiable
 * cross-site tracking of health intent.
 *
 * That auto-fire logic has been stripped. The file is retained only so any
 * lingering `<script src="/shared/meta-tracking.js">` tags don't 404 in the
 * browser. It is no longer loaded by `shared/header.js`.
 *
 * The Netlify function `/.netlify/functions/meta-capi` is now dormant — no
 * caller exists. It can be deleted in a follow-up task along with the
 * `META_PIXEL_ID` / `META_CAPI_TOKEN` env vars in the Netlify dashboard.
 *
 * Do NOT re-enable Meta tracking from this file. If conversion measurement
 * for paid Meta campaigns is needed, use server-side Conversions API only
 * from booking success confirmation pages with hashed user data — never
 * from health pages, never with event_source_url exposing the visited path.
 *
 * See ~/seo-analytics/audits/tracker-audit.md for the full strip plan.
 */

(function () {
  // Intentionally empty — no auto-fire, no event handlers, no network requests.
})();
