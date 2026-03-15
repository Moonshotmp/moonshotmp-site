/**
 * Meta CAPI — Client-Side Event Tracker
 * ======================================
 * Lightweight script that auto-detects page type,
 * fires the appropriate Meta conversion event, and
 * sends it to our Netlify function for server-side relay.
 *
 * Events:
 *   ViewContent    — service/learn pages
 *   Schedule       — booking pages
 *   CompleteRegistration — quiz result pages
 *   Contact        — phone link clicks
 *
 * Load deferred: <script src="/shared/meta-tracking.js" defer></script>
 */

(function () {
  var ENDPOINT = '/.netlify/functions/meta-capi';
  var path = location.pathname;

  // Read Meta cookies
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  // Generate a unique event ID for deduplication
  function eventId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  // Send event to our Netlify function
  function sendEvent(eventName) {
    var payload = {
      event_name: eventName,
      event_source_url: location.href,
      event_id: eventId(),
      fbc: getCookie('_fbc'),
      fbp: getCookie('_fbp'),
    };

    // Use sendBeacon if available (works on page unload), else fetch
    var json = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([json], { type: 'application/json' }));
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
        keepalive: true,
      }).catch(function () {});
    }
  }

  // --- Auto-detect page type and fire event ---

  // Booking pages → Schedule
  if (path.indexOf('/booking/') === 0) {
    sendEvent('Schedule');
  }
  // Quiz results → CompleteRegistration
  else if (path.indexOf('/quiz/results') === 0 || path.indexOf('/quiz/body-comp/results') === 0) {
    sendEvent('CompleteRegistration');
  }
  // Service & learn pages → ViewContent
  else if (
    path.indexOf('/medical/') === 0 ||
    path.indexOf('/learn/') === 0 ||
    path.indexOf('/blood-work/') === 0 ||
    path.indexOf('/rehab/') === 0
  ) {
    sendEvent('ViewContent');
  }

  // Phone link clicks → Contact (delegated listener)
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="tel:"]');
    if (link) {
      sendEvent('Contact');
    }
  });
})();
