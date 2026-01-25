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

          <div class="hidden md:flex space-x-8 items-center">
            <a href="/" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition">Home</a>

            <div class="relative inline-block" id="services-menu-wrapper">
              <button class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition flex items-center focus:outline-none"
                      id="services-menu-button" aria-expanded="false" aria-haspopup="true">
                Services
                <svg class="ml-1 h-4 w-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              <div class="absolute left-0 mt-2 w-64 bg-brand-dark border border-white/10 shadow-xl rounded-sm hidden"
                   id="services-dropdown">
                <div class="py-2">
                  <a href="/services/" class="block px-4 py-3 text-sm text-brand-light hover:bg-white/5 uppercase tracking-wide">All Services</a>
                  <a href="/services/performance-medicine/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Performance Medicine</a>
                  <a href="/services/mens-hormone-optimization/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Men's Hormone Optimization</a>
                  <a href="/services/womens-hormone-optimization/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Women's Hormone Optimization</a>
                  <a href="/services/body-composition-optimization/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Body Composition</a>
                  <a href="/services/recovery-and-optimization/" class="block px-4 py-3 text-sm text-brand-gray hover:text-brand-light hover:bg-white/5 border-t border-white/5">Recovery & Optimization</a>
                </div>
              </div>
            </div>

            <a href="/membership/" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition">Membership</a>
            <a href="/contact/" class="nav-link text-brand-light hover:text-brand-gray text-sm uppercase tracking-wider font-medium transition">Contact</a>
            <a href="/booking/" class="btn-primary text-xs tracking-widest">Book Consult</a>
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
          <a href="/" class="block w-full text-brand-light hover:bg-white/5 py-3 text-sm uppercase tracking-widest">Home</a>

          <div>
            <button id="mobile-services-btn"
                    class="w-full flex items-center px-2 py-3 text-brand-light hover:bg-white/5 text-sm uppercase tracking-widest focus:outline-none">
              <span class="w-4"></span>
              <span class="flex-1 text-center font-bold border-b border-white">Services</span>
              <svg class="h-4 w-4 transition-transform duration-200" id="mobile-services-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            <div id="mobile-services-submenu" class="bg-black/20 hidden">
              <a href="/services/" class="block w-full text-brand-light py-2 text-xs uppercase tracking-wide font-bold">All Services</a>
              <a href="/services/performance-medicine/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Performance Medicine</a>
              <a href="/services/mens-hormone-optimization/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Men's Hormones</a>
              <a href="/services/womens-hormone-optimization/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Women's Hormones</a>
              <a href="/services/body-composition-optimization/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Body Composition</a>
              <a href="/services/recovery-and-optimization/" class="block w-full text-brand-gray hover:text-brand-light py-2 text-xs uppercase tracking-wide">Recovery</a>
            </div>
          </div>

          <a href="/membership/" class="block w-full text-brand-light hover:bg-white/5 py-3 text-sm uppercase tracking-widest">Membership</a>
          <a href="/contact/" class="block w-full text-brand-light hover:bg-white/5 py-3 text-sm uppercase tracking-widest">Contact</a>
          <a href="/booking/" class="block w-full text-brand-light bg-brand-gray/10 hover:bg-brand-gray/20 py-3 text-sm uppercase tracking-widest mt-2 font-bold">Book Consult</a>
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
        const mobileServicesBtn = document.getElementById('mobile-services-btn');
        const mobileServicesSubmenu = document.getElementById('mobile-services-submenu');
        const mobileServicesArrow = document.getElementById('mobile-services-arrow');

        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
                if (mobileMenu.classList.contains('hidden') && mobileServicesSubmenu) {
                    mobileServicesSubmenu.classList.add('hidden');
                    if (mobileServicesArrow) mobileServicesArrow.classList.remove('rotate-180');
                }
            });
        }

        if (mobileServicesBtn && mobileServicesSubmenu && mobileServicesArrow) {
            mobileServicesBtn.addEventListener('click', () => {
                mobileServicesSubmenu.classList.toggle('hidden');
                mobileServicesArrow.classList.toggle('rotate-180');
            });
        }

        const wrapper = document.getElementById('services-menu-wrapper');
        const btn = document.getElementById('services-menu-button');
        const dropdown = document.getElementById('services-dropdown');

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

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openMenu();
            });

            document.addEventListener('click', (e) => {
                if (!wrapper.contains(e.target)) dropdown.classList.add('hidden');
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') dropdown.classList.add('hidden');
            });
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderInteractions);
    } else {
        initHeaderInteractions();
    }
})();
