/*
 * Moonshot Header Component
 * =========================
 * Auto-injects the site header into the page.
 *
 * Usage:
 *   Add this at the start of <body>:
 *   <div id="site-header"></div>
 *   <script src="/shared/header.js"></script>
 *
 *   Or just include the script and it will prepend to body automatically.
 */

(function() {
    // GA4 dataLayer shim — kept as a harmless no-op so any legacy `gtag(...)`
    // calls elsewhere in the codebase don't throw. The real tracker scripts
    // (gtag.js, Ahrefs, Meta CAPI) are NO LONGER loaded from this file.
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ /* no-op shim */ };

    // === Phase 0 tracker strip (2026-04-30) ===
    // Health-data pages (/quiz/, /medical/, /learn/, /blood-work/, /rehab/)
    // historically loaded GA4, Google Ads, Ahrefs Analytics, and a Meta CAPI
    // relay unconditionally. That pattern is HBNR-violating (cf. GoodRx $1.5M,
    // BetterHelp $7.8M FTC settlements). We now load NO third-party trackers
    // from this file — period. Even non-health pages do not load them here
    // until a consent gate is implemented.
    //
    // Generic, non-health funnel measurement now flows through the first-party
    // endpoint at `/.netlify/functions/quiz-event`. See the audit at
    // `~/seo-analytics/audits/tracker-audit.md` for the full strip plan.
    //
    // DO NOT re-add gtag.js, googletagmanager.com, googleadservices.com,
    // analytics.ahrefs.com, connect.facebook.net, or graph.facebook.com loaders
    // to this file without an explicit consent gate AND a path-based exclusion
    // for /quiz/*, /medical/*, /learn/*, /blood-work/*, /rehab/*, /booking/*.

    // === Google Ads click-id + UTM capture (first-party only) ===
    // Reads ?gclid= / ?gbraid= / ?wbraid= and ?utm_* URL params on any page
    // load and persists in localStorage so the booking handoff can attribute
    // the conversion server-side via the Google Ads Conversion API and so we
    // can slice our own bookings by campaign without querying Google.
    //
    // PRIVACY: Click IDs and UTM tags are opaque tokens, not health data. They
    // never co-travel with health-condition signals here — the actual
    // conversion upload happens server-side from the EHR with a generic
    // "Booking" event name and dollar value, and explicitly OMITS
    // appointment_type / service name / condition. localStorage is purely
    // client-side; we do NOT POST any of this to any third-party from this
    // file.
    try {
      var gAdsParams = new URLSearchParams(window.location.search || '');
      var gclid = (gAdsParams.get('gclid') || '').trim();
      var gbraid = (gAdsParams.get('gbraid') || '').trim();
      var wbraid = (gAdsParams.get('wbraid') || '').trim();
      var utmSource = (gAdsParams.get('utm_source') || '').trim();
      var utmMedium = (gAdsParams.get('utm_medium') || '').trim();
      var utmCampaign = (gAdsParams.get('utm_campaign') || '').trim();
      var utmTerm = (gAdsParams.get('utm_term') || '').trim();
      var utmContent = (gAdsParams.get('utm_content') || '').trim();

      // Validate shape: alphanumeric + - and _, max 256 chars for ids;
      // utm_* allow a slightly looser charset (alphanumeric + - _ . + |),
      // bounded at 128 chars. Anything else is dropped to avoid persisting
      // attacker-controlled junk.
      var validClickId = function (v) { return /^[A-Za-z0-9_-]{1,256}$/.test(v); };
      var validUtm = function (v) { return /^[A-Za-z0-9_.\-+|]{1,128}$/.test(v); };

      var clickId = gclid || gbraid || wbraid;
      if (clickId && validClickId(clickId)) {
        // 90-day TTL matches Google Ads default attribution window.
        localStorage.setItem('mmp_google_click_id', JSON.stringify({
          gclid: gclid && validClickId(gclid) ? gclid : null,
          gbraid: gbraid && validClickId(gbraid) ? gbraid : null,
          wbraid: wbraid && validClickId(wbraid) ? wbraid : null,
          ts: Date.now(),
          landing_path: window.location.pathname,
        }));
      }

      // UTMs persist independently of click-id so organic referrers
      // (e.g., utm_source=newsletter) also get attributed.
      if (utmSource || utmMedium || utmCampaign || utmTerm || utmContent) {
        localStorage.setItem('mmp_utm_attribution', JSON.stringify({
          utm_source: utmSource && validUtm(utmSource) ? utmSource : null,
          utm_medium: utmMedium && validUtm(utmMedium) ? utmMedium : null,
          utm_campaign: utmCampaign && validUtm(utmCampaign) ? utmCampaign : null,
          utm_term: utmTerm && validUtm(utmTerm) ? utmTerm : null,
          utm_content: utmContent && validUtm(utmContent) ? utmContent : null,
          ts: Date.now(),
          landing_path: window.location.pathname,
        }));
      }
    } catch (e) {
      // Never break page load over attribution capture.
    }

    // === Inject /shared/attribution-capture.js on every page ===
    // Captures the marketing-attribution fields the legacy block above
    // misses (referrer, landing_page, last_page, fbclid, msclkid) into
    // sessionStorage. Quiz engines read window.MoonshotAttribution.getFlat()
    // when constructing the email-capture form payload — the unified flat
    // object is forwarded to the EHR /api/leads/webhook attribution column.
    try {
      if (!document.querySelector('script[data-moonshot-attribution-capture]')) {
        var attrScript = document.createElement('script');
        attrScript.src = '/shared/attribution-capture.js';
        attrScript.defer = true;
        attrScript.setAttribute('data-moonshot-attribution-capture', '1');
        (document.head || document.documentElement).appendChild(attrScript);
      }
    } catch (_e) { /* never block header render */ }

    // === Decorate clinic /book CTAs with persisted attribution ===
    // The legacy localStorage capture above (mmp_google_click_id +
    // mmp_utm_attribution, 90-day TTL) already runs site-wide. What was
    // missing: nothing READ those stored values back onto outbound clinic
    // booking links. So if a user landed from an ad, navigated around,
    // and clicked Book later, the gclid was lost and the appointment
    // ingested with no attribution — which is why only 2 of ~1700 recent
    // bookings carried a gclid even though the upload pipeline itself
    // works end-to-end (see functions/shared/google-ads-conversion.js on
    // the clinic side).
    //
    // This helper appends the persisted gclid/gbraid/wbraid + utm_* to any
    // anchor whose href points at a moonshotclinic.com /book/* path. It is
    // idempotent (won't double-append) and runs after the header HTML is
    // injected so nav-bar CTAs are covered too. The clinic /book page
    // already reads these params from window.location.search and forwards
    // them in the POST /api/book/appointment payload (book-appointment.js
    // lines 1958–1989), so this single rewrite closes the loop.
    function decorateClinicBookingLinks() {
      try {
        var attribution = {};
        try {
          var clickRaw = localStorage.getItem('mmp_google_click_id');
          if (clickRaw) {
            var clickObj = JSON.parse(clickRaw);
            if (clickObj && typeof clickObj === 'object') {
              if (typeof clickObj.gclid === 'string' && clickObj.gclid) attribution.gclid = clickObj.gclid;
              if (typeof clickObj.gbraid === 'string' && clickObj.gbraid) attribution.gbraid = clickObj.gbraid;
              if (typeof clickObj.wbraid === 'string' && clickObj.wbraid) attribution.wbraid = clickObj.wbraid;
            }
          }
        } catch (_e) { /* corrupt JSON — skip */ }
        try {
          var utmRaw = localStorage.getItem('mmp_utm_attribution');
          if (utmRaw) {
            var utmObj = JSON.parse(utmRaw);
            if (utmObj && typeof utmObj === 'object') {
              ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
                if (typeof utmObj[k] === 'string' && utmObj[k]) attribution[k] = utmObj[k];
              });
            }
          }
        } catch (_e) { /* corrupt JSON — skip */ }

        var keys = Object.keys(attribution);
        if (!keys.length) return;
        var pairs = keys.map(function (k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(attribution[k]);
        }).join('&');

        // Match any subdomain (moonshot.moonshotclinic.com, branch.moonshotclinic.com,
        // etc.) under /book/. Substring filter is broad on purpose so we don't
        // miss future booking subdomains; idempotency check below prevents harm.
        var anchors = document.querySelectorAll('a[href*="moonshotclinic.com/book"]');
        for (var i = 0; i < anchors.length; i++) {
          var a = anchors[i];
          var href = a.getAttribute('href') || '';
          if (!href) continue;
          // Idempotent: skip if any tracked param is already present (covers
          // both fresh URL params already forwarded by the legacy /ads/*
          // inline forwarder and prior decoration on this page).
          if (/[?&](gclid|gbraid|wbraid|utm_source)=/.test(href)) continue;
          var sep = href.indexOf('?') === -1 ? '?' : '&';
          a.setAttribute('href', href + sep + pairs);
        }
      } catch (_e) { /* never break page render over decoration */ }
    }

    // Run once now (covers anchors already in the body) and once after the
    // header HTML is injected below. Also re-run on DOMContentLoaded for
    // any deferred-script-added anchors.
    decorateClinicBookingLinks();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', decorateClinicBookingLinks);
    }

    const headerHTML = `
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-brand-dark focus:text-brand-light focus:px-4 focus:py-2 focus:border focus:border-white/20">Skip to content</a>
    <nav class="fixed top-0 w-full z-50 bg-brand-dark/95 backdrop-blur-md border-b border-white/10" id="navbar">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-20">
          <a href="/" class="flex-shrink-0 flex items-center gap-2 cursor-pointer">
            <img src="/images/mm+logocloud.png" alt="MM+ Logo" class="h-8 md:h-10 w-auto object-contain" width="200" height="168">
            <div class="hidden sm:block text-brand-light font-heading text-sm tracking-wide leading-tight ml-3">
              MOONSHOT<br>MEDICAL AND PERFORMANCE
            </div>
          </a>

          <div class="hidden lg:flex space-x-6 items-center">
            <!-- Medical Dropdown -->
            <div class="relative inline-block" id="medical-menu-wrapper">
              <button type="button" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="medical-menu-button" aria-expanded="false" aria-haspopup="true">
                Medical
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute left-0 mt-2 w-56 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="medical-dropdown" role="menu">
                <div class="py-2">
                  <a href="/medical/" class="block px-4 py-3 text-sm text-brand-light hover:bg-white/5 uppercase tracking-wide" role="menuitem">Overview</a>
                  <a href="/medical/blood-panels/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Blood Panels</a>
                  <a href="/blood-work/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Blood Work Guide</a>
                  <a href="/medical/dexa-scan/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">DEXA Scan</a>
                  <a href="/medical/mens-hormones/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Men's Hormones</a>
                  <a href="/medical/tadalafil/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Daily Tadalafil</a>
                  <a href="/medical/womens-hormones/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Women's Hormones</a>
                  <a href="/medical/weight-loss/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Weight Loss</a>
                  <a href="/medical/nutrition-coaching/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Nutrition Coaching</a>
                  <a href="/medical/peptides/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Peptides</a>
                  <a href="/medical/botox-park-ridge/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Botox / Jeuveau</a>
                  <a href="/quiz/perimenopause/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/10 mt-1" role="menuitem">Perimenopause Screener</a>
                  <a href="/quiz/low-t/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5" role="menuitem">TRT Readiness Screener</a>
                  <a href="/quiz/glp1/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5" role="menuitem">GLP-1 Readiness Screener</a>
                  <a href="/quiz/bone-density/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5" role="menuitem">Bone Density Screener</a>
                </div>
              </div>
            </div>

            <!-- Rehab Dropdown -->
            <div class="relative inline-block" id="rehab-menu-wrapper">
              <button type="button" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="rehab-menu-button" aria-expanded="false" aria-haspopup="true">
                Rehab
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute left-0 mt-2 w-56 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="rehab-dropdown" role="menu">
                <div class="py-2">
                  <a href="/rehab/" class="block px-4 py-3 text-sm text-brand-light hover:bg-white/5 uppercase tracking-wide" role="menuitem">Overview</a>
                  <a href="/rehab/chiropractic/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Chiropractic</a>
                  <a href="/rehab/physical-rehab/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Physical Rehab</a>
                  <a href="/rehab/trigger-point/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Trigger Point</a>
                  <a href="/rehab/dry-needling/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Dry Needling</a>
                  <a href="/rehab/shockwave/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Shockwave</a>
                </div>
              </div>
            </div>

            <!-- Learn Mega Menu -->
            <div class="relative inline-block" id="learn-menu-wrapper">
              <a href="/learn/" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="learn-menu-button" aria-expanded="false" aria-haspopup="true">
                Learn
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </a>
              <div class="absolute right-0 mt-2 w-[850px] bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="learn-dropdown" role="menu">
                <div class="p-6 grid grid-cols-5 gap-6">
                  <!-- Men Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Men</span>
                    <a href="/learn/trt-guide/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">TRT Guide</a>
                    <a href="/learn/low-testosterone-symptoms/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Low T Symptoms</a>
                    <a href="/learn/trt-vs-steroids/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">TRT vs Steroids</a>
                    <a href="/medical/trt-vs-enclomiphene/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">TRT vs Enclomiphene</a>
                    <a href="/medical/tadalafil/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Daily Tadalafil</a>
                  </div>
                  <!-- Women Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Women</span>
                    <a href="/learn/menopause-perimenopause/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Menopause Guide</a>
                    <a href="/learn/testosterone-for-women/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Testosterone for Women</a>
                    <a href="/learn/progesterone/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Progesterone</a>
                    <a href="/learn/pcos/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">PCOS</a>
                    <a href="/learn/whi-study-hrt-truth/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">HRT: Myths vs Facts</a>
                  </div>
                  <!-- Weight Loss Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Weight Loss</span>
                    <a href="/learn/semaglutide-vs-tirzepatide/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Semaglutide vs Tirzepatide</a>
                    <a href="/medical/glp1-vs-other-weight-loss/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">GLP-1 vs Other Methods</a>
                  </div>
                  <!-- Peptides Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Peptides</span>
                    <a href="/learn/peptides/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Peptide Therapy Guide</a>
                    <a href="/learn/bpc-157/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">BPC-157</a>
                    <a href="/learn/sermorelin/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Sermorelin</a>
                    <a href="/learn/tb-500/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">TB-500</a>
                    <a href="/learn/wolverine-blend/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Wolverine Blend</a>
                    <a href="/learn/pt-141/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">PT-141</a>
                    <a href="/learn/ghk-cu/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">GHK-Cu</a>
                    <a href="/quiz/peptides/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Peptide Quiz</a>
                  </div>
                  <!-- Rehab & Diagnostics Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Rehab & Diagnostics</span>
                    <a href="/learn/prp-microneedling/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">PRP Microneedling</a>
                    <a href="/learn/dry-needling/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Dry Needling</a>
                    <a href="/learn/shockwave-therapy/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Shockwave Therapy</a>
                    <a href="/learn/trigger-point-injections/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Trigger Point Injections</a>
                    <a href="/blood-work/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Blood Work Guide</a>
                    <a href="/medical/dexa-scan/dexa-vs-inbody/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">DEXA vs InBody</a>
                    <a href="/learn/first-visit/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">Your First Visit</a>
                  </div>
                </div>
                <div class="border-t border-white/10 px-6 py-3">
                  <a href="/learn/" class="text-sm text-brand-gray hover:text-brand-light transition" role="menuitem">View All Resources &rarr;</a>
                </div>
              </div>
            </div>

            <!-- About Dropdown -->
            <div class="relative inline-block" id="about-menu-wrapper">
              <button type="button" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="about-menu-button" aria-expanded="false" aria-haspopup="true">
                About
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute left-0 mt-2 w-56 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="about-dropdown" role="menu">
                <div class="py-2">
                  <a href="/about/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5" role="menuitem">Our Team</a>
                  <a href="/ourstory/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Tom's Story</a>
                  <a href="/medical/moonshot-vs-typical-clinic/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">How We're Different</a>
                  <a href="/contact/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/10 mt-2" role="menuitem">Contact Us</a>
                </div>
              </div>
            </div>

            <!-- Quiz Dropdown -->
            <div class="relative inline-block" id="quiz-menu-wrapper">
              <button type="button" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="quiz-menu-button" aria-expanded="false" aria-haspopup="true">
                Quiz
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute left-0 mt-2 w-64 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="quiz-dropdown" role="menu">
                <div class="py-2">
                  <a href="/quiz/perimenopause/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5" role="menuitem">Perimenopause Screener</a>
                  <a href="/quiz/low-t/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">TRT Readiness Screener</a>
                  <a href="/quiz/glp1/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">GLP-1 Readiness Screener</a>
                  <a href="/quiz/bone-density/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Bone Density Screener</a>
                  <a href="/quiz/peptides/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Peptide Quiz</a>
                  <a href="/quiz/body-comp/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5" role="menuitem">Body Comp IQ Quiz</a>
                </div>
              </div>
            </div>

            <button type="button" id="search-toggle" aria-label="Search" class="text-brand-light hover:text-brand-gray transition cursor-pointer" onclick="var so=document.getElementById('search-overlay');so.style.display='block';document.body.style.overflow='hidden';var si=document.getElementById('search-input');si.value='';document.getElementById('search-results').innerHTML='';setTimeout(function(){si.focus()},100);">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <a href="https://moonshot.moonshotclinic.com/portal" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition">Login</a>
            <a href="/booking/medical/" class="btn-primary text-xs tracking-widest" onclick="event.preventDefault(); openBookingModal();">Book Now</a>
          </div>

          <div class="lg:hidden flex items-center gap-3">
            <button type="button" id="mobile-search-toggle" aria-label="Search" class="text-brand-light hover:text-white focus:outline-none cursor-pointer" onclick="var so=document.getElementById('search-overlay');so.style.display='block';document.body.style.overflow='hidden';var si=document.getElementById('search-input');si.value='';document.getElementById('search-results').innerHTML='';setTimeout(function(){si.focus()},100);">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <button type="button" id="mobile-menu-btn" aria-label="Open menu" class="text-brand-light hover:text-white focus:outline-none">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div id="mobile-menu" class="lg:hidden bg-brand-dark border-b border-white/10 hidden max-h-[calc(100vh-5rem)] overflow-y-auto">
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 text-center">

          <!-- Medical Mobile -->
          <div>
            <button type="button" id="mobile-medical-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold">Medical</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-medical-arrow" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-medical-submenu" class="bg-black/20 hidden">
              <a href="/medical/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide font-bold">Overview</a>
              <a href="/medical/blood-panels/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Blood Panels</a>
              <a href="/blood-work/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Blood Work Guide</a>
              <a href="/medical/dexa-scan/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">DEXA Scan</a>
              <a href="/medical/mens-hormones/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Men's Hormones</a>
              <a href="/medical/tadalafil/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Daily Tadalafil</a>
              <a href="/medical/womens-hormones/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Women's Hormones</a>
              <a href="/medical/weight-loss/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Weight Loss</a>
              <a href="/medical/nutrition-coaching/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Nutrition Coaching</a>
              <a href="/medical/peptides/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Peptides</a>
              <a href="/medical/botox-park-ridge/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Botox / Jeuveau</a>
              <a href="/quiz/perimenopause/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide mt-2 font-bold">Perimenopause Screener &rarr;</a>
              <a href="/quiz/low-t/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide font-bold">TRT Readiness Screener &rarr;</a>
              <a href="/quiz/glp1/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide font-bold">GLP-1 Readiness Screener &rarr;</a>
              <a href="/quiz/bone-density/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide font-bold">Bone Density Screener &rarr;</a>
            </div>
          </div>

          <!-- Rehab Mobile -->
          <div>
            <button type="button" id="mobile-rehab-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold">Rehab</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-rehab-arrow" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-rehab-submenu" class="bg-black/20 hidden">
              <a href="/rehab/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide font-bold">Overview</a>
              <a href="/rehab/chiropractic/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Chiropractic</a>
              <a href="/rehab/physical-rehab/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Physical Rehab</a>
              <a href="/rehab/trigger-point/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Trigger Point</a>
              <a href="/rehab/dry-needling/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Dry Needling</a>
              <a href="/rehab/shockwave/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Shockwave</a>
            </div>
          </div>

          <!-- Learn Mobile -->
          <div>
            <button type="button" id="mobile-learn-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold">Learn</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-learn-arrow" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-learn-submenu" class="bg-black/20 hidden">
              <span class="block w-full text-brand-gray py-2 text-xs uppercase tracking-wide">— Men —</span>
              <a href="/learn/trt-guide/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">TRT Guide</a>
              <a href="/learn/low-testosterone-symptoms/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Low T Symptoms</a>
              <a href="/learn/trt-vs-steroids/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">TRT vs Steroids</a>
              <a href="/medical/trt-vs-enclomiphene/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">TRT vs Enclomiphene</a>
              <a href="/medical/tadalafil/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Daily Tadalafil</a>
              <span class="block w-full text-brand-gray py-2 text-xs uppercase tracking-wide mt-2">— Women —</span>
              <a href="/learn/menopause-perimenopause/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Menopause Guide</a>
              <a href="/learn/testosterone-for-women/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Testosterone for Women</a>
              <a href="/learn/progesterone/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Progesterone</a>
              <a href="/learn/pcos/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">PCOS</a>
              <a href="/learn/whi-study-hrt-truth/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">HRT: Myths vs Facts</a>
              <span class="block w-full text-brand-gray py-2 text-xs uppercase tracking-wide mt-2">— Weight Loss —</span>
              <a href="/learn/semaglutide-vs-tirzepatide/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Semaglutide vs Tirzepatide</a>
              <a href="/medical/glp1-vs-other-weight-loss/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">GLP-1 vs Other Methods</a>
              <span class="block w-full text-brand-gray py-2 text-xs uppercase tracking-wide mt-2">— Peptides —</span>
              <a href="/learn/peptides/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Peptide Therapy Guide</a>
              <a href="/learn/bpc-157/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">BPC-157</a>
              <a href="/learn/sermorelin/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Sermorelin</a>
              <a href="/learn/tb-500/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">TB-500</a>
              <a href="/learn/wolverine-blend/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Wolverine Blend</a>
              <a href="/learn/pt-141/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">PT-141</a>
              <a href="/learn/ghk-cu/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">GHK-Cu</a>
              <a href="/quiz/peptides/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Peptide Quiz</a>
              <span class="block w-full text-brand-gray py-2 text-xs uppercase tracking-wide mt-2">— Rehab & Diagnostics —</span>
              <a href="/learn/prp-microneedling/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">PRP Microneedling</a>
              <a href="/learn/dry-needling/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Dry Needling</a>
              <a href="/learn/shockwave-therapy/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Shockwave Therapy</a>
              <a href="/learn/trigger-point-injections/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Trigger Point Injections</a>
              <a href="/blood-work/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Blood Work Guide</a>
              <a href="/medical/dexa-scan/dexa-vs-inbody/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">DEXA vs InBody</a>
              <a href="/learn/first-visit/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Your First Visit</a>
              <a href="/learn/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide mt-2 font-bold">View All &rarr;</a>
            </div>
          </div>

          <!-- About Mobile -->
          <div>
            <button type="button" id="mobile-about-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold">About</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-about-arrow" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-about-submenu" class="bg-black/20 hidden">
              <a href="/about/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Our Team</a>
              <a href="/ourstory/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Tom's Story</a>
              <a href="/medical/moonshot-vs-typical-clinic/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">How We're Different</a>
              <a href="/contact/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Contact Us</a>
            </div>
          </div>

          <!-- Quiz Mobile -->
          <div>
            <button type="button" id="mobile-quiz-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold">Quiz</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-quiz-arrow" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-quiz-submenu" class="bg-black/20 hidden">
              <a href="/quiz/perimenopause/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Perimenopause Screener</a>
              <a href="/quiz/low-t/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">TRT Readiness Screener</a>
              <a href="/quiz/glp1/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">GLP-1 Readiness Screener</a>
              <a href="/quiz/bone-density/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Bone Density Screener</a>
              <a href="/quiz/peptides/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Peptide Quiz</a>
              <a href="/quiz/body-comp/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Body Comp IQ Quiz</a>
            </div>
          </div>

          <a href="https://moonshot.moonshotclinic.com/portal" class="block w-full text-brand-gray hover:text-brand-light py-3 text-sm uppercase tracking-widest mt-2">Login</a>
          <a href="#" onclick="event.preventDefault(); openBookingModal();" class="block w-full text-brand-light bg-brand-gray/10 hover:bg-brand-gray/20 py-3 text-sm uppercase tracking-widest mt-2 font-bold">Book Now</a>
        </div>
      </div>
    </nav>
    `;

    // Inject header
    const headerContainer = document.getElementById('site-header');
    if (headerContainer) {
        headerContainer.innerHTML = headerHTML;
    } else {
        // Prepend to body if no container found
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }

    // Decorate the nav-bar clinic booking CTAs that were just injected
    // (the earlier call only covered anchors already in the body markup).
    decorateClinicBookingLinks();

    // Initialize header interactions after DOM is ready
    function initHeaderInteractions() {
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');

        // Mobile menu toggle
        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
                const isNowOpen = !mobileMenu.classList.contains('hidden');
                mobileMenuBtn.setAttribute('aria-label', isNowOpen ? 'Close menu' : 'Open menu');
                // Close all submenus when closing main menu
                if (!isNowOpen) {
                    document.querySelectorAll('#mobile-menu [id$="-submenu"]').forEach(el => el.classList.add('hidden'));
                    document.querySelectorAll('#mobile-menu [id$="-arrow"]').forEach(el => el.classList.remove('rotate-180'));
                }
            });
        }

        // Mobile submenu toggles (accordion - only one open at a time)
        const mobileSubmenus = ['medical', 'rehab', 'learn', 'about', 'quiz'];

        function setupMobileSubmenu(btnId, submenuId, arrowId, menuName) {
            const btn = document.getElementById(btnId);
            const submenu = document.getElementById(submenuId);
            const arrow = document.getElementById(arrowId);
            if (btn && submenu && arrow) {
                btn.addEventListener('click', () => {
                    const wasOpen = !submenu.classList.contains('hidden');

                    // Close ALL submenus first
                    mobileSubmenus.forEach(name => {
                        const sub = document.getElementById('mobile-' + name + '-submenu');
                        const arr = document.getElementById('mobile-' + name + '-arrow');
                        if (sub) sub.classList.add('hidden');
                        if (arr) arr.classList.remove('rotate-180');
                    });

                    // If it was closed, open it (if it was open, it stays closed)
                    if (!wasOpen) {
                        submenu.classList.remove('hidden');
                        arrow.classList.add('rotate-180');
                    }
                });
            }
        }
        setupMobileSubmenu('mobile-medical-btn', 'mobile-medical-submenu', 'mobile-medical-arrow', 'medical');
        setupMobileSubmenu('mobile-rehab-btn', 'mobile-rehab-submenu', 'mobile-rehab-arrow', 'rehab');
        setupMobileSubmenu('mobile-learn-btn', 'mobile-learn-submenu', 'mobile-learn-arrow', 'learn');
        setupMobileSubmenu('mobile-about-btn', 'mobile-about-submenu', 'mobile-about-arrow', 'about');
        setupMobileSubmenu('mobile-quiz-btn', 'mobile-quiz-submenu', 'mobile-quiz-arrow', 'quiz');

        // Desktop dropdown menus
        function setupDesktopDropdown(wrapperId, buttonId, dropdownId) {
            const wrapper = document.getElementById(wrapperId);
            const btn = document.getElementById(buttonId);
            const dropdown = document.getElementById(dropdownId);

            if (wrapper && btn && dropdown) {
                let closeTimer = null;

                const openMenu = () => {
                    clearTimeout(closeTimer);
                    dropdown.classList.remove('hidden');
                    btn.setAttribute('aria-expanded', 'true');
                    const icon = btn.querySelector('svg');
                    if (icon) icon.classList.add('rotate-180');
                };

                const closeMenu = (immediate) => {
                    if (immediate) {
                        clearTimeout(closeTimer);
                        dropdown.classList.add('hidden');
                        btn.setAttribute('aria-expanded', 'false');
                        const icon = btn.querySelector('svg');
                        if (icon) icon.classList.remove('rotate-180');
                    } else {
                        closeTimer = setTimeout(() => {
                            dropdown.classList.add('hidden');
                            btn.setAttribute('aria-expanded', 'false');
                            const icon = btn.querySelector('svg');
                            if (icon) icon.classList.remove('rotate-180');
                        }, 150);
                    }
                };

                // Mouse behavior (unchanged)
                wrapper.addEventListener('mouseenter', openMenu);
                wrapper.addEventListener('mouseleave', () => closeMenu(false));
                btn.addEventListener('click', (e) => { e.stopPropagation(); openMenu(); });
                document.addEventListener('click', (e) => { if (!wrapper.contains(e.target)) closeMenu(true); });

                // Keyboard: keep dropdown open while focus is inside wrapper
                wrapper.addEventListener('focusin', () => {
                    clearTimeout(closeTimer);
                    if (!dropdown.classList.contains('hidden')) return;
                    // Don't auto-open on focus alone — user must press Enter/Space or arrow
                });

                wrapper.addEventListener('focusout', (e) => {
                    // If focus moves outside wrapper, close the dropdown
                    setTimeout(() => {
                        if (!wrapper.contains(document.activeElement)) {
                            closeMenu(true);
                        }
                    }, 0);
                });

                // Arrow key navigation within dropdown
                wrapper.addEventListener('keydown', (e) => {
                    const isOpen = !dropdown.classList.contains('hidden');
                    const menuItems = dropdown.querySelectorAll('a[role="menuitem"]');

                    if (e.key === 'Escape' && isOpen) {
                        e.preventDefault();
                        e.stopPropagation();
                        closeMenu(true);
                        btn.focus();
                        return;
                    }

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (!isOpen) {
                            openMenu();
                            // Focus first item after opening
                            setTimeout(() => {
                                const items = dropdown.querySelectorAll('a[role="menuitem"]');
                                if (items.length) items[0].focus();
                            }, 0);
                        } else if (menuItems.length) {
                            const currentIndex = Array.from(menuItems).indexOf(document.activeElement);
                            const nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
                            menuItems[nextIndex].focus();
                        }
                        return;
                    }

                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (isOpen && menuItems.length) {
                            const currentIndex = Array.from(menuItems).indexOf(document.activeElement);
                            const prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
                            menuItems[prevIndex].focus();
                        }
                        return;
                    }
                });
            }
        }
        setupDesktopDropdown('medical-menu-wrapper', 'medical-menu-button', 'medical-dropdown');
        setupDesktopDropdown('rehab-menu-wrapper', 'rehab-menu-button', 'rehab-dropdown');
        setupDesktopDropdown('learn-menu-wrapper', 'learn-menu-button', 'learn-dropdown');
        setupDesktopDropdown('about-menu-wrapper', 'about-menu-button', 'about-dropdown');
        setupDesktopDropdown('quiz-menu-wrapper', 'quiz-menu-button', 'quiz-dropdown');

        // Close dropdowns on escape (global fallback)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openDropdowns = document.querySelectorAll('[id$="-dropdown"]:not(.hidden)');
                openDropdowns.forEach(el => {
                    el.classList.add('hidden');
                    // Reset aria-expanded on the corresponding button
                    const wrapperId = el.id.replace('-dropdown', '-menu-wrapper');
                    const wrapper = document.getElementById(wrapperId);
                    if (wrapper) {
                        const triggerBtn = wrapper.querySelector('[aria-expanded]');
                        if (triggerBtn) {
                            triggerBtn.setAttribute('aria-expanded', 'false');
                            const icon = triggerBtn.querySelector('svg');
                            if (icon) icon.classList.remove('rotate-180');
                        }
                    }
                });
            }
        });

        // Search functionality
        const searchIndex = [
            // Home
            { title: "Moonshot Medical & Performance", desc: "Medical optimization, hormone therapy, rehab, diagnostics", url: "/", cat: "About" },
            // Medical Services
            { title: "Medical Services", desc: "All medical optimization services at Moonshot", url: "/medical/", cat: "Medical" },
            { title: "Blood Panels", desc: "60+ biomarker comprehensive blood panel", url: "/medical/blood-panels/", cat: "Medical" },
            { title: "DEXA Body Composition Scan", desc: "Medical-grade body composition analysis", url: "/medical/dexa-scan/", cat: "Medical" },
            { title: "Men's Hormone Optimization", desc: "Testosterone replacement therapy (TRT)", url: "/medical/mens-hormones/", cat: "Medical" },
            { title: "Women's Hormone Optimization", desc: "Bioidentical hormone replacement therapy", url: "/medical/womens-hormones/", cat: "Medical" },
            { title: "Weight Loss (GLP-1)", desc: "Semaglutide and tirzepatide programs", url: "/medical/weight-loss/", cat: "Medical" },
            { title: "Nutrition Coaching", desc: "One-on-one, behavior-first coaching with Sarah DeCicco", url: "/medical/nutrition-coaching/", cat: "Medical" },
            { title: "Peptides & Add-On Therapies", desc: "BPC-157, TB-500, Sermorelin, PT-141, GHK-Cu", url: "/medical/peptides/", cat: "Medical" },
            { title: "Botox / Jeuveau", desc: "Aesthetic injectables in Park Ridge", url: "/medical/botox-park-ridge/", cat: "Medical" },
            { title: "Daily Tadalafil", desc: "Low-dose tadalafil for vascular health", url: "/medical/tadalafil/", cat: "Medical" },
            { title: "Mobile Blood Draw", desc: "On-site blood draw services for businesses", url: "/medical/mobile-blood-draw/", cat: "Medical" },
            { title: "Coalition Mobile Blood Draw", desc: "Coalition partnership mobile blood draw event", url: "/medical/mobile-blood-draw/coalition/", cat: "Medical" },
            { title: "Moonshot vs Typical Clinics", desc: "What makes Moonshot different from typical hormone and weight loss clinics", url: "/medical/moonshot-vs-typical-clinic/", cat: "Medical" },
            { title: "TRT vs Enclomiphene", desc: "Which testosterone treatment is right for you", url: "/medical/trt-vs-enclomiphene/", cat: "Medical" },
            // Peptides
            { title: "BPC-157 Guide", desc: "Benefits, dosing, side effects, how to get it", url: "/learn/bpc-157/", cat: "Peptides" },
            { title: "TB-500 Guide", desc: "Thymosin beta-4 for tissue repair", url: "/learn/tb-500/", cat: "Peptides" },
            { title: "Sermorelin Guide", desc: "Growth hormone optimization", url: "/learn/sermorelin/", cat: "Peptides" },
            { title: "PT-141 Guide", desc: "Sexual health peptide, FDA-approved", url: "/learn/pt-141/", cat: "Peptides" },
            { title: "GHK-Cu Guide", desc: "Copper peptide for skin and anti-aging", url: "/learn/ghk-cu/", cat: "Peptides" },
            { title: "Wolverine Blend", desc: "BPC-157 + TB-500 combination therapy", url: "/learn/wolverine-blend/", cat: "Peptides" },
            { title: "Glow Stack", desc: "GHK-Cu + BPC-157 + TB-500 triple protocol", url: "/learn/glow-stack/", cat: "Peptides" },
            { title: "Peptide Therapy Guide", desc: "Benefits, side effects, FDA regulation", url: "/learn/peptides/", cat: "Peptides" },
            { title: "Peptides for Gut Healing", desc: "BPC-157 for IBS, leaky gut, NSAID damage", url: "/learn/peptides-for-gut-healing/", cat: "Peptides" },
            { title: "Peptides for Injury Recovery", desc: "BPC-157, TB-500 for tendon and muscle healing", url: "/learn/peptides-for-injury-recovery/", cat: "Peptides" },
            { title: "BPC-157 vs PRP", desc: "Head-to-head comparison", url: "/learn/bpc-157-vs-prp/", cat: "Peptides" },
            // PRP Microneedling
            { title: "PRP Microneedling Guide", desc: "How PRP microneedling works, what it treats, results, cost", url: "/learn/prp-microneedling/", cat: "Medical" },
            { title: "PRP vs Regular Microneedling", desc: "Is PRP worth the extra cost over standard microneedling?", url: "/learn/prp-vs-microneedling/", cat: "Medical" },
            { title: "PRP After Weight Loss", desc: "Skin tightening after GLP-1 weight loss with PRP microneedling", url: "/learn/prp-microneedling-after-weight-loss/", cat: "Medical" },
            { title: "PRP Microneedling Cost", desc: "How much PRP microneedling costs in 2026", url: "/learn/prp-microneedling-cost/", cat: "Medical" },
            { title: "Which Peptide Should I Take?", desc: "Decision guide for choosing the right peptide", url: "/learn/which-peptide/", cat: "Peptides" },
            // NAD+
            { title: "NAD+ Therapy", desc: "NAD+ injections for cellular energy and recovery — $60/shot", url: "/medical/nad/", cat: "Medical" },
            { title: "NAD+ Protocol Guide", desc: "What to expect: loading phase, maintenance, stacking", url: "/learn/nad-protocol/", cat: "NAD+" },
            { title: "NAD+ for Anti-Aging", desc: "Science of NAD+ decline, sirtuins, DNA repair", url: "/learn/nad-anti-aging/", cat: "NAD+" },
            { title: "NAD+ for Athletes", desc: "Recovery, mitochondrial biogenesis, performance", url: "/learn/nad-athletic-recovery/", cat: "NAD+" },
            { title: "NAD+ Injections vs IV Drips", desc: "$60 SubQ vs $250-1000+ IV — cost and bioavailability comparison", url: "/learn/nad-injections-vs-iv/", cat: "NAD+" },
            { title: "NAD+ Therapy Cost", desc: "IV vs injections vs supplements pricing comparison", url: "/learn/nad-therapy-cost/", cat: "NAD+" },
            { title: "NAD+ vs NMN vs NR", desc: "Injections vs supplements — which boosts NAD+ best", url: "/learn/nad-vs-nmn/", cat: "NAD+" },
            { title: "NAD+ & Vitamin Injections", desc: "Evidence-based guide to NAD+ and vitamin shots", url: "/learn/nad-vitamin-injections/", cat: "NAD+" },
            // Weight Loss
            { title: "Semaglutide vs Tirzepatide", desc: "GLP-1 medication comparison", url: "/learn/semaglutide-vs-tirzepatide/", cat: "Weight Loss" },
            { title: "GLP-1 vs Other Weight Loss", desc: "How GLP-1s compare to other methods", url: "/medical/glp1-vs-other-weight-loss/", cat: "Weight Loss" },
            { title: "Semaglutide Cost", desc: "GLP-1 pricing breakdown for 2026", url: "/learn/semaglutide-cost/", cat: "Weight Loss" },
            { title: "Semaglutide Side Effects", desc: "What to expect on GLP-1 medication", url: "/learn/semaglutide-side-effects/", cat: "Weight Loss" },
            // Rehab
            { title: "Rehab Services", desc: "Physical rehabilitation services at Moonshot", url: "/rehab/", cat: "Rehab" },
            { title: "Chiropractic Care", desc: "McKenzie Method evidence-based care", url: "/rehab/chiropractic/", cat: "Rehab" },
            { title: "Chiropractic & McKenzie Method", desc: "Evidence-based chiropractic guide", url: "/learn/chiropractic/", cat: "Rehab" },
            { title: "Dry Needling", desc: "Trigger point release for chronic pain", url: "/learn/dry-needling/", cat: "Rehab" },
            { title: "Dry Needling Services", desc: "In-clinic dry needling at Moonshot", url: "/rehab/dry-needling/", cat: "Rehab" },
            { title: "Shockwave Therapy Sessions", desc: "$105 ESWT sessions in Park Ridge, book online", url: "/rehab/shockwave/", cat: "Rehab" },
            { title: "Shockwave Therapy", desc: "ESWT for tendon injuries", url: "/learn/shockwave-therapy/", cat: "Rehab" },
            { title: "Shockwave Therapy Services", desc: "In-clinic shockwave therapy at Moonshot", url: "/rehab/shockwave/", cat: "Rehab" },
            { title: "Trigger Point Injections", desc: "Targeted relief for muscle pain", url: "/learn/trigger-point-injections/", cat: "Rehab" },
            { title: "Trigger Point Injection Services", desc: "In-clinic trigger point injections", url: "/rehab/trigger-point/", cat: "Rehab" },
            { title: "Physical Rehabilitation", desc: "Movement restoration and strength rehab", url: "/rehab/physical-rehab/", cat: "Rehab" },
            { title: "Rehab Patient Reviews", desc: "Testimonials from rehab patients", url: "/rehab/testimonials/", cat: "Rehab" },
            // Diagnostics & Blood Work
            { title: "Blood Work Guide", desc: "Understanding your lab results", url: "/blood-work/", cat: "Blood Work" },
            { title: "Blood Cells & CBC", desc: "Understanding your complete blood count", url: "/blood-work/blood-cells-cbc/", cat: "Blood Work" },
            { title: "Cardiovascular & Lipids", desc: "Cholesterol, triglycerides, and heart health markers", url: "/blood-work/cardiovascular-lipids/", cat: "Blood Work" },
            { title: "Hormones & Endocrine", desc: "Hormone panel results explained", url: "/blood-work/hormones-endocrine/", cat: "Blood Work" },
            { title: "Inflammation Markers", desc: "CRP, ESR, and inflammation blood work explained", url: "/blood-work/inflammation-markers/", cat: "Blood Work" },
            { title: "Kidney Function", desc: "Kidney function and electrolyte results explained", url: "/blood-work/kidney-function/", cat: "Blood Work" },
            { title: "Liver Function", desc: "Understanding your liver panel results", url: "/blood-work/liver-function/", cat: "Blood Work" },
            { title: "Metabolic & Blood Sugar", desc: "Blood sugar and metabolic health markers explained", url: "/blood-work/metabolic-blood-sugar/", cat: "Blood Work" },
            { title: "Blood Work Patterns", desc: "How your markers connect and what patterns mean", url: "/blood-work/patterns/", cat: "Blood Work" },
            { title: "Thyroid Function", desc: "TSH, T4, T3 and TPO thyroid testing explained", url: "/blood-work/thyroid-function/", cat: "Blood Work" },
            { title: "Vitamins & Nutrients", desc: "Vitamin and nutrient blood work results explained", url: "/blood-work/vitamins-nutrients/", cat: "Blood Work" },
            { title: "Men's Blood Panel", desc: "Comprehensive blood panel guide for men", url: "/blood/men/", cat: "Blood Work" },
            { title: "Women's Blood Panel", desc: "Comprehensive blood panel guide for women", url: "/blood/women/", cat: "Blood Work" },
            { title: "Men's Hormone Pathways", desc: "Men's hormone optimization treatment pathways", url: "/blood/men/bhrt/", cat: "Blood Work" },
            { title: "Women's Hormone Pathways", desc: "Women's hormone optimization treatment pathways", url: "/blood/women/bhrt/", cat: "Blood Work" },
            { title: "DEXA vs InBody", desc: "Body composition scan comparison", url: "/medical/dexa-scan/dexa-vs-inbody/", cat: "Diagnostics" },
            { title: "Optimal vs Normal Ranges", desc: "Why normal isn't always optimal", url: "/learn/optimal-vs-normal/", cat: "Diagnostics" },
            { title: "DEXA Scan Cost", desc: "$150 DEXA scan at Moonshot Medical", url: "/learn/dexa-scan-cost/", cat: "Diagnostics" },
            { title: "DEXA Scan for Weight Loss", desc: "Why the scale isn't enough — track real progress", url: "/learn/dexa-scan-for-weight-loss/", cat: "Diagnostics" },
            { title: "How to Read DEXA Results", desc: "Understanding your DEXA scan report", url: "/learn/how-to-read-dexa-scan-results/", cat: "Diagnostics" },
            { title: "DEXA Scan vs Bod Pod", desc: "Which body composition method is more accurate", url: "/learn/dexa-scan-vs-bod-pod/", cat: "Diagnostics" },
            { title: "Sample DEXA Report", desc: "Walkthrough of a real DEXA scan report", url: "/learn/sample-dexa-report/", cat: "Diagnostics" },
            { title: "What Labs to Test", desc: "What labs you should actually be testing beyond the standard panel", url: "/learn/what-labs-to-test/", cat: "Diagnostics" },
            { title: "Understanding Blood Results", desc: "How to interpret your blood work results", url: "/learn/understanding-blood-results/", cat: "Diagnostics" },
            { title: "Cardiovascular & Lipid Optimization", desc: "Beyond cholesterol — advanced lipid management", url: "/learn/cardiovascular-lipid-optimization/", cat: "Diagnostics" },
            { title: "Vitamin D & Micronutrients", desc: "Hidden health bottlenecks from deficiencies", url: "/learn/vitamin-d-micronutrients/", cat: "Diagnostics" },
            { title: "Thyroid Optimization", desc: "Why normal thyroid isn't optimal", url: "/learn/thyroid-optimization/", cat: "Diagnostics" },
            { title: "Sleep Optimization", desc: "How sleep affects hormones and health", url: "/learn/sleep-optimization/", cat: "Diagnostics" },
            // Men's Health
            { title: "TRT Guide", desc: "Testosterone replacement therapy — benefits, risks, dosing, cost", url: "/learn/trt-guide/", cat: "Men" },
            { title: "Low Testosterone Symptoms", desc: "Signs of low T in men", url: "/learn/low-testosterone-symptoms/", cat: "Men" },
            { title: "TRT vs Steroids", desc: "Understanding the difference", url: "/learn/trt-vs-steroids/", cat: "Men" },
            { title: "TRT Cost", desc: "How much TRT costs — pricing guide for 2026", url: "/learn/trt-cost/", cat: "Men" },
            { title: "TRT Side Effects", desc: "What to expect on testosterone therapy", url: "/learn/trt-side-effects/", cat: "Men" },
            { title: "Testosterone Levels by Age", desc: "Normal vs optimal testosterone by age group", url: "/learn/testosterone-levels-by-age/", cat: "Men" },
            { title: "How Long Does TRT Take to Work?", desc: "TRT timeline — when to expect results", url: "/learn/how-long-does-trt-take-to-work/", cat: "Men" },
            { title: "Testosterone Therapy After 40", desc: "Low T facts vs hype for men over 40", url: "/learn/testosterone-therapy-over-40/", cat: "Men" },
            // Women's Health
            { title: "Menopause Guide", desc: "Perimenopause and menopause explained", url: "/learn/menopause-perimenopause/", cat: "Women" },
            { title: "Testosterone for Women", desc: "Why women need testosterone too", url: "/learn/testosterone-for-women/", cat: "Women" },
            { title: "BHRT Cost", desc: "What women pay for bioidentical hormone therapy", url: "/learn/bhrt-cost/", cat: "Women" },
            { title: "Hashimoto's Thyroiditis", desc: "Causes, diagnosis, and treatment options", url: "/learn/hashimotos-thyroiditis/", cat: "Women" },
            { title: "PCOS", desc: "Causes, types, and treatment for polycystic ovary syndrome", url: "/learn/pcos/", cat: "Women" },
            { title: "Estrogen Dominance", desc: "Estrogen-progesterone imbalance symptoms and treatment", url: "/learn/estrogen-dominance/", cat: "Women" },
            { title: "Pellet Therapy", desc: "How hormone pellet therapy works and what to expect", url: "/learn/pellet-therapy/", cat: "Women" },
            { title: "Progesterone Guide", desc: "The forgotten hormone — why progesterone matters", url: "/learn/progesterone/", cat: "Women" },
            { title: "WHI Study & HRT Truth", desc: "HRT myths vs facts — the WHI study revisited", url: "/learn/whi-study-hrt-truth/", cat: "Women" },
            // Cost Guides (not already listed above)
            // (TRT Cost under Men, BHRT Cost under Women, DEXA Cost under Diagnostics, Semaglutide Cost under Weight Loss, NAD Cost under NAD+)
            // Local SEO — Park Ridge
            { title: "TRT in Park Ridge", desc: "Testosterone therapy in Park Ridge, IL", url: "/learn/trt-park-ridge/", cat: "Local" },
            { title: "DEXA Scan in Park Ridge", desc: "DEXA body composition scan in Park Ridge, IL", url: "/learn/dexa-scan-park-ridge/", cat: "Local" },
            { title: "Chiropractor in Park Ridge", desc: "Evidence-based chiropractic in Park Ridge, IL", url: "/learn/chiropractor-park-ridge/", cat: "Local" },
            { title: "GLP-1 Weight Loss in Park Ridge", desc: "Semaglutide and tirzepatide in Park Ridge, IL", url: "/learn/glp1-weight-loss-park-ridge/", cat: "Local" },
            { title: "Women's Hormones in Park Ridge", desc: "Women's hormone optimization in Park Ridge, IL", url: "/learn/womens-hormones-park-ridge/", cat: "Local" },
            { title: "Dry Needling in Park Ridge", desc: "Dry needling therapy in Park Ridge, IL", url: "/learn/dry-needling-park-ridge/", cat: "Local" },
            { title: "Shockwave Therapy in Park Ridge", desc: "ESWT shockwave therapy in Park Ridge, IL", url: "/learn/shockwave-therapy-park-ridge/", cat: "Local" },
            { title: "Trigger Point Injections in Park Ridge", desc: "Trigger point therapy in Park Ridge, IL", url: "/learn/trigger-point-injections-park-ridge/", cat: "Local" },
            { title: "Physical Rehab in Park Ridge", desc: "Physical rehabilitation in Park Ridge, IL", url: "/learn/physical-rehab-park-ridge/", cat: "Local" },
            { title: "Blood Work in Park Ridge", desc: "Comprehensive blood panels in Park Ridge, IL", url: "/learn/blood-work-park-ridge/", cat: "Local" },
            { title: "Peptide Therapy in Park Ridge", desc: "Local peptide therapy guide", url: "/learn/peptide-therapy-park-ridge/", cat: "Local" },
            { title: "NAD+ Injections in Park Ridge", desc: "NAD+ therapy in Park Ridge, IL", url: "/learn/nad-injections-park-ridge/", cat: "Local" },
            { title: "Hormone Quiz — Park Ridge", desc: "Hormone imbalance quiz for Park Ridge, IL residents", url: "/learn/hormone-quiz-park-ridge/", cat: "Local" },
            // Local SEO — Chicago
            { title: "TRT in Chicago", desc: "Testosterone therapy in Chicago, IL", url: "/learn/trt-chicago/", cat: "Local" },
            { title: "DEXA Scan in Chicago", desc: "DEXA body composition scan in Chicago, IL", url: "/learn/dexa-scan-chicago/", cat: "Local" },
            { title: "GLP-1 Weight Loss in Chicago", desc: "Semaglutide and tirzepatide in Chicago, IL", url: "/learn/glp1-weight-loss-chicago/", cat: "Local" },
            // Local SEO — Other suburbs
            { title: "Chiropractor Near Niles", desc: "Evidence-based chiropractic near Niles, IL", url: "/learn/chiropractor-niles/", cat: "Local" },
            { title: "DEXA Scan Near Skokie", desc: "DEXA body composition scan near Skokie, IL", url: "/learn/dexa-scan-skokie/", cat: "Local" },
            { title: "TRT in Des Plaines", desc: "Testosterone therapy in Des Plaines, IL", url: "/learn/trt-des-plaines/", cat: "Local" },
            // Quiz
            { title: "Perimenopause Screener", desc: "Validated 11-item MRS scale + safety screen", url: "/quiz/perimenopause/", cat: "Quiz" },
            { title: "TRT Readiness Screener", desc: "Validated ADAM scale + PSA and IPSS safety check", url: "/quiz/low-t/", cat: "Quiz" },
            { title: "GLP-1 Readiness Screener", desc: "BMI + comorbidity + 8-category contraindication check", url: "/quiz/glp1/", cat: "Quiz" },
            { title: "Bone Density Screener", desc: "OST formula + AACE/NOF risk factors for DEXA decision", url: "/quiz/bone-density/", cat: "Quiz" },
            { title: "Peptide Quiz", desc: "Find which peptide is right for you", url: "/quiz/peptides/", cat: "Quiz" },
            { title: "Body Comp IQ Quiz", desc: "Test your body composition knowledge", url: "/quiz/body-comp/", cat: "Quiz" },
            // Getting Started & General
            { title: "Your First Visit", desc: "What to expect at your first Moonshot appointment", url: "/learn/first-visit/", cat: "About" },
            { title: "Best Hormone Clinic Near Me", desc: "What to look for and what to avoid", url: "/learn/best-hormone-clinic-near-me/", cat: "About" },
            { title: "Function Health Next Steps", desc: "Got Function Health results? Here's what to do", url: "/learn/function-health-results-next-steps/", cat: "Diagnostics" },
            { title: "InsideTracker Next Steps", desc: "Got InsideTracker results? Here's what to do", url: "/learn/insidetracker-results-next-steps/", cat: "Diagnostics" },
            { title: "Learn — All Articles", desc: "Browse all health resources and guides", url: "/learn/", cat: "About" },
            { title: "Supplements", desc: "Personalized supplement plan at Moonshot", url: "/supplements/", cat: "Medical" },
            // About & Booking
            { title: "Our Team", desc: "Meet the Moonshot Medical team", url: "/about/", cat: "About" },
            { title: "Missy Zammichieli, DNP", desc: "Medical Director credentials and bio", url: "/about/missy-zammichieli/", cat: "About" },
            { title: "Ellen Haight, RN", desc: "Aesthetic injector credentials and bio", url: "/about/ellen-haight/", cat: "About" },
            { title: "Our Story", desc: "Tom's story and why Moonshot exists", url: "/ourstory/", cat: "About" },
            { title: "Pricing", desc: "Moonshot Medical service pricing", url: "/pricing/", cat: "About" },
            { title: "Book an Appointment", desc: "Schedule medical or rehab visit", url: "/booking/", cat: "Book" },
            { title: "Book a DEXA Scan", desc: "Schedule a DEXA body composition scan", url: "/booking/dexa/", cat: "Book" },
            { title: "Book Medical Services", desc: "Schedule medical optimization services", url: "/booking/medical/", cat: "Book" },
            { title: "Book Rehab Services", desc: "Schedule rehab and physical therapy", url: "/booking/rehab/", cat: "Book" },
            { title: "Contact Us", desc: "Phone, email, and location", url: "/contact/", cat: "About" },
            { title: "Privacy Policy", desc: "Moonshot Medical privacy policy", url: "/privacy/", cat: "About" },
            { title: "Terms of Service", desc: "Moonshot Medical terms of service", url: "/terms/", cat: "About" },
        ];

        const searchOverlay = document.getElementById('search-overlay');
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const searchToggle = document.getElementById('search-toggle');
        const mobileSearchToggle = document.getElementById('mobile-search-toggle');
        const searchClose = document.getElementById('search-close');
        let searchDebounce = null;
        let activeResultIndex = -1;

        function openSearch() {
            searchOverlay.style.display = 'block';
            document.body.style.overflow = 'hidden';
            searchInput.value = '';
            searchResults.innerHTML = '';
            activeResultIndex = -1;
            setTimeout(() => searchInput.focus(), 100);
        }

        function closeSearch() {
            searchOverlay.style.display = 'none';
            document.body.style.overflow = '';
            activeResultIndex = -1;
        }

        function renderResults(query) {
            if (!query || query.length < 2) {
                searchResults.innerHTML = '';
                activeResultIndex = -1;
                return;
            }
            const q = query.toLowerCase();
            const matches = searchIndex.filter(item =>
                item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
            ).slice(0, 8);

            if (matches.length === 0) {
                searchResults.innerHTML = '<p class="text-brand-gray/60 text-sm py-4">No results found.</p>';
                activeResultIndex = -1;
                return;
            }

            activeResultIndex = -1;
            searchResults.innerHTML = matches.map((item, i) =>
                '<a href="' + item.url + '" class="search-result flex items-center justify-between px-4 py-3 rounded-sm hover:bg-white/5 transition group" data-index="' + i + '">' +
                    '<div>' +
                        '<span class="text-brand-light text-sm font-medium group-hover:text-white">' + item.title + '</span>' +
                        '<span class="block text-brand-gray/60 text-xs mt-0.5">' + item.desc + '</span>' +
                    '</div>' +
                    '<span class="text-[10px] uppercase tracking-wider text-brand-gray/40 border border-white/10 px-2 py-0.5 rounded-sm shrink-0 ml-4">' + item.cat + '</span>' +
                '</a>'
            ).join('');
        }

        function updateActiveResult() {
            const items = searchResults.querySelectorAll('.search-result');
            items.forEach((el, i) => {
                if (i === activeResultIndex) {
                    el.classList.add('bg-white/5');
                } else {
                    el.classList.remove('bg-white/5');
                }
            });
            if (items[activeResultIndex]) {
                items[activeResultIndex].scrollIntoView({ block: 'nearest' });
            }
        }

        if (searchToggle) searchToggle.addEventListener('click', openSearch);
        if (mobileSearchToggle) mobileSearchToggle.addEventListener('click', openSearch);
        if (searchClose) searchClose.addEventListener('click', closeSearch);

        if (searchOverlay) {
            searchOverlay.addEventListener('click', (e) => {
                if (e.target === searchOverlay) closeSearch();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(() => renderResults(searchInput.value.trim()), 150);
            });

            searchInput.addEventListener('keydown', (e) => {
                const items = searchResults.querySelectorAll('.search-result');
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    activeResultIndex = Math.min(activeResultIndex + 1, items.length - 1);
                    updateActiveResult();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    activeResultIndex = Math.max(activeResultIndex - 1, -1);
                    updateActiveResult();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (activeResultIndex >= 0 && items[activeResultIndex]) {
                        items[activeResultIndex].click();
                    }
                } else if (e.key === 'Escape') {
                    closeSearch();
                }
            });
        }

        // Cmd+K / Ctrl+K to open search
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (searchOverlay.style.display === 'none' || searchOverlay.style.display === '') {
                    openSearch();
                } else {
                    closeSearch();
                }
            }
            // Also close search on Escape (global)
            if (e.key === 'Escape' && searchOverlay.style.display === 'block') {
                closeSearch();
            }
        });

        // Ensure <main> has id for skip-to-content link
        const mainEl = document.querySelector('main');
        if (mainEl && !mainEl.id) mainEl.id = 'main-content';
    }

    // Booking Modal HTML
    const bookingModalHTML = `
    <div id="booking-modal" class="fixed inset-0 z-[100] hidden" role="dialog" aria-modal="true" aria-labelledby="booking-modal-heading">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="closeBookingModal()"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4">
            <div class="bg-brand-dark border border-white/10 rounded-sm max-w-md w-full p-8 relative">
                <button type="button" onclick="closeBookingModal()" class="absolute top-4 right-4 text-brand-gray hover:text-white" aria-label="Close booking modal">
                    <svg class="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
                <h3 id="booking-modal-heading" class="text-2xl font-bold text-brand-light mb-2 font-heading uppercase">Book an Appointment</h3>
                <p class="text-brand-gray text-sm mb-8">Which service are you looking for?</p>
                <div class="space-y-4">
                    <a href="https://moonshotclinic.com/book/" class="block w-full bg-brand-slate hover:bg-brand-slate/80 text-brand-light p-4 rounded-sm transition">
                        <span class="font-bold block">Medical</span>
                        <span class="text-brand-gray text-sm">Labs, DEXA, hormones, weight loss, peptides</span>
                    </a>
                    <a href="/booking/rehab/" class="block w-full bg-brand-slate hover:bg-brand-slate/80 text-brand-light p-4 rounded-sm transition">
                        <span class="font-bold block">Rehab</span>
                        <span class="text-brand-gray text-sm">Chiropractic, physical rehab, dry needling, shockwave</span>
                    </a>
                </div>
                <p class="text-brand-gray text-xs mt-6 text-center">Not sure? <a href="/contact/" class="underline hover:text-white">Contact us</a> and we'll help.</p>
            </div>
        </div>
    </div>
    `;

    // Inject search overlay (must be a direct child of body for z-index to work above nav)
    const searchOverlayHTML = `
    <div id="search-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:95;background:rgba(16,25,33,0.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)">
      <div class="max-w-2xl mx-auto px-4 pt-24">
        <div class="flex items-center gap-3 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-brand-gray"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input id="search-input" type="text" placeholder="Search services, articles, and guides..." autocomplete="off" class="flex-1 bg-transparent border-b border-white/20 focus:border-brand-gray py-3 text-xl text-brand-light placeholder-brand-gray/40 focus:outline-none font-light">
          <button type="button" id="search-close" class="text-brand-gray hover:text-white text-sm uppercase tracking-wider cursor-pointer" onclick="document.getElementById('search-overlay').style.display='none';document.body.style.overflow='';">Esc</button>
        </div>
        <div id="search-results" class="space-y-1 max-h-[60vh] overflow-y-auto"></div>
      </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', searchOverlayHTML);

    // Inject booking modal
    document.body.insertAdjacentHTML('beforeend', bookingModalHTML);

    // Decorate the booking modal's clinic CTA (site-wide "Book an Appointment"
    // entrypoint -> moonshotclinic.com/book/). This is the highest-traffic
    // booking link on the site and was previously unattributed.
    decorateClinicBookingLinks();

    // Global booking modal functions
    var _bookingModalTrigger = null;

    window.openBookingModal = function() {
        _bookingModalTrigger = document.activeElement;
        var modal = document.getElementById('booking-modal');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        // First-party generic CTA event — no `page` (URL would expose the
        // health condition the user was viewing). No quiz context here.
        try {
            fetch('/.netlify/functions/quiz-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quiz: 'site', event: 'cta_click', timestamp: new Date().toISOString() }),
                keepalive: true,
            }).catch(function(){});
        } catch (e) { /* ignore */ }
        // Focus first focusable element in modal
        setTimeout(function() {
            var focusable = modal.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
            if (focusable.length) focusable[0].focus();
        }, 50);
    };

    window.closeBookingModal = function() {
        document.getElementById('booking-modal').classList.add('hidden');
        document.body.style.overflow = '';
        // Restore focus to the element that triggered the modal
        if (_bookingModalTrigger && _bookingModalTrigger.focus) {
            _bookingModalTrigger.focus();
            _bookingModalTrigger = null;
        }
    };

    // Focus trap and escape for booking modal
    document.addEventListener('keydown', (e) => {
        var modal = document.getElementById('booking-modal');
        if (!modal || modal.classList.contains('hidden')) return;

        if (e.key === 'Escape') {
            closeBookingModal();
            return;
        }

        if (e.key === 'Tab') {
            var focusable = modal.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                // Shift+Tab: if on first element, wrap to last
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                // Tab: if on last element, wrap to first
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
    });

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderInteractions);
    } else {
        initHeaderInteractions();
    }
})();
