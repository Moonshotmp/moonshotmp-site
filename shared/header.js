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
    const headerHTML = `
    <nav class="fixed top-0 w-full z-50 bg-brand-dark/95 backdrop-blur-md border-b border-white/10" id="navbar">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-20">
          <a href="/" class="flex-shrink-0 flex items-center gap-2 cursor-pointer">
            <img src="/images/mm+logocloud.png" alt="MM+ Logo" class="h-8 md:h-10 w-auto object-contain">
            <div class="hidden sm:block text-brand-light font-heading text-sm tracking-wide leading-tight ml-3">
              MOONSHOT<br>MEDICAL AND PERFORMANCE
            </div>
          </a>

          <div class="hidden lg:flex space-x-6 items-center">
            <!-- Medical Dropdown -->
            <div class="relative inline-block" id="medical-menu-wrapper">
              <button class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
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
                  <a href="/medical/dexa-scan/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">DEXA Scan</a>
                  <a href="/medical/mens-hormones/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Men's Hormones</a>
                  <a href="/medical/tadalafil/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Daily Tadalafil</a>
                  <a href="/medical/womens-hormones/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Women's Hormones</a>
                  <a href="/medical/weight-loss/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Weight Loss</a>
                  <a href="/medical/peptides/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Peptides</a>
                </div>
              </div>
            </div>

            <!-- Rehab Dropdown -->
            <div class="relative inline-block" id="rehab-menu-wrapper">
              <button class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
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
              <button class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="learn-menu-button" aria-expanded="false" aria-haspopup="true">
                Learn
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute right-0 mt-2 w-[540px] bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="learn-dropdown">
                <div class="p-6 grid grid-cols-3 gap-6">
                  <!-- Men Column -->
                  <div>
                    <span class="block text-xs text-brand-gray/60 uppercase tracking-widest mb-3 font-medium">Men</span>
                    <a href="/learn/low-testosterone-symptoms/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Low T Symptoms</a>
                    <a href="/medical/trt-vs-enclomiphene/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">TRT vs Enclomiphene</a>
                    <a href="/medical/tadalafil/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Daily Tadalafil</a>
                  </div>
                  <!-- Women Column -->
                  <div>
                    <span class="block text-xs text-brand-gray/60 uppercase tracking-widest mb-3 font-medium">Women</span>
                    <a href="/learn/menopause-perimenopause/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Menopause Guide</a>
                    <a href="/learn/testosterone-for-women/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Testosterone for Women</a>
                    <a href="/learn/progesterone/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Progesterone</a>
                    <a href="/learn/pcos/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">PCOS</a>
                    <a href="/learn/whi-study-hrt-truth/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">HRT: Myths vs Facts</a>
                  </div>
                  <!-- Diagnostics Column -->
                  <div>
                    <span class="block text-xs text-brand-gray/60 uppercase tracking-widest mb-3 font-medium">Diagnostics</span>
                    <a href="/learn/understanding-blood-results/" class="block py-2 text-sm text-brand-gray hover:text-brand-light transition">Understanding Blood Results</a>
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
              <button class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
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

            <a href="/booking/medical/" class="btn-primary text-xs tracking-widest" onclick="event.preventDefault(); openBookingModal();">Book Now</a>
          </div>

          <div class="lg:hidden flex items-center">
            <button id="mobile-menu-btn" class="text-brand-light hover:text-white focus:outline-none">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div id="mobile-menu" class="lg:hidden bg-brand-dark border-b border-white/10 hidden">
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 text-center">

          <!-- Medical Mobile -->
          <div>
            <button id="mobile-medical-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold">Medical</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-medical-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-medical-submenu" class="bg-black/20 hidden">
              <a href="/medical/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide font-bold">Overview</a>
              <a href="/medical/blood-panels/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Blood Panels</a>
              <a href="/medical/dexa-scan/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">DEXA Scan</a>
              <a href="/medical/mens-hormones/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Men's Hormones</a>
              <a href="/medical/tadalafil/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Daily Tadalafil</a>
              <a href="/medical/womens-hormones/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Women's Hormones</a>
              <a href="/medical/weight-loss/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Weight Loss</a>
              <a href="/medical/peptides/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Peptides</a>
            </div>
          </div>

          <!-- Rehab Mobile -->
          <div>
            <button id="mobile-rehab-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
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
            <button id="mobile-learn-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold">Learn</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-learn-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-learn-submenu" class="bg-black/20 hidden">
              <span class="block w-full text-brand-gray/50 py-2 text-xs uppercase tracking-wide">— Men —</span>
              <a href="/learn/low-testosterone-symptoms/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Low T Symptoms</a>
              <a href="/medical/trt-vs-enclomiphene/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">TRT vs Enclomiphene</a>
              <a href="/medical/tadalafil/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Daily Tadalafil</a>
              <span class="block w-full text-brand-gray/50 py-2 text-xs uppercase tracking-wide mt-2">— Women —</span>
              <a href="/learn/menopause-perimenopause/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Menopause Guide</a>
              <a href="/learn/testosterone-for-women/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Testosterone for Women</a>
              <a href="/learn/progesterone/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Progesterone</a>
              <a href="/learn/pcos/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">PCOS</a>
              <a href="/learn/whi-study-hrt-truth/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">HRT: Myths vs Facts</a>
              <span class="block w-full text-brand-gray/50 py-2 text-xs uppercase tracking-wide mt-2">— Diagnostics —</span>
              <a href="/learn/understanding-blood-results/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Understanding Blood Results</a>
              <a href="/medical/dexa-scan/dexa-vs-inbody/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">DEXA vs InBody</a>
              <a href="/learn/first-visit/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Your First Visit</a>
              <a href="/learn/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide mt-2 font-bold">View All &rarr;</a>
            </div>
          </div>

          <!-- About Mobile -->
          <div>
            <button id="mobile-about-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
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
                // Close all submenus when closing main menu
                if (mobileMenu.classList.contains('hidden')) {
                    document.querySelectorAll('#mobile-menu [id$="-submenu"]').forEach(el => el.classList.add('hidden'));
                    document.querySelectorAll('#mobile-menu [id$="-arrow"]').forEach(el => el.classList.remove('rotate-180'));
                }
            });
        }

        // Mobile submenu toggles
        function setupMobileSubmenu(btnId, submenuId, arrowId) {
            const btn = document.getElementById(btnId);
            const submenu = document.getElementById(submenuId);
            const arrow = document.getElementById(arrowId);
            if (btn && submenu && arrow) {
                btn.addEventListener('click', () => {
                    submenu.classList.toggle('hidden');
                    arrow.classList.toggle('rotate-180');
                });
            }
        }
        setupMobileSubmenu('mobile-medical-btn', 'mobile-medical-submenu', 'mobile-medical-arrow');
        setupMobileSubmenu('mobile-rehab-btn', 'mobile-rehab-submenu', 'mobile-rehab-arrow');
        setupMobileSubmenu('mobile-learn-btn', 'mobile-learn-submenu', 'mobile-learn-arrow');
        setupMobileSubmenu('mobile-about-btn', 'mobile-about-submenu', 'mobile-about-arrow');

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

        // Close dropdowns on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('[id$="-dropdown"]').forEach(el => el.classList.add('hidden'));
            }
        });
    }

    // Booking Modal HTML
    const bookingModalHTML = `
    <div id="booking-modal" class="fixed inset-0 z-[100] hidden">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="closeBookingModal()"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4">
            <div class="bg-brand-dark border border-white/10 rounded-sm max-w-md w-full p-8 relative">
                <button onclick="closeBookingModal()" class="absolute top-4 right-4 text-brand-gray hover:text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
                <h3 class="text-2xl font-bold text-brand-light mb-2 font-heading uppercase">Book an Appointment</h3>
                <p class="text-brand-gray text-sm mb-8">Which service are you looking for?</p>
                <div class="space-y-4">
                    <a href="/booking/" class="block w-full bg-brand-slate hover:bg-brand-slate/80 text-brand-light p-4 rounded-sm transition">
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

    // Inject booking modal
    document.body.insertAdjacentHTML('beforeend', bookingModalHTML);

    // Global booking modal functions
    window.openBookingModal = function() {
        document.getElementById('booking-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    window.closeBookingModal = function() {
        document.getElementById('booking-modal').classList.add('hidden');
        document.body.style.overflow = '';
    };

    // Close modal on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeBookingModal();
    });

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderInteractions);
    } else {
        initHeaderInteractions();
    }
})();
