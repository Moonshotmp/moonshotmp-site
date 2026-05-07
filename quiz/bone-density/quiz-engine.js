/*
 * Moonshot Bone Density Screener — Quiz Engine
 * =============================================
 * Browser-side IIFE that runs the entire bone-density screening flow:
 * welcome → age-gate → age → sex → weight → height → height-loss → prior
 * fracture → parental fracture → lifestyle → meds → (women only) reproductive
 * → conditions → state → acknowledgement → calculating → results.
 *
 * Scoring logic is INLINED from /quiz/bone-density/scoring.js (the
 * canonical pure module). Both files MUST stay in sync — the Vitest suite
 * pins the contract on the scoring module; this engine reproduces it
 * verbatim because the page loads as a non-module script tag (no ESM imports).
 *
 * Output contract (must match scoring.js exactly):
 *   { tier: 'A'|'B'|'C'|'D', tierLabel, resultSlug, ostScore, riskFactorCount, outOfState }
 *
 * Privacy / first-party analytics:
 *   Health values NEVER leave the browser as analytics. The ga() shim only
 *   forwards generic funnel events (quiz_start / screen_advance / quiz_back /
 *   quiz_retake / quiz_email_submit / quiz_results_view / quiz_cta_click) to
 *   /.netlify/functions/quiz-event with the strict 4-field contract
 *   { quiz: 'bone-density', event, screen, timestamp }. Health data flows
 *   through /.netlify/functions/bone-density-quiz-submit for the email and
 *   CRM pipeline only.
 *
 * Compliance rails:
 *   - Never reference "FRAX" (licensed name).
 *   - Never name specific drug brands in result text (drug CLASS is fine).
 *   - Never tell the user they have osteoporosis / osteopenia / a T-score.
 *   - Tier labels are neutral — no "strong / possible candidate" language.
 *   - Acknowledgement screen is a real click-through, timestamped.
 *   - Email capture comes AFTER the result; never gates the result.
 *   - Out-of-state users receive an IL-only message in place of the result.
 *   - Age-gate "No" terminates the quiz with a permanent block screen.
 */
