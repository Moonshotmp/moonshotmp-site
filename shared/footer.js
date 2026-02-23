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
                            <a href="tel:+12244354280" class="hover:text-brand-light transition py-2 inline-block">224-435-4280</a>
                        </p>
                        <p class="text-brand-gray">
                            <a href="mailto:hello@moonshotmp.com" class="hover:text-brand-light transition py-2 inline-block">hello@moonshotmp.com</a>
                        </p>
                    </div>
                </div>

                <!-- Social -->
                <div>
                    <h3 class="text-brand-light font-heading font-bold text-sm tracking-widest mb-4">FOLLOW</h3>
                    <div class="space-y-2">
                        <a href="https://www.instagram.com/moonshotmp" target="_blank" rel="noopener noreferrer" class="text-brand-gray hover:text-white text-sm uppercase tracking-wider flex items-center gap-2 py-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                            Instagram
                        </a>
                        <a href="https://www.facebook.com/people/Moonshot-Medical-and-Performance/61587482906784/" target="_blank" rel="noopener noreferrer" class="text-brand-gray hover:text-white text-sm uppercase tracking-wider flex items-center gap-2 py-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                            Facebook
                        </a>
                        <a href="https://www.linkedin.com/company/moonshot-medical-and-performance" target="_blank" rel="noopener noreferrer" class="text-brand-gray hover:text-white text-sm uppercase tracking-wider flex items-center gap-2 py-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                            LinkedIn
                        </a>
                    </div>
                </div>
            </div>
            <!-- Quiz CTAs -->
            <div class="mt-8 pt-8 border-t border-white/5">
                <p class="text-brand-light font-heading font-bold text-sm tracking-widest mb-4">FREE QUIZZES</p>
                <div class="grid sm:grid-cols-2 gap-4">
                    <a href="/quiz/" class="block border border-white/20 border-l-2 border-l-brand-light rounded-sm p-5 bg-brand-slate hover:bg-brand-slate/80 hover:border-white/30 transition-all duration-300 group">
                        <p class="text-white font-heading font-bold text-sm tracking-widest group-hover:text-white transition">HORMONE HEALTH QUIZ</p>
                        <p class="text-brand-light/80 text-xs mt-1">Are your hormones holding you back? 2-min assessment with personalized results.</p>
                    </a>
                    <a href="/quiz/body-comp/" class="block border border-white/20 border-l-2 border-l-brand-light rounded-sm p-5 bg-brand-slate hover:bg-brand-slate/80 hover:border-white/30 transition-all duration-300 group">
                        <p class="text-white font-heading font-bold text-sm tracking-widest group-hover:text-white transition">BODY COMP IQ QUIZ</p>
                        <p class="text-brand-light/80 text-xs mt-1">Test what you know about body fat, DEXA scans, and metabolic health.</p>
                    </a>
                </div>
            </div>

            <div class="mt-6 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-brand-gray">
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

    // Contextual lead magnet CTA on learn articles (replaces generic booking CTA)
    if (/^\/learn\/[^/]+\//.test(location.pathname)) {
        var magnetScript = document.createElement('script');
        magnetScript.src = '/shared/lead-magnets.js';
        document.body.appendChild(magnetScript);
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
                '<a href="tel:+12244354280" class="text-brand-light border border-white/20 rounded-full w-10 h-10 flex items-center justify-center hover:bg-white/10 transition" aria-label="Call us">' +
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

    // "Not ready to book?" quiz CTA on service pages (medical, rehab, DEXA)
    if (/^\/(medical|rehab)\/(index\.html)?$/.test(path) || path === '/medical/dexa-scan/' || path === '/medical/dexa-scan/index.html') {
        var lastCta = document.querySelector('main > section:last-of-type');
        if (lastCta) {
            var quizNudge = document.createElement('div');
            quizNudge.className = 'bg-brand-dark border-t border-white/5 py-8 text-center';
            quizNudge.innerHTML = '<p class="text-brand-gray text-sm mb-3">Not ready to book? Start with a free quiz.</p>' +
                '<div class="flex justify-center gap-4 flex-wrap">' +
                '<a href="/quiz/" class="text-brand-light text-sm border border-white/15 rounded-sm px-5 py-2 hover:bg-white/5 transition">Hormone Health Quiz</a>' +
                '<a href="/quiz/body-comp/" class="text-brand-light text-sm border border-white/15 rounded-sm px-5 py-2 hover:bg-white/5 transition">Body Comp IQ Quiz</a>' +
                '</div>';
            lastCta.insertAdjacentElement('afterend', quizNudge);
        }
    }

    // Scroll-depth quiz prompt on content pages (60%+ scroll, once per session)
    if (/^\/(learn|medical|rehab)\//.test(path) && !/^\/quiz\//.test(path) && !sessionStorage.getItem('quiz_prompt_shown')) {
        var promptShown = false;
        window.addEventListener('scroll', function() {
            if (promptShown) return;
            var scrollPct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
            if (scrollPct >= 0.6) {
                promptShown = true;
                sessionStorage.setItem('quiz_prompt_shown', '1');
                var prompt = document.createElement('div');
                prompt.id = 'quiz-scroll-prompt';
                prompt.className = 'fixed bottom-4 right-4 z-[70] bg-brand-dark border border-white/10 rounded-sm p-5 shadow-2xl max-w-xs transition-all duration-300 translate-y-4 opacity-0 hidden md:block';
                prompt.innerHTML = '<button onclick="this.parentElement.remove()" class="absolute top-2 right-3 text-brand-gray hover:text-white text-lg leading-none">&times;</button>' +
                    '<p class="text-brand-light font-heading font-bold text-sm tracking-widest mb-1">CURIOUS?</p>' +
                    '<p class="text-brand-gray text-xs mb-3">Take a free 2-min quiz and get personalized insights.</p>' +
                    '<div class="space-y-2">' +
                    '<a href="/quiz/" class="block text-brand-light text-xs border border-white/15 rounded-sm px-4 py-2 hover:bg-white/5 transition text-center">Hormone Health Quiz</a>' +
                    '<a href="/quiz/body-comp/" class="block text-brand-light text-xs border border-white/15 rounded-sm px-4 py-2 hover:bg-white/5 transition text-center">Body Comp IQ Quiz</a>' +
                    '</div>';
                document.body.appendChild(prompt);
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        prompt.style.opacity = '1';
                        prompt.style.transform = 'translateY(0)';
                    });
                });
            }
        }, {passive: true});
    }

    // Load chat widget
    const chatScript = document.createElement('script');
    chatScript.src = '/shared/chat-widget.js';
    document.body.appendChild(chatScript);
})();
