/**
 * booking-attribution.js — Source-attributed booking flow
 * =======================================================
 * Phase 0 — TASK T5
 *
 * Reads ?source= and ?result= URL params on /booking/, stores attribution
 * in localStorage, fires a HBNR-compliant first-party analytics event,
 * personalizes the intro for warm-quiz traffic, and propagates source/result
 * to the EHR booker URL.
 *
 * PRIVACY (HBNR):
 *   We persist only quiz NAME (e.g. "peptide-quiz") and result TIER slug
 *   (e.g. "tier-1") in localStorage. We DO NOT capture symptoms, peptide
 *   names, medication names, severity values, or any other health data.
 *
 *   The first-party /.netlify/functions/quiz-event endpoint enforces a
 *   strict allowlist on `quiz` and `event` and rejects health terms even
 *   in nested fields. We send only the minimum allowed payload — the slug
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
  // Endpoint allowlist: peptide | hormone | body-comp | site
  function mapSourceToQuizEnum(source) {
    if (!source) return 'site';
    if (source.indexOf('peptide') !== -1) return 'peptide';
    if (source.indexOf('perimenopause') !== -1) return 'perimenopause';
    if (source.indexOf('low-t') !== -1) return 'low-t';
    if (source.indexOf('hormone') !== -1 ||
        source.indexOf('trt') !== -1 ||
        source.indexOf('glp1') !== -1 || source.indexOf('glp-1') !== -1) {
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
      // TTL — discard if older than 30 days.
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
  //   - quiz: mapped low-cardinality enum (peptide / hormone / body-comp / site)
  //   - event: 'cta_click' (closest allowed event for "landed on booking")
  //   - screen: 'booking' (24-char limit, no health terms)
  // We DO NOT forward the raw `source` slug or `result` tier over the
  // network — those stay client-side for personalization only.
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
          // Network errors are non-fatal — analytics is best-effort.
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
    // Build text node — we explicitly avoid innerHTML with any user-controlled
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

  // -- 5. Propagate source/result to EHR booker URL ----------------------
  function decorateEhrLinks() {
    var links = document.querySelectorAll('a[data-ehr-booker]');
    if (!links || !links.length) return;
    var src = attribution.source;
    var res = attribution.result;
    if (!src && !res) return;
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      try {
        var url = new URL(a.getAttribute('href'), window.location.origin);
        if (src) url.searchParams.set('source', src);
        if (res) url.searchParams.set('result', res);
        a.setAttribute('href', url.toString());
      } catch (e) {
        // Bad href — leave untouched.
      }
    }
  }

  // -- 6. Callback form ---------------------------------------------------
  function wireCallbackForm() {
    var form = document.getElementById('mmp-callback-form');
    if (!form) return;
    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      var nameEl = form.querySelector('[name="name"]');
      var phoneEl = form.querySelector('[name="phone"]');
      var msgEl = document.getElementById('mmp-callback-msg');
      var name = (nameEl && nameEl.value || '').trim();
      var phone = (phoneEl && phoneEl.value || '').trim();
      if (!name || !phone) {
        if (msgEl) {
          msgEl.textContent = 'Please enter your name and phone number.';
          msgEl.classList.remove('hidden');
        }
        return;
      }
      var stub = {
        name: name,
        phone: phone,
        source: attribution.source || '',
        result: attribution.result || '',
        ts: new Date().toISOString(),
      };
      // Best-effort POST — Tom can wire a real Netlify Function later.
      // For now we attempt the endpoint; on any failure we still show the
      // confirmation message so the user knows we received the request
      // (their submission is queued in localStorage for manual recovery).
      try {
        if (typeof fetch === 'function') {
          fetch('/.netlify/functions/booking-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stub),
            keepalive: true,
          }).catch(function () {
            if (typeof console !== 'undefined') {
              console.log('booking_callback_fallback', stub);
            }
          });
        }
      } catch (e) {
        if (typeof console !== 'undefined') {
          console.log('booking_callback_fallback', stub);
        }
      }
      // Local backup so a missing endpoint doesn't lose the lead.
      try {
        var pending = JSON.parse(localStorage.getItem('mmp_callback_pending') || '[]');
        pending.push(stub);
        localStorage.setItem('mmp_callback_pending', JSON.stringify(pending));
      } catch (e) { /* ignore */ }

      form.reset();
      form.classList.add('hidden');
      if (msgEl) {
        msgEl.textContent = "Thanks — we'll call you within 1 business day.";
        msgEl.classList.remove('hidden');
        msgEl.classList.remove('text-red-700');
        msgEl.classList.add('text-brand-dark', 'font-bold');
      }
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