(function() {
    'use strict';

    // ── Inlined Scoring Logic (mirror of scoring.js) ─────────────────
    // If scoring.js changes, update both files together. Vitest pins the
    // canonical module — keep this section identical in behavior.

    var LBS_TO_KG = 0.45359237;

    var TIER_LABELS = {
        A: 'Eligibility factors present',
        B: 'Eligibility factors present',
        C: 'Eligibility factors mixed',
        D: 'Eligibility factors not met'
    };

    var RESULT_SLUGS = {
        A: 'clinical-indication',
        B: 'high',
        C: 'moderate',
        D: 'low'
    };

    function resolveWeightKg(s) {
        if (s == null) return null;
        if (typeof s.weightKg === 'number' && s.weightKg > 0) return s.weightKg;
        if (typeof s.weightLbs === 'number' && s.weightLbs > 0) return s.weightLbs * LBS_TO_KG;
        return null;
    }

    function computeOst(s) {
        if (!s) return null;
        if (s.sex !== 'female') return null;
        if (typeof s.age !== 'number' || s.age < 45) return null;
        var weightKg = resolveWeightKg(s);
        if (weightKg == null) return null;
        return 0.2 * (weightKg - s.age);
    }

    function countRiskFactors(s) {
        if (!s) return 0;
        var count = 0;
        if (s.priorFragilityFracture === 'yes') count += 1;
        if (s.heightLoss === 'yes') count += 1;
        if (s.parentalHipFracture === 'yes') count += 1;
        if (s.smokingOrAlcohol === 'yes') count += 1;
        if (Array.isArray(s.medications)) count += s.medications.length;
        if (s.sex === 'female' && s.prematureMenopause === 'yes') count += 1;
        if (Array.isArray(s.secondaryConditions)) count += s.secondaryConditions.length;
        return count;
    }

    function scoreBoneDensity(s) {
        var ost = computeOst(s);
        var riskFactorCount = countRiskFactors(s);
        var isWomanOver45 = s && s.sex === 'female' &&
            typeof s.age === 'number' && s.age >= 45;

        var tier;
        if (s && s.priorFragilityFracture === 'yes') {
            tier = 'A';
        } else if (isWomanOver45 && ost !== null && ost < 2) {
            tier = 'B';
        } else if (riskFactorCount >= 3) {
            tier = 'B';
        } else if (riskFactorCount >= 1) {
            tier = 'C';
        } else {
            tier = 'D';
        }

        var stateCode = s && typeof s.stateCode === 'string'
            ? s.stateCode.toUpperCase()
            : '';

        return {
            tier: tier,
            tierLabel: TIER_LABELS[tier],
            resultSlug: RESULT_SLUGS[tier],
            ostScore: ost,
            riskFactorCount: riskFactorCount,
            outOfState: stateCode !== 'IL'
        };
    }

    // ── Screen Constants ─────────────────────────────────────────────
    // Internal indices. A subset is presented to the user depending on sex
    // (REPRODUCTIVE is skipped for non-female). The progress bar uses a
    // dynamic denominator that excludes skipped screens.

    var SCREEN = {
        WELCOME:           0,
        AGE_GATE:          1,
        AGE_BLOCK:         2,  // terminal block screen for under-18 users
        AGE:               3,
        SEX:               4,
        WEIGHT:            5,
        HEIGHT:            6,
        HEIGHT_LOSS:       7,
        PRIOR_FRACTURE:    8,
        PARENTAL_FRACTURE: 9,
        LIFESTYLE:        10,
        MEDS:             11,
        REPRODUCTIVE:     12, // women only
        CONDITIONS:       13,
        STATE:            14,
        ACK:              15,
        CALCULATING:      16,
        RESULTS:          17
    };

    // Short, neutral labels that pass the HEALTH_TERMS allowlist on
    // /.netlify/functions/quiz-event. No clinical jargon, no "menopause",
    // no severity words.
    var SCREEN_LABEL = {};
    SCREEN_LABEL[SCREEN.WELCOME]           = 'welcome';
    SCREEN_LABEL[SCREEN.AGE_GATE]          = 'age-gate';
    SCREEN_LABEL[SCREEN.AGE_BLOCK]         = 'age-block';
    SCREEN_LABEL[SCREEN.AGE]               = 'age';
    SCREEN_LABEL[SCREEN.SEX]               = 'sex';
    SCREEN_LABEL[SCREEN.WEIGHT]            = 'weight';
    SCREEN_LABEL[SCREEN.HEIGHT]            = 'height';
    SCREEN_LABEL[SCREEN.HEIGHT_LOSS]       = 'height-loss';
    SCREEN_LABEL[SCREEN.PRIOR_FRACTURE]    = 'prior-fracture';
    SCREEN_LABEL[SCREEN.PARENTAL_FRACTURE] = 'parental-fracture';
    SCREEN_LABEL[SCREEN.LIFESTYLE]         = 'lifestyle';
    SCREEN_LABEL[SCREEN.MEDS]              = 'meds';
    SCREEN_LABEL[SCREEN.REPRODUCTIVE]      = 'reproductive';
    SCREEN_LABEL[SCREEN.CONDITIONS]        = 'conditions';
    SCREEN_LABEL[SCREEN.STATE]             = 'state';
    SCREEN_LABEL[SCREEN.ACK]               = 'ack';
    SCREEN_LABEL[SCREEN.CALCULATING]       = 'calculating';
    SCREEN_LABEL[SCREEN.RESULTS]           = 'results';

    // ── Option Data ──────────────────────────────────────────────────

    var sexOptions = [
        { label: 'Male',                key: 'male' },
        { label: 'Female',              key: 'female' },
        { label: 'Prefer not to say',   key: 'prefer-not' }
    ];

    var yesNoOptions = [
        { label: 'Yes', key: 'yes' },
        { label: 'No',  key: 'no' }
    ];

    var yesNoUnknownOptions = [
        { label: 'Yes',          key: 'yes' },
        { label: 'No',           key: 'no' },
        { label: 'I\'m not sure', key: 'unknown' }
    ];

    var reproductiveOptions = [
        { label: 'Yes',              key: 'yes' },
        { label: 'No',               key: 'no' },
        { label: 'Not applicable',   key: 'na' }
    ];

    var medicationOptions = [
        { label: 'Oral steroids (prednisone, etc.) for 3+ months',                  key: 'steroids' },
        { label: 'Proton-pump inhibitors (omeprazole, etc.) for 3+ months',         key: 'ppi' },
        { label: 'SSRIs for 3+ months',                                             key: 'ssri' },
        { label: 'Aromatase inhibitors / chemotherapy',                             key: 'ai-chemo' },
        { label: 'Or any other medication you\'ve been told affects bone health',    key: 'other-med' }
    ];

    var conditionOptions = [
        { label: 'Rheumatoid arthritis',                                             key: 'ra' },
        { label: 'Type 1 diabetes',                                                   key: 't1d' },
        { label: 'Hyperthyroidism',                                                   key: 'hyperthyroid' },
        { label: 'IBD or celiac',                                                     key: 'ibd-celiac' },
        { label: 'Hypogonadism',                                                      key: 'hypogonadism' },
        { label: 'Eating disorder history',                                            key: 'eating-disorder' },
        { label: 'Or any other condition you\'ve been told affects bone health',       key: 'other-condition' }
    ];

    var US_STATES = [
        { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
        { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
        { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
        { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
        { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
        { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
        { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
        { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
        { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
        { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
        { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
        { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
        { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
        { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
        { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
        { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
        { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
        { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
        { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
        { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
        { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
        { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
        { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
        { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
        { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
        { code: 'WY', name: 'Wyoming' }
    ];

    var calculatingSteps = [
        'Reviewing your responses...',
        'Calculating bone density risk factors...',
        'Comparing to AACE / NOF guidelines...',
        'Checking screening recommendations...',
        'Building your protocol...',
        'Finalizing your result...'
    ];

    // ── Universal Disclaimers (verbatim from spec) ───────────────────

    var RESULT_DISCLAIMER = 'This is a screening tool, not a diagnosis. Only a DXA scan can diagnose osteoporosis or osteopenia. Your provider can determine whether scanning, treatment, or further workup is appropriate based on your full clinical picture.';

    // The universal footer disclaimer ("This tool does not... By proceeding
    // you confirm you are at least 18 years old.") is rendered by the static
    // HTML below the quiz mount in /quiz/bone-density/index.html. It is NOT
    // duplicated by this engine — the static placement is canonical and is
    // always visible because the quiz is inline (not modal).

    var AUTHOR_ATTRIBUTION = 'Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC. This review is of the tool, not of your individual responses. You have not been examined or treated by Moonshot Medical.';

    // ── State ────────────────────────────────────────────────────────

    // Field names match scoring.js EXACTLY. Do not rename without also
    // changing the scoring module and its Vitest suite.
    var state = {
        currentScreen: 0,
        ageGate: null,                  // 'yes' | 'no'
        age: null,                       // number
        sex: null,                       // 'male' | 'female' | 'prefer-not'
        weightKg: null,                  // number (preferred input to scoring)
        weightLbs: null,                 // number (alternative — converted internally)
        weightUnit: 'lbs',               // 'lbs' | 'kg' (UI toggle state)
        weightInput: '',                 // raw string the user typed (re-display)
        heightCm: null,                  // number (context only — not used in tier scoring)
        heightIn: null,                  // number (context only — not used in tier scoring)
        heightUnit: 'in',                // 'in' | 'cm'
        heightInput: '',
        heightLoss: null,                // 'yes' | 'no' | 'unknown'
        priorFragilityFracture: null,    // 'yes' | 'no'
        parentalHipFracture: null,       // 'yes' | 'no'
        smokingOrAlcohol: null,          // 'yes' | 'no'
        medications: [],                  // string[]   (multi-check, count length)
        prematureMenopause: null,         // 'yes' | 'no' | 'na'   (women only)
        secondaryConditions: [],           // string[]   (multi-check, count length)
        stateCode: '',                     // 'IL' | 'CA' | ...
        ackTimestamp: null,                // ISO string set on Ack-screen continue
        name: '',
        email: '',
        phone: '',
        marketingOptIn: false,
        emailOptIn: false
    };

    var root = document.getElementById('quiz-root');
    var progressBar = document.getElementById('quiz-progress-bar');

    // ── State Persistence ────────────────────────────────────────────

    var STORAGE_KEY = 'mmp_bone_density_quiz_state';
    var STORAGE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

    function saveState() {
        try {
            var snapshot = {};
            for (var k in state) {
                if (Object.prototype.hasOwnProperty.call(state, k)) {
                    snapshot[k] = state[k];
                }
            }
            snapshot.savedAt = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } catch (e) { /* ignore */ }
    }

    function clearSavedState() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    }

    function loadSavedState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var saved = JSON.parse(raw);
            if (!saved || !saved.savedAt) return null;
            if (Date.now() - saved.savedAt > STORAGE_MAX_AGE) {
                clearSavedState();
                return null;
            }
            return saved;
        } catch (e) { return null; }
    }

    // ── First-Party Analytics Shim ───────────────────────────────────
    // Only generic funnel events are forwarded. The screen label is the
    // short, neutral string from SCREEN_LABEL[]. No health values ever leave
    // the browser via analytics.

    function ga(eventName, screenIndex) {
        // Allowed events (must match ALLOWED_EVENTS in quiz-event.js):
        //   quiz_start, quiz_step, screen_advance, quiz_back, quiz_retake,
        //   quiz_email_submit, quiz_info_submit, quiz_complete,
        //   quiz_results_view, quiz_cta_click
        if (!eventName) return;
        var screenLabel = null;
        if (typeof screenIndex === 'number' && SCREEN_LABEL[screenIndex]) {
            screenLabel = SCREEN_LABEL[screenIndex];
        } else if (typeof screenIndex === 'string') {
            screenLabel = screenIndex;
        }
        var payload = {
            quiz: 'bone-density',
            event: eventName,
            screen: screenLabel,
            timestamp: new Date().toISOString()
        };
        try {
            fetch('/.netlify/functions/quiz-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function(){});
        } catch (e) { /* ignore */ }
    }

    // ── Progress Bar (skip-aware) ────────────────────────────────────

    // Build the ordered list of screens the current user will see, given
    // their sex selection. AGE_BLOCK is excluded — it's a terminal-only
    // path. CALCULATING and RESULTS sit at 100%.
    function activeScreenOrder() {
        var order = [
            SCREEN.WELCOME, SCREEN.AGE_GATE, SCREEN.AGE, SCREEN.SEX,
            SCREEN.WEIGHT, SCREEN.HEIGHT, SCREEN.HEIGHT_LOSS,
            SCREEN.PRIOR_FRACTURE, SCREEN.PARENTAL_FRACTURE,
            SCREEN.LIFESTYLE, SCREEN.MEDS
        ];
        if (state.sex === 'female') order.push(SCREEN.REPRODUCTIVE);
        order.push(SCREEN.CONDITIONS);
        order.push(SCREEN.STATE);
        order.push(SCREEN.ACK);
        return order;
    }

    function updateProgress() {
        var pct = 0;
        if (state.currentScreen === SCREEN.CALCULATING ||
            state.currentScreen === SCREEN.RESULTS) {
            pct = 100;
        } else if (state.currentScreen === SCREEN.AGE_BLOCK) {
            pct = 100;
        } else {
            var order = activeScreenOrder();
            var idx = order.indexOf(state.currentScreen);
            if (idx < 0) idx = 0;
            // Welcome = 0%; ack = ~94%; calculating/results = 100%.
            pct = Math.round((idx / Math.max(order.length - 1, 1)) * 95);
        }
        if (progressBar) {
            progressBar.style.width = pct + '%';
            progressBar.setAttribute('role', 'progressbar');
            progressBar.setAttribute('aria-valuenow', String(pct));
            progressBar.setAttribute('aria-valuemin', '0');
            progressBar.setAttribute('aria-valuemax', '100');
            progressBar.setAttribute('aria-label', 'Quiz progress');
        }
    }

    // ── show() / screenWrap() helpers ────────────────────────────────

    function show(screenIndex) {
        state.currentScreen = screenIndex;
        updateProgress();
        saveState();
        var screens = root.querySelectorAll('.quiz-screen');
        for (var i = 0; i < screens.length; i++) {
            screens[i].classList.remove('active');
        }
        // Use requestAnimationFrame so the active class lands on the next
        // paint frame (more reliable cross-browser than a 30ms timeout).
        var raf = window.requestAnimationFrame ||
            function(cb) { return setTimeout(cb, 16); };
        raf(function() {
            var target = root.querySelector('[data-screen="' + screenIndex + '"]');
            if (target) {
                target.classList.add('active');
                // Scroll the quiz mount itself into view (not the window top).
                // The page has ~220px of static content above #quiz-root —
                // breadcrumb, page H1, author byline. Scrolling to window top
                // hides the new screen below that content and looks like the
                // click did nothing. Aligning #quiz-root to the top of the
                // viewport keeps the active screen in view at every transition.
                if (root && typeof root.scrollIntoView === 'function') {
                    try { root.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
                    catch (e) { window.scrollTo({ top: 0, behavior: 'smooth' }); }
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                // Focus management: focus the heading or first interactive
                // element on the new screen for screen reader / keyboard users.
                var heading = target.querySelector('h2');
                var firstControl = target.querySelector('input, select, button:not([data-back])');
                var focusEl = heading || firstControl;
                if (focusEl) {
                    if (heading) heading.setAttribute('tabindex', '-1');
                    try { focusEl.focus({ preventScroll: true }); } catch (e) { try { focusEl.focus(); } catch (e2) {} }
                }
            }
        });
    }

    // Returns whether a back button should appear. Hidden on welcome,
    // age-gate, age-block (terminal), calculating, results.
    function shouldShowBack(index) {
        if (index === SCREEN.WELCOME) return false;
        if (index === SCREEN.AGE_GATE) return false;
        if (index === SCREEN.AGE_BLOCK) return false;
        if (index === SCREEN.CALCULATING) return false;
        if (index === SCREEN.RESULTS) return false;
        return true;
    }

    function screenWrap(index, inner) {
        var backBtn = '';
        if (shouldShowBack(index)) {
            // Visible "Back" text is the accessible name; no aria-label needed.
            backBtn = '<button type="button" class="quiz-back-btn text-brand-gray/60 hover:text-brand-light text-sm flex items-center gap-1 mb-6 transition-colors" data-back="true">' +
                '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>' +
                'Back</button>';
        }
        // Every screen's first H2 carries id="screen-N-heading" (where N is
        // the screen index). The wrapping group is labelled by that heading
        // so screen readers announce the screen heading rather than a slug.
        var screenHeadingId = 'screen-' + index + '-heading';
        return '<div class="quiz-screen flex items-center justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + index + '" role="group" aria-labelledby="' + screenHeadingId + '">' +
            '<div class="max-w-2xl w-full">' + backBtn + inner + '</div></div>';
    }

    // ── Screen Builders ──────────────────────────────────────────────

    function buildWelcome() {
        return screenWrap(SCREEN.WELCOME,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-6">Free Bone Density Screener</p>' +
                '<h2 id="screen-' + SCREEN.WELCOME + '-heading" class="text-4xl md:text-5xl font-bold text-brand-light mb-6 font-heading">Should I get a DEXA bone density scan?</h2>' +
                '<p class="text-brand-gray text-lg font-light mb-10 max-w-lg mx-auto">A 2-minute screener that uses public-domain clinical risk factors to help you decide whether a DEXA scan is worth your time. Reviewed by a Doctor of Nursing Practice.</p>' +
                '<button type="button" id="quiz-start-btn" class="btn-primary text-lg px-10 py-4">Start the Screener</button>' +
                '<p class="text-brand-gray/50 text-xs mt-4">No account needed. Results are instant. We don\'t sell your data or share it with advertisers.</p>' +
                '<p class="text-brand-gray/60 text-xs mt-6">Created by the medical team at Moonshot Medical &mdash; a licensed clinic in Park Ridge, IL</p>' +
                '<p class="text-brand-gray/40 text-xs mt-2">For educational purposes only. Not medical advice.</p>' +
            '</div>'
        );
    }

    function buildAgeGate() {
        return screenWrap(SCREEN.AGE_GATE,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.AGE_GATE + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Are you 18 or older?</h2>' +
                '<p class="text-brand-gray font-light mb-10">This screener is only available to adults.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.AGE_GATE + '-heading" class="flex flex-col gap-3 max-w-md mx-auto">' +
                    '<button type="button" role="radio" aria-checked="false" tabindex="0" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-age-gate="yes">Yes, I am 18 or older</button>' +
                    '<button type="button" role="radio" aria-checked="false" tabindex="-1" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-age-gate="no">No</button>' +
                '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-age-gate-continue" class="btn-primary px-10 py-3" data-age-gate-continue="true" disabled>Continue</button></div>' +
            '</div>'
        );
    }

    function buildAgeBlock() {
        return screenWrap(SCREEN.AGE_BLOCK,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.AGE_BLOCK + '-heading" class="text-3xl font-bold text-brand-light mb-4 font-heading">This tool is only for adults</h2>' +
                '<p class="text-brand-gray font-light mb-6 max-w-lg mx-auto">This screener is only available to users 18 or older. If you have questions about bone health, please speak with a parent, guardian, or pediatric clinician.</p>' +
                '<p class="text-brand-gray/60 text-sm">You can return to <a href="/" class="text-brand-light underline">moonshotmp.com</a> any time.</p>' +
            '</div>'
        );
    }

    function buildAge() {
        return screenWrap(SCREEN.AGE,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.AGE + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">How old are you?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Please enter your age in years. <span class="text-red-400" aria-hidden="true">*</span></p>' +
                '<div class="max-w-xs mx-auto">' +
                    '<label for="quiz-age-input" class="sr-only">Age in years (required)</label>' +
                    '<input type="number" inputmode="numeric" id="quiz-age-input" min="18" max="100" step="1" required aria-required="true" placeholder="e.g. 52" aria-describedby="quiz-age-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg text-center">' +
                    '<p id="quiz-age-error" role="alert" class="text-red-500 text-xs mt-2 hidden">Please enter an age between 18 and 100.</p>' +
                    '<button type="button" id="quiz-age-continue" class="btn-primary w-full py-3 mt-6">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildSex() {
        var btns = '';
        for (var i = 0; i < sexOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-sex="' + sexOptions[i].key + '">' + sexOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.SEX,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.SEX + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">What is your biological sex?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Bone density risk factors differ by biological sex. This question is not about gender identity.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.SEX + '-heading" class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-sex-continue" class="btn-primary px-10 py-3" data-sex-continue="true" disabled>Continue</button></div>' +
            '</div>'
        );
    }

    function buildWeight() {
        return screenWrap(SCREEN.WEIGHT,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.WEIGHT + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">What is your current weight?</h2>' +
                '<p class="text-brand-gray font-light mb-8">Body weight is a public-domain risk factor. <span class="text-red-400" aria-hidden="true">*</span></p>' +
                '<div class="max-w-xs mx-auto">' +
                    '<div class="flex items-center justify-center gap-4 mb-6">' +
                        '<span id="weight-unit-label-lbs" class="text-brand-light text-sm font-medium">Pounds</span>' +
                        '<button type="button" id="weight-unit-toggle" class="toggle-track" role="switch" aria-checked="false" aria-labelledby="weight-unit-label-lbs weight-unit-label-kg"><span class="toggle-knob"></span></button>' +
                        '<span id="weight-unit-label-kg" class="text-brand-gray/60 text-sm">Kilograms</span>' +
                    '</div>' +
                    '<label for="quiz-weight-input" class="sr-only">Weight (required)</label>' +
                    '<input type="number" inputmode="decimal" id="quiz-weight-input" min="50" max="800" step="0.1" required aria-required="true" placeholder="e.g. 165" aria-describedby="quiz-weight-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg text-center">' +
                    '<p id="quiz-weight-error" role="alert" class="text-red-500 text-xs mt-2 hidden">Please enter a realistic weight.</p>' +
                    '<button type="button" id="quiz-weight-continue" class="btn-primary w-full py-3 mt-6">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildHeight() {
        return screenWrap(SCREEN.HEIGHT,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.HEIGHT + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">What is your current height?</h2>' +
                '<p class="text-brand-gray font-light mb-8">We use this for context only. <span class="text-red-400" aria-hidden="true">*</span></p>' +
                '<div class="max-w-xs mx-auto">' +
                    '<div class="flex items-center justify-center gap-4 mb-6">' +
                        '<span id="height-unit-label-in" class="text-brand-light text-sm font-medium">Inches</span>' +
                        '<button type="button" id="height-unit-toggle" class="toggle-track" role="switch" aria-checked="false" aria-labelledby="height-unit-label-in height-unit-label-cm"><span class="toggle-knob"></span></button>' +
                        '<span id="height-unit-label-cm" class="text-brand-gray/60 text-sm">Centimeters</span>' +
                    '</div>' +
                    '<label for="quiz-height-input" class="sr-only">Height (required)</label>' +
                    '<input type="number" inputmode="decimal" id="quiz-height-input" min="36" max="96" step="0.1" required aria-required="true" placeholder="e.g. 66" aria-describedby="quiz-height-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg text-center">' +
                    '<p id="quiz-height-error" role="alert" class="text-red-500 text-xs mt-2 hidden">Please enter a realistic height.</p>' +
                    '<button type="button" id="quiz-height-continue" class="btn-primary w-full py-3 mt-6">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    // Generic single-select radio screen with a Continue button. Per
    // WCAG 2.2.1 (Timing Adjustable), selections do NOT auto-advance —
    // the user must explicitly click Continue.
    function buildRadioScreen(index, headline, subhead, optionList, dataAttr) {
        var headingId = 'screen-' + index + '-heading';
        var btns = '';
        for (var i = 0; i < optionList.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-' + dataAttr + '="' + optionList[i].key + '">' + optionList[i].label + '</button>';
        }
        return screenWrap(index,
            '<div class="text-center">' +
                '<h2 id="' + headingId + '" class="text-3xl font-bold text-brand-light mb-2 font-heading">' + headline + '</h2>' +
                (subhead ? '<p class="text-brand-gray font-light mb-10">' + subhead + '</p>' : '<div class="mb-10"></div>') +
                '<div role="radiogroup" aria-labelledby="' + headingId + '" class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" class="btn-primary px-10 py-3" data-' + dataAttr + '-continue="true" disabled>Continue</button></div>' +
            '</div>'
        );
    }

    function buildHeightLoss() {
        return buildRadioScreen(
            SCREEN.HEIGHT_LOSS,
            'Have you lost more than 1.5 inches of height?',
            'Compared to your peak adult height. Loss of stature can signal vertebral compression.',
            yesNoUnknownOptions,
            'height-loss'
        );
    }

    function buildPriorFracture() {
        return buildRadioScreen(
            SCREEN.PRIOR_FRACTURE,
            'After age 40, have you ever broken a bone from a minor fall?',
            'For example, breaking a wrist or hip after a fall from standing height.',
            yesNoOptions,
            'prior-fracture'
        );
    }

    function buildParentalFracture() {
        return buildRadioScreen(
            SCREEN.PARENTAL_FRACTURE,
            'Did either of your parents break a hip?',
            'Family history of hip fracture is an independent risk factor.',
            yesNoOptions,
            'parental-fracture'
        );
    }

    function buildLifestyle() {
        return buildRadioScreen(
            SCREEN.LIFESTYLE,
            'Do you currently smoke OR drink 3+ alcoholic drinks per day?',
            'Either alone, or both together.',
            yesNoOptions,
            'lifestyle'
        );
    }

    // Multi-select with an exclusive "none of these" option. Continue
    // button is required (no auto-advance for multi-select).
    function buildMultiCheckScreen(index, headline, subhead, optionList, dataAttr) {
        var headingId = 'screen-' + index + '-heading';
        var noneHintId = dataAttr + '-none-hint';
        var btns = '';
        for (var i = 0; i < optionList.length; i++) {
            btns +=
                '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors">' +
                    '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '="' + optionList[i].key + '" aria-describedby="' + dataAttr + '-help">' +
                    '<span>' + optionList[i].label + '</span>' +
                '</label>';
        }
        // Exclusive "None of these" option — hint announced via aria-describedby.
        btns +=
            '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors mt-2">' +
                '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '-none="true" aria-describedby="' + noneHintId + '">' +
                '<span>None of these</span>' +
            '</label>' +
            '<span id="' + noneHintId + '" class="sr-only">Selecting None of these will clear all other selections.</span>';
        return screenWrap(index,
            '<div class="text-center">' +
                '<h2 id="' + headingId + '" class="text-3xl font-bold text-brand-light mb-2 font-heading">' + headline + '</h2>' +
                (subhead ? '<p id="' + dataAttr + '-help" class="text-brand-gray font-light mb-10">' + subhead + '</p>' : '<div class="mb-10"></div>') +
                '<div role="group" aria-labelledby="' + headingId + '" class="flex flex-col gap-2 max-w-md mx-auto text-left">' + btns + '</div>' +
                '<div class="mt-8"><button type="button" class="btn-primary px-10 py-3" data-' + dataAttr + '-continue="true">Continue</button></div>' +
            '</div>'
        );
    }

    function buildMeds() {
        return buildMultiCheckScreen(
            SCREEN.MEDS,
            'Have you taken any of these medications?',
            'Select all that apply. These are drug classes, not specific brand names.',
            medicationOptions,
            'med'
        );
    }

    function buildReproductive() {
        return buildRadioScreen(
            SCREEN.REPRODUCTIVE,
            'Did you stop having periods before age 45?',
            'Either naturally or after a surgery.',
            reproductiveOptions,
            'reproductive'
        );
    }

    function buildConditions() {
        return buildMultiCheckScreen(
            SCREEN.CONDITIONS,
            'Have you been diagnosed with any of these?',
            'Select all that apply.',
            conditionOptions,
            'cond'
        );
    }

    function buildState() {
        var opts = '<option value="">Select your state...</option>';
        for (var i = 0; i < US_STATES.length; i++) {
            opts += '<option value="' + US_STATES[i].code + '">' + US_STATES[i].name + '</option>';
        }
        return screenWrap(SCREEN.STATE,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.STATE + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">What state do you live in?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Moonshot clinicians are licensed in Illinois only. We use this to tell you whether we can help. <span class="text-red-400" aria-hidden="true">*</span></p>' +
                '<div class="max-w-xs mx-auto">' +
                    '<label for="quiz-state-select" class="sr-only">State of residence (required)</label>' +
                    '<select id="quiz-state-select" required aria-required="true" aria-describedby="quiz-state-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light focus:outline-none focus:border-brand-gray/50 text-lg">' + opts + '</select>' +
                    '<p id="quiz-state-error" role="alert" class="text-red-500 text-xs mt-2 hidden">Please choose your state of residence.</p>' +
                    '<button type="button" id="quiz-state-continue" class="btn-primary w-full py-3 mt-6">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildAck() {
        return screenWrap(SCREEN.ACK,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.ACK + '-heading" class="text-3xl font-bold text-brand-light mb-4 font-heading">One last step</h2>' +
                '<p class="text-brand-gray font-light mb-8 max-w-lg mx-auto">Before we show your result, please confirm:</p>' +
                '<div class="bg-white/5 border border-white/10 rounded-sm p-6 mb-6 max-w-lg mx-auto text-left">' +
                    '<p class="text-brand-light font-light leading-relaxed">I understand this is a screening tool, not medical advice, and I have not been examined or treated by a clinician.</p>' +
                '</div>' +
                '<button type="button" id="quiz-ack-continue" class="btn-primary px-10 py-3">Continue</button>' +
                '<p class="text-brand-gray/60 text-xs mt-4">By clicking Continue you confirm the statement above.</p>' +
            '</div>'
        );
    }

    function buildCalculating() {
        var markers = '';
        for (var i = 0; i < calculatingSteps.length; i++) {
            markers += '<div class="calculating-marker flex items-center gap-3 py-2 opacity-0" data-marker-idx="' + i + '">' +
                '<div class="calculating-check w-6 h-6 rounded-full border-2 border-brand-gray/30 flex items-center justify-center flex-shrink-0">' +
                    '<svg class="w-4 h-4 text-brand-gray opacity-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' +
                '</div>' +
                '<span class="text-brand-gray text-sm font-medium">' + calculatingSteps[i] + '</span>' +
            '</div>';
        }
        return screenWrap(SCREEN.CALCULATING,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.CALCULATING + '-heading" class="text-2xl font-bold text-brand-light mb-2 font-heading">Calculating your screening result</h2>' +
                '<p class="text-brand-gray font-light mb-10">This will take just a moment...</p>' +
                // Visual markers are decorative — the real announcement
                // happens via the single live region below.
                '<div class="max-w-sm mx-auto text-left" aria-hidden="true">' + markers + '</div>' +
                '<p id="calculating-current-step" class="sr-only" aria-live="polite" aria-atomic="true"></p>' +
            '</div>'
        );
    }

    function buildResultsShell() {
        // The results heading is rendered dynamically by renderResults().
        // It carries id="screen-{RESULTS}-heading" so the wrapping region
        // can be labelled by it once content is injected.
        return '<div class="quiz-screen flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + SCREEN.RESULTS + '" role="region" aria-labelledby="screen-' + SCREEN.RESULTS + '-heading">' +
            '<div class="max-w-2xl w-full" id="quiz-results-inner"></div></div>';
    }

    // ── Build all screens ────────────────────────────────────────────

    function buildAllScreens() {
        var html = '';
        html += buildWelcome();
        html += buildAgeGate();
        html += buildAgeBlock();
        html += buildAge();
        html += buildSex();
        html += buildWeight();
        html += buildHeight();
        html += buildHeightLoss();
        html += buildPriorFracture();
        html += buildParentalFracture();
        html += buildLifestyle();
        html += buildMeds();
        html += buildReproductive();
        html += buildConditions();
        html += buildState();
        html += buildAck();
        html += buildCalculating();
        html += buildResultsShell();
        root.innerHTML = html;
    }

    // ── Navigation Helpers ───────────────────────────────────────────
    // Compute the "next" screen relative to the current position based on
    // sex (women see REPRODUCTIVE, others skip it). The order is taken from
    // activeScreenOrder() plus the calculating/results suffix.

    function nextScreenFrom(currentIndex) {
        var order = activeScreenOrder();
        var calculatingIdx = order.length; // sentinel — past the end
        var pos = order.indexOf(currentIndex);
        if (pos < 0) return SCREEN.WELCOME;
        if (pos + 1 < order.length) return order[pos + 1];
        // Past ack → calculating → results
        return SCREEN.CALCULATING;
    }

    function prevScreenFrom(currentIndex) {
        var order = activeScreenOrder();
        var pos = order.indexOf(currentIndex);
        if (pos > 0) return order[pos - 1];
        return SCREEN.WELCOME;
    }

    // ── Helper: mark an option group radio-selected ──────────────────
    function selectRadio(groupAttr, value) {
        var all = root.querySelectorAll('[data-' + groupAttr + ']');
        for (var i = 0; i < all.length; i++) {
            var matches = all[i].getAttribute('data-' + groupAttr) === value;
            all[i].classList.toggle('selected', matches);
            if (all[i].getAttribute('role') === 'radio') {
                all[i].setAttribute('aria-checked', matches ? 'true' : 'false');
                // Roving tabindex: only the selected radio is tabbable.
                all[i].setAttribute('tabindex', matches ? '0' : '-1');
            }
        }
        // Enable the Continue button for this group
        var cont = root.querySelector('[data-' + groupAttr + '-continue]');
        if (cont) cont.removeAttribute('disabled');
    }

    // ── WAI-ARIA radiogroup keyboard pattern ─────────────────────────
    // Roving tabindex + arrow keys / Home / End / Space / Enter.
    // Attached once via delegation on the quiz root. Event target must be
    // a radio inside a role="radiogroup" container.
    function bindRadiogroupKeyboard() {
        root.addEventListener('keydown', function(e) {
            var target = e.target;
            if (!target || target.getAttribute('role') !== 'radio') return;
            var group = target.closest('[role="radiogroup"]');
            if (!group) return;
            var radios = group.querySelectorAll('[role="radio"]');
            if (!radios || !radios.length) return;
            var idx = -1;
            for (var i = 0; i < radios.length; i++) {
                if (radios[i] === target) { idx = i; break; }
            }
            if (idx < 0) return;

            var key = e.key;
            var nextIdx = idx;
            var handled = false;

            if (key === 'ArrowDown' || key === 'ArrowRight') {
                nextIdx = (idx + 1) % radios.length;
                handled = true;
            } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
                nextIdx = (idx - 1 + radios.length) % radios.length;
                handled = true;
            } else if (key === 'Home') {
                nextIdx = 0;
                handled = true;
            } else if (key === 'End') {
                nextIdx = radios.length - 1;
                handled = true;
            } else if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
                // Space/Enter selects the focused radio.
                e.preventDefault();
                target.click();
                return;
            }

            if (!handled) return;
            e.preventDefault();
            // Roving tabindex: focused radio becomes tabbable; others -1.
            for (var j = 0; j < radios.length; j++) {
                radios[j].setAttribute('tabindex', j === nextIdx ? '0' : '-1');
            }
            try { radios[nextIdx].focus({ preventScroll: true }); }
            catch (e2) { try { radios[nextIdx].focus(); } catch (e3) {} }
        });
    }

    // ── Manual Advance (no auto-advance) ─────────────────────────────
    // Per WCAG 2.2.1 (Timing Adjustable), radio selections do NOT
    // auto-advance. Users select an option (which highlights the card and
    // enables the Continue button) and then click Continue at their own pace.
    function advanceFrom(currentScreenIndex) {
        var next = nextScreenFrom(currentScreenIndex);
        ga('screen_advance', currentScreenIndex);
        if (next === SCREEN.CALCULATING) {
            startCalculatingFlow();
        } else {
            show(next);
        }
    }

    // ── Validation Helpers ───────────────────────────────────────────

    function showFieldError(errorId, msg) {
        var el = document.getElementById(errorId);
        if (!el) return;
        if (msg) {
            el.textContent = msg;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    // ── Calculating Animation ────────────────────────────────────────

    function runCalculatingAnimation(callback) {
        var markers = root.querySelectorAll('.calculating-marker');
        var liveRegion = document.getElementById('calculating-current-step');
        var delay = 400;
        var totalTime = 0;

        for (var i = 0; i < markers.length; i++) {
            (function(idx) {
                var t = delay * (idx + 1);
                setTimeout(function() {
                    var marker = markers[idx];
                    if (!marker) return;
                    marker.style.opacity = '1';
                    marker.style.transition = 'opacity 0.3s ease';
                    // Update single SR-announced step label so screen
                    // readers receive a textContent change (opacity
                    // changes alone don't trigger live-region updates).
                    if (liveRegion && calculatingSteps[idx]) {
                        liveRegion.textContent = calculatingSteps[idx];
                    }
                    setTimeout(function() {
                        var check = marker.querySelector('.calculating-check');
                        var svg = marker.querySelector('svg');
                        if (check) {
                            check.style.borderColor = '#B2BFBE';
                            check.style.background = 'rgba(178, 191, 190, 0.15)';
                        }
                        if (svg) {
                            svg.style.opacity = '1';
                            svg.style.transition = 'opacity 0.2s ease';
                        }
                        var label = marker.querySelector('span');
                        if (label) label.style.color = '#F0EEE9';
                    }, 150);
                }, t);
                totalTime = t + 300;
            })(i);
        }

        setTimeout(function() {
            if (callback) callback();
        }, totalTime + 600);
    }

    function resetCalculatingMarkers() {
        var markers = root.querySelectorAll('.calculating-marker');
        for (var i = 0; i < markers.length; i++) {
            markers[i].style.opacity = '0';
            var check = markers[i].querySelector('.calculating-check');
            var svg = markers[i].querySelector('svg');
            if (check) { check.style.borderColor = ''; check.style.background = ''; }
            if (svg) { svg.style.opacity = '0'; }
            var label = markers[i].querySelector('span');
            if (label) label.style.color = '';
        }
        var liveRegion = document.getElementById('calculating-current-step');
        if (liveRegion) liveRegion.textContent = '';
    }

    function startCalculatingFlow() {
        show(SCREEN.CALCULATING);
        resetCalculatingMarkers();
        runCalculatingAnimation(function() {
            var result = scoreBoneDensity(state);
            renderResults(result);
            ga('quiz_results_view', SCREEN.RESULTS);
            show(SCREEN.RESULTS);
            if (progressBar) progressBar.style.width = '100%';
        });
    }

    // ── Results Renderer ─────────────────────────────────────────────

    function buildBookingHref(slug, service) {
        return '/booking/?source=bone-density-quiz&result=' + encodeURIComponent(slug) +
            '&service=' + encodeURIComponent(service);
    }

    // Tier-specific body copy. Verbatim from spec — do NOT paraphrase.
    function tierBody(tier) {
        if (tier === 'A') {
            return {
                heading: 'Eligibility factors present',
                body: 'Per AACE, Endocrine Society, and NOF guidelines, a low-trauma fracture after age 40 is itself diagnostic of osteoporosis, even before a DEXA scan. A clinical evaluation is the appropriate next step &mdash; it should include a DEXA scan, bone-relevant lab work, and a discussion of treatment options. We offer DEXA scans on-site in Park Ridge ($150) and full clinical evaluation.',
                primaryCta: { label: 'Book consult with DEXA included', service: 'consult-with-dexa' },
                secondaryCta: null
            };
        }
        if (tier === 'B') {
            return {
                heading: 'Eligibility factors present',
                body: 'Your responses describe risk factors associated with elevated likelihood of low bone density. The most accurate way to know your bones\' actual condition is a DEXA scan &mdash; it\'s the medical gold standard. Moonshot offers DEXA scans on-site in Park Ridge for $150, no referral needed.',
                primaryCta: { label: 'Book DEXA scan ($150)', service: 'dexa' },
                secondaryCta: { label: 'Or book a consultation to review your full picture', service: 'consult' }
            };
        }
        if (tier === 'C') {
            return {
                heading: 'Eligibility factors mixed',
                body: 'You have one or more risk factors for bone density loss. A DEXA scan is reasonable based on these inputs and would establish a baseline you can track over time. For most adults with risk factors, getting a baseline by age 50 (women) or 60 (men) is the standard recommendation.',
                primaryCta: { label: 'Book DEXA scan ($150)', service: 'dexa' },
                secondaryCta: null
            };
        }
        // Tier D
        return {
            heading: 'Eligibility factors not met',
            body: 'Based on your responses, your risk factors for low bone density are minimal. <strong>A DEXA is reasonable but not urgent based on these inputs.</strong> If you\'re approaching standard screening ages or want a longevity baseline, the scan is still valuable as a reference point.',
            primaryCta: { label: 'Discuss baseline scan with a clinician', service: 'consult' },
            secondaryCta: null
        };
    }

    function renderResults(result) {
        // Out-of-state branch — show IL-only message instead of personalized
        // result. The tier was still computed above so we have an audit trail
        // in the submit payload, but the user does not see it.
        var html = '';
        if (result.outOfState) {
            html += '<div class="text-center mb-10">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Your Result</p>' +
                '<h2 id="screen-' + SCREEN.RESULTS + '-heading" class="text-3xl md:text-4xl font-bold text-brand-light mb-4 font-heading">Available to Illinois residents</h2>' +
            '</div>';
            html += '<div class="border border-brand-gray/40 rounded-sm p-8 mb-6" style="background: rgba(178, 191, 190, 0.05)">' +
                '<p class="text-brand-light font-light leading-relaxed">This tool is currently available to residents of Illinois only. Moonshot Medical clinicians are licensed in Illinois only. Please consult a clinician licensed in your state.</p>' +
            '</div>';
        } else {
            var tier = result.tier;
            var copy = tierBody(tier);
            var slug = result.resultSlug;

            html += '<div class="text-center mb-8">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Your Result</p>' +
                '<h2 id="screen-' + SCREEN.RESULTS + '-heading" class="text-3xl md:text-4xl font-bold text-brand-light mb-2 font-heading">' + copy.heading + '</h2>' +
            '</div>';

            html += '<div class="border border-brand-gray/40 rounded-sm p-8 mb-6" style="background: rgba(178, 191, 190, 0.05)">' +
                '<p class="text-brand-light font-light text-base leading-relaxed">' + copy.body + '</p>' +
            '</div>';

            // CTA block
            html += '<div class="bg-brand-slate rounded-sm p-8 mb-6 text-center">' +
                '<h3 class="text-brand-light font-bold mb-4">YOUR NEXT STEP</h3>' +
                '<a href="' + buildBookingHref(slug, copy.primaryCta.service) + '" class="btn-primary text-lg px-10 py-4 inline-block quiz-cta" data-cta="' + copy.primaryCta.service + '">' + copy.primaryCta.label + '</a>';
            if (copy.secondaryCta) {
                html += '<p class="mt-4"><a href="' + buildBookingHref(slug, copy.secondaryCta.service) + '" class="text-brand-light underline text-sm hover:text-brand-gray quiz-cta" data-cta="' + copy.secondaryCta.service + '">' + copy.secondaryCta.label + '</a></p>';
            }
            html += '<p class="text-brand-gray/60 text-sm mt-4"><a href="tel:+12244354280" class="text-brand-light hover:underline quiz-cta" data-cta="phone">(224) 435-4280</a> if you\'d rather call</p>' +
            '</div>';
        }

        // Result-specific disclaimer (always shown)
        html += '<div class="bg-white/5 border-l-2 border-brand-gray/50 rounded-sm p-4 mb-6">' +
            '<p class="text-brand-gray text-xs italic font-light leading-relaxed">' + RESULT_DISCLAIMER + '</p>' +
        '</div>';

        // ── Email capture (post-result, separate opt-in, never gates result)
        if (!result.outOfState) {
            html += '<div class="bg-white/5 border border-white/10 rounded-sm p-6 mb-6">' +
                '<h3 class="text-brand-light font-bold mb-3">Want a copy of your result?</h3>' +
                '<p class="text-brand-gray text-sm font-light mb-4">Optional &mdash; you do not need to enter anything to keep this result.</p>' +
                '<div class="space-y-3 text-left">' +
                    '<label class="flex items-start gap-3 cursor-pointer">' +
                        '<input type="checkbox" id="quiz-email-optin" class="mt-1 flex-shrink-0">' +
                        '<span class="text-brand-light text-sm font-light">Email me a copy of these results</span>' +
                    '</label>' +
                    '<label class="flex items-start gap-3 cursor-pointer">' +
                        '<input type="checkbox" id="quiz-marketing-optin" class="mt-1 flex-shrink-0">' +
                        '<span class="text-brand-light text-sm font-light">Send me occasional updates from Moonshot Medical (no spam)</span>' +
                    '</label>' +
                '</div>' +
                '<div id="quiz-email-fields" class="hidden mt-4 space-y-3 max-w-sm">' +
                    '<label for="quiz-name" class="sr-only">First name (required)</label>' +
                    '<input type="text" id="quiz-name" required aria-required="true" maxlength="80" placeholder="First name *" autocomplete="given-name" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<label for="quiz-email" class="sr-only">Email address (required)</label>' +
                    '<input type="email" id="quiz-email" required aria-required="true" maxlength="254" placeholder="Email address *" autocomplete="email" aria-describedby="quiz-email-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<label for="quiz-phone" class="sr-only">Phone (optional)</label>' +
                    '<input type="tel" id="quiz-phone" maxlength="32" placeholder="Phone (optional)" autocomplete="tel" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<p id="quiz-email-error" role="alert" class="text-red-500 text-xs hidden">Please enter a valid email address.</p>' +
                    '<p id="quiz-name-error" role="alert" class="text-red-500 text-xs hidden">Please enter your first name.</p>' +
                    '<p id="quiz-submit-msg" role="status" aria-live="polite" class="text-brand-gray text-xs hidden"></p>' +
                    '<button type="button" id="quiz-submit-info" class="btn-primary w-full py-3">Email My Results</button>' +
                '</div>' +
            '</div>';
        }

        // Universal footer disclaimer is rendered once by the static HTML
        // below the quiz mount — do NOT duplicate it here. Author attribution
        // remains result-page-specific.

        // Author attribution (always shown)
        html += '<div class="mt-8">' +
            '<p class="text-xs text-brand-gray/60 italic leading-relaxed">' + AUTHOR_ATTRIBUTION + '</p>' +
        '</div>';

        // Retake quiz button (lower right)
        html += '<div class="mt-8 text-right">' +
            '<button type="button" class="text-brand-gray/60 hover:text-brand-light text-sm transition-colors underline underline-offset-2" data-retake="true">Retake screener</button>' +
        '</div>';

        document.getElementById('quiz-results-inner').innerHTML = html;

        // Update URL for sharing — only the tier letter, not the full state.
        if (window.history && window.history.replaceState) {
            try {
                var validTier = result.tier && /^[A-D]$/.test(result.tier);
                if (validTier) {
                    window.history.replaceState(null, '', '/quiz/bone-density/?r=' + result.tier);
                }
            } catch (e) { /* ignore */ }
        }

        // Update OG meta
        try {
            var metaTitle = document.querySelector('meta[property="og:title"]');
            var metaDesc = document.querySelector('meta[property="og:description"]');
            if (metaTitle) metaTitle.setAttribute('content', 'My DEXA Bone Density Screener Result | Moonshot Medical');
            if (metaDesc) metaDesc.setAttribute('content', 'Take the free 2-minute screener to find out whether a DEXA scan is right for you.');
        } catch (e) { /* ignore */ }

        bindResultsHandlers();
    }

    // ── Handlers for the results screen (email capture, retake, CTAs) ─

    function bindResultsHandlers() {
        var emailOpt = document.getElementById('quiz-email-optin');
        var marketingOpt = document.getElementById('quiz-marketing-optin');
        var fields = document.getElementById('quiz-email-fields');

        if (emailOpt && fields) {
            emailOpt.addEventListener('change', function() {
                state.emailOptIn = !!emailOpt.checked;
                if (emailOpt.checked) {
                    fields.classList.remove('hidden');
                    var nameInput = document.getElementById('quiz-name');
                    if (nameInput) {
                        try { nameInput.focus(); } catch (e) {}
                    }
                } else {
                    fields.classList.add('hidden');
                }
            });
        }
        if (marketingOpt) {
            marketingOpt.addEventListener('change', function() {
                state.marketingOptIn = !!marketingOpt.checked;
            });
        }

        var submitBtn = document.getElementById('quiz-submit-info');
        if (submitBtn) {
            submitBtn.addEventListener('click', handleEmailSubmit);
        }
    }

    function handleEmailSubmit() {
        var nameInput = document.getElementById('quiz-name');
        var emailInput = document.getElementById('quiz-email');
        var phoneInput = document.getElementById('quiz-phone');

        // Trim + length-clamp before storing. Caps are: name 80, email
        // 254 (RFC 5321 maximum email length), phone 32.
        var name = nameInput ? (nameInput.value || '').trim().slice(0, 80) : '';
        var email = emailInput ? (emailInput.value || '').trim().slice(0, 254) : '';
        var phone = phoneInput ? (phoneInput.value || '').trim().slice(0, 32) : '';

        showFieldError('quiz-name-error', '');
        showFieldError('quiz-email-error', '');
        if (nameInput) nameInput.style.borderColor = '';
        if (emailInput) emailInput.style.borderColor = '';

        var hasErr = false;
        if (!name) {
            showFieldError('quiz-name-error', 'Please enter your first name.');
            if (nameInput) nameInput.style.borderColor = '#dc2626';
            hasErr = true;
        }
        if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
            showFieldError('quiz-email-error', 'Please enter a valid email address.');
            if (emailInput) emailInput.style.borderColor = '#dc2626';
            if (!hasErr && emailInput) try { emailInput.focus(); } catch (e) {}
            hasErr = true;
        }
        if (hasErr) return;

        state.name = name;
        state.email = email;
        state.phone = phone;

        ga('quiz_email_submit', SCREEN.RESULTS);
        sendResults();

        var msg = document.getElementById('quiz-submit-msg');
        if (msg) {
            msg.textContent = 'Thanks — we just sent your result to ' + email + '.';
            msg.classList.remove('hidden');
        }
        // Hide submit button to prevent duplicate sends
        var submitBtn = document.getElementById('quiz-submit-info');
        if (submitBtn) submitBtn.setAttribute('disabled', 'disabled');
    }

    // ── Email submission ─────────────────────────────────────────────
    // Compact payload — counts only for multi-check fields, not raw arrays.
    function sendResults() {
        var result = scoreBoneDensity(state);

        var payload = {
            name: state.name || null,
            email: state.email,
            phone: state.phone || null,
            marketingOptIn: !!state.marketingOptIn,
            result: {
                tier: result.tier,
                tierLabel: result.tierLabel,
                ostScore: result.ostScore,
                riskFactorCount: result.riskFactorCount,
                resultSlug: result.resultSlug
            },
            profile: {
                age: state.age,
                sex: state.sex,
                weightKg: resolveWeightKg(state),
                heightLoss: state.heightLoss,
                priorFragilityFracture: state.priorFragilityFracture,
                parentalHipFracture: state.parentalHipFracture,
                smokingOrAlcohol: state.smokingOrAlcohol,
                medicationCount: Array.isArray(state.medications) ? state.medications.length : 0,
                prematureMenopause: state.prematureMenopause,
                secondaryConditionCount: Array.isArray(state.secondaryConditions) ? state.secondaryConditions.length : 0,
                stateCode: state.stateCode
            },
            ackTimestamp: state.ackTimestamp
        };

        // Attach upstream marketing attribution (utm_*, gclid, fbclid,
        // landing_page, last_page, referrer) — forwarded to the EHR lead webhook.
        try {
            payload.attribution = (window.MoonshotAttribution && typeof window.MoonshotAttribution.getFlat === 'function')
                ? window.MoonshotAttribution.getFlat()
                : null;
        } catch (_a) { payload.attribution = null; }

        try {
            fetch('/.netlify/functions/bone-density-quiz-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function() { /* fire-and-forget */ });
        } catch (e) { /* ignore */ }
    }

    // ── Shared Result View (?r=A|B|C|D) ──────────────────────────────

    function showSharedResult(tier) {
        if (!/^[A-D]$/.test(tier)) return;
        var copy = tierBody(tier);
        var html = '<div class="flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12">' +
            '<div class="max-w-2xl w-full">' +
                '<div class="text-center mb-8">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Shared Screener Result</p>' +
                    '<h2 class="text-3xl font-bold text-brand-light mb-4 font-heading">Someone Matched With &mdash; ' + copy.heading + '</h2>' +
                '</div>' +
                '<div class="border border-brand-gray/40 rounded-sm p-8 mb-8" style="background: rgba(178, 191, 190, 0.05)">' +
                    '<p class="text-brand-light font-light">' + copy.body + '</p>' +
                '</div>' +
                '<div class="bg-white/5 border border-white/10 rounded-sm p-6 mb-8 text-center">' +
                    '<p class="text-brand-gray font-light mb-6">This result was personalized for someone else. Take the screener to get your own.</p>' +
                    '<button type="button" id="shared-result-cta" class="btn-primary text-lg px-10 py-4">Take the Screener</button>' +
                '</div>' +
                // Universal footer disclaimer is rendered by the static HTML
                // below the quiz mount — not duplicated here.
            '</div>' +
        '</div>';

        root.innerHTML = html;
        if (progressBar) progressBar.style.width = '0%';

        var ctaBtn = document.getElementById('shared-result-cta');
        if (ctaBtn) {
            ctaBtn.addEventListener('click', function() {
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '/quiz/bone-density/');
                }
                ga('quiz_cta_click', 'shared');
                restoreQuiz();
            });
        }
    }

    // ── Bind: All Event Handlers ─────────────────────────────────────

    function bindAll() {
        // Welcome start button
        var startBtn = document.getElementById('quiz-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', function() {
                ga('quiz_start', SCREEN.WELCOME);
                show(SCREEN.AGE_GATE);
            });
        }

        // ── Delegated card clicks for radio-style screens ────────────
        root.addEventListener('click', function(e) {
            var target = e.target;

            // Age gate
            var ageGateBtn = target.closest('[data-age-gate]');
            if (ageGateBtn) {
                state.ageGate = ageGateBtn.getAttribute('data-age-gate');
                selectRadio('age-gate', state.ageGate);
                if (state.ageGate === 'no') {
                    // No recovery path — advance immediately to terminal block
                    ga('screen_advance', SCREEN.AGE_GATE);
                    show(SCREEN.AGE_BLOCK);
                }
                // For "yes" the user must click Continue (no auto-advance,
                // per WCAG 2.2.1).
                return;
            }
            var ageGateCont = target.closest('#quiz-age-gate-continue');
            if (ageGateCont && state.ageGate === 'yes') {
                advanceFrom(SCREEN.AGE_GATE);
                return;
            }

            // Sex
            var sexBtn = target.closest('[data-sex]');
            if (sexBtn) {
                state.sex = sexBtn.getAttribute('data-sex');
                selectRadio('sex', state.sex);
                return;
            }
            var sexCont = target.closest('#quiz-sex-continue');
            if (sexCont && state.sex) {
                advanceFrom(SCREEN.SEX);
                return;
            }

            // Height-loss
            var hlBtn = target.closest('[data-height-loss]');
            if (hlBtn) {
                state.heightLoss = hlBtn.getAttribute('data-height-loss');
                selectRadio('height-loss', state.heightLoss);
                return;
            }
            if (target.closest('[data-height-loss-continue]') && state.heightLoss) {
                advanceFrom(SCREEN.HEIGHT_LOSS);
                return;
            }

            // Prior fracture
            var pfBtn = target.closest('[data-prior-fracture]');
            if (pfBtn) {
                state.priorFragilityFracture = pfBtn.getAttribute('data-prior-fracture');
                selectRadio('prior-fracture', state.priorFragilityFracture);
                return;
            }
            if (target.closest('[data-prior-fracture-continue]') && state.priorFragilityFracture) {
                advanceFrom(SCREEN.PRIOR_FRACTURE);
                return;
            }

            // Parental fracture
            var ppBtn = target.closest('[data-parental-fracture]');
            if (ppBtn) {
                state.parentalHipFracture = ppBtn.getAttribute('data-parental-fracture');
                selectRadio('parental-fracture', state.parentalHipFracture);
                return;
            }
            if (target.closest('[data-parental-fracture-continue]') && state.parentalHipFracture) {
                advanceFrom(SCREEN.PARENTAL_FRACTURE);
                return;
            }

            // Lifestyle
            var lsBtn = target.closest('[data-lifestyle]');
            if (lsBtn) {
                state.smokingOrAlcohol = lsBtn.getAttribute('data-lifestyle');
                selectRadio('lifestyle', state.smokingOrAlcohol);
                return;
            }
            if (target.closest('[data-lifestyle-continue]') && state.smokingOrAlcohol) {
                advanceFrom(SCREEN.LIFESTYLE);
                return;
            }

            // Reproductive
            var rpBtn = target.closest('[data-reproductive]');
            if (rpBtn) {
                state.prematureMenopause = rpBtn.getAttribute('data-reproductive');
                selectRadio('reproductive', state.prematureMenopause);
                return;
            }
            if (target.closest('[data-reproductive-continue]') && state.prematureMenopause) {
                advanceFrom(SCREEN.REPRODUCTIVE);
                return;
            }

            // Meds Continue
            if (target.closest('[data-med-continue]')) {
                if (state.currentScreen === SCREEN.MEDS) {
                    advanceFrom(SCREEN.MEDS);
                }
                return;
            }
            // Conditions Continue
            if (target.closest('[data-cond-continue]')) {
                if (state.currentScreen === SCREEN.CONDITIONS) {
                    advanceFrom(SCREEN.CONDITIONS);
                }
                return;
            }

            // Back button
            var backBtn = target.closest('[data-back]');
            if (backBtn) {
                var prev = prevScreenFrom(state.currentScreen);
                ga('quiz_back', state.currentScreen);
                show(prev);
                return;
            }

            // Retake quiz
            var retakeBtn = target.closest('[data-retake]');
            if (retakeBtn) {
                ga('quiz_retake', SCREEN.RESULTS);
                resetState();
                clearSavedState();
                buildAllScreens();
                bindAll();
                show(SCREEN.WELCOME);
                return;
            }

            // CTA clicks (booking links, phone tap)
            var cta = target.closest('.quiz-cta');
            if (cta) {
                ga('quiz_cta_click', SCREEN.RESULTS);
                return;
            }
        });

        // ── Multi-check inputs (delegated change) ─────────────────────
        root.addEventListener('change', function(e) {
            var t = e.target;
            if (!t || t.tagName !== 'INPUT') return;

            // Medications
            var medKey = t.getAttribute('data-med');
            if (medKey != null) {
                handleMultiCheck(state.medications, medKey, t.checked, 'med');
                return;
            }
            if (t.getAttribute('data-med-none') === 'true') {
                handleNoneOf(state.medications, t.checked, 'med');
                return;
            }

            // Conditions
            var condKey = t.getAttribute('data-cond');
            if (condKey != null) {
                handleMultiCheck(state.secondaryConditions, condKey, t.checked, 'cond');
                return;
            }
            if (t.getAttribute('data-cond-none') === 'true') {
                handleNoneOf(state.secondaryConditions, t.checked, 'cond');
                return;
            }
        });

        // ── Age screen ────────────────────────────────────────────────
        bindAgeScreen();
        // ── Weight screen ─────────────────────────────────────────────
        bindWeightScreen();
        // ── Height screen ─────────────────────────────────────────────
        bindHeightScreen();
        // ── State screen ──────────────────────────────────────────────
        bindStateScreen();
        // ── Acknowledgement ───────────────────────────────────────────
        bindAckScreen();
        // ── WAI-ARIA radiogroup keyboard nav ──────────────────────────
        bindRadiogroupKeyboard();
    }

    function handleMultiCheck(arr, key, checked, dataAttr) {
        var idx = arr.indexOf(key);
        if (checked) {
            if (idx === -1) arr.push(key);
            // Uncheck the "None of these" if a regular item is now checked
            var noneInput = root.querySelector('[data-' + dataAttr + '-none]');
            if (noneInput) noneInput.checked = false;
        } else {
            if (idx !== -1) arr.splice(idx, 1);
        }
        saveState();
    }

    function handleNoneOf(arr, checked, dataAttr) {
        if (checked) {
            // Clear all other multi-check entries
            arr.length = 0;
            var inputs = root.querySelectorAll('[data-' + dataAttr + ']');
            for (var i = 0; i < inputs.length; i++) {
                inputs[i].checked = false;
            }
        }
        saveState();
    }

    function bindAgeScreen() {
        var input = document.getElementById('quiz-age-input');
        var btn = document.getElementById('quiz-age-continue');
        if (!input || !btn) return;
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });
        btn.addEventListener('click', function() {
            var raw = (input.value || '').trim();
            var n = parseInt(raw, 10);
            input.style.borderColor = '';
            if (!raw || isNaN(n) || n < 18 || n > 100) {
                showFieldError('quiz-age-error', 'Please enter an age between 18 and 100.');
                input.style.borderColor = '#dc2626';
                try { input.focus(); } catch (e) {}
                return;
            }
            showFieldError('quiz-age-error', '');
            state.age = n;
            saveState();
            advanceFrom(SCREEN.AGE);
        });
    }

    function bindWeightScreen() {
        var input = document.getElementById('quiz-weight-input');
        var btn = document.getElementById('quiz-weight-continue');
        var toggle = document.getElementById('weight-unit-toggle');
        var labelLbs = document.getElementById('weight-unit-label-lbs');
        var labelKg = document.getElementById('weight-unit-label-kg');
        if (!input || !btn || !toggle) return;

        function syncUnitUI() {
            var isKg = state.weightUnit === 'kg';
            toggle.classList.toggle('on', isKg);
            toggle.setAttribute('aria-checked', isKg ? 'true' : 'false');
            if (labelLbs) labelLbs.classList.toggle('text-brand-light', !isKg);
            if (labelLbs) labelLbs.classList.toggle('text-brand-gray/60', isKg);
            if (labelKg) labelKg.classList.toggle('text-brand-light', isKg);
            if (labelKg) labelKg.classList.toggle('text-brand-gray/60', !isKg);
            input.placeholder = isKg ? 'e.g. 75' : 'e.g. 165';
        }
        syncUnitUI();

        toggle.addEventListener('click', function() {
            state.weightUnit = state.weightUnit === 'lbs' ? 'kg' : 'lbs';
            syncUnitUI();
            saveState();
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });

        btn.addEventListener('click', function() {
            var raw = (input.value || '').trim();
            var n = parseFloat(raw);
            input.style.borderColor = '';
            // Reasonable physiological bounds
            var minOk, maxOk;
            if (state.weightUnit === 'kg') {
                minOk = 25; maxOk = 350;
            } else {
                minOk = 55; maxOk = 770;
            }
            if (!raw || isNaN(n) || n < minOk || n > maxOk) {
                showFieldError('quiz-weight-error', 'Please enter a realistic weight.');
                input.style.borderColor = '#dc2626';
                try { input.focus(); } catch (e) {}
                return;
            }
            showFieldError('quiz-weight-error', '');
            state.weightInput = raw;
            if (state.weightUnit === 'kg') {
                state.weightKg = n;
                state.weightLbs = null;
            } else {
                state.weightLbs = n;
                state.weightKg = null;
            }
            saveState();
            advanceFrom(SCREEN.WEIGHT);
        });
    }

    function bindHeightScreen() {
        var input = document.getElementById('quiz-height-input');
        var btn = document.getElementById('quiz-height-continue');
        var toggle = document.getElementById('height-unit-toggle');
        var labelIn = document.getElementById('height-unit-label-in');
        var labelCm = document.getElementById('height-unit-label-cm');
        if (!input || !btn || !toggle) return;

        function syncUnitUI() {
            var isCm = state.heightUnit === 'cm';
            toggle.classList.toggle('on', isCm);
            toggle.setAttribute('aria-checked', isCm ? 'true' : 'false');
            if (labelIn) labelIn.classList.toggle('text-brand-light', !isCm);
            if (labelIn) labelIn.classList.toggle('text-brand-gray/60', isCm);
            if (labelCm) labelCm.classList.toggle('text-brand-light', isCm);
            if (labelCm) labelCm.classList.toggle('text-brand-gray/60', !isCm);
            input.placeholder = isCm ? 'e.g. 168' : 'e.g. 66';
        }
        syncUnitUI();

        toggle.addEventListener('click', function() {
            state.heightUnit = state.heightUnit === 'in' ? 'cm' : 'in';
            syncUnitUI();
            saveState();
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });

        btn.addEventListener('click', function() {
            var raw = (input.value || '').trim();
            var n = parseFloat(raw);
            input.style.borderColor = '';
            var minOk, maxOk;
            if (state.heightUnit === 'cm') {
                minOk = 90; maxOk = 250;
            } else {
                minOk = 36; maxOk = 96;
            }
            if (!raw || isNaN(n) || n < minOk || n > maxOk) {
                showFieldError('quiz-height-error', 'Please enter a realistic height.');
                input.style.borderColor = '#dc2626';
                try { input.focus(); } catch (e) {}
                return;
            }
            showFieldError('quiz-height-error', '');
            state.heightInput = raw;
            if (state.heightUnit === 'cm') {
                state.heightCm = n;
                state.heightIn = null;
            } else {
                state.heightIn = n;
                state.heightCm = null;
            }
            saveState();
            advanceFrom(SCREEN.HEIGHT);
        });
    }

    function bindStateScreen() {
        var sel = document.getElementById('quiz-state-select');
        var btn = document.getElementById('quiz-state-continue');
        if (!sel || !btn) return;
        btn.addEventListener('click', function() {
            var v = (sel.value || '').toUpperCase();
            if (!v) {
                showFieldError('quiz-state-error', 'Please choose your state of residence.');
                try { sel.focus(); } catch (e) {}
                return;
            }
            showFieldError('quiz-state-error', '');
            state.stateCode = v;
            saveState();
            advanceFrom(SCREEN.STATE);
        });
    }

    function bindAckScreen() {
        var btn = document.getElementById('quiz-ack-continue');
        if (!btn) return;
        btn.addEventListener('click', function() {
            state.ackTimestamp = new Date().toISOString();
            saveState();
            advanceFrom(SCREEN.ACK);
        });
    }

    // ── Reset State ──────────────────────────────────────────────────

    function resetState() {
        state.currentScreen = 0;
        state.ageGate = null;
        state.age = null;
        state.sex = null;
        state.weightKg = null;
        state.weightLbs = null;
        state.weightUnit = 'lbs';
        state.weightInput = '';
        state.heightCm = null;
        state.heightIn = null;
        state.heightUnit = 'in';
        state.heightInput = '';
        state.heightLoss = null;
        state.priorFragilityFracture = null;
        state.parentalHipFracture = null;
        state.smokingOrAlcohol = null;
        state.medications = [];
        state.prematureMenopause = null;
        state.secondaryConditions = [];
        state.stateCode = '';
        state.ackTimestamp = null;
        state.name = '';
        state.email = '';
        state.phone = '';
        state.marketingOptIn = false;
        state.emailOptIn = false;
    }

    // ── Restore from Saved State ─────────────────────────────────────

    // Allowlists for enum-typed restored fields. Anything not in the
    // allowlist is rejected (set null) — protects scoring from corrupted
    // localStorage values planted via DevTools or older schema versions.
    var ENUM_AGE_GATE = { 'yes': 1, 'no': 1 };
    var ENUM_SEX = { 'male': 1, 'female': 1, 'prefer-not': 1 };
    var ENUM_YES_NO_UNKNOWN = { 'yes': 1, 'no': 1, 'unknown': 1 };
    var ENUM_YES_NO = { 'yes': 1, 'no': 1 };
    var ENUM_REPRODUCTIVE = { 'yes': 1, 'no': 1, 'na': 1 };
    var ENUM_UNIT_WEIGHT = { 'lbs': 1, 'kg': 1 };
    var ENUM_UNIT_HEIGHT = { 'in': 1, 'cm': 1 };
    function pickEnum(value, allow, fallback) {
        if (typeof value !== 'string') return fallback;
        return Object.prototype.hasOwnProperty.call(allow, value) ? value : fallback;
    }
    // CSS.escape polyfill for very old browsers (Tom's audience is modern,
    // but harmless to fall back to a regex-based escape).
    function safeAttrEscape(value) {
        if (typeof value !== 'string') return '';
        if (typeof window.CSS !== 'undefined' &&
            typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }
        return value.replace(/["\\\]]/g, '\\$&');
    }

    function restoreQuiz() {
        var saved = loadSavedState();
        buildAllScreens();
        bindAll();

        if (!saved) {
            show(SCREEN.WELCOME);
            return;
        }

        // Restore primitive fields with strict enum / type validation.
        state.ageGate = pickEnum(saved.ageGate, ENUM_AGE_GATE, null);
        state.age = (typeof saved.age === 'number' && saved.age >= 18 && saved.age <= 100) ? saved.age : null;
        state.sex = pickEnum(saved.sex, ENUM_SEX, null);
        state.weightKg = (typeof saved.weightKg === 'number' && saved.weightKg > 0) ? saved.weightKg : null;
        state.weightLbs = (typeof saved.weightLbs === 'number' && saved.weightLbs > 0) ? saved.weightLbs : null;
        state.weightUnit = pickEnum(saved.weightUnit, ENUM_UNIT_WEIGHT, 'lbs');
        state.weightInput = (typeof saved.weightInput === 'string') ? saved.weightInput : '';
        state.heightCm = (typeof saved.heightCm === 'number' && saved.heightCm > 0) ? saved.heightCm : null;
        state.heightIn = (typeof saved.heightIn === 'number' && saved.heightIn > 0) ? saved.heightIn : null;
        state.heightUnit = pickEnum(saved.heightUnit, ENUM_UNIT_HEIGHT, 'in');
        state.heightInput = (typeof saved.heightInput === 'string') ? saved.heightInput : '';
        state.heightLoss = pickEnum(saved.heightLoss, ENUM_YES_NO_UNKNOWN, null);
        state.priorFragilityFracture = pickEnum(saved.priorFragilityFracture, ENUM_YES_NO, null);
        state.parentalHipFracture = pickEnum(saved.parentalHipFracture, ENUM_YES_NO, null);
        state.smokingOrAlcohol = pickEnum(saved.smokingOrAlcohol, ENUM_YES_NO, null);
        state.medications = Array.isArray(saved.medications) ? saved.medications.slice() : [];
        state.prematureMenopause = pickEnum(saved.prematureMenopause, ENUM_REPRODUCTIVE, null);
        state.secondaryConditions = Array.isArray(saved.secondaryConditions) ? saved.secondaryConditions.slice() : [];
        // stateCode: must match /^[A-Z]{2}$/ (case-insensitive, normalized up).
        state.stateCode = (typeof saved.stateCode === 'string' && /^[A-Za-z]{2}$/.test(saved.stateCode))
            ? saved.stateCode.toUpperCase()
            : '';
        state.ackTimestamp = (typeof saved.ackTimestamp === 'string') ? saved.ackTimestamp : null;
        state.name = (typeof saved.name === 'string') ? saved.name : '';
        state.email = (typeof saved.email === 'string') ? saved.email : '';
        state.phone = (typeof saved.phone === 'string') ? saved.phone : '';
        state.marketingOptIn = !!saved.marketingOptIn;
        state.emailOptIn = !!saved.emailOptIn;

        // Rehydrate UI selections
        if (state.ageGate) selectRadio('age-gate', state.ageGate);
        if (state.sex) selectRadio('sex', state.sex);
        if (state.heightLoss) selectRadio('height-loss', state.heightLoss);
        if (state.priorFragilityFracture) selectRadio('prior-fracture', state.priorFragilityFracture);
        if (state.parentalHipFracture) selectRadio('parental-fracture', state.parentalHipFracture);
        if (state.smokingOrAlcohol) selectRadio('lifestyle', state.smokingOrAlcohol);
        if (state.prematureMenopause) selectRadio('reproductive', state.prematureMenopause);

        // Rehydrate inputs
        var ageInput = document.getElementById('quiz-age-input');
        if (ageInput && state.age != null) ageInput.value = String(state.age);
        var weightInput = document.getElementById('quiz-weight-input');
        if (weightInput && state.weightInput) weightInput.value = state.weightInput;
        var heightInput = document.getElementById('quiz-height-input');
        if (heightInput && state.heightInput) heightInput.value = state.heightInput;
        var stateSel = document.getElementById('quiz-state-select');
        if (stateSel && state.stateCode) stateSel.value = state.stateCode;

        // Rehydrate multi-checks — escape attribute values to prevent any
        // hostile string from breaking out of the selector.
        if (state.medications.length) {
            for (var i = 0; i < state.medications.length; i++) {
                var medEl = root.querySelector('[data-med="' + safeAttrEscape(state.medications[i]) + '"]');
                if (medEl) medEl.checked = true;
            }
        }
        if (state.secondaryConditions.length) {
            for (var j = 0; j < state.secondaryConditions.length; j++) {
                var condEl = root.querySelector('[data-cond="' + safeAttrEscape(state.secondaryConditions[j]) + '"]');
                if (condEl) condEl.checked = true;
            }
        }

        // Determine target screen — never restore directly to calculating or
        // results (the result is recomputed on demand). If saved currentScreen
        // is past the ack, send the user to the ack screen so they explicitly
        // re-acknowledge before re-rendering the result.
        var target = (typeof saved.currentScreen === 'number') ? saved.currentScreen : SCREEN.WELCOME;
        if (target === SCREEN.AGE_BLOCK || target === SCREEN.CALCULATING || target === SCREEN.RESULTS) {
            target = SCREEN.ACK;
        }
        // Clamp into a valid index range
        if (target < SCREEN.WELCOME) target = SCREEN.WELCOME;
        if (target > SCREEN.ACK) target = SCREEN.ACK;
        show(target);
    }

    // ── Init ─────────────────────────────────────────────────────────

    function init() {
        if (!root) return;

        // Shared result URL: /quiz/bone-density/?r=A|B|C|D
        try {
            var urlParams = new URLSearchParams(window.location.search);
            var sharedTier = (urlParams.get('r') || '').trim().toUpperCase();
            if (sharedTier && /^[A-D]$/.test(sharedTier)) {
                showSharedResult(sharedTier);
                return;
            }
        } catch (e) { /* ignore */ }

        restoreQuiz();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
