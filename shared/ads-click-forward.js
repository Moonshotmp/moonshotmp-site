/**
 * shared/ads-click-forward.js — Ad-safe Google Ads click-id forwarder
 * ===================================================================
 *
 * WHY: The /ads/* landing pages use an "ad-safe static header" and load
 * neither shared/header.js (which captures gclid → localStorage) nor
 * booking-attribution.js (which decorates the EHR booker links). So a paid
 * click landing on /ads/dexa/?gclid=XYZ and clicking "Book" arrived at the
 * clinic booker with NO gclid — the click-id was dropped at the very first
 * hop, on the page where 100% of paid clicks land. Measured gclid capture
 * rate was ~19%; this closes that leak.
 *
 * WHAT: On load, read gclid/gbraid/wbraid + utm_* from the landing URL,
 * persist them in localStorage (90-day window, mirroring header.js keys so
 * the rest of the site stays consistent), and append them to every booking
 * CTA that points at the clinic booker. Falls back to the persisted value
 * if a later /ads page is hit without the param in its URL.
 *
 * PRIVACY (HBNR / HIPAA): click-ids and utm tags are opaque marketing
 * tokens, NOT health data. Nothing is POSTed from this file. The actual
 * server-side conversion upload (from the EHR) uses a generic "Booking"
 * event + dollar value and explicitly omits service/condition. This script
 * only moves opaque tokens from the URL onto a same-org booking link.
 */
(function () {
  'use strict';

  var CLICK_KEY = 'mmp_google_click_id';
  var UTM_KEY = 'mmp_utm_attribution';
  var TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90-day Google Ads attribution window

  // Match header.js validators exactly so storage stays consistent.
  var validClickId = function (v) { return /^[A-Za-z0-9_-]{1,256}$/.test(v); };
  var validUtm = function (v) { return /^[A-Za-z0-9_.\-+|]{1,128}$/.test(v); };

  function readStore(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.ts === 'number' && (Date.now() - parsed.ts) > TTL_MS) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  var params;
  try {
    params = new URLSearchParams(window.location.search || '');
  } catch (e) {
    params = null;
  }
  function urlParam(name) {
    if (!params) return '';
    return (params.get(name) || '').trim();
  }

  // -- 1. Resolve click-id: URL first, then persisted fallback ------------
  var gclid = urlParam('gclid');
  var gbraid = urlParam('gbraid');
  var wbraid = urlParam('wbraid');
  var click = {
    gclid: gclid && validClickId(gclid) ? gclid : null,
    gbraid: gbraid && validClickId(gbraid) ? gbraid : null,
    wbraid: wbraid && validClickId(wbraid) ? wbraid : null,
  };
  if (!click.gclid && !click.gbraid && !click.wbraid) {
    var storedClick = readStore(CLICK_KEY);
    if (storedClick) click = storedClick;
  } else {
    // Persist the fresh click-id (90-day TTL), mirroring header.js shape.
    try {
      localStorage.setItem(CLICK_KEY, JSON.stringify({
        gclid: click.gclid,
        gbraid: click.gbraid,
        wbraid: click.wbraid,
        ts: Date.now(),
        landing_path: window.location.pathname,
      }));
    } catch (e) { /* private mode / quota — fail silent */ }
  }

  // -- 2. Resolve UTMs: URL first, then persisted fallback ----------------
  var utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var utm = {};
  var sawUrlUtm = false;
  for (var i = 0; i < utmFields.length; i++) {
    var v = urlParam(utmFields[i]);
    if (v && validUtm(v)) { utm[utmFields[i]] = v; sawUrlUtm = true; }
  }
  if (sawUrlUtm) {
    try {
      localStorage.setItem(UTM_KEY, JSON.stringify(
        Object.assign({}, utm, { ts: Date.now() })
      ));
    } catch (e) { /* fail silent */ }
  } else {
    var storedUtm = readStore(UTM_KEY);
    if (storedUtm) {
      for (var j = 0; j < utmFields.length; j++) {
        if (storedUtm[utmFields[j]]) utm[utmFields[j]] = storedUtm[utmFields[j]];
      }
    }
  }

  // -- 3. Decorate the clinic booker CTAs ---------------------------------
  function decorate() {
    var haveSomething =
      click.gclid || click.gbraid || click.wbraid ||
      utm.utm_source || utm.utm_medium || utm.utm_campaign || utm.utm_term || utm.utm_content;
    if (!haveSomething) return;

    var links = document.querySelectorAll('a[href*="moonshotclinic.com/book"]');
    for (var k = 0; k < links.length; k++) {
      var a = links[k];
      var href = a.getAttribute('href');
      if (!href) continue;
      try {
        var u = new URL(href);
        if (click.gclid && !u.searchParams.has('gclid')) u.searchParams.set('gclid', click.gclid);
        if (click.gbraid && !u.searchParams.has('gbraid')) u.searchParams.set('gbraid', click.gbraid);
        if (click.wbraid && !u.searchParams.has('wbraid')) u.searchParams.set('wbraid', click.wbraid);
        for (var m = 0; m < utmFields.length; m++) {
          var f = utmFields[m];
          if (utm[f] && !u.searchParams.has(f)) u.searchParams.set(f, utm[f]);
        }
        a.setAttribute('href', u.toString());
      } catch (e) {
        // Bad href — leave untouched.
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorate);
  } else {
    decorate();
  }
})();
