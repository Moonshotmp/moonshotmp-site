/**
 * shared/ads-sticky-cta.js - mobile sticky booking bar for /ads/* landing pages
 *
 * WHY (2026-11-09): 94% of paid clicks are on a phone and the ads pages run
 * six to eight phone screens long with booking buttons only near the top and
 * bottom. About four of five paid clicks left without opening the booker.
 *
 * WHAT: the page ships a static #adsStickyCta bar (so ads-click-forward.js
 * stamps gclid/utm on its link like any other booker CTA). This script only
 * slides it in once the hero button (#bookCtaTop) has scrolled out of view,
 * and back out while the hero button is on screen. No tracking, no storage.
 */
(function () {
  'use strict';
  var bar = document.getElementById('adsStickyCta');
  var hero = document.getElementById('bookCtaTop');
  if (!bar || !hero) return;
  function set(show) {
    bar.style.transform = show ? 'translateY(0)' : 'translateY(110%)';
    bar.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  if (!('IntersectionObserver' in window)) { set(true); return; }
  new IntersectionObserver(function (entries) {
    set(!entries[0].isIntersecting);
  }).observe(hero);
})();
