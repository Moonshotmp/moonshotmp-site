/**
 * shared/ads-open-times.js - next open times as tappable chips under the hero button
 *
 * WHY (Tom, 2026-11-23, Google Ads funnel review): 86% of paid DEXA clicks
 * never opened the booker (112 clicks -> 16 booker opens in 7 days). Showing
 * real open times on the landing page lets a visitor pick one before leaving.
 *
 * WHAT: reads the clinic booker's own public reads (the same calls
 * moonshot.moonshotehr.com/book/dexa makes; data-type-id skips the link config read) and renders up to six open times,
 * soonest first, each linking to the booker with ?slot=YYYY-MM-DDTHH:MM so it
 * opens on that time. The booker re-checks the time and, if it is gone, opens
 * its calendar with one line; a booker without ?slot= support simply opens
 * its calendar. Times are clinic time (America/Chicago), whatever the device.
 *
 * FAIL SAFE: any error, a 2.5 s budget overrun, or no open time hides the
 * block (see remove()); the page then shows what it did without this script.
 * The reserved space is in the markup, so chips arriving never move the hero.
 *
 * ATTRIBUTION: chip links are decorated by ads-click-forward.js's own pass
 * (window.MMPAdsForward.decorate) after they are inserted, so they carry
 * gclid/gbraid/wbraid and utm_* exactly like #bookCtaTop. As a second path the
 * chip starts from #bookCtaTop's current href, which that pass already stamped.
 *
 * PRIVACY: GET only, no cookies (credentials omitted), nothing about the
 * visitor is sent. The reads return open times and staff names only.
 *
 * Markup contract: <div id="adsOpenTimes" data-api="https://api..." data-tenant="moonshot"
 *   data-link="dexa" data-cta="bookCtaTop"> holding [data-open-times-list], whose
 *   last child is the [data-open-times-all] link; chips go in before it.
 */
(function () {
  'use strict';
  var box = document.getElementById('adsOpenTimes');
  if (!box) return;
  var API = box.getAttribute('data-api');
  var TENANT = box.getAttribute('data-tenant');
  var LINK = box.getAttribute('data-link');
  // The link's appointment type, when the page knows it, saves one serial
  // round trip (and its CORS preflight). If it is stale the booker re-checks
  // the time against its own service, so a wrong id can only show "taken".
  var TYPE_ID = box.getAttribute('data-type-id');
  var cta = document.getElementById(box.getAttribute('data-cta') || 'bookCtaTop');
  var list = box.querySelector('[data-open-times-list]');
  var allLink = box.querySelector('[data-open-times-all]');
  var TZ = 'America/Chicago';
  var MAX_CHIPS = 6;
  var BUDGET_MS = 2500;
  var done = false;

  // Failed, slow or empty: the block goes invisible and keeps its reserved
  // height (the page CSS), so nothing below it, or the centred desktop
  // column, ever moves.
  function remove() {
    if (done) return;
    done = true;
    box.setAttribute('data-state', 'failed');
    box.setAttribute('aria-hidden', 'true');
    var links = box.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) links[i].setAttribute('tabindex', '-1');
  }
  if (!API || !TENANT || (!LINK && !TYPE_ID) || !cta || !list || !window.fetch || !window.Promise) return remove();
  var timer = setTimeout(remove, BUDGET_MS);
  var ctrl = typeof AbortController === 'function' ? new AbortController() : null;

  function get(path) {
    return fetch(API + path, {
      headers: { 'X-Tenant-Slug': TENANT },
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // YYYY-MM-DD in the clinic zone, `days` calendar days from today there
  // (calendar arithmetic, so a DST night never skips or repeats a day).
  var todayParts = (function () {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date());
    var o = {};
    for (var i = 0; i < parts.length; i++) o[parts[i].type] = parts[i].value;
    return o;
  })();
  function clinicDay(days) {
    return new Date(Date.UTC(+todayParts.year, +todayParts.month - 1, +todayParts.day + days, 12)).toISOString().slice(0, 10);
  }
  // Labels come from the date string itself (UTC noon), never the device zone.
  function dayLabel(ymd, today, tomorrow) {
    if (ymd === today) return 'Today';
    if (ymd === tomorrow) return 'Tomorrow';
    var p = ymd.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  }
  function timeLabel(hm) {
    var p = hm.split(':');
    var h = +p[0];
    return (h % 12 || 12) + ':' + p[1] + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function chipHref(ymd, hm) {
    var u = new URL(cta.getAttribute('href'));
    u.searchParams.set('slot', ymd + 'T' + hm);
    return u.toString();
  }

  var today = clinicDay(0);
  var tomorrow = clinicDay(1);
  var typeId = null;

  (TYPE_ID
    ? Promise.resolve({ config: { appointment_type_id: TYPE_ID } })
    : get('/api/book/config-by-slug/' + encodeURIComponent(LINK) + '?probe=1')) // probe: not counted as a link open
    .then(function (cfg) {
      typeId = cfg && cfg.config && cfg.config.appointment_type_id;
      if (!typeId) throw new Error('no appointment type');
      return get('/api/book/availability-summary?start_date=' + today + '&end_date=' + clinicDay(14) +
        '&appointment_type_id=' + encodeURIComponent(typeId));
    })
    .then(function (d) {
      var s = (d && d.summary) || {};
      var days = Object.keys(s).filter(function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k) && k >= today && s[k] > 0; }).sort().slice(0, 2);
      if (!days.length) throw new Error('no open days');
      return Promise.all(days.map(function (day) {
        return get('/api/book/slots?date=' + day + '&appointment_type_id=' + encodeURIComponent(typeId))
          .then(function (r) { return { day: day, slots: (r && r.slots) || [] }; });
      }));
    })
    .then(function (perDay) {
      if (done) return;
      var picks = [];
      for (var i = 0; i < perDay.length && picks.length < MAX_CHIPS; i++) {
        var seen = {};
        var slots = perDay[i].slots.slice().sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
        for (var j = 0; j < slots.length && picks.length < MAX_CHIPS; j++) {
          var t = slots[j] && slots[j].time;
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t || '') || seen[t]) continue; // one chip per time, any provider
          seen[t] = true;
          picks.push({ day: perDay[i].day, time: t });
        }
      }
      if (!picks.length) throw new Error('no open times');
      var html = '';
      for (var k = 0; k < picks.length; k++) {
        var d = dayLabel(picks[k].day, today, tomorrow);
        var tl = timeLabel(picks[k].time);
        html += '<a class="ads-time-chip" href="' + chipHref(picks[k].day, picks[k].time) + '" aria-label="Book ' + d + ' ' + tl + '">' +
          '<span class="ads-time-chip-day">' + d + '</span><span class="ads-time-chip-time">' + tl + '</span></a>';
      }
      var skel = list.querySelectorAll('.ads-time-chip-skel');
      for (var q = 0; q < skel.length; q++) skel[q].parentNode.removeChild(skel[q]);
      if (allLink && allLink.parentNode === list) allLink.insertAdjacentHTML('beforebegin', html);
      else list.insertAdjacentHTML('beforeend', html);
      if (window.MMPAdsForward && typeof window.MMPAdsForward.decorate === 'function') window.MMPAdsForward.decorate();
      done = true;
      clearTimeout(timer);
      box.setAttribute('data-state', 'ready');
    })
    .catch(function () {
      clearTimeout(timer);
      remove();
    });

  // Past the budget: stop the reads too, so nothing paints later.
  setTimeout(function () { if (ctrl && box.getAttribute('data-state') !== 'ready') ctrl.abort(); }, BUDGET_MS);
})();
