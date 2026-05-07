/**
 * shared/attribution-capture.js — Marketing source attribution
 * ============================================================
 *
 * Captures upstream marketing attribution (utm_*, gclid, fbclid, msclkid,
 * landing_page, last_page, referrer) on first landing in a session.
 * Persists in sessionStorage so it survives navigation across pages.
 *
 * On every page load:
 *   - If no stored attribution: capture from URL + document.referrer
 *   - Always update last_page to current path (so we know which page
 *     they were on right before submitting any form)
 *
 * SCOPE: this script captures MARKETING channel signals only — no health
 * data, no quiz answers, no symptoms. The captured object is forwarded
 * by the quiz email-capture flow to the clinic lead webhook.
 *
 * CONFLICT-FREE WITH booking-attribution.js: that script handles the
 * `?source=quiz-name&result=tier` post-quiz propagation to the EHR
 * booker URL. This script handles upstream UTM/click-id capture.
 * Different storage key, different concern.
 *
 * Exposes:
 *   window.MoonshotAttribution.get()      → full object
 *   window.MoonshotAttribution.getFlat()  → flat key:value object suitable
 *                                            for form payloads / JSON
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'moonshot_marketing_attribution';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  var URL_FIELDS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gclid',
    'fbclid',
    'msclkid',
  ];

  function safeRead(key) {
    try {
      var raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.captured_at_ms === 'number' &&
          (Date.now() - parsed.captured_at_ms) > TTL_MS) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private browsing / quota — fail silent */
    }
  }

  function clamp(s) {
    if (typeof s !== 'string') return null;
    if (!s.length) return null;
    return s.length > 256 ? s.slice(0, 256) : s;
  }

  function captureFromUrl() {
    var out = {};
    try {
      var params = new URLSearchParams(window.location.search || '');
      for (var i = 0; i < URL_FIELDS.length; i++) {
        var key = URL_FIELDS[i];
        var val = clamp(params.get(key));
        if (val) out[key] = val;
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  function getReferrer() {
    try {
      var ref = document.referrer || '';
      if (!ref) return null;
      // Drop our own domain — internal navigations are not the referrer
      // we care about.
      var host = '';
      try { host = new URL(ref).host; } catch (e) { return null; }
      if (host === window.location.host) return null;
      return clamp(ref);
    } catch (e) {
      return null;
    }
  }

  var existing = safeRead(STORAGE_KEY);
  var nowIso = (function () {
    try { return new Date().toISOString(); } catch (e) { return ''; }
  })();
  var currentPath = (window.location.pathname || '/') + (window.location.search || '');
  if (currentPath.length > 256) currentPath = currentPath.slice(0, 256);

  if (!existing) {
    var captured = captureFromUrl();
    var referrer = getReferrer();
    if (referrer) captured.referrer = referrer;
    captured.landing_page = currentPath;
    captured.last_page = currentPath;
    captured.session_started_at = nowIso;
    captured.captured_at_ms = Date.now();
    safeWrite(STORAGE_KEY, captured);
    existing = captured;
  } else {
    // Update last_page so we always have the most-recent path before submit.
    if (existing.last_page !== currentPath) {
      existing.last_page = currentPath;
      safeWrite(STORAGE_KEY, existing);
    }
  }

  function publicGet() {
    return safeRead(STORAGE_KEY) || {};
  }

  // Read UTMs that header.js may have stashed in localStorage with a longer
  // TTL (used for the EHR-side Google Ads Conversion API upload). Used as a
  // fallback so a user who landed days earlier still has UTM context attached
  // to the lead they convert today.
  function readLegacyLocalStorage() {
    var out = {};
    try {
      var utmRaw = window.localStorage.getItem('mmp_utm_attribution');
      if (utmRaw) {
        var utmObj = JSON.parse(utmRaw);
        if (utmObj && typeof utmObj === 'object') {
          ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
            if (typeof utmObj[k] === 'string' && utmObj[k]) out[k] = clamp(utmObj[k]);
          });
        }
      }
    } catch (e) { /* ignore */ }
    try {
      var clickRaw = window.localStorage.getItem('mmp_google_click_id');
      if (clickRaw) {
        var clickObj = JSON.parse(clickRaw);
        if (clickObj && typeof clickObj === 'object' && typeof clickObj.gclid === 'string' && clickObj.gclid) {
          out.gclid = clamp(clickObj.gclid);
        }
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  function publicGetFlat() {
    var obj = publicGet();
    var legacy = readLegacyLocalStorage();
    var out = {};
    var keys = URL_FIELDS.concat(['landing_page', 'last_page', 'referrer', 'session_started_at']);
    // Session capture wins over legacy localStorage (more recent).
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (typeof obj[k] === 'string' && obj[k].length) out[k] = obj[k];
    }
    // Backfill any UTM/gclid the session capture missed (user landed before
    // this script existed but header.js had captured the legacy keys).
    Object.keys(legacy).forEach(function (k) {
      if (!out[k]) out[k] = legacy[k];
    });
    return out;
  }

  window.MoonshotAttribution = {
    get: publicGet,
    getFlat: publicGetFlat,
  };
})();
