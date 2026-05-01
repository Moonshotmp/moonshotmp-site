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
            <div class="grid md:grid-cols-4 gap-8">
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

                <!-- Resources -->
                <div>
                    <h3 class="text-brand-light font-heading font-bold text-sm tracking-widest mb-4">RESOURCES</h3>
                    <div class="space-y-2 text-sm">
                        <p class="text-brand-gray">
                            <a href="/blood-work/" class="hover:text-brand-light transition py-2 inline-block">Blood Work Guide</a>
                        </p>
                        <p class="text-brand-gray">
                            <a href="/medical/blood-panels/" class="hover:text-brand-light transition py-2 inline-block">Blood Panels</a>
                        </p>
                        <p class="text-brand-gray">
                            <a href="/medical/dexa-scan/" class="hover:text-brand-light transition py-2 inline-block">DEXA Scans</a>
                        </p>
                        <p class="text-brand-gray">
                            <a href="/learn/" class="hover:text-brand-light transition py-2 inline-block">All Articles</a>
                        </p>
                    </div>
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
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <a href="/quiz/perimenopause/" class="block border border-white/20 border-l-2 border-l-brand-light rounded-sm p-5 bg-brand-slate hover:bg-brand-slate/80 hover:border-white/30 transition-all duration-300 group">
                        <p class="text-white font-heading font-bold text-sm tracking-widest group-hover:text-white transition">PERIMENOPAUSE SCREENER</p>
                        <p class="text-brand-light/80 text-xs mt-1">Validated 11-item MRS scale plus a safety screen for hormone-therapy contraindications.</p>
                    </a>
                    <a href="/quiz/low-t/" class="block border border-white/20 border-l-2 border-l-brand-light rounded-sm p-5 bg-brand-slate hover:bg-brand-slate/80 hover:border-white/30 transition-all duration-300 group">
                        <p class="text-white font-heading font-bold text-sm tracking-widest group-hover:text-white transition">TRT READINESS SCREENER</p>
                        <p class="text-brand-light/80 text-xs mt-1">Validated 10-item ADAM scale plus a PSA and IPSS short-form safety check.</p>
                    </a>
                    <a href="/quiz/glp1/" class="block border border-white/20 border-l-2 border-l-brand-light rounded-sm p-5 bg-brand-slate hover:bg-brand-slate/80 hover:border-white/30 transition-all duration-300 group">
                        <p class="text-white font-heading font-bold text-sm tracking-widest group-hover:text-white transition">GLP-1 READINESS SCREENER</p>
                        <p class="text-brand-light/80 text-xs mt-1">BMI, qualifying comorbidities, and an 8-category contraindication safety check for prescription weight-management.</p>
                    </a>
                    <a href="/quiz/bone-density/" class="block border border-white/20 border-l-2 border-l-brand-light rounded-sm p-5 bg-brand-slate hover:bg-brand-slate/80 hover:border-white/30 transition-all duration-300 group">
                        <p class="text-white font-heading font-bold text-sm tracking-widest group-hover:text-white transition">BONE DENSITY SCREENER</p>
                        <p class="text-brand-light/80 text-xs mt-1">OST formula plus AACE / NOF risk factors to help you decide whether a DEXA scan makes sense.</p>
                    </a>
                    <a href="/quiz/peptides/" class="block border border-white/20 border-l-2 border-l-brand-light rounded-sm p-5 bg-brand-slate hover:bg-brand-slate/80 hover:border-white/30 transition-all duration-300 group">
                        <p class="text-white font-heading font-bold text-sm tracking-widest group-hover:text-white transition">PEPTIDE QUIZ</p>
                        <p class="text-brand-light/80 text-xs mt-1">Which peptide is right for you? Get a personalized protocol recommendation.</p>
                    </a>
                    <a href="/quiz/body-comp/" class="block border border-white/20 border-l-2 border-l-brand-light rounded-sm p-5 bg-brand-slate hover:bg-brand-slate/80 hover:border-white/30 transition-all duration-300 group">
                        <p class="text-white font-heading font-bold text-sm tracking-widest group-hover:text-white transition">BODY COMP IQ QUIZ</p>
                        <p class="text-brand-light/80 text-xs mt-1">Test what you know about body fat, DEXA scans, and metabolic health.</p>
                    </a>
                </div>
            </div>

            <div class="mt-6 pt-6 border-t border-white/5">
                <p class="text-brand-gray/50 text-[10px] leading-relaxed max-w-4xl mx-auto text-center">
                    Content on this site is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Peptide therapies and compounded preparations discussed on this site are not FDA-approved drugs. Results vary. Always consult a qualified healthcare provider before starting any therapy. No provider-patient relationship is established by viewing this content.
                </p>
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

    // Auto-inject reviews section on service, learn, about, booking, and contact pages
    // (Homepage has explicit placement, so skip it)
    var reviewsPath = location.pathname;
    var needsReviews = /^\/(medical|rehab|learn|about|contact|booking)\/?/.test(reviewsPath) && reviewsPath !== '/';
    if (needsReviews && !document.getElementById('reviews-section')) {
        // Determine filter based on page context
        var reviewFilter = '';
        if (/\/(mens-hormones|trt|testosterone|enclomiphene)/.test(reviewsPath)) reviewFilter = 'trt';
        else if (/\/(dexa|body-comp)/.test(reviewsPath)) reviewFilter = 'dexa';
        else if (/\/(blood-panel|blood-work|blood-draw)/.test(reviewsPath)) reviewFilter = 'blood-work';

        // Determine theme — light sections get light reviews
        var mainEl = document.querySelector('main');
        var lastSection = mainEl ? mainEl.querySelector('section:last-of-type') : null;
        var reviewTheme = 'dark';

        // Insert before the last section (usually the final CTA)
        var reviewDiv = document.createElement('div');
        reviewDiv.id = 'reviews-section';
        reviewDiv.setAttribute('data-theme', reviewTheme);
        if (reviewFilter) reviewDiv.setAttribute('data-filter', reviewFilter);
        if (lastSection) {
            lastSection.parentNode.insertBefore(reviewDiv, lastSection);
        } else if (mainEl) {
            mainEl.appendChild(reviewDiv);
        }

        // Load reviews.js if not already loaded
        if (!window.MoonshotReviews) {
            var rvScript = document.createElement('script');
            rvScript.src = '/shared/reviews.js';
            document.body.appendChild(rvScript);
        } else {
            window.MoonshotReviews.render();
        }
    }

    // Contextual lead magnet CTA on learn articles (replaces generic booking CTA)
    if (/^\/learn\/[^/]+\//.test(location.pathname)) {
        var magnetScript = document.createElement('script');
        magnetScript.src = '/shared/lead-magnets.js';
        document.body.appendChild(magnetScript);
    }

    // First-party: track phone link clicks as generic site CTA.
    // We deliberately do NOT include `page`/URL here — it would leak the
    // health-condition page the user was on (HBNR risk).
    document.querySelectorAll('a[href^="tel:"]').forEach(function(link) {
        link.addEventListener('click', function() {
            try {
                fetch('/.netlify/functions/quiz-event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quiz: 'site', event: 'cta_click', timestamp: new Date().toISOString() }),
                    keepalive: true,
                }).catch(function(){});
            } catch (e) { /* ignore */ }
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
                '<a href="/quiz/perimenopause/" class="text-brand-light text-sm border border-white/15 rounded-sm px-5 py-2 hover:bg-white/5 transition">Perimenopause Screener</a>' +
                '<a href="/quiz/low-t/" class="text-brand-light text-sm border border-white/15 rounded-sm px-5 py-2 hover:bg-white/5 transition">TRT Readiness Screener</a>' +
                '<a href="/quiz/glp1/" class="text-brand-light text-sm border border-white/15 rounded-sm px-5 py-2 hover:bg-white/5 transition">GLP-1 Readiness Screener</a>' +
                '<a href="/quiz/bone-density/" class="text-brand-light text-sm border border-white/15 rounded-sm px-5 py-2 hover:bg-white/5 transition">Bone Density Screener</a>' +
                '<a href="/quiz/peptides/" class="text-brand-light text-sm border border-white/15 rounded-sm px-5 py-2 hover:bg-white/5 transition">Peptide Quiz</a>' +
                '</div>';
            lastCta.insertAdjacentElement('afterend', quizNudge);
        }
    }

    // Scroll-depth quiz prompt on content pages (60%+ scroll, once per session)
    if (/\/(peptide|bpc-157|tb-500|wolverine-blend|ghk-cu|glow-stack)/.test(path) && !sessionStorage.getItem('quiz_prompt_shown')) {
        var promptShown = false;
        window.addEventListener('scroll', function() {
            if (promptShown) return;
            var scrollPct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
            if (scrollPct >= 0.85) {
                promptShown = true;
                sessionStorage.setItem('quiz_prompt_shown', '1');
                var prompt = document.createElement('div');
                prompt.id = 'quiz-scroll-prompt';
                prompt.className = 'fixed bottom-4 right-4 z-[70] bg-brand-dark border border-white/10 rounded-sm p-5 shadow-2xl max-w-xs transition-all duration-300 translate-y-4 opacity-0 hidden md:block';
                prompt.innerHTML = '<button type="button" onclick="this.parentElement.remove()" class="absolute top-2 right-3 text-brand-gray hover:text-white text-lg leading-none">&times;</button>' +
                    '<p class="text-brand-light font-heading font-bold text-sm tracking-widest mb-1">CURIOUS?</p>' +
                    '<p class="text-brand-gray text-xs mb-3">Take a free 2-min quiz and get personalized insights.</p>' +
                    '<div class="space-y-2">' +
                    '<a href="/quiz/perimenopause/" class="block text-brand-light text-xs border border-white/15 rounded-sm px-4 py-2 hover:bg-white/5 transition text-center">Perimenopause Screener</a>' +
                    '<a href="/quiz/low-t/" class="block text-brand-light text-xs border border-white/15 rounded-sm px-4 py-2 hover:bg-white/5 transition text-center">TRT Readiness Screener</a>' +
                    '<a href="/quiz/peptides/" class="block text-brand-light text-xs border border-white/15 rounded-sm px-4 py-2 hover:bg-white/5 transition text-center">Peptide Quiz</a>' +
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

    // Load chat widget — deferred until idle to avoid competing with critical resources
    if ('requestIdleCallback' in window) {
        requestIdleCallback(function() {
            const chatScript = document.createElement('script');
            chatScript.src = '/shared/chat-widget.js';
            document.body.appendChild(chatScript);
        }, { timeout: 5000 });
    } else {
        setTimeout(function() {
            const chatScript = document.createElement('script');
            chatScript.src = '/shared/chat-widget.js';
            document.body.appendChild(chatScript);
        }, 3000);
    }
})();
