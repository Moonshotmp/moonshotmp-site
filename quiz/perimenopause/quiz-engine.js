/*
 * Moonshot Perimenopause Screener — Quiz Engine
 * ==============================================
 * Browser-side IIFE that runs the entire perimenopause screening flow:
 * welcome → age-gate → age → menstrual status → 11 MRS items (Q3..Q13)
 * → contraindication history → (conditional) red-flag interstitial
 * → state → acknowledgement → calculating → results.
 *
 * Scoring logic is INLINED from /quiz/perimenopause/scoring.js (the canonical
 * pure module). Both files MUST stay in sync — the Vitest suite pins the
 * contract on the scoring module; this engine reproduces it verbatim because
 * the page loads as a non-module script tag (no ESM imports).
 *
 * Output contract (must match scoring.js exactly):
 *   { mrsScore, mrsTier, hasHrtContraindication, hasRedFlag, internalTier,
 *     internalTierLabel, resultSlug, outOfState }
 *
 * Privacy / first-party analytics:
 *   Health values NEVER leave the browser as analytics. The ga() shim only
 *   forwards generic funnel events to /.netlify/functions/quiz-event with
 *   the strict 4-field contract { quiz: 'perimenopause', event, screen,
 *   timestamp }. Health data flows through
 *   /.netlify/functions/perimenopause-quiz-submit for the email and CRM
 *   pipeline only.
 *
 * Compliance rails:
 *   - Never name specific drugs or hormones in result output.
 *   - Never tell the user they "should start HRT".
 *   - Never use "Strong candidate" / "Possible candidate" — neutral labels only.
 *   - Never predict cause ("estrogen dominance", "low testosterone").
 *   - Tier labels are the four neutral strings from INTERNAL_TIER_LABELS.
 *   - Acknowledgement screen is a real click-through, timestamped.
 *   - Red-flag interstitial appears BEFORE the result when triggered, with
 *     a separate ack timestamp.
 *   - Email capture comes AFTER the result; never gates the result.
 *   - Out-of-state users receive an IL-only message in place of the result.
 *   - Age-gate "No" terminates the quiz with a permanent block screen.
 */
