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
    // GA4 dataLayer queue — available immediately so events fire before gtag loads
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){dataLayer.push(arguments);};

    // Google Analytics 4 — deferred to avoid competing with critical resources
    setTimeout(function() {
        const gtagScript = document.createElement('script');
        gtagScript.async = true;
        gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-TVYS826RW0';
        document.head.appendChild(gtagScript);

        gtag('js', new Date());
        gtag('config', 'G-TVYS826RW0');

        // Meta CAPI — deferred client-side event tracker
        const metaScript = document.createElement('script');
        metaScript.defer = true;
        metaScript.src = '/shared/meta-tracking.js';
        document.head.appendChild(metaScript);
    }, 0);

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
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute left-0 mt-2 w-56 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="medical-dropdown">
                <div class="py-2">
                  <a href="/medical/" class="block px-4 py-3 text-sm text-brand-light hover:bg-white/5 uppercase tracking-wide">Overview</a>
                  <a href="/medical/blood-panels/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Blood Panels</a>
                  <a href="/blood-work/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Blood Work Guide</a>
                  <a href="/medical/dexa-scan/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">DEXA Scan</a>
                  <a href="/medical/mens-hormones/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Men's Hormones</a>
                  <a href="/medical/tadalafil/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Daily Tadalafil</a>
                  <a href="/medical/womens-hormones/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Women's Hormones</a>
                  <a href="/medical/weight-loss/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Weight Loss</a>
                  <a href="/medical/peptides/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Peptides</a>
                  <a href="/quiz/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/10 mt-1">Hormone Health Quiz</a>
                </div>
              </div>
            </div>

            <!-- Rehab Dropdown -->
            <div class="relative inline-block" id="rehab-menu-wrapper">
              <button type="button" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="rehab-menu-button" aria-expanded="false" aria-haspopup="true">
                Rehab
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute left-0 mt-2 w-56 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="rehab-dropdown">
                <div class="py-2">
                  <a href="/rehab/" class="block px-4 py-3 text-sm text-brand-light hover:bg-white/5 uppercase tracking-wide">Overview</a>
                  <a href="/rehab/chiropractic/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Chiropractic</a>
                  <a href="/rehab/physical-rehab/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Physical Rehab</a>
                  <a href="/rehab/trigger-point/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Trigger Point</a>
                  <a href="/rehab/dry-needling/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Dry Needling</a>
                  <a href="/rehab/shockwave/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Shockwave</a>
                </div>
              </div>
            </div>

            <!-- Learn Mega Menu -->
            <div class="relative inline-block" id="learn-menu-wrapper">
              <a href="/learn/" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="learn-menu-button" aria-expanded="false" aria-haspopup="true">
                Learn
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </a>
              <div class="absolute right-0 mt-2 w-[850px] bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="learn-dropdown">
                <div class="p-6 grid grid-cols-5 gap-6">
                  <!-- Men Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Men</span>
                    <a href="/learn/low-testosterone-symptoms/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Low T Symptoms</a>
                    <a href="/learn/trt-vs-steroids/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">TRT vs Steroids</a>
                    <a href="/medical/trt-vs-enclomiphene/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">TRT vs Enclomiphene</a>
                    <a href="/medical/tadalafil/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Daily Tadalafil</a>
                  </div>
                  <!-- Women Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Women</span>
                    <a href="/learn/menopause-perimenopause/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Menopause Guide</a>
                    <a href="/learn/testosterone-for-women/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Testosterone for Women</a>
                    <a href="/learn/progesterone/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Progesterone</a>
                    <a href="/learn/pcos/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">PCOS</a>
                    <a href="/learn/whi-study-hrt-truth/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">HRT: Myths vs Facts</a>
                  </div>
                  <!-- Weight Loss Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Weight Loss</span>
                    <a href="/learn/semaglutide-vs-tirzepatide/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Semaglutide vs Tirzepatide</a>
                    <a href="/medical/glp1-vs-other-weight-loss/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">GLP-1 vs Other Methods</a>
                    <a href="/learn/retatrutide/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Retatrutide Guide</a>
                  </div>
                  <!-- Peptides Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Peptides</span>
                    <a href="/learn/peptides/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Peptide Therapy Guide</a>
                    <a href="/learn/bpc-157/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">BPC-157</a>
                    <a href="/learn/sermorelin/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Sermorelin</a>
                    <a href="/learn/tb-500/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">TB-500</a>
                    <a href="/learn/wolverine-blend/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Wolverine Blend</a>
                    <a href="/learn/pt-141/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">PT-141</a>
                    <a href="/learn/ghk-cu/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">GHK-Cu</a>
                    <a href="/quiz/peptides/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Peptide Quiz</a>
                  </div>
                  <!-- Rehab & Diagnostics Column -->
                  <div>
                    <span class="block text-xs text-brand-gray uppercase tracking-widest mb-3 font-medium">Rehab & Diagnostics</span>
                    <a href="/learn/dry-needling/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Dry Needling</a>
                    <a href="/learn/shockwave-therapy/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Shockwave Therapy</a>
                    <a href="/learn/trigger-point-injections/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Trigger Point Injections</a>
                    <a href="/blood-work/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Blood Work Guide</a>
                    <a href="/medical/dexa-scan/dexa-vs-inbody/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">DEXA vs InBody</a>
                    <a href="/learn/first-visit/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Your First Visit</a>
                  </div>
                </div>
                <div class="border-t border-white/10 px-6 py-3">
                  <a href="/learn/" class="text-sm text-brand-gray hover:text-brand-light transition">View All Resources &rarr;</a>
                </div>
              </div>
            </div>

            <!-- About Dropdown -->
            <div class="relative inline-block" id="about-menu-wrapper">
              <button type="button" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="about-menu-button" aria-expanded="false" aria-haspopup="true">
                About
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute left-0 mt-2 w-56 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="about-dropdown">
                <div class="py-2">
                  <a href="/about/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5">Our Team</a>
                  <a href="/ourstory/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Tom's Story</a>
                  <a href="/medical/moonshot-vs-typical-clinic/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">How We're Different</a>
                  <a href="/contact/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/10 mt-2">Contact Us</a>
                </div>
              </div>
            </div>

            <!-- Quiz Dropdown -->
            <div class="relative inline-block" id="quiz-menu-wrapper">
              <button type="button" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="quiz-menu-button" aria-expanded="false" aria-haspopup="true">
                Quiz
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute left-0 mt-2 w-56 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="quiz-dropdown">
                <div class="py-2">
                  <a href="/quiz/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5">Hormone Health Quiz</a>
                  <a href="/quiz/peptides/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Peptide Quiz</a>
                  <a href="/quiz/body-comp/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Body Comp IQ Quiz</a>
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
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-medical-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <a href="/medical/peptides/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Peptides</a>
              <a href="/quiz/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide mt-2 font-bold">Hormone Health Quiz &rarr;</a>
            </div>
          </div>

          <!-- Rehab Mobile -->
          <div>
            <button type="button" id="mobile-rehab-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold">Rehab</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-rehab-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-learn-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-learn-submenu" class="bg-black/20 hidden">
              <span class="block w-full text-brand-gray py-2 text-xs uppercase tracking-wide">— Men —</span>
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
              <a href="/learn/retatrutide/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Retatrutide Guide</a>
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
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-about-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-quiz-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-quiz-submenu" class="bg-black/20 hidden">
              <a href="/quiz/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Hormone Health Quiz</a>
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

                const closeMenu = () => {
                    closeTimer = setTimeout(() => {
                        dropdown.classList.add('hidden');
                        btn.setAttribute('aria-expanded', 'false');
                        const icon = btn.querySelector('svg');
                        if (icon) icon.classList.remove('rotate-180');
                    }, 150);
                };

                wrapper.addEventListener('mouseenter', openMenu);
                wrapper.addEventListener('mouseleave', closeMenu);
                btn.addEventListener('click', (e) => { e.stopPropagation(); openMenu(); });
                document.addEventListener('click', (e) => { if (!wrapper.contains(e.target)) dropdown.classList.add('hidden'); });
            }
        }
        setupDesktopDropdown('medical-menu-wrapper', 'medical-menu-button', 'medical-dropdown');
        setupDesktopDropdown('rehab-menu-wrapper', 'rehab-menu-button', 'rehab-dropdown');
        setupDesktopDropdown('learn-menu-wrapper', 'learn-menu-button', 'learn-dropdown');
        setupDesktopDropdown('about-menu-wrapper', 'about-menu-button', 'about-dropdown');
        setupDesktopDropdown('quiz-menu-wrapper', 'quiz-menu-button', 'quiz-dropdown');

        // Close dropdowns on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('[id$="-dropdown"]').forEach(el => el.classList.add('hidden'));
            }
        });

        // Search functionality
        const searchIndex = [
            // Medical
            { title: "Blood Panels", desc: "60+ biomarker comprehensive blood panel", url: "/medical/blood-panels/", cat: "Medical" },
            { title: "DEXA Body Composition Scan", desc: "Medical-grade body composition analysis", url: "/medical/dexa-scan/", cat: "Medical" },
            { title: "Men's Hormone Optimization", desc: "Testosterone replacement therapy (TRT)", url: "/medical/mens-hormones/", cat: "Medical" },
            { title: "Women's Hormone Optimization", desc: "Bioidentical hormone replacement therapy", url: "/medical/womens-hormones/", cat: "Medical" },
            { title: "Weight Loss (GLP-1)", desc: "Semaglutide and tirzepatide programs", url: "/medical/weight-loss/", cat: "Medical" },
            { title: "Peptides & Add-On Therapies", desc: "BPC-157, TB-500, Sermorelin, PT-141, GHK-Cu", url: "/medical/peptides/", cat: "Medical" },
            { title: "Daily Tadalafil", desc: "Low-dose tadalafil for vascular health", url: "/medical/tadalafil/", cat: "Medical" },
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
            { title: "Peptide Quiz", desc: "Find which peptide is right for you", url: "/quiz/peptides/", cat: "Quiz" },
            // Weight Loss
            { title: "Semaglutide vs Tirzepatide", desc: "GLP-1 medication comparison", url: "/learn/semaglutide-vs-tirzepatide/", cat: "Weight Loss" },
            { title: "GLP-1 vs Other Weight Loss", desc: "How GLP-1s compare to other methods", url: "/medical/glp1-vs-other-weight-loss/", cat: "Weight Loss" },
            { title: "Retatrutide Guide", desc: "Triple-agonist GLP-1 in clinical trials", url: "/learn/retatrutide/", cat: "Weight Loss" },
            // Rehab
            { title: "Chiropractic Care", desc: "McKenzie Method evidence-based care", url: "/rehab/chiropractic/", cat: "Rehab" },
            { title: "Dry Needling", desc: "Trigger point release for chronic pain", url: "/learn/dry-needling/", cat: "Rehab" },
            { title: "Shockwave Therapy", desc: "ESWT for tendon injuries", url: "/learn/shockwave-therapy/", cat: "Rehab" },
            { title: "Trigger Point Injections", desc: "Targeted relief for muscle pain", url: "/learn/trigger-point-injections/", cat: "Rehab" },
            { title: "Physical Rehabilitation", desc: "Movement restoration and strength rehab", url: "/rehab/physical-rehab/", cat: "Rehab" },
            // Diagnostics
            { title: "Blood Work Guide", desc: "Understanding your lab results", url: "/blood-work/", cat: "Diagnostics" },
            { title: "DEXA vs InBody", desc: "Body composition scan comparison", url: "/medical/dexa-scan/dexa-vs-inbody/", cat: "Diagnostics" },
            { title: "Optimal vs Normal Ranges", desc: "Why normal isn't always optimal", url: "/learn/optimal-vs-normal/", cat: "Diagnostics" },
            // Hormones
            { title: "Low Testosterone Symptoms", desc: "Signs of low T in men", url: "/learn/low-testosterone-symptoms/", cat: "Men" },
            { title: "TRT vs Steroids", desc: "Understanding the difference", url: "/learn/trt-vs-steroids/", cat: "Men" },
            { title: "Menopause Guide", desc: "Perimenopause and menopause explained", url: "/learn/menopause-perimenopause/", cat: "Women" },
            { title: "Testosterone for Women", desc: "Why women need testosterone too", url: "/learn/testosterone-for-women/", cat: "Women" },
            // About
            { title: "Our Team", desc: "Meet the Moonshot Medical team", url: "/about/", cat: "About" },
            { title: "Missy Zammichieli, DNP", desc: "Medical Director credentials and bio", url: "/about/missy-zammichieli/", cat: "About" },
            { title: "Book an Appointment", desc: "Schedule medical or rehab visit", url: "/booking/", cat: "Book" },
            { title: "Contact Us", desc: "Phone, email, and location", url: "/contact/", cat: "About" },
            { title: "Hormone Health Quiz", desc: "2-minute hormone assessment", url: "/quiz/", cat: "Quiz" },
            { title: "Peptide Therapy in Park Ridge", desc: "Local peptide therapy guide", url: "/learn/peptide-therapy-park-ridge/", cat: "Local" },
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
    <div id="booking-modal" class="fixed inset-0 z-[100] hidden">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="closeBookingModal()"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4">
            <div class="bg-brand-dark border border-white/10 rounded-sm max-w-md w-full p-8 relative">
                <button type="button" onclick="closeBookingModal()" class="absolute top-4 right-4 text-brand-gray hover:text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
                <h3 class="text-2xl font-bold text-brand-light mb-2 font-heading uppercase">Book an Appointment</h3>
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
    <div id="search-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:95;background:rgba(16,25,33,0.97);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)">
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

    // Global booking modal functions
    window.openBookingModal = function() {
        document.getElementById('booking-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        gtag('event', 'cta_click', {cta_name: 'book_now', page: location.pathname});
    };

    window.closeBookingModal = function() {
        document.getElementById('booking-modal').classList.add('hidden');
        document.body.style.overflow = '';
    };

    // Close modals on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeBookingModal();
        }
    });

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderInteractions);
    } else {
        initHeaderInteractions();
    }
})();
