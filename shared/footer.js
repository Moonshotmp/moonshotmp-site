/*
 * Moonshot Footer Component
 * =========================
 * Auto-injects the site footer into the page.
 *
 * Usage:
 *   Add this at the end of <body>, before closing </body>:
 *   <div id="site-footer"></div>
 *   <script src="/shared/footer.js"></script>
 *
 *   Or just include the script and it will append to body automatically.
 */

(function() {
    const currentYear = new Date().getFullYear();

    const footerHTML = `
    <footer class="bg-black border-t border-white/10 py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid md:grid-cols-3 gap-8">
                <!-- Brand -->
                <div>
                    <a href="/" class="flex items-center gap-2 mb-2">
                         <img src="/images/mm+logocloud.png" alt="MM+ Logo" class="h-8 md:h-10 w-auto object-contain">
                    </a>
                    <div class="text-brand-light font-heading font-bold text-xl tracking-widest">Moonshot Medical and Performance</div>
                    <p class="text-brand-gray text-xs mt-2">
                        542 Busse Hwy, Park Ridge, IL 60068
                    </p>
                </div>

                <!-- Contact -->
                <div>
                    <h4 class="text-brand-light font-heading font-bold text-sm tracking-widest mb-4">CONTACT</h4>
                    <div class="space-y-2 text-sm">
                        <p class="text-brand-gray">
                            <span class="text-brand-light font-medium">Medical:</span>
                            <a href="tel:+18474991266" class="hover:text-brand-light transition">847-499-1266</a>
                        </p>
                        <p class="text-brand-gray">
                            <span class="text-brand-light font-medium">Rehab:</span>
                            <a href="tel:+12244354280" class="hover:text-brand-light transition">224-435-4280</a>
                        </p>
                        <p class="text-brand-gray mt-3">
                            <a href="mailto:hello@moonshotmp.com" class="hover:text-brand-light transition">hello@moonshotmp.com</a>
                        </p>
                    </div>
                </div>

                <!-- Social -->
                <div>
                    <h4 class="text-brand-light font-heading font-bold text-sm tracking-widest mb-4">FOLLOW</h4>
                    <a href="https://www.instagram.com/moonshotmp" target="_blank" rel="noopener noreferrer" class="text-brand-gray hover:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                        Instagram
                    </a>
                </div>
            </div>
            <div class="mt-8 pt-8 border-t border-white/5 text-center md:text-left text-xs text-brand-gray/50">
                &copy; ${currentYear} Moonshot Medical and Performance. All Rights Reserved.
            </div>
        </div>
    </footer>
    `;

    // Inject footer
    const footerContainer = document.getElementById('site-footer');
    if (footerContainer) {
        footerContainer.innerHTML = footerHTML;
    } else {
        // Append to body if no container found
        document.body.insertAdjacentHTML('beforeend', footerHTML);
    }
})();