(function() {
    'use strict';

    // ── Inlined Scoring Logic (mirror of scoring.js) ─────────────────
    // If scoring.js changes, update both files together. Vitest pins the
    // canonical module — keep this section identical in behavior.

    var MRS_INDEX = {
        Q3_HOT_FLUSHES:        0,
        Q4_PALPITATIONS:       1,
        Q5_SLEEP:              2,
        Q6_DEPRESSIVE:         3,
        Q7_IRRITABILITY:       4,
        Q8_ANXIETY:            5,
        Q9_EXHAUSTION:         6,
        Q10_SEXUAL:            7,
        Q11_BLADDER:           8,
        Q12_VAGINAL_DRYNESS:   9,
        Q13_JOINT_MUSCLE:     10
    };

    var MRS_ITEM_COUNT = 11;
    var MRS_VALUE_MIN = 0;
    var MRS_VALUE_MAX = 4;

    var MENSTRUAL_STATUS_VALUES = {
        'regular': 1,
        'irregular': 1,
        'less-than-12-months-since-lmp': 1,
        '12-or-more-months-since-lmp': 1,
        'hyst-with-ovaries': 1,
        'hyst-with-oophorectomy': 1,
        'on-hormonal-contraception-or-hrt': 1
    };

    var INTERNAL_TIER_VALUES = {
        'contraindication-identified': 1,
        'eligibility-factors-present': 1,
        'eligibility-factors-mixed': 1,
        'eligibility-factors-not-met': 1
    };

    var INTERNAL_TIER_LABELS = {
        'contraindication-identified': 'Contraindication identified',
        'eligibility-factors-present': 'Eligibility factors present',
        'eligibility-factors-mixed':   'Eligibility factors mixed',
        'eligibility-factors-not-met': 'Eligibility factors not met'
    };

    var RESULT_SLUGS = {
        'contraindication-identified': 'contraindication',
        'eligibility-factors-present': 'present',
        'eligibility-factors-mixed':   'mixed',
        'eligibility-factors-not-met': 'not-met'
    };

    var MRS_TIER_CUTOFFS = {
        NONE_MAX:     4,
        MILD_MAX:     8,
        MODERATE_MAX: 16
    };

    var RED_FLAG_MIN = 3;

    function clampMrsValue(v) {
        if (typeof v !== 'number' || isNaN(v)) return 0;
        if (v < MRS_VALUE_MIN) return MRS_VALUE_MIN;
        if (v > MRS_VALUE_MAX) return MRS_VALUE_MAX;
        return Math.floor(v);
    }

    function sumMrs(mrs) {
        if (!Array.isArray(mrs)) return 0;
        var total = 0;
        for (var i = 0; i < MRS_ITEM_COUNT; i++) {
            total += clampMrsValue(mrs[i]);
        }
        return total;
    }

    // Number.isFinite rejects NaN AND ±Infinity. A plain typeof check
    // would let NaN through (typeof NaN === 'number') and every <=
    // comparison would fail, returning 'severe' on corrupted state —
    // exactly the wrong direction for a clinical screener.
    function mrsTier(score) {
        if (!Number.isFinite(score) || score < 0) return 'none';
        if (score <= MRS_TIER_CUTOFFS.NONE_MAX) return 'none';
        if (score <= MRS_TIER_CUTOFFS.MILD_MAX) return 'mild';
        if (score <= MRS_TIER_CUTOFFS.MODERATE_MAX) return 'moderate';
        return 'severe';
    }

    function hasRedFlag(mrs) {
        if (!Array.isArray(mrs)) return false;
        var palpitations = clampMrsValue(mrs[MRS_INDEX.Q4_PALPITATIONS]);
        var anxiety = clampMrsValue(mrs[MRS_INDEX.Q8_ANXIETY]);
        return palpitations >= RED_FLAG_MIN && anxiety >= RED_FLAG_MIN;
    }

    function hasHrtContraindication(contraindications) {
        if (!Array.isArray(contraindications)) return false;
        return contraindications.length > 0;
    }

    function scorePerimenopause(s) {
        var mrs = s && s.mrs;
        var contraindications = s && s.contraindications;

        var mrsScore = sumMrs(mrs);
        var tier = mrsTier(mrsScore);
        var redFlag = hasRedFlag(mrs);
        var contraindication = hasHrtContraindication(contraindications);

        var internalTier;
        if (contraindication) {
            internalTier = 'contraindication-identified';
        } else if (tier === 'severe' || tier === 'moderate') {
            internalTier = 'eligibility-factors-present';
        } else if (tier === 'mild') {
            internalTier = 'eligibility-factors-mixed';
        } else {
            internalTier = 'eligibility-factors-not-met';
        }

        var stateCode = s && typeof s.stateCode === 'string'
            ? s.stateCode.toUpperCase()
            : '';

        return {
            mrsScore: mrsScore,
            mrsTier: tier,
            hasHrtContraindication: contraindication,
            hasRedFlag: redFlag,
            internalTier: internalTier,
            internalTierLabel: INTERNAL_TIER_LABELS[internalTier],
            resultSlug: RESULT_SLUGS[internalTier],
            outOfState: stateCode !== 'IL'
        };
    }

    // ── Screen Constants ─────────────────────────────────────────────
    // The 11 MRS items render as 11 sequential numbered q-N screens.
    // INTERSTITIAL_REDFLAG is conditional — only shown when hasRedFlag(state.mrs)
    // returns true after the HISTORY screen.

    var SCREEN = {
        WELCOME:             0,
        AGE_GATE:            1,
        AGE_BLOCK:           2,
        AGE:                 3,
        CYCLE:               4,
        MRS_Q3:              5,
        MRS_Q4:              6,
        MRS_Q5:              7,
        MRS_Q6:              8,
        MRS_Q7:              9,
        MRS_Q8:             10,
        MRS_Q9:             11,
        MRS_Q10:            12,
        MRS_Q11:            13,
        MRS_Q12:            14,
        MRS_Q13:            15,
        HISTORY:            16,
        INTERSTITIAL_REDFLAG: 17,
        STATE:              18,
        ACK:                19,
        CALCULATING:        20,
        RESULTS:            21
    };

    // Short, neutral labels that pass the HEALTH_TERMS allowlist on
    // /.netlify/functions/quiz-event. No clinical jargon, no "menopause",
    // no severity words. These strings are the ONLY thing sent in analytics.
    var SCREEN_LABEL = {};
    SCREEN_LABEL[SCREEN.WELCOME]               = 'welcome';
    SCREEN_LABEL[SCREEN.AGE_GATE]              = 'age-gate';
    SCREEN_LABEL[SCREEN.AGE_BLOCK]             = 'age-block';
    SCREEN_LABEL[SCREEN.AGE]                   = 'age';
    SCREEN_LABEL[SCREEN.CYCLE]                 = 'cycle';
    SCREEN_LABEL[SCREEN.MRS_Q3]                = 'q-3';
    SCREEN_LABEL[SCREEN.MRS_Q4]                = 'q-4';
    SCREEN_LABEL[SCREEN.MRS_Q5]                = 'q-5';
    SCREEN_LABEL[SCREEN.MRS_Q6]                = 'q-6';
    SCREEN_LABEL[SCREEN.MRS_Q7]                = 'q-7';
    SCREEN_LABEL[SCREEN.MRS_Q8]                = 'q-8';
    SCREEN_LABEL[SCREEN.MRS_Q9]                = 'q-9';
    SCREEN_LABEL[SCREEN.MRS_Q10]               = 'q-10';
    SCREEN_LABEL[SCREEN.MRS_Q11]               = 'q-11';
    SCREEN_LABEL[SCREEN.MRS_Q12]               = 'q-12';
    SCREEN_LABEL[SCREEN.MRS_Q13]               = 'q-13';
    SCREEN_LABEL[SCREEN.HISTORY]               = 'history';
    SCREEN_LABEL[SCREEN.INTERSTITIAL_REDFLAG]  = 'interstitial';
    SCREEN_LABEL[SCREEN.STATE]                 = 'state';
    SCREEN_LABEL[SCREEN.ACK]                   = 'ack';
    SCREEN_LABEL[SCREEN.CALCULATING]           = 'calc';
    SCREEN_LABEL[SCREEN.RESULTS]               = 'results';

    // ── Option Data ──────────────────────────────────────────────────

    var ageGateOptions = [
        { label: 'Yes, I am 18 or older', key: 'yes' },
        { label: 'No',                    key: 'no' }
    ];

    // Cycle / menstrual status — keys match MENSTRUAL_STATUS_VALUES exactly.
    var cycleOptions = [
        { label: 'I have regular cycles',                                                key: 'regular' },
        { label: 'My cycles are irregular',                                              key: 'irregular' },
        { label: 'It has been less than 12 months since my last period',                 key: 'less-than-12-months-since-lmp' },
        { label: 'It has been 12 or more months since my last period (postmenopausal)',  key: '12-or-more-months-since-lmp' },
        { label: 'I had a hysterectomy with my ovaries preserved',                       key: 'hyst-with-ovaries' },
        { label: 'I had a hysterectomy with my ovaries removed (oophorectomy)',          key: 'hyst-with-oophorectomy' },
        { label: 'I am currently using hormonal contraception or HRT',                   key: 'on-hormonal-contraception-or-hrt' }
    ];

    // Severity scale for the 11 MRS items. Neutral labels (not the spec
    // "None / Mild / Moderate / Severe / Extreme") to avoid leaking severity
    // language into the page text and analytics.
    var severityOptions = [
        { label: 'Not at all (0)',     key: '0' },
        { label: 'A little (1)',       key: '1' },
        { label: 'Some (2)',           key: '2' },
        { label: 'A lot (3)',          key: '3' },
        { label: 'All the time (4)',   key: '4' }
    ];

    // 11 MRS items — index, prompt, and (if relevant) red-flag tag. The
    // prompts go through to the patient as headlines on each q-N screen.
    var mrsItems = [
        { idx: 0,  screen: 5,  prompt: 'How often do you experience hot flushes or sweating?' },
        { idx: 1,  screen: 6,  prompt: 'How often do you experience heart palpitations or a racing heart?' },
        { idx: 2,  screen: 7,  prompt: 'How often do you have sleep problems?' },
        { idx: 3,  screen: 8,  prompt: 'How often do you feel depressive mood or low mood?' },
        { idx: 4,  screen: 9,  prompt: 'How often do you feel irritable?' },
        { idx: 5,  screen: 10, prompt: 'How often do you feel anxious?' },
        { idx: 6,  screen: 11, prompt: 'How often do you experience physical and mental exhaustion (memory, concentration)?' },
        { idx: 7,  screen: 12, prompt: 'How often do you experience changes in sexual desire or libido?' },
        { idx: 8,  screen: 13, prompt: 'How often do you experience bladder problems (incontinence, urgency, frequency)?' },
        { idx: 9,  screen: 14, prompt: 'How often do you experience vaginal dryness?' },
        { idx: 10, screen: 15, prompt: 'How often do you experience joint and muscular discomfort?' }
    ];

    // Contraindication multi-check options (HISTORY screen). Keys are short
    // enums — safe to include in the submit payload's `contraindicationCategories`.
    var contraindicationOptions = [
        { label: 'History of blood clots, DVT, or PE',                                         key: 'clots' },
        { label: 'Personal history of breast, endometrial, or ovarian cancer',                 key: 'cancer' },
        { label: 'Severe liver disease or hepatic impairment',                                 key: 'liver' },
        { label: 'Recent stroke or TIA within the past 12 months',                             key: 'stroke' },
        { label: 'Coronary artery disease or prior heart attack',                              key: 'cardiac' },
        { label: 'Uncontrolled high blood pressure (over 160/100)',                            key: 'htn' },
        { label: 'Migraine with visual aura',                                                  key: 'migraine-aura' },
        { label: 'Unexplained vaginal bleeding in the past 12 months',                         key: 'unexplained-bleeding' },
        { label: 'Currently pregnant or trying to become pregnant',                            key: 'pregnancy' },
        { label: 'Or any other condition you\'ve been told affects hormone or estrogen-based therapy', key: 'other' }
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
        'Tabulating MRS symptom score...',
        'Comparing to validated tier cutoffs...',
        'Checking safety screen...',
        'Preparing your result summary...',
        'Finalizing your result...'
    ];

    // ── Universal Disclaimers (verbatim from spec) ───────────────────

    var RESULT_DISCLAIMER = 'This is a screening tool, not a clinical diagnosis. Only a clinician can confirm whether your symptoms are due to perimenopause, menopause, or another cause. Your provider can determine whether further workup, hormone testing, or treatment is appropriate based on your full clinical picture.';

    // The universal footer disclaimer is rendered by the static HTML below
    // the quiz mount in /quiz/perimenopause/index.html. It is NOT duplicated
    // by this engine — the static placement is canonical and is always
    // visible because the quiz is inline (not modal). Mirrors bone-density.

    var AUTHOR_ATTRIBUTION = 'Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC. This review is of the tool, not of your individual responses. You have not been examined or treated by Moonshot Medical.';

    // Red-flag interstitial copy (verbatim from spec). Surfaces between the
    // HISTORY screen and the STATE screen if Q4 ≥3 AND Q8 ≥3.
    var REDFLAG_INTERSTITIAL_COPY = 'palpitations combined with anxiety can have causes beyond hormonal change &mdash; including thyroid disease, cardiac arrhythmias (paroxysmal atrial fibrillation), or other conditions. These need to be ruled out before assuming a perimenopausal explanation. If your palpitations are severe, sudden, or accompanied by chest pain, shortness of breath, or fainting &mdash; please see your primary care physician or an emergency department. Click below to continue with the screening result, but please raise these symptoms specifically with a clinician.';

    // ── State ────────────────────────────────────────────────────────

    // Field names match scoring.js EXACTLY. Do not rename without also
    // changing the scoring module and its Vitest suite.
    var state = {
        currentScreen: 0,
        ageGate: null,                  // 'yes' | 'no'
        age: null,                       // number
        menstrualStatus: null,           // string in MENSTRUAL_STATUS_VALUES
        mrs: [null, null, null, null, null, null, null, null, null, null, null], // 0..4 each
        contraindications: [],           // string[] (subset of contraindication keys)
        contraindicationsNoneSelected: false, // UI flag — true if user explicitly picked "None of these"
        stateCode: '',                    // 'IL' | 'CA' | ...
        ackTimestamp: null,                // ISO string set on Ack-screen continue
        redFlagAckTimestamp: null,         // ISO string set on red-flag interstitial continue
        name: '',
        email: '',
        phone: '',
        marketingOptIn: false,
        emailOptIn: false
    };

    var root = document.getElementById('quiz-root');
    var progressBar = document.getElementById('quiz-progress-bar');

    // ── State Persistence ────────────────────────────────────────────

    var STORAGE_KEY = 'mmp_perimenopause_quiz_state';
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
    // the browser via analytics. quiz-event.js rejects HEALTH_TERMS — our
    // screen labels are pre-checked to avoid those substrings.

    function ga(eventName, screenIndex) {
        // Allowed events (must match ALLOWED_EVENTS in quiz-event.js):
        //   quiz_start, screen_advance, quiz_back, quiz_retake,
        //   quiz_email_submit, quiz_results_view, quiz_cta_click
        if (!eventName) return;
        var screenLabel = null;
        if (typeof screenIndex === 'number' && SCREEN_LABEL[screenIndex]) {
            screenLabel = SCREEN_LABEL[screenIndex];
        } else if (typeof screenIndex === 'string') {
            screenLabel = screenIndex;
        }
        var payload = {
            quiz: 'perimenopause',
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

    // Build the ordered list of screens the current user will see. The
    // INTERSTITIAL_REDFLAG screen is included only if hasRedFlag(state.mrs)
    // returns true at the time the user is past the HISTORY screen — but we
    // always include it in the order conditionally so the progress bar
    // denominator reflects the user's actual remaining path.
    function activeScreenOrder() {
        var order = [
            SCREEN.WELCOME, SCREEN.AGE_GATE, SCREEN.AGE, SCREEN.CYCLE,
            SCREEN.MRS_Q3, SCREEN.MRS_Q4, SCREEN.MRS_Q5, SCREEN.MRS_Q6,
            SCREEN.MRS_Q7, SCREEN.MRS_Q8, SCREEN.MRS_Q9, SCREEN.MRS_Q10,
            SCREEN.MRS_Q11, SCREEN.MRS_Q12, SCREEN.MRS_Q13,
            SCREEN.HISTORY
        ];
        if (hasRedFlag(state.mrs)) {
            order.push(SCREEN.INTERSTITIAL_REDFLAG);
        }
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
                // Scroll the quiz mount into view rather than window top —
                // the static page has H1 + byline above #quiz-root and a
                // window-top scroll hides the new active screen below them.
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
            backBtn = '<button type="button" class="quiz-back-btn text-brand-gray/60 hover:text-brand-light text-sm flex items-center gap-1 mb-6 transition-colors" data-back="true">' +
                '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>' +
                'Back</button>';
        }
        var screenHeadingId = 'screen-' + index + '-heading';
        return '<div class="quiz-screen flex items-center justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + index + '" role="group" aria-labelledby="' + screenHeadingId + '">' +
            '<div class="max-w-2xl w-full">' + backBtn + inner + '</div></div>';
    }

    // ── Screen Builders ──────────────────────────────────────────────

    function buildWelcome() {
        return screenWrap(SCREEN.WELCOME,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-6">Free Perimenopause Screener</p>' +
                '<h2 id="screen-' + SCREEN.WELCOME + '-heading" class="text-4xl md:text-5xl font-bold text-brand-light mb-6 font-heading">Are my symptoms perimenopause?</h2>' +
                '<p class="text-brand-gray text-lg font-light mb-10 max-w-lg mx-auto">A 3-minute screener built on the Menopause Rating Scale &mdash; a public-domain validated instrument &mdash; to help you decide whether a clinical evaluation is worth your time. Reviewed by a Doctor of Nursing Practice.</p>' +
                '<button type="button" id="quiz-start-btn" class="btn-primary text-lg px-10 py-4">Start the Screener</button>' +
                '<p class="text-brand-gray/50 text-xs mt-4">No account needed. Results are instant. We don\'t sell your data or share it with advertisers.</p>' +
                '<p class="text-brand-gray/60 text-xs mt-6">Created by the medical team at Moonshot Medical &mdash; a licensed clinic in Park Ridge, IL</p>' +
                '<p class="text-brand-gray/40 text-xs mt-2">For educational purposes only. Not medical advice.</p>' +
            '</div>'
        );
    }

    function buildAgeGate() {
        var btns = '';
        for (var i = 0; i < ageGateOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-age-gate="' + ageGateOptions[i].key + '">' + ageGateOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.AGE_GATE,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.AGE_GATE + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Are you 18 or older?</h2>' +
                '<p class="text-brand-gray font-light mb-10">This screener is only available to adults.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.AGE_GATE + '-heading" class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-age-gate-continue" class="btn-primary px-10 py-3" data-age-gate-continue="true" disabled>Continue</button></div>' +
            '</div>'
        );
    }

    function buildAgeBlock() {
        return screenWrap(SCREEN.AGE_BLOCK,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.AGE_BLOCK + '-heading" class="text-3xl font-bold text-brand-light mb-4 font-heading">This tool is only for adults</h2>' +
                '<p class="text-brand-gray font-light mb-6 max-w-lg mx-auto">This tool is only for users 18 or older. If you have questions about your symptoms, please speak with a parent, guardian, or pediatric clinician.</p>' +
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
                    '<input type="number" inputmode="numeric" id="quiz-age-input" min="18" max="100" step="1" required aria-required="true" placeholder="e.g. 47" aria-describedby="quiz-age-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg text-center">' +
                    '<p id="quiz-age-error" role="alert" class="text-red-500 text-xs mt-2 hidden">Please enter an age between 18 and 100.</p>' +
                    '<button type="button" id="quiz-age-continue" class="btn-primary w-full py-3 mt-6">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildCycle() {
        var btns = '';
        for (var i = 0; i < cycleOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-cycle="' + cycleOptions[i].key + '">' + cycleOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.CYCLE,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.CYCLE + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Which best describes your current cycle?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Pick the one that fits best. Your answer helps frame the result.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.CYCLE + '-heading" class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-cycle-continue" class="btn-primary px-10 py-3" data-cycle-continue="true" disabled>Continue</button></div>' +
            '</div>'
        );
    }

    // Generic single-select severity (0-4) screen for an MRS item. The
    // selected value is stored at state.mrs[mrsIndex]. Continue button is
    // required (no auto-advance, per WCAG 2.2.1 / Timing Adjustable).
    function buildMrsScreen(item) {
        var screenIndex = item.screen;
        var headingId = 'screen-' + screenIndex + '-heading';
        var dataAttr = 'mrs-' + item.idx;
        var btns = '';
        for (var i = 0; i < severityOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-' + dataAttr + '="' + severityOptions[i].key + '">' + severityOptions[i].label + '</button>';
        }
        return screenWrap(screenIndex,
            '<div class="text-center">' +
                '<h2 id="' + headingId + '" class="text-3xl font-bold text-brand-light mb-2 font-heading">' + item.prompt + '</h2>' +
                '<p class="text-brand-gray font-light mb-10">Choose the answer that best fits the past few weeks.</p>' +
                '<div role="radiogroup" aria-labelledby="' + headingId + '" class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" class="btn-primary px-10 py-3" data-' + dataAttr + '-continue="true" disabled>Continue</button></div>' +
            '</div>'
        );
    }

    // Multi-select with an exclusive "None of these" option. Continue
    // button is required (no auto-advance for multi-select).
    function buildHistory() {
        var dataAttr = 'hx';
        var headingId = 'screen-' + SCREEN.HISTORY + '-heading';
        var noneHintId = dataAttr + '-none-hint';
        var btns = '';
        for (var i = 0; i < contraindicationOptions.length; i++) {
            btns +=
                '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors">' +
                    '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '="' + contraindicationOptions[i].key + '" aria-describedby="' + dataAttr + '-help">' +
                    '<span>' + contraindicationOptions[i].label + '</span>' +
                '</label>';
        }
        // Exclusive "None of these" option — hint announced via aria-describedby.
        btns +=
            '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors mt-2">' +
                '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '-none="true" aria-describedby="' + noneHintId + '">' +
                '<span>None of these</span>' +
            '</label>' +
            '<span id="' + noneHintId + '" class="sr-only">Selecting None of these will clear all other selections.</span>';
        return screenWrap(SCREEN.HISTORY,
            '<div class="text-center">' +
                '<h2 id="' + headingId + '" class="text-3xl font-bold text-brand-light mb-2 font-heading">Do any of these apply to you?</h2>' +
                '<p id="' + dataAttr + '-help" class="text-brand-gray font-light mb-10">Select all that apply. This helps us flag situations that need careful clinical review before any hormone-based options are considered.</p>' +
                '<div role="group" aria-labelledby="' + headingId + '" class="flex flex-col gap-2 max-w-md mx-auto text-left">' + btns + '</div>' +
                '<div class="mt-8"><button type="button" id="quiz-hx-continue" class="btn-primary px-10 py-3" data-' + dataAttr + '-continue="true">Continue</button></div>' +
            '</div>'
        );
    }

    function buildInterstitialRedflag() {
        return screenWrap(SCREEN.INTERSTITIAL_REDFLAG,
            '<div class="text-left">' +
                '<div class="text-center mb-6">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-3">One important note</p>' +
                    '<h2 id="screen-' + SCREEN.INTERSTITIAL_REDFLAG + '-heading" class="text-2xl md:text-3xl font-bold text-brand-light mb-2 font-heading">Important: please read before continuing</h2>' +
                '</div>' +
                '<div class="border border-brand-gray/40 rounded-sm p-6 mb-6" style="background: rgba(178, 191, 190, 0.05)">' +
                    '<p class="text-brand-light font-light leading-relaxed"><strong class="text-brand-light">Important: ' + REDFLAG_INTERSTITIAL_COPY + '</strong></p>' +
                '</div>' +
                '<div class="text-center">' +
                    '<button type="button" id="quiz-redflag-continue" class="btn-primary px-10 py-3">I understand &mdash; continue</button>' +
                    '<p class="text-brand-gray/60 text-xs mt-4">By clicking Continue you confirm you have read this notice.</p>' +
                '</div>' +
            '</div>'
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
        html += buildCycle();
        for (var i = 0; i < mrsItems.length; i++) {
            html += buildMrsScreen(mrsItems[i]);
        }
        html += buildHistory();
        html += buildInterstitialRedflag();
        html += buildState();
        html += buildAck();
        html += buildCalculating();
        html += buildResultsShell();
        root.innerHTML = html;
    }

    // ── Navigation Helpers ───────────────────────────────────────────
    // Compute the "next" screen relative to the current position. The
    // INTERSTITIAL_REDFLAG screen is conditionally inserted between HISTORY
    // and STATE based on hasRedFlag(state.mrs). The order is taken from
    // activeScreenOrder() plus the calculating/results suffix.

    function nextScreenFrom(currentIndex) {
        var order = activeScreenOrder();
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
    // Attached once via delegation on the quiz root.
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
            var result = scorePerimenopause(state);
            renderResults(result);
            ga('quiz_results_view', SCREEN.RESULTS);
            show(SCREEN.RESULTS);
            if (progressBar) progressBar.style.width = '100%';
        });
    }

    // ── Results Renderer ─────────────────────────────────────────────

    function buildBookingHref(slug) {
        return '/booking/?source=perimenopause-quiz&severity=' + encodeURIComponent(slug);
    }

    // Tier-specific body copy. Verbatim from spec — do NOT paraphrase.
    // The contraindication overlay is appended (not replaced) when
    // hasHrtContraindication is true. Within eligibility-factors-present we
    // branch on mrsTier to differentiate severe (≥17) vs moderate (9-16) body.
    function tierBody(result) {
        var internalTier = result.internalTier;
        var heading = result.internalTierLabel;
        var body;
        var ctaLabel;
        var slug = result.resultSlug;

        if (internalTier === 'contraindication-identified') {
            // The contraindication branch wins regardless of MRS — patient
            // is routed to the contraindication path. Body covers safety.
            body = 'Your responses indicate medical history that requires careful clinical evaluation before any hormone-based therapy. Non-hormone-based evaluation paths exist and are part of what a consultation would cover. A clinician can review your full picture, order appropriate workup, and discuss options that fit your situation safely.';
            ctaLabel = 'Book a consultation';
        } else if (internalTier === 'eligibility-factors-present') {
            // Two body variants by mrsTier — severe vs moderate.
            if (result.mrsTier === 'severe') {
                body = 'Your responses indicate significant symptom burden in patterns associated with hormonal change. A clinical evaluation can clarify what\'s driving symptoms &mdash; there are several treatment paths including hormone-based and non-hormone-based options. We\'d recommend booking a consultation to review symptoms and order a comprehensive hormone panel.';
            } else {
                // moderate
                body = 'Your responses indicate moderate symptom burden consistent with patterns associated with perimenopausal or menopausal change. Several evaluation paths exist &mdash; comprehensive hormone testing, lifestyle interventions, targeted nutrition. A clinical evaluation can clarify what\'s right for you.';
            }
            ctaLabel = 'Book hormone consultation';
        } else if (internalTier === 'eligibility-factors-mixed') {
            body = 'Your symptom burden is mild. Many people in your range benefit from lifestyle and nutritional foundations before considering hormone-based options. If you\'d like a baseline panel for reference, a consultation can order one.';
            ctaLabel = 'Book a baseline consultation';
        } else {
            // eligibility-factors-not-met
            body = 'You\'re reporting few perimenopausal symptoms. If your concern is about future hormonal change, baseline hormone panels can help establish a reference point.';
            ctaLabel = 'Book a baseline consultation';
        }

        return {
            heading: heading,
            body: body,
            ctaLabel: ctaLabel,
            slug: slug
        };
    }

    // Contraindication overlay: appended to the result body when
    // hasHrtContraindication is true AND internalTier is NOT already
    // contraindication-identified. The contraindication-identified body
    // already covers this content.
    var CONTRAINDICATION_OVERLAY = '<strong>Note:</strong> Some of your responses indicate medical history that requires careful clinical evaluation before any hormone-based therapy. Non-hormone-based evaluation paths exist and are part of what a consultation would cover.';

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
            var copy = tierBody(result);

            html += '<div class="text-center mb-8">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Your Result</p>' +
                '<h2 id="screen-' + SCREEN.RESULTS + '-heading" class="text-3xl md:text-4xl font-bold text-brand-light mb-2 font-heading">' + copy.heading + '</h2>' +
                '<p class="text-brand-gray text-sm mt-2">Your MRS symptom score: <strong class="text-brand-light">' + result.mrsScore + '</strong></p>' +
            '</div>';

            html += '<div class="border border-brand-gray/40 rounded-sm p-8 mb-6" style="background: rgba(178, 191, 190, 0.05)">' +
                '<p class="text-brand-light font-light text-base leading-relaxed">' + copy.body + '</p>';
            // Append contraindication overlay if applicable AND not already
            // the contraindication-identified tier (which already covers it).
            if (result.hasHrtContraindication && result.internalTier !== 'contraindication-identified') {
                html += '<p class="text-brand-light font-light text-base leading-relaxed mt-4 pt-4 border-t border-brand-gray/20">' + CONTRAINDICATION_OVERLAY + '</p>';
            }
            html += '</div>';

            // CTA block
            html += '<div class="bg-brand-slate rounded-sm p-8 mb-6 text-center">' +
                '<h3 class="text-brand-light font-bold mb-4">YOUR NEXT STEP</h3>' +
                '<a href="' + buildBookingHref(copy.slug) + '" class="btn-primary text-lg px-10 py-4 inline-block quiz-cta" data-cta="' + copy.slug + '">' + copy.ctaLabel + '</a>' +
                '<p class="text-brand-gray/60 text-sm mt-4"><a href="tel:+12244354280" class="text-brand-light hover:underline quiz-cta" data-cta="phone">(224) 435-4280</a> if you\'d rather call</p>' +
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
                    '<div>' +
                        '<label for="quiz-name" class="block text-brand-gray text-xs uppercase tracking-widest mb-1 text-left">First name <span class="text-red-400" aria-hidden="true">*</span></label>' +
                        '<input type="text" id="quiz-name" required aria-required="true" maxlength="80" placeholder="First name" autocomplete="given-name" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '</div>' +
                    '<div>' +
                        '<label for="quiz-email" class="block text-brand-gray text-xs uppercase tracking-widest mb-1 text-left">Email <span class="text-red-400" aria-hidden="true">*</span></label>' +
                        '<input type="email" id="quiz-email" required aria-required="true" maxlength="254" placeholder="you@example.com" autocomplete="email" aria-describedby="quiz-email-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '</div>' +
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

        // Update URL for sharing — only the result slug, not the full state.
        if (window.history && window.history.replaceState) {
            try {
                var validSlug = result.resultSlug && /^(contraindication|present|mixed|not-met)$/.test(result.resultSlug);
                if (validSlug) {
                    window.history.replaceState(null, '', '/quiz/perimenopause/?r=' + result.resultSlug);
                }
            } catch (e) { /* ignore */ }
        }

        // Update OG meta
        try {
            var metaTitle = document.querySelector('meta[property="og:title"]');
            var metaDesc = document.querySelector('meta[property="og:description"]');
            if (metaTitle) metaTitle.setAttribute('content', 'My Perimenopause Screener Result | Moonshot Medical');
            if (metaDesc) metaDesc.setAttribute('content', 'Take the free 3-minute screener to find out whether your symptoms warrant a clinical evaluation.');
        } catch (e) { /* ignore */ }

        bindResultsHandlers();

        // Clear PII from in-memory state after the result has rendered. The
        // email opt-in form below reads directly from input.value, so it
        // captures fresh input — these zeroed fields don't break it. This
        // protects shared-device users from seeing prefilled fields if they
        // hit Retake. Saved state was already cleared on email submit; this
        // covers the case where the result was rendered without submitting.
        state.name = '';
        state.email = '';
        state.phone = '';
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
        // Hide submit button to prevent duplicate sends, then clear saved
        // state so retake / fresh visit doesn't pre-fill from this submit.
        var submitBtn = document.getElementById('quiz-submit-info');
        if (submitBtn) submitBtn.setAttribute('disabled', 'disabled');
        clearSavedState();
    }

    // ── Email submission ─────────────────────────────────────────────
    // Compact payload — counts and sanitized enums only for multi-check
    // fields, NEVER raw symptom values or individual MRS item scores.
    function sendResults() {
        var result = scorePerimenopause(state);

        var payload = {
            name: state.name || null,
            email: state.email,
            phone: state.phone || null,
            marketingOptIn: !!state.marketingOptIn,
            result: {
                internalTier: result.internalTier,
                internalTierLabel: result.internalTierLabel,
                mrsScore: result.mrsScore,
                mrsTier: result.mrsTier,
                hasHrtContraindication: result.hasHrtContraindication,
                hasRedFlag: result.hasRedFlag,
                resultSlug: result.resultSlug
            },
            profile: {
                age: state.age,
                menstrualStatus: state.menstrualStatus,
                mrsScore: result.mrsScore,
                mrsTier: result.mrsTier,
                contraindicationCount: Array.isArray(state.contraindications) ? state.contraindications.length : 0,
                // Send sanitized keys only (short enum strings — safe).
                // Never send the human-readable contraindication labels.
                contraindicationCategories: Array.isArray(state.contraindications) ? state.contraindications.slice() : [],
                stateCode: state.stateCode
            },
            ackTimestamp: state.ackTimestamp,
            redFlagAckTimestamp: state.redFlagAckTimestamp
        };

        // Attach upstream marketing attribution (utm_*, gclid, fbclid,
        // landing_page, last_page, referrer) — forwarded to the EHR lead webhook.
        try {
            payload.attribution = (window.MoonshotAttribution && typeof window.MoonshotAttribution.getFlat === 'function')
                ? window.MoonshotAttribution.getFlat()
                : null;
        } catch (_a) { payload.attribution = null; }

        try {
            fetch('/.netlify/functions/perimenopause-quiz-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function() { /* fire-and-forget */ });
        } catch (e) { /* ignore */ }
    }

    // ── Shared Result View (?r=contraindication|present|mixed|not-met) ─

    function showSharedResult(slug) {
        if (!/^(contraindication|present|mixed|not-met)$/.test(slug)) return;
        // Reverse-map slug → internalTier for the renderer.
        var slugToTier = {
            'contraindication': 'contraindication-identified',
            'present':          'eligibility-factors-present',
            'mixed':            'eligibility-factors-mixed',
            'not-met':          'eligibility-factors-not-met'
        };
        var internalTier = slugToTier[slug];
        // Build a synthetic result object for the renderer. We don't have
        // the original MRS score, so display copy only. For the "present"
        // tier we default to the moderate body variant (less alarmist
        // than severe when shared out of context).
        var fakeResult = {
            internalTier: internalTier,
            internalTierLabel: INTERNAL_TIER_LABELS[internalTier],
            resultSlug: slug,
            mrsScore: 0,
            mrsTier: internalTier === 'eligibility-factors-present' ? 'moderate' : 'none',
            hasHrtContraindication: internalTier === 'contraindication-identified',
            hasRedFlag: false,
            outOfState: false
        };
        var copy = tierBody(fakeResult);

        var html = '<div class="flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12">' +
            '<div class="max-w-2xl w-full">' +
                '<div class="text-center mb-8">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Shared Screener Result</p>' +
                    '<h2 class="text-3xl font-bold text-brand-light mb-4 font-heading">Shared screener result &mdash; ' + copy.heading + '</h2>' +
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
                    window.history.replaceState(null, '', '/quiz/perimenopause/');
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

            // Cycle / menstrual status
            var cycleBtn = target.closest('[data-cycle]');
            if (cycleBtn) {
                state.menstrualStatus = cycleBtn.getAttribute('data-cycle');
                selectRadio('cycle', state.menstrualStatus);
                return;
            }
            var cycleCont = target.closest('#quiz-cycle-continue');
            if (cycleCont && state.menstrualStatus) {
                advanceFrom(SCREEN.CYCLE);
                return;
            }

            // ── 11 MRS items: data-mrs-N="0..4" (radio cards) ──────────
            // Loop check — find any data-mrs-{idx} attribute on the closest
            // button. Storing the value as an integer 0-4 in state.mrs[idx].
            for (var mi = 0; mi < mrsItems.length; mi++) {
                var attr = 'mrs-' + mi;
                var mrsBtn = target.closest('[data-' + attr + ']');
                if (mrsBtn) {
                    var rawVal = mrsBtn.getAttribute('data-' + attr);
                    var n = parseInt(rawVal, 10);
                    if (!isNaN(n) && n >= 0 && n <= 4) {
                        state.mrs[mi] = n;
                        selectRadio(attr, rawVal);
                        saveState();
                    }
                    return;
                }
                var mrsCont = target.closest('[data-' + attr + '-continue]');
                if (mrsCont && typeof state.mrs[mi] === 'number') {
                    advanceFrom(mrsItems[mi].screen);
                    return;
                }
            }

            // ── History (multi-check) Continue ─────────────────────────
            if (target.closest('[data-hx-continue]')) {
                if (state.currentScreen === SCREEN.HISTORY) {
                    // Recompute progress (because the next-screen path may
                    // include the red-flag interstitial now).
                    updateProgress();
                    advanceFrom(SCREEN.HISTORY);
                }
                return;
            }

            // Red-flag interstitial Continue
            if (target.closest('#quiz-redflag-continue')) {
                state.redFlagAckTimestamp = new Date().toISOString();
                saveState();
                advanceFrom(SCREEN.INTERSTITIAL_REDFLAG);
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

            // Contraindications
            var hxKey = t.getAttribute('data-hx');
            if (hxKey != null) {
                handleMultiCheck(state.contraindications, hxKey, t.checked, 'hx');
                state.contraindicationsNoneSelected = false;
                return;
            }
            if (t.getAttribute('data-hx-none') === 'true') {
                handleNoneOf(state.contraindications, t.checked, 'hx');
                state.contraindicationsNoneSelected = !!t.checked;
                return;
            }
        });

        // ── Age screen ────────────────────────────────────────────────
        bindAgeScreen();
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
        state.menstrualStatus = null;
        state.mrs = [null, null, null, null, null, null, null, null, null, null, null];
        state.contraindications = [];
        state.contraindicationsNoneSelected = false;
        state.stateCode = '';
        state.ackTimestamp = null;
        state.redFlagAckTimestamp = null;
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
    var ENUM_CYCLE = MENSTRUAL_STATUS_VALUES;
    var ENUM_CONTRAINDICATION = {
        'clots': 1, 'cancer': 1, 'liver': 1, 'stroke': 1, 'cardiac': 1,
        'htn': 1, 'migraine-aura': 1, 'unexplained-bleeding': 1,
        'pregnancy': 1, 'other': 1
    };

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

    // Validate a saved mrs array — must be 11 entries of integer 0-4 or null.
    // Anything else for a slot is reset to null.
    function pickMrsArray(saved) {
        var out = [null, null, null, null, null, null, null, null, null, null, null];
        if (!Array.isArray(saved)) return out;
        for (var i = 0; i < MRS_ITEM_COUNT; i++) {
            var v = saved[i];
            if (typeof v === 'number' && !isNaN(v) && v >= 0 && v <= 4 && Math.floor(v) === v) {
                out[i] = v;
            }
        }
        return out;
    }

    // Validate a saved contraindications array — keep only allowlisted keys.
    function pickContraindicationArray(saved) {
        if (!Array.isArray(saved)) return [];
        var out = [];
        for (var i = 0; i < saved.length; i++) {
            var v = saved[i];
            if (typeof v === 'string' &&
                Object.prototype.hasOwnProperty.call(ENUM_CONTRAINDICATION, v)) {
                out.push(v);
            }
        }
        return out;
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
        state.age = (Number.isFinite(saved.age) && saved.age >= 18 && saved.age <= 100) ? saved.age : null;
        state.menstrualStatus = pickEnum(saved.menstrualStatus, ENUM_CYCLE, null);
        state.mrs = pickMrsArray(saved.mrs);
        state.contraindications = pickContraindicationArray(saved.contraindications);
        state.contraindicationsNoneSelected = !!saved.contraindicationsNoneSelected;
        // stateCode: must match /^[A-Z]{2}$/ (case-insensitive, normalized up).
        state.stateCode = (typeof saved.stateCode === 'string' && /^[A-Za-z]{2}$/.test(saved.stateCode))
            ? saved.stateCode.toUpperCase()
            : '';
        state.ackTimestamp = (typeof saved.ackTimestamp === 'string') ? saved.ackTimestamp : null;
        state.redFlagAckTimestamp = (typeof saved.redFlagAckTimestamp === 'string') ? saved.redFlagAckTimestamp : null;
        state.name = (typeof saved.name === 'string') ? saved.name : '';
        state.email = (typeof saved.email === 'string') ? saved.email : '';
        state.phone = (typeof saved.phone === 'string') ? saved.phone : '';
        state.marketingOptIn = !!saved.marketingOptIn;
        state.emailOptIn = !!saved.emailOptIn;

        // Rehydrate UI selections — single-select cards.
        if (state.ageGate) selectRadio('age-gate', state.ageGate);
        if (state.menstrualStatus) selectRadio('cycle', state.menstrualStatus);
        for (var mi = 0; mi < MRS_ITEM_COUNT; mi++) {
            if (typeof state.mrs[mi] === 'number') {
                selectRadio('mrs-' + mi, String(state.mrs[mi]));
            }
        }

        // Rehydrate inputs
        var ageInput = document.getElementById('quiz-age-input');
        if (ageInput && state.age != null) ageInput.value = String(state.age);
        var stateSel = document.getElementById('quiz-state-select');
        if (stateSel && state.stateCode) stateSel.value = state.stateCode;

        // Rehydrate multi-checks — escape attribute values to prevent any
        // hostile string from breaking out of the selector.
        if (state.contraindications.length) {
            for (var ci = 0; ci < state.contraindications.length; ci++) {
                var hxEl = root.querySelector('[data-hx="' + safeAttrEscape(state.contraindications[ci]) + '"]');
                if (hxEl) hxEl.checked = true;
            }
        } else if (state.contraindicationsNoneSelected) {
            var noneEl = root.querySelector('[data-hx-none="true"]');
            if (noneEl) noneEl.checked = true;
        }

        // Determine target screen — never restore directly to calculating or
        // results (the result is recomputed on demand). If saved currentScreen
        // is past the ack, send the user to the ack screen so they explicitly
        // re-acknowledge before re-rendering the result.
        var target = (typeof saved.currentScreen === 'number') ? saved.currentScreen : SCREEN.WELCOME;
        if (target === SCREEN.AGE_BLOCK || target === SCREEN.CALCULATING || target === SCREEN.RESULTS) {
            target = SCREEN.ACK;
        }
        // Clamp into a valid index range [WELCOME .. ACK]. The
        // INTERSTITIAL_REDFLAG screen is only valid if hasRedFlag(state.mrs)
        // — if the saved screen is the interstitial but the user's MRS doesn't
        // currently trigger it, snap them back to HISTORY.
        if (target < SCREEN.WELCOME) target = SCREEN.WELCOME;
        if (target > SCREEN.ACK) target = SCREEN.ACK;
        if (target === SCREEN.INTERSTITIAL_REDFLAG && !hasRedFlag(state.mrs)) {
            target = SCREEN.HISTORY;
        }
        show(target);
    }

    // ── Init ─────────────────────────────────────────────────────────

    function init() {
        if (!root) return;

        // Shared result URL: /quiz/perimenopause/?r=contraindication|present|mixed|not-met
        try {
            var urlParams = new URLSearchParams(window.location.search);
            var sharedSlug = (urlParams.get('r') || '').trim().toLowerCase();
            if (sharedSlug && /^(contraindication|present|mixed|not-met)$/.test(sharedSlug)) {
                showSharedResult(sharedSlug);
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
