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
                    <h3 class="text-brand-light font-heading font-bold text-sm tracking-widest mb-4">CONTACT</h3>
                    <div class="space-y-2 text-sm">
                        <p class="text-brand-gray">
                            <span class="text-brand-light font-medium">Medical:</span>
                            <a href="tel:+18474991266" class="hover:text-brand-light transition py-2 inline-block">847-499-1266</a>
                        </p>
                        <p class="text-brand-gray">
                            <span class="text-brand-light font-medium">Rehab:</span>
                            <a href="tel:+12244354280" class="hover:text-brand-light transition py-2 inline-block">224-435-4280</a>
                        </p>
                        <p class="text-brand-gray mt-3">
                            <a href="mailto:hello@moonshotmp.com" class="hover:text-brand-light transition py-2 inline-block">hello@moonshotmp.com</a>
                        </p>
                    </div>
                </div>

                <!-- Social -->
                <div>
                    <h3 class="text-brand-light font-heading font-bold text-sm tracking-widest mb-4">FOLLOW</h3>
                    <a href="https://www.instagram.com/moonshotmp" target="_blank" rel="noopener noreferrer" class="text-brand-gray hover:text-white text-sm uppercase tracking-wider flex items-center gap-2 py-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                        Instagram
                    </a>
                </div>
            </div>
            <div class="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-brand-gray">
                <span>&copy; ${currentYear} Moonshot Medical and Performance. All Rights Reserved.</span>
                <div class="flex gap-6">
                    <a href="/privacy/" class="hover:text-brand-gray transition">Privacy Policy</a>
                    <a href="/terms/" class="hover:text-brand-gray transition">Terms of Service</a>
                </div>
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

    // Mid-article CTA banner on learn articles
    if (/^\/learn\/[^/]+\//.test(location.pathname)) {
        var articleH2s = document.querySelectorAll('article h2');
        if (articleH2s.length >= 4) {
            var target = articleH2s[3];
            var section = target.closest('section') || target.parentElement;
            var cta = document.createElement('div');
            cta.className = 'my-12 bg-brand-slate text-brand-light p-6 md:p-8 text-center';
            cta.innerHTML = '<p class="font-heading font-bold text-lg uppercase tracking-wide mb-2">Ready to take the next step?</p>' +
                '<p class="text-brand-gray text-sm font-light mb-4">Book a free consultation and get a personalized plan.</p>' +
                '<a href="#" onclick="event.preventDefault(); openBookingModal();" class="btn-primary text-xs tracking-widest">Book a Free Consultation</a>';
            section.parentNode.insertBefore(cta, section);
        }
    }

    // GA4: track phone link clicks
    document.querySelectorAll('a[href^="tel:"]').forEach(function(link) {
        link.addEventListener('click', function() {
            gtag('event', 'cta_click', {cta_name: 'call', page: location.pathname});
        });
    });

    // Sticky mobile CTA bar on content pages
    var path = location.pathname;
    if (/^\/(learn|medical|rehab)\//.test(path)) {
        requestIdleCallback(function() {
            var bar = document.createElement('div');
            bar.id = 'sticky-mobile-cta';
            bar.className = 'fixed bottom-0 left-0 right-0 z-[80] bg-brand-dark/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-center gap-4 md:hidden';
            bar.style.display = 'none';
            bar.innerHTML = '<a href="#" onclick="event.preventDefault(); openBookingModal();" class="btn-primary text-xs tracking-widest py-2 px-6">Book Now</a>' +
                '<a href="tel:+18474991266" class="text-brand-light border border-white/20 rounded-full w-10 h-10 flex items-center justify-center hover:bg-white/10 transition" aria-label="Call us">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>' +
                '</a>';
            document.body.appendChild(bar);

            var shown = false;
            window.addEventListener('scroll', function() {
                var shouldShow = window.scrollY > 300;
                if (shouldShow !== shown) {
                    shown = shouldShow;
                    bar.style.display = shouldShow ? 'flex' : 'none';
                }
            }, {passive: true});
        });
    }

    // Load chat widget
    const chatScript = document.createElement('script');
    chatScript.src = '/shared/chat-widget.js';
    document.body.appendChild(chatScript);
})();
