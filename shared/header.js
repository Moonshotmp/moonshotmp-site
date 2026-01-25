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

          <div class="hidden md:flex space-x-6 items-center">
            <!-- Medical Dropdown -->
            <div class="relative inline-block" id="medical-menu-wrapper">
              <button class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="medical-menu-button" aria-expanded="false" aria-haspopup="true">
                Medical
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              <div class="absolute left-0 mt-2 w-56 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden" id="medical-dropdown">
                <div class="py-2">
                  <a href="/medical/" class="block px-4 py-3 text-sm text-brand-light hover:bg-white/5 uppercase tracking-wide">Overview</a>
                  <a href="/medical/blood-panels/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Blood Panels</a>
                  <a href="/medical/dexa-scan/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">DEXA Scan</a>
                  <a href="/medical/mens-hormones/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Men's Hormones</a>
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
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
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

            <a href="/about/" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition">About</a>
            <a href="/contact/" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition">Contact</a>
            <a href="/booking/medical/" class="btn-primary text-xs tracking-widest" onclick="event.preventDefault(); openBookingModal();">Book Now</a>
          </div>

          <div class="md:hidden flex items-center">
            <button id="mobile-menu-btn" class="text-brand-light hover:text-white focus:outline-none">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div id="mobile-menu" class="md:hidden bg-brand-dark border-b border-white/10 hidden">
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 text-center">

          <!-- Medical Mobile -->
          <div>
            <button id="mobile-medical-btn" class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold">Medical</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-medical-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            <div id="mobile-medical-submenu" class="bg-black/20 hidden">
              <a href="/medical/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide font-bold">Overview</a>
              <a href="/medical/blood-panels/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Blood Panels</a>
              <a href="/medical/dexa-scan/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">DEXA Scan</a>
              <a href="/medical/mens-hormones/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Men's Hormones</a>
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
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
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

          <a href="/about/" class="block w-full text-brand-light hover:bg-white/5 py-3 text-sm uppercase tracking-widest">About</a>
          <a href="/contact/" class="block w-full text-brand-light hover:bg-white/5 py-3 text-sm uppercase tracking-widest">Contact</a>
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
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
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
