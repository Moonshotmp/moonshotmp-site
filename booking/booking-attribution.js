/**
 * booking-attribution.js - Source-attributed booking flow
 * =======================================================
 * Phase 0 - TASK T5
 *
 * Reads ?source= and ?result= URL params on /booking/, stores attribution
 * in localStorage, fires a HBNR-compliant first-party analytics event,
 * personalizes the intro for warm-quiz traffic, and propagates source/result
 * to the EHR booker URL.
 *
 * PRIVACY (HBNR):
 *   We persist only quiz NAME (e.g. "glp1-quiz") and result TIER slug
 *   (e.g. "tier-1") in localStorage. We DO NOT capture symptoms, peptide
 *   names, medication names, severity values, or any other health data.
 *
 *   The first-party /.netlify/functions/quiz-event endpoint enforces a
 *   strict allowlist on `quiz` and `event` and rejects health terms even
 *   in nested fields. We send only the minimum allowed payload - the slug
 *   string is NOT forwarded over the network. localStorage is purely
 *   client-side and used only to render a personalized intro.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mmp_booking_attribution';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  // -- 1. Read URL params -------------------------------------------------
  var params = new URLSearchParams(window.location.search || '');
  var urlSource = (params.get('source') || '').trim().toLowerCase();
  var urlResult = (params.get('result') || '').trim().toLowerCase();

  // Allowlist of source slugs we recognize. Anything else falls through to
  // a generic warm-traffic message but does NOT get persisted as a label
  // to avoid storing arbitrary attacker-controlled strings.
  var SOURCE_LABELS = {
    'peptide-quiz': 'You completed our Peptide Quiz',
    'bone-density-quiz': 'You completed our Bone Density Screener',
    'glp1-quiz': 'You completed our GLP-1 Readiness Quiz',
    'low-t-quiz': 'You completed our Low Testosterone Quiz',
    'perimenopause-quiz': 'You completed our Perimenopause Screener',
    'hormone-quiz': 'You completed our Hormone Quiz',
    'body-comp-quiz': 'You completed our Body Composition Quiz',
    'dexa-scan-park-ridge': 'You read about our DEXA scan service in Park Ridge',
    'dexa-scan-chicago': 'You read about our DEXA scan service for Chicago patients',
    'dexa-scan': 'You read about our DEXA scan service',
    'trt-park-ridge': 'You read about our TRT service in Park Ridge',
    'glp1-park-ridge': 'You read about our medical weight loss service in Park Ridge',
    'peptides-park-ridge': 'You read about our peptide therapy in Park Ridge',
  };

  // Map from arbitrary `source` slug to the strict `quiz` enum the
  // /.netlify/functions/quiz-event endpoint accepts.
  // Endpoint allowlist: peptide | hormone | body-comp | bone-density | perimenopause | low-t | glp1 | site
  function mapSourceToQuizEnum(source) {
    if (!source) return 'site';
    if (source.indexOf('peptide') !== -1) return 'peptide';
    if (source.indexOf('perimenopause') !== -1) return 'perimenopause';
    if (source.indexOf('low-t') !== -1) return 'low-t';
    if (source.indexOf('glp1') !== -1 || source.indexOf('glp-1') !== -1) return 'glp1';
    if (source.indexOf('hormone') !== -1 ||
        source.indexOf('trt') !== -1) {
      return 'hormone';
    }
    if (source.indexOf('bone-density') !== -1) return 'bone-density';
    if (source.indexOf('body') !== -1 || source.indexOf('dexa') !== -1) {
      return 'body-comp';
    }
    return 'site';
  }

  // -- 2. Load existing attribution + merge with URL params ---------------
  function loadStoredAttribution() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      // TTL - discard if older than 30 days.
      if (typeof parsed.ts === 'number' && (Date.now() - parsed.ts) > TTL_MS) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveAttribution(attr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attr));
    } catch (e) {
      // Storage may be disabled (Safari private mode); fail silent.
    }
  }

  var stored = loadStoredAttribution() || {};
  var attribution = {
    source: urlSource || stored.source || '',
    result: urlResult || stored.result || '',
    ts: Date.now(),
  };

  // Only persist if we got something usable (avoids overwriting older
  // valid attribution with an empty object on a direct visit).
  if (attribution.source || attribution.result) {
    saveAttribution(attribution);
  }

  // -- 3. Fire HBNR-compliant attribution event --------------------------
  // The /.netlify/functions/quiz-event endpoint accepts ONLY the four-field
  // contract { quiz, event, screen?, timestamp? } and rejects any payload
  // containing health terms. We send the minimum safe signal:
  //   - quiz: mapped low-cardinality enum (peptide / hormone / body-comp / glp1 / ... / site)
  //   - event: 'cta_click' (closest allowed event for "landed on booking")
  //   - screen: 'booking' (24-char limit, no health terms)
  // We DO NOT forward the raw `source` slug or `result` tier over the
  // network - those stay client-side for personalization only.
  function fireAttributionEvent() {
    try {
      var payload = {
        quiz: mapSourceToQuizEnum(attribution.source),
        event: 'cta_click',
        screen: 'booking',
        timestamp: new Date().toISOString(),
      };
      if (typeof fetch === 'function') {
        fetch('/.netlify/functions/quiz-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(function () {
          // Network errors are non-fatal - analytics is best-effort.
          if (typeof console !== 'undefined') {
            console.log('booking_attribution_fallback', payload);
          }
        });
      } else if (typeof console !== 'undefined') {
        console.log('booking_attribution', payload);
      }
    } catch (e) {
      // Never break the booking page over an analytics failure.
    }
  }
  fireAttributionEvent();

  // -- 4. Render personalized intro --------------------------------------
  function renderPersonalizedIntro() {
    var slot = document.getElementById('mmp-booking-personalized-intro');
    if (!slot) return;
    var src = attribution.source;
    if (!src) return;
    var label = SOURCE_LABELS[src] || 'You showed interest in our services';
    // Build text node - we explicitly avoid innerHTML with any user-controlled
    // value. The provider name is a static string template.
    var p = document.createElement('p');
    p.className = 'text-brand-dark text-base md:text-lg mb-4 max-w-3xl mx-auto';
    var bold = document.createElement('strong');
    bold.textContent = label + '.';
    p.appendChild(bold);
    p.appendChild(document.createTextNode(
      ' Your 45-minute consult with Missy Zammichieli, DNP, FNP-BC will ' +
      'cover your specific situation, lab review, and treatment options.'
    ));
    slot.appendChild(p);
    slot.classList.remove('hidden');
  }

  // -- 5. Propagate source/result + Google click-id + UTMs to EHR booker --
  // Click-id (gclid / gbraid / wbraid) and utm_* tags are captured site-wide
  // in header.js. We read them back here and forward to the EHR so the
  // conversion upload can fire server-side after booking confirmation, and
  // so we can slice our own bookings by campaign. See header.js privacy
  // notes - opaque tokens only, no health data.
  var ATTR_TTL = 90 * 24 * 60 * 60 * 1000; // 90-day Google Ads attribution window
  function loadAttributionFromStorage(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.ts === 'number' && (Date.now() - parsed.ts) > ATTR_TTL) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function decorateEhrLinks() {
    var links = document.querySelectorAll('a[data-ehr-booker]');
    if (!links || !links.length) return;
    var src = attribution.source;
    var res = attribution.result;
    var click = loadAttributionFromStorage('mmp_google_click_id');
    var utm = loadAttributionFromStorage('mmp_utm_attribution');
    if (!src && !res && !click && !utm) return;
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      try {
        var url = new URL(a.getAttribute('href'), window.location.origin);
        if (src) url.searchParams.set('source', src);
        if (res) url.searchParams.set('result', res);
        if (click && click.gclid) url.searchParams.set('gclid', click.gclid);
        if (click && click.gbraid) url.searchParams.set('gbraid', click.gbraid);
        if (click && click.wbraid) url.searchParams.set('wbraid', click.wbraid);
        if (utm && utm.utm_source) url.searchParams.set('utm_source', utm.utm_source);
        if (utm && utm.utm_medium) url.searchParams.set('utm_medium', utm.utm_medium);
        if (utm && utm.utm_campaign) url.searchParams.set('utm_campaign', utm.utm_campaign);
        if (utm && utm.utm_term) url.searchParams.set('utm_term', utm.utm_term);
        if (utm && utm.utm_content) url.searchParams.set('utm_content', utm.utm_content);
        a.setAttribute('href', url.toString());
      } catch (e) {
        // Bad href - leave untouched.
      }
    }
  }

  // -- 6. Callback form ---------------------------------------------------
  // Posts to /.netlify/functions/booking-callback, which mails the front desk.
  // The receipt shows only once the function answers ok; any failure tells
  // the visitor to call or text instead, so no request is silently lost.
  var callbackRenderedAt = Date.now();

  function showCallbackMessage(msgEl, ok) {
    if (!msgEl) return;
    msgEl.textContent = '';
    msgEl.classList.remove('hidden', 'text-brand-slate');
    msgEl.classList.add('font-bold');
    if (ok) {
      msgEl.style.color = '';
      msgEl.classList.add('text-brand-dark');
      msgEl.textContent = "Got it. We'll call you within 1 business day.";
      return;
    }
    // Error red inline: the compiled tailwind.css has no red utilities.
    msgEl.style.color = '#b91c1c';
    msgEl.appendChild(document.createTextNode("We couldn't send that. Call or text "));
    var tel = document.createElement('a');
    tel.href = 'tel:+12244354280';
    tel.className = 'underline font-bold';
    tel.textContent = '224-435-4280';
    msgEl.appendChild(tel);
    msgEl.appendChild(document.createTextNode(" and we'll get you booked."));
  }

  function wireCallbackForm() {
    var form = document.getElementById('mmp-callback-form');
    if (!form) return;
    var sending = false;
    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      if (sending) return;
      var nameEl = form.querySelector('[name="name"]');
      var phoneEl = form.querySelector('[name="phone"]');
      var trapEl = form.querySelector('[name="website"]');
      var emailEl = form.querySelector('[name="email"]');
      var button = form.querySelector('button[type="submit"]');
      var msgEl = document.getElementById('mmp-callback-msg');
      var name = (nameEl && nameEl.value || '').trim();
      var phone = (phoneEl && phoneEl.value || '').trim();
      var digits = phone.replace(/\D/g, '');
      var phoneOk = digits.length === 10 || (digits.length === 11 && digits.charAt(0) === '1');
      if (!name || !phoneOk) {
        if (msgEl) {
          msgEl.textContent = 'Please enter your name and a 10-digit phone number.';
          msgEl.classList.remove('hidden', 'text-brand-dark', 'font-bold');
          msgEl.style.color = '#b91c1c';
        }
        return;
      }

      sending = true;
      var label = button ? button.textContent : '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Sending...';
      }
      if (msgEl) msgEl.classList.add('hidden');

      var payload = {
        name: name,
        phone: phone,
        email: (emailEl && emailEl.value || '').trim(),
        source: attribution.source || '',
        result: attribution.result || '',
        page_url: window.location.origin + window.location.pathname,
        website: trapEl ? trapEl.value : '',
        elapsed_ms: Date.now() - callbackRenderedAt,
      };

      function done(ok) {
        sending = false;
        if (button) {
          button.disabled = false;
          button.textContent = label;
        }
        if (ok) {
          form.reset();
          form.classList.add('hidden');
        }
        showCallbackMessage(msgEl, ok);
      }

      if (typeof fetch !== 'function') {
        done(false);
        return;
      }
      fetch('/.netlify/functions/booking-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (res) {
        if (!res.ok) return { ok: false };
        return res.json().catch(function () { return { ok: false }; });
      }).then(function (body) {
        done(!!(body && body.ok === true));
      }).catch(function () {
        done(false);
      });
    });
  }

  // -- Init ---------------------------------------------------------------
  function init() {
    renderPersonalizedIntro();
    decorateEhrLinks();
    wireCallbackForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
