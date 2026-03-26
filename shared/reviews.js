/*
 * Moonshot Reviews Component
 * ==========================
 * Displays Google reviews in a scrolling carousel with trust badge.
 * Auto-injects into any page with <div id="reviews-section"></div>
 * or can be auto-placed on specific pages.
 *
 * Usage:
 *   <script src="/shared/reviews.js" defer></script>
 *
 * Options (data attributes on the container):
 *   data-filter="trt"         — Show only reviews tagged with that service
 *   data-style="compact"      — Smaller inline version for service pages
 *   data-style="full"         — Full section with header (default)
 */

(function() {
    var GOOGLE_MAPS_URL = 'https://maps.google.com/?cid=7766394185852799175';
    var TOTAL_REVIEWS = 147;
    var RATING = '5.0';

    var reviews = [
        {
            name: 'Nick A.',
            date: 'March 2026',
            tags: ['dexa', 'body-comp'],
            text: 'I recently got a Dexa Scan at Moonshot Medical and Performance in Park Ridge and it was honestly really cool to see the breakdown of everything. The Dexa Scan shows things like body fat, muscle mass, and overall body composition, which was way more helpful than I expected. The staff were really easy to work with and explained the results in a way that actually made sense. It didn\'t feel like a typical medical appointment\u2014more like a helpful check-in if you\'re focused on fitness, weight loss, or improving performance.'
        },
        {
            name: 'Chris G.',
            initial: 'C',
            date: 'February 2026',
            badge: 'Local Guide',
            tags: ['trt', 'blood-work', 'hormones'],
            text: 'I just wanted to say a big thanks to the \u2018life saving\u2019 team at Moonshot Medical. I am 42 years old and was previously doing all the right things, working out 4 times a week, eating right and getting 8 plus hours of sleep a night, but also needed a daily \u2018power nap\u2019. I had my blood work tested and turns out doing the right thing isn\'t always enough when you are dealing with low T. Immediately I felt a change in my energy levels, skipping the midday nap and never looking back. I am now working out daily, doubling my exercise workload and feel half the pain in recovery I used to.'
        },
        {
            name: 'Charlie A.',
            initial: 'C',
            date: 'February 2026',
            tags: ['trt', 'blood-work', 'hormones', 'brain-fog'],
            text: 'I originally wanted to get my labs done as I felt like I have plateaued in my workout progress but found a few more benefits since starting. Currently only in 3 weeks to treatment and the biggest difference I\'ve noticed is the mental stamina I\'ve been missing. Brain fog is a thing of the past and I find myself wishing for more arms as I am now able to juggle more mentally than before. All around great group to work with. Would highly recommend.'
        },
        {
            name: 'Edwin G.',
            date: 'February 2026',
            tags: ['trt', 'dexa', 'hormones'],
            text: 'Best place! Since starting TRT here I\'ve noticed a huge change in my energy levels and stamina\u2014total game changer, especially with little kids at home. The team is incredibly nice, knowledgeable, and really guides you through the whole process. I also love that they coordinate with your primary care physician to monitor everything safely. I\'m excited to get my DEXA scan next, which is included with the hormone optimization membership.'
        },
        {
            name: 'Phil P.',
            date: 'March 2026',
            tags: ['dexa', 'trt', 'blood-work'],
            text: 'I had an amazing experience at this Park Ridge location. I came in for a DEXA scan, TRT consultation, and a blood draw, and the entire staff was incredibly knowledgeable and professional. They took the time to answer all my questions with patience and care, making sure I fully understood each step of the process. The DEXA scan was quick and informative, the TRT overview was thorough, and the blood draw was done expertly. I highly recommend this place to anyone looking for top-notch service.'
        }
    ];

    // Google star SVG
    function starSVG() {
        return '<svg class="mn-rv-star" viewBox="0 0 24 24" width="16" height="16"><path fill="#FBBC04" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    }
    function starsHTML() {
        return starSVG() + starSVG() + starSVG() + starSVG() + starSVG();
    }

    // Google logo SVG (simplified)
    function googleLogoSVG() {
        return '<svg viewBox="0 0 48 48" width="20" height="20" style="display:inline-block;vertical-align:middle"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
    }

    function getInitial(name) {
        return name.charAt(0).toUpperCase();
    }

    // Build a single review card
    function buildCard(r) {
        var initial = r.initial || getInitial(r.name);
        var badgeHTML = r.badge ? '<span class="mn-rv-badge">' + r.badge + '</span>' : '';
        return '<div class="mn-rv-card">' +
            '<div class="mn-rv-header">' +
                '<div class="mn-rv-avatar">' + initial + '</div>' +
                '<div class="mn-rv-meta">' +
                    '<div class="mn-rv-name">' + r.name + '</div>' +
                    badgeHTML +
                '</div>' +
            '</div>' +
            '<div class="mn-rv-stars">' + starsHTML() + '<span class="mn-rv-date">' + r.date + '</span></div>' +
            '<p class="mn-rv-text">' + r.text + '</p>' +
        '</div>';
    }

    // Build the full reviews section
    function buildSection(filteredReviews, style) {
        var isCompact = style === 'compact';

        var headerHTML = isCompact ? '' :
            '<div class="mn-rv-section-header">' +
                '<div>' +
                    '<p class="mn-rv-eyebrow">Patient Reviews</p>' +
                    '<h2 class="mn-rv-title">WHAT OUR PATIENTS SAY</h2>' +
                '</div>' +
                '<a href="' + GOOGLE_MAPS_URL + '" target="_blank" rel="noopener noreferrer" class="mn-rv-google-badge">' +
                    googleLogoSVG() +
                    '<div class="mn-rv-google-info">' +
                        '<div class="mn-rv-google-rating">' + RATING + ' ' + starsHTML() + '</div>' +
                        '<div class="mn-rv-google-count">' + TOTAL_REVIEWS + ' reviews on Google</div>' +
                    '</div>' +
                '</a>' +
            '</div>';

        var cardsHTML = '';
        for (var i = 0; i < filteredReviews.length; i++) {
            cardsHTML += buildCard(filteredReviews[i]);
        }

        var navHTML = filteredReviews.length > 3 ?
            '<div class="mn-rv-nav">' +
                '<button type="button" class="mn-rv-nav-btn mn-rv-prev" aria-label="Previous reviews">' +
                    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>' +
                '</button>' +
                '<button type="button" class="mn-rv-nav-btn mn-rv-next" aria-label="Next reviews">' +
                    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
                '</button>' +
            '</div>' : '';

        var writeReviewHTML = isCompact ? '' :
            '<div class="mn-rv-cta">' +
                '<a href="' + GOOGLE_MAPS_URL + '" target="_blank" rel="noopener noreferrer" class="mn-rv-write-link">Read All ' + TOTAL_REVIEWS + ' Reviews on Google \u2192</a>' +
            '</div>';

        return '<div class="mn-rv-wrapper' + (isCompact ? ' mn-rv-compact' : '') + '">' +
            headerHTML +
            '<div class="mn-rv-track-container">' +
                '<div class="mn-rv-track">' + cardsHTML + '</div>' +
            '</div>' +
            navHTML +
            writeReviewHTML +
        '</div>';
    }

    // Build the trust bar (for hero sections)
    function buildTrustBar() {
        return '<a href="' + GOOGLE_MAPS_URL + '" target="_blank" rel="noopener noreferrer" class="mn-rv-trust-bar">' +
            googleLogoSVG() +
            '<span class="mn-rv-trust-rating">' + RATING + '</span>' +
            '<span class="mn-rv-trust-stars">' + starsHTML() + '</span>' +
            '<span class="mn-rv-trust-count">' + TOTAL_REVIEWS + ' reviews</span>' +
        '</a>';
    }

    // Inject styles
    var css = document.createElement('style');
    css.textContent = '' +
        /* Section wrapper */
        '.mn-rv-wrapper{max-width:72rem;margin:0 auto;padding:0 1rem;}' +
        '.mn-rv-section{padding:4rem 0;border-top:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05);}' +
        '.mn-rv-section.mn-rv-light{background:#F0EEE9;border-color:rgba(16,25,33,0.08);}' +

        /* Header */
        '.mn-rv-section-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:2rem;}' +
        '.mn-rv-eyebrow{color:#B2BFBE;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:0.25rem;}' +
        '.mn-rv-light .mn-rv-eyebrow{color:#2C353E;}' +
        '.mn-rv-title{color:#F0EEE9;font-family:"Oswald",sans-serif;font-size:1.875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;}' +
        '.mn-rv-light .mn-rv-title{color:#101921;}' +

        /* Google badge */
        '.mn-rv-google-badge{display:flex;align-items:center;gap:0.75rem;text-decoration:none;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.25rem;padding:0.75rem 1rem;transition:border-color 0.2s;}' +
        '.mn-rv-google-badge:hover{border-color:rgba(255,255,255,0.25);}' +
        '.mn-rv-light .mn-rv-google-badge{background:white;border-color:rgba(16,25,33,0.1);}' +
        '.mn-rv-light .mn-rv-google-badge:hover{border-color:rgba(16,25,33,0.25);}' +
        '.mn-rv-google-info{display:flex;flex-direction:column;}' +
        '.mn-rv-google-rating{display:flex;align-items:center;gap:0.25rem;color:#F0EEE9;font-weight:600;font-size:0.875rem;}' +
        '.mn-rv-light .mn-rv-google-rating{color:#101921;}' +
        '.mn-rv-google-count{color:#B2BFBE;font-size:0.75rem;}' +
        '.mn-rv-light .mn-rv-google-count{color:#2C353E;}' +

        /* Track */
        '.mn-rv-track-container{overflow:hidden;position:relative;margin:0 -0.5rem;}' +
        '.mn-rv-track{display:flex;gap:1rem;transition:transform 0.4s ease;padding:0 0.5rem;}' +

        /* Card */
        '.mn-rv-card{flex:0 0 calc(33.333% - 0.75rem);min-width:280px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:0.25rem;padding:1.5rem;transition:border-color 0.2s;}' +
        '.mn-rv-card:hover{border-color:rgba(255,255,255,0.2);}' +
        '.mn-rv-light .mn-rv-card{background:white;border-color:rgba(16,25,33,0.08);}' +
        '.mn-rv-light .mn-rv-card:hover{border-color:rgba(16,25,33,0.2);}' +

        /* Card header */
        '.mn-rv-header{display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;}' +
        '.mn-rv-avatar{width:2.25rem;height:2.25rem;border-radius:50%;background:#2C353E;color:#B2BFBE;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:0.875rem;flex-shrink:0;}' +
        '.mn-rv-light .mn-rv-avatar{background:#e8e5df;color:#2C353E;}' +
        '.mn-rv-name{color:#F0EEE9;font-weight:600;font-size:0.875rem;}' +
        '.mn-rv-light .mn-rv-name{color:#101921;}' +
        '.mn-rv-badge{display:inline-block;color:#B2BFBE;font-size:0.625rem;text-transform:uppercase;letter-spacing:0.05em;}' +
        '.mn-rv-light .mn-rv-badge{color:#2C353E;}' +

        /* Stars */
        '.mn-rv-stars{display:flex;align-items:center;gap:0.125rem;margin-bottom:0.75rem;}' +
        '.mn-rv-star{flex-shrink:0;}' +
        '.mn-rv-date{color:#B2BFBE;font-size:0.75rem;margin-left:0.5rem;}' +
        '.mn-rv-light .mn-rv-date{color:#2C353E;}' +

        /* Text */
        '.mn-rv-text{color:#B2BFBE;font-size:0.8125rem;line-height:1.6;font-weight:300;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;}' +
        '.mn-rv-light .mn-rv-text{color:#2C353E;}' +

        /* Nav */
        '.mn-rv-nav{display:flex;justify-content:center;gap:0.5rem;margin-top:1.5rem;}' +
        '.mn-rv-nav-btn{width:2.5rem;height:2.5rem;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#B2BFBE;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}' +
        '.mn-rv-nav-btn:hover{border-color:rgba(255,255,255,0.4);color:#F0EEE9;}' +
        '.mn-rv-light .mn-rv-nav-btn{border-color:rgba(16,25,33,0.15);color:#2C353E;}' +
        '.mn-rv-light .mn-rv-nav-btn:hover{border-color:rgba(16,25,33,0.4);color:#101921;}' +

        /* CTA */
        '.mn-rv-cta{text-align:center;margin-top:2rem;}' +
        '.mn-rv-write-link{color:#B2BFBE;font-size:0.8125rem;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;transition:color 0.2s;}' +
        '.mn-rv-write-link:hover{color:#F0EEE9;}' +
        '.mn-rv-light .mn-rv-write-link{color:#2C353E;}' +
        '.mn-rv-light .mn-rv-write-link:hover{color:#101921;}' +

        /* Trust bar */
        '.mn-rv-trust-bar{display:inline-flex;align-items:center;gap:0.5rem;text-decoration:none;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.25rem;padding:0.5rem 1rem;transition:border-color 0.2s;}' +
        '.mn-rv-trust-bar:hover{border-color:rgba(255,255,255,0.3);}' +
        '.mn-rv-trust-rating{color:#F0EEE9;font-weight:700;font-size:0.875rem;}' +
        '.mn-rv-trust-stars{display:flex;align-items:center;gap:1px;}' +
        '.mn-rv-trust-count{color:#B2BFBE;font-size:0.75rem;}' +

        /* Compact variant */
        '.mn-rv-compact .mn-rv-card{flex:0 0 calc(50% - 0.5rem);}' +
        '.mn-rv-compact .mn-rv-text{-webkit-line-clamp:4;}' +

        /* Responsive */
        '@media(max-width:1024px){.mn-rv-card{flex:0 0 calc(50% - 0.5rem);}}' +
        '@media(max-width:640px){' +
            '.mn-rv-card{flex:0 0 calc(85vw - 2rem);min-width:0;}' +
            '.mn-rv-section-header{flex-direction:column;align-items:flex-start;}' +
            '.mn-rv-title{font-size:1.5rem;}' +
            '.mn-rv-compact .mn-rv-card{flex:0 0 calc(85vw - 2rem);}' +
        '}';
    document.head.appendChild(css);

    // Scroll logic
    function initScroll(wrapper) {
        var track = wrapper.querySelector('.mn-rv-track');
        var prevBtn = wrapper.querySelector('.mn-rv-prev');
        var nextBtn = wrapper.querySelector('.mn-rv-next');
        if (!track || !prevBtn) return;

        var pos = 0;
        function getCardWidth() {
            var card = track.querySelector('.mn-rv-card');
            if (!card) return 300;
            return card.offsetWidth + 16; // card width + gap
        }
        function getMaxScroll() {
            return Math.max(0, track.scrollWidth - track.parentElement.offsetWidth);
        }
        function slide(dir) {
            var step = getCardWidth();
            pos = Math.max(0, Math.min(pos + dir * step, getMaxScroll()));
            track.style.transform = 'translateX(-' + pos + 'px)';
        }
        prevBtn.addEventListener('click', function() { slide(-1); });
        nextBtn.addEventListener('click', function() { slide(1); });

        // Touch swipe
        var startX = 0, startPos = 0, dragging = false;
        track.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            startPos = pos;
            dragging = true;
            track.style.transition = 'none';
        }, {passive: true});
        track.addEventListener('touchmove', function(e) {
            if (!dragging) return;
            var dx = startX - e.touches[0].clientX;
            pos = Math.max(0, Math.min(startPos + dx, getMaxScroll()));
            track.style.transform = 'translateX(-' + pos + 'px)';
        }, {passive: true});
        track.addEventListener('touchend', function() {
            dragging = false;
            track.style.transition = 'transform 0.4s ease';
        });
    }

    // Render into containers
    function render() {
        // Full sections
        var containers = document.querySelectorAll('[id="reviews-section"], [data-reviews]');
        for (var i = 0; i < containers.length; i++) {
            var el = containers[i];
            var filter = el.getAttribute('data-filter');
            var style = el.getAttribute('data-style') || 'full';
            var theme = el.getAttribute('data-theme') || 'dark';

            var filtered = reviews;
            if (filter) {
                filtered = reviews.filter(function(r) {
                    return r.tags.indexOf(filter) !== -1;
                });
            }
            if (filtered.length === 0) filtered = reviews;

            var sectionClass = 'mn-rv-section' + (theme === 'light' ? ' mn-rv-light' : '');
            el.className = (el.className ? el.className + ' ' : '') + sectionClass;
            el.innerHTML = buildSection(filtered, style);
            initScroll(el.querySelector('.mn-rv-wrapper'));
        }

        // Trust bars
        var trustBars = document.querySelectorAll('[data-reviews-trust]');
        for (var j = 0; j < trustBars.length; j++) {
            trustBars[j].innerHTML = buildTrustBar();
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }

    // Expose for dynamic use
    window.MoonshotReviews = {
        render: render,
        buildTrustBar: buildTrustBar,
        reviews: reviews,
        total: TOTAL_REVIEWS,
        rating: RATING
    };
})();
