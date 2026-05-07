/*
 * Moonshot GLP-1 Readiness Screener — Quiz Engine
 * ================================================
 * Browser-side IIFE that runs the entire GLP-1 screening flow:
 * welcome → age-gate → demo (sex/age) → body (height/weight) → conditions
 * (comorbidity multi-check) → [ascvd numbers, conditional on high-cholesterol]
 * → attempts → history (8 hard-stops + None) → pregnancy → bariatric → other
 * (free-text catch-all) → readiness (1-5 Likert) → state → ack →
 * calculating → results.
 *
 * Scoring logic is INLINED from /quiz/glp1/scoring.js (the canonical pure
 * module). Both files MUST stay in sync — the Vitest suite pins the contract
 * on the scoring module; this engine reproduces it verbatim because the page
 * loads as a non-module script tag (no ESM imports).
 *
 * Output contract (must match scoring.js exactly):
 *   { bmi, hasComorbidity, hasMedicalHardStop, hasPregnancyHardStop,
 *     hasOtherConditionHardStop, hasBariatricModifier, bmiMeetsThreshold,
 *     bmiBorderline, bmiBelowThreshold, priorAttemptYes, readinessAdequate,
 *     internalTier, internalTierLabel, resultSlug, outOfState }
 *
 * Privacy / first-party analytics:
 *   Health values NEVER leave the browser as analytics. The ga() shim only
 *   forwards generic funnel events to /.netlify/functions/quiz-event with
 *   the strict 4-field contract { quiz: 'glp1', event, screen, timestamp }.
 *   Health data flows through /.netlify/functions/glp1-quiz-submit for the
 *   email and CRM pipeline only. Screen labels are pre-checked against
 *   HEALTH_TERMS — none of our labels (welcome, age-gate, age-block, demo,
 *   body, conditions, ascvd, attempts, history, pregnancy, bariatric,
 *   other, readiness, state, ack, calc, results) contain any forbidden
 *   substrings.
 *
 * Compliance rails (NEVER violate these):
 *   - Never name specific GLP-1 drugs in result output. Banned terms:
 *     semaglutide, tirzepatide, Wegovy, Ozempic, Zepbound, Mounjaro,
 *     Saxenda, Victoza, Trulicity, Rybelsus.
 *   - Never claim "you qualify for [drug]" — only a clinician determines
 *     candidacy after a comprehensive in-person evaluation.
 *   - Never claim "compounded versions are equivalent to FDA-approved".
 *     Moonshot does not market or sell compounded substitutes.
 *   - Never use "Strong candidate" / "Possible candidate" / "Likely
 *     candidate" — neutral guardrail labels only.
 *   - Never give specific dose recommendations or cost figures.
 *   - Tier labels are the five neutral strings from INTERNAL_TIER_LABELS.
 *   - Acknowledgement screen is a real click-through, timestamped.
 *   - Email capture comes AFTER the result; never gates the result.
 *   - Out-of-state users receive an IL-only message in place of the result.
 *   - Age-gate "No" terminates the quiz with a permanent block screen.
 *   - Free-text "other condition" catch-all triggers contraindication on
 *     any non-empty trimmed string (universal guardrail #9).
 */
(function() {
    'use strict';

    // ── Inlined Scoring Logic (mirror of scoring.js) ─────────────────
    // If scoring.js changes, update both files together. Vitest pins the
    // canonical module — keep this section identical in behavior.

    // 8 hard-stop medical history keys — any single one routes to
    // contraindication-identified. Drawn from FDA labeling + REMS-style
    // warnings.
    var HARD_STOP_MEDICAL = {
        'mtc-or-men2': 1,
        'pancreatitis': 1,
        'severe-gastroparesis': 1,
        't1d': 1,
        'eating-disorder': 1,
        'suicidal-ideation-or-recent-psych-hospitalization': 1,
        'severe-esrd': 1,
        'severe-diabetic-retinopathy-on-insulin': 1
    };

    // Allowlist for medical-history multi-check (validation only). 'none'
    // means user explicitly checked None of these.
    var MED_HISTORY_KEYS = {
        'mtc-or-men2': 1,
        'pancreatitis': 1,
        'severe-gastroparesis': 1,
        't1d': 1,
        'eating-disorder': 1,
        'suicidal-ideation-or-recent-psych-hospitalization': 1,
        'severe-esrd': 1,
        'severe-diabetic-retinopathy-on-insulin': 1,
        'none': 1
    };

    // Comorbidity keys for the BMI-≥27 weight-related condition path.
    // 'none' clears the others. Order matches FDA labeling.
    var COMORBIDITY_KEYS = {
        't2d-or-prediabetes': 1,
        'high-blood-pressure': 1,
        'high-cholesterol': 1,
        'sleep-apnea': 1,
        'pcos': 1,
        'nafld': 1,
        'cardiovascular-disease': 1,
        'none': 1
    };

    // The 7 weight-related comorbidities that satisfy FDA labeling's
    // "≥27 BMI with comorbidity" path. 'none' is excluded.
    var QUALIFYING_COMORBIDITIES = {
        't2d-or-prediabetes': 1,
        'high-blood-pressure': 1,
        'high-cholesterol': 1,
        'sleep-apnea': 1,
        'pcos': 1,
        'nafld': 1,
        'cardiovascular-disease': 1
    };

    var PRIOR_ATTEMPT_VALUES = { 'yes': 1, 'no': 1, 'prefer-not': 1 };

    var SEX_VALUES = { 'male': 1, 'female': 1, 'prefer-not': 1 };

    var INTERNAL_TIER_VALUES = {
        'contraindication-identified': 1,
        'specialist-evaluation': 1,
        'eligibility-not-met-bmi': 1,
        'eligibility-mixed': 1,
        'eligibility-present': 1
    };

    // Patient-facing tier labels — five neutral strings (guardrail #8).
    var INTERNAL_TIER_LABELS = {
        'contraindication-identified': 'Contraindication identified',
        'specialist-evaluation':       'Specialist evaluation indicated',
        'eligibility-not-met-bmi':     'Eligibility factors not met',
        'eligibility-mixed':           'Eligibility factors mixed',
        'eligibility-present':         'Eligibility factors present'
    };

    // Short URL-safe keys for booking CTA's ?result= param.
    var RESULT_SLUGS = {
        'contraindication-identified': 'contraindication',
        'specialist-evaluation':       'specialist',
        'eligibility-not-met-bmi':     'not-met',
        'eligibility-mixed':           'mixed',
        'eligibility-present':         'present'
    };

    // BMI thresholds drawn directly from FDA labeling for prescription
    // weight-management medications. Do NOT alter without re-citing the
    // current labeling.
    var BMI_THRESHOLD_OBESITY = 30;
    var BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY = 27;
    var READINESS_ADEQUATE_MIN = 3;

    var LBS_TO_KG = 0.45359237;
    var INCHES_TO_METERS = 0.0254;

    function computeBmi(s) {
        if (!s) return null;
        if (!Number.isFinite(s.heightInches) || s.heightInches <= 0) return null;
        if (!Number.isFinite(s.weightLbs) || s.weightLbs <= 0) return null;
        var meters = s.heightInches * INCHES_TO_METERS;
        var kg = s.weightLbs * LBS_TO_KG;
        return kg / (meters * meters);
    }

    function hasComorbidity(s) {
        if (!s || !Array.isArray(s.comorbidities)) return false;
        for (var i = 0; i < s.comorbidities.length; i++) {
            if (Object.prototype.hasOwnProperty.call(QUALIFYING_COMORBIDITIES, s.comorbidities[i])) return true;
        }
        return false;
    }

    function hasMedicalHardStop(s) {
        if (!s || !Array.isArray(s.medicalHistory)) return false;
        for (var i = 0; i < s.medicalHistory.length; i++) {
            if (Object.prototype.hasOwnProperty.call(HARD_STOP_MEDICAL, s.medicalHistory[i])) return true;
        }
        return false;
    }

    function hasPregnancyHardStop(s) {
        return !!(s && s.pregnancyOrPlanning === 'yes');
    }

    // Free-text catch-all from the OTHER screen. Any non-empty string after
    // trimming routes to contraindication. The catch-all exists per universal
    // guardrail #9 to defeat the implicit-warranty trap.
    function hasOtherConditionHardStop(s) {
        if (!s || typeof s.otherCondition !== 'string') return false;
        return s.otherCondition.trim().length > 0;
    }

    function hasBariatricModifier(s) {
        return !!(s && s.bariatricHistory === 'yes');
    }

    function priorAttemptYes(s) {
        return !!(s && s.priorAttempt === 'yes');
    }

    function readinessAdequate(s) {
        return !!(s &&
            Number.isFinite(s.readiness) &&
            s.readiness >= READINESS_ADEQUATE_MIN);
    }

    function bmiMeetsThreshold(s) {
        var bmi = computeBmi(s);
        if (bmi === null) return false;
        if (bmi >= BMI_THRESHOLD_OBESITY) return true;
        if (bmi >= BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY && hasComorbidity(s)) return true;
        return false;
    }

    function bmiBorderline(s) {
        var bmi = computeBmi(s);
        if (bmi === null) return false;
        if (bmi < BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY) return false;
        if (bmi >= BMI_THRESHOLD_OBESITY) return false;
        return !hasComorbidity(s);
    }

    function bmiBelowThreshold(s) {
        var bmi = computeBmi(s);
        if (bmi === null) return false;
        return bmi < BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY;
    }

    function scoreGlp1(s) {
        var bmi = computeBmi(s);
        var comorbidity = hasComorbidity(s);
        var medicalHardStop = hasMedicalHardStop(s);
        var pregnancyHardStop = hasPregnancyHardStop(s);
        var otherConditionHardStop = hasOtherConditionHardStop(s);
        var bariatricModifier = hasBariatricModifier(s);
        var meetsThreshold = bmiMeetsThreshold(s);
        var borderline = bmiBorderline(s);
        var belowThreshold = bmiBelowThreshold(s);
        var priorAttempt = priorAttemptYes(s);
        var readyEnough = readinessAdequate(s);

        var internalTier;
        if (medicalHardStop || pregnancyHardStop || otherConditionHardStop) {
            internalTier = 'contraindication-identified';
        } else if (bariatricModifier) {
            internalTier = 'specialist-evaluation';
        } else if (belowThreshold) {
            internalTier = 'eligibility-not-met-bmi';
        } else if (borderline) {
            internalTier = 'eligibility-mixed';
        } else if (meetsThreshold && priorAttempt && readyEnough) {
            internalTier = 'eligibility-present';
        } else if (meetsThreshold) {
            // BMI threshold met but missing prior-attempt OR readiness.
            internalTier = 'eligibility-mixed';
        } else {
            // BMI not computable / state incomplete — default to mixed
            // rather than present (safer when state is partial).
            internalTier = 'eligibility-mixed';
        }

        var stateCode = s && typeof s.stateCode === 'string'
            ? s.stateCode.toUpperCase()
            : '';

        return {
            bmi: bmi,
            hasComorbidity: comorbidity,
            hasMedicalHardStop: medicalHardStop,
            hasPregnancyHardStop: pregnancyHardStop,
            hasOtherConditionHardStop: otherConditionHardStop,
            hasBariatricModifier: bariatricModifier,
            bmiMeetsThreshold: meetsThreshold,
            bmiBorderline: borderline,
            bmiBelowThreshold: belowThreshold,
            priorAttemptYes: priorAttempt,
            readinessAdequate: readyEnough,
            internalTier: internalTier,
            internalTierLabel: INTERNAL_TIER_LABELS[internalTier],
            resultSlug: RESULT_SLUGS[internalTier],
            outOfState: stateCode !== 'IL'
        };
    }

    // ── Screen Constants ─────────────────────────────────────────────

    var SCREEN = {
        WELCOME:      0,
        AGE_GATE:     1,
        AGE_BLOCK:    2,
        DEMO:         3,
        BODY:         4,
        CONDITIONS:   5,
        ASCVD:        6,
        ATTEMPTS:     7,
        HISTORY:      8,
        PREGNANCY:    9,
        BARIATRIC:   10,
        OTHER:       11,
        READINESS:   12,
        STATE:       13,
        ACK:         14,
        CALCULATING: 15,
        RESULTS:     16
    };

    // Short, neutral labels that pass the HEALTH_TERMS allowlist on
    // /.netlify/functions/quiz-event. No clinical jargon, no severity
    // words. These strings are the ONLY thing sent in analytics.
    var SCREEN_LABEL = {};
    SCREEN_LABEL[SCREEN.WELCOME]     = 'welcome';
    SCREEN_LABEL[SCREEN.AGE_GATE]    = 'age-gate';
    SCREEN_LABEL[SCREEN.AGE_BLOCK]   = 'age-block';
    SCREEN_LABEL[SCREEN.DEMO]        = 'demo';
    SCREEN_LABEL[SCREEN.BODY]        = 'body';
    SCREEN_LABEL[SCREEN.CONDITIONS]  = 'conditions';
    SCREEN_LABEL[SCREEN.ASCVD]       = 'ascvd';
    SCREEN_LABEL[SCREEN.ATTEMPTS]    = 'attempts';
    SCREEN_LABEL[SCREEN.HISTORY]     = 'history';
    SCREEN_LABEL[SCREEN.PREGNANCY]   = 'pregnancy';
    SCREEN_LABEL[SCREEN.BARIATRIC]   = 'bariatric';
    SCREEN_LABEL[SCREEN.OTHER]       = 'other';
    SCREEN_LABEL[SCREEN.READINESS]   = 'readiness';
    SCREEN_LABEL[SCREEN.STATE]       = 'state';
    SCREEN_LABEL[SCREEN.ACK]         = 'ack';
    SCREEN_LABEL[SCREEN.CALCULATING] = 'calc';
    SCREEN_LABEL[SCREEN.RESULTS]     = 'results';

    // ── Option Data ──────────────────────────────────────────────────

    var ageGateOptions = [
        { label: 'Yes, I am 18 or older', key: 'yes' },
        { label: 'No',                    key: 'no' }
    ];

    // Sex radiogroup options.
    var sexOptions = [
        { label: 'Male',              key: 'male' },
        { label: 'Female',            key: 'female' },
        { label: 'Prefer not to say', key: 'prefer-not' }
    ];

    // Comorbidity multi-check options. Keys are short enums — safe to send
    // as `comorbidityCategories` in the submit payload. The 'none' option
    // is rendered separately as an exclusive choice.
    var comorbidityOptions = [
        { label: 'Type 2 diabetes or prediabetes',                                key: 't2d-or-prediabetes' },
        { label: 'High blood pressure',                                            key: 'high-blood-pressure' },
        { label: 'High cholesterol or triglycerides',                              key: 'high-cholesterol' },
        { label: 'Sleep apnea',                                                    key: 'sleep-apnea' },
        { label: 'Polycystic ovary syndrome (PCOS)',                               key: 'pcos' },
        { label: 'Fatty liver / NAFLD',                                            key: 'nafld' },
        { label: 'Cardiovascular disease (heart attack, stroke, etc.)',            key: 'cardiovascular-disease' }
    ];

    // Prior-attempt radiogroup options.
    var priorAttemptOptions = [
        { label: 'Yes',                key: 'yes' },
        { label: 'No',                 key: 'no' },
        { label: 'Prefer not to say',  key: 'prefer-not' }
    ];

    // Medical history multi-check options. Keys are short enums — safe to
    // include in submit payload's `medicalHistoryCategories`. The 'none'
    // option is rendered separately as an exclusive choice.
    var historyOptions = [
        { label: 'Personal or family history of medullary thyroid carcinoma or MEN2 syndrome',                  key: 'mtc-or-men2' },
        { label: 'Pancreatitis',                                                                                 key: 'pancreatitis' },
        { label: 'Severe gastroparesis or significant nausea/vomiting after meals',                              key: 'severe-gastroparesis' },
        { label: 'Type 1 diabetes',                                                                              key: 't1d' },
        { label: 'Active eating disorder (anorexia, bulimia, or binge-eating disorder under treatment)',         key: 'eating-disorder' },
        { label: 'Recent psychiatric hospitalization or current thoughts of self-harm',                          key: 'suicidal-ideation-or-recent-psych-hospitalization' },
        { label: 'Severe end-stage renal disease (eGFR less than 15, or on dialysis)',                           key: 'severe-esrd' },
        { label: 'Severe diabetic retinopathy and currently on insulin',                                         key: 'severe-diabetic-retinopathy-on-insulin' }
    ];

    // Pregnancy radiogroup options.
    var pregnancyOptions = [
        { label: 'Yes', key: 'yes' },
        { label: 'No',  key: 'no' }
    ];

    // Bariatric radiogroup options.
    var bariatricOptions = [
        { label: 'Yes', key: 'yes' },
        { label: 'No',  key: 'no' }
    ];

    // Readiness 1-5 Likert options.
    var readinessOptions = [
        { label: 'Not ready right now',          key: '1' },
        { label: 'Thinking about it',            key: '2' },
        { label: 'Preparing to start',           key: '3' },
        { label: 'Actively making changes',      key: '4' },
        { label: 'Already in a sustained routine', key: '5' }
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

    // Calculating animation steps. Six neutral steps. The single aria-live
    // <p> below the visual markers is updated as each marker activates,
    // so screen readers receive textContent changes.
    var calculatingSteps = [
        'Reviewing your responses...',
        'Calculating BMI and threshold checks...',
        'Comparing to FDA labeling expectations...',
        'Checking medical history flags...',
        'Cross-referencing safety screen...',
        'Preparing your result summary...'
    ];

    // ── Universal Disclaimers (verbatim from spec) ───────────────────

    // Result-page-specific disclaimer. NOTE this one is GLP-1-specific —
    // mentions compounding directly because the regulatory exposure on
    // compounded substitutes is unique to this category.
    var RESULT_DISCLAIMER = 'This is a screening tool, not a clinical diagnosis or prescription. We do not market or sell compounded versions of FDA-approved medications as substitutes for those products. Eligibility for any specific medication is determined by a licensed clinician after a comprehensive in-person evaluation.';

    // Author attribution — Missy-only (she has FPA; no collaborator clause).
    var AUTHOR_ATTRIBUTION = 'Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC. This review is of the tool, not of your individual responses. You have not been examined or treated by Moonshot Medical.';

    // ── State ────────────────────────────────────────────────────────

    // Field names match scoring.js EXACTLY. Do not rename without also
    // changing the scoring module and its Vitest suite.
    var state = {
        currentScreen: 0,
        ageGate: null,                  // 'yes' | 'no'
        // DEMO
        sex: null,                       // 'male' | 'female' | 'prefer-not'
        age: null,                       // number 18..100
        // BODY
        heightInches: null,              // number
        weightLbs: null,                 // number
        // CONDITIONS
        comorbidities: [],               // string[] (subset of COMORBIDITY_KEYS minus 'none')
        comorbiditiesNoneSelected: false,
        // ASCVD (only collected if 'high-cholesterol' in comorbidities)
        ascvd: { totalCholesterol: null, ldl: null, hdl: null },
        // ATTEMPTS
        priorAttempt: null,              // 'yes' | 'no' | 'prefer-not'
        // HISTORY (8 hard-stops + None)
        medicalHistory: [],              // string[] (subset of MED_HISTORY_KEYS minus 'none')
        medicalHistoryNoneSelected: false,
        // PREGNANCY / BARIATRIC
        pregnancyOrPlanning: null,       // 'yes' | 'no'
        bariatricHistory: null,          // 'yes' | 'no'
        // OTHER (free-text catch-all — non-empty triggers contraind)
        otherCondition: '',
        // READINESS
        readiness: null,                 // number 1..5
        // STATE / ACK
        stateCode: '',
        ackTimestamp: null,
        // PII (cleared on result render)
        name: '',
        email: '',
        phone: '',
        marketingOptIn: false,
        emailOptIn: false
    };

    var root = document.getElementById('quiz-root');
    var progressBar = document.getElementById('quiz-progress-bar');

    // ── State Persistence ────────────────────────────────────────────

    var STORAGE_KEY = 'mmp_glp1_quiz_state';
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
        if (!eventName) return;
        var screenLabel = null;
        if (typeof screenIndex === 'number' && SCREEN_LABEL[screenIndex]) {
            screenLabel = SCREEN_LABEL[screenIndex];
        } else if (typeof screenIndex === 'string') {
            screenLabel = screenIndex;
        }
        var payload = {
            quiz: 'glp1',
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

    // ── Progress Bar ─────────────────────────────────────────────────
    // The flow is mostly linear except the conditional ASCVD screen, which
    // is included in the order ONLY when the user checked 'high-cholesterol'
    // on the conditions screen.

    function activeScreenOrder() {
        var order = [
            SCREEN.WELCOME,
            SCREEN.AGE_GATE,
            SCREEN.DEMO,
            SCREEN.BODY,
            SCREEN.CONDITIONS
        ];
        if (Array.isArray(state.comorbidities) && state.comorbidities.indexOf('high-cholesterol') !== -1) {
            order.push(SCREEN.ASCVD);
        }
        order.push(SCREEN.ATTEMPTS);
        order.push(SCREEN.HISTORY);
        order.push(SCREEN.PREGNANCY);
        order.push(SCREEN.BARIATRIC);
        order.push(SCREEN.OTHER);
        order.push(SCREEN.READINESS);
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
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-6">Free Readiness Screener</p>' +
                '<h2 id="screen-' + SCREEN.WELCOME + '-heading" class="text-3xl md:text-4xl font-bold text-brand-light mb-6 font-heading">Am I a candidate for prescription weight-management?</h2>' +
                '<p class="text-brand-gray text-lg font-light mb-10 max-w-lg mx-auto">Takes about 2-3 minutes. Walks through BMI, qualifying weight-related conditions, an 8-category safety panel, and a short readiness check — the same eligibility framework a clinician uses — to help you decide whether a clinical evaluation is worth your time. Reviewed by a Doctor of Nursing Practice.</p>' +
                '<button type="button" id="quiz-start-btn" class="btn-primary text-lg px-10 py-4">Start the Screener</button>' +
                '<p class="text-brand-gray/50 text-xs mt-4">No account needed. Results are instant. We don\'t sell your data or share it with advertisers.</p>' +
                '<p class="text-brand-gray/60 text-xs mt-6">Created by the medical team at Moonshot Medical — a licensed clinic in Park Ridge, IL</p>' +
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
                '<div class="mt-6"><button type="button" id="quiz-age-gate-continue" class="btn-primary px-10 py-3" data-age-gate-continue="true" disabled aria-disabled="true">Continue</button></div>' +
            '</div>'
        );
    }

    function buildAgeBlock() {
        return screenWrap(SCREEN.AGE_BLOCK,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.AGE_BLOCK + '-heading" class="text-3xl font-bold text-brand-light mb-4 font-heading">This tool is only for adults</h2>' +
                '<p class="text-brand-gray font-light mb-6 max-w-lg mx-auto">This tool is only for users 18 or older. Pediatric and adolescent obesity care follows a different clinical framework with different eligibility criteria, dosing, and monitoring requirements. Please ask a parent or guardian to discuss next steps with your pediatrician.</p>' +
                '<p class="text-brand-gray/60 text-sm">You can return to <a href="/" class="text-brand-light underline">moonshotmp.com</a> any time.</p>' +
            '</div>'
        );
    }

    // DEMO screen — sex (radiogroup) + age (number input) on one screen.
    function buildDemo() {
        var sexBtns = '';
        for (var i = 0; i < sexOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            sexBtns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-sex="' + sexOptions[i].key + '">' + sexOptions[i].label + '</button>';
        }
        var sexHeadingId = 'demo-sex-heading';
        return screenWrap(SCREEN.DEMO,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.DEMO + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">A bit about you</h2>' +
                '<p class="text-brand-gray font-light mb-8">Sex and age provide clinical context for the screen.</p>' +
                '<div class="max-w-md mx-auto space-y-6 text-left">' +
                    '<div>' +
                        '<div id="' + sexHeadingId + '" class="text-brand-light font-medium mb-3">Sex assigned at birth <span class="text-red-400" aria-hidden="true">*</span></div>' +
                        '<div role="radiogroup" aria-labelledby="' + sexHeadingId + '" aria-describedby="quiz-demo-error" class="flex flex-col gap-3">' + sexBtns + '</div>' +
                    '</div>' +
                    '<div>' +
                        '<label for="quiz-age-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">Age in years <span class="text-red-400" aria-hidden="true">*</span></label>' +
                        '<input type="number" inputmode="numeric" id="quiz-age-input" min="18" max="100" step="1" required aria-required="true" placeholder="e.g. 45" aria-describedby="quiz-demo-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<p id="quiz-demo-error" role="alert" class="text-red-500 text-xs hidden">Please choose a sex and enter an age between 18 and 100.</p>' +
                    '<button type="button" id="quiz-demo-continue" class="btn-primary w-full py-3 mt-2">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    // BODY screen — height (inches) + weight (pounds) on one screen.
    function buildBody() {
        return screenWrap(SCREEN.BODY,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.BODY + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Height and weight</h2>' +
                '<p class="text-brand-gray font-light mb-8">We use these to compute BMI for the eligibility check.</p>' +
                '<div class="max-w-md mx-auto space-y-4 text-left">' +
                    '<div>' +
                        '<label for="quiz-height-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">Height in inches <span class="text-red-400" aria-hidden="true">*</span></label>' +
                        '<input type="number" inputmode="numeric" id="quiz-height-input" min="36" max="96" step="0.5" required aria-required="true" placeholder="e.g. 66" aria-describedby="quiz-body-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<div>' +
                        '<label for="quiz-weight-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">Weight in pounds <span class="text-red-400" aria-hidden="true">*</span></label>' +
                        '<input type="number" inputmode="numeric" id="quiz-weight-input" min="50" max="700" step="1" required aria-required="true" placeholder="e.g. 195" aria-describedby="quiz-body-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<p id="quiz-body-error" role="alert" class="text-red-500 text-xs mt-2 hidden">Please enter valid values for both fields.</p>' +
                    '<button type="button" id="quiz-body-continue" class="btn-primary w-full py-3 mt-4">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    // Multi-select with an exclusive "None of the above" option.
    function buildConditions() {
        var dataAttr = 'cond';
        var headingId = 'screen-' + SCREEN.CONDITIONS + '-heading';
        var noneHintId = dataAttr + '-none-hint';
        var btns = '';
        for (var i = 0; i < comorbidityOptions.length; i++) {
            btns +=
                '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors">' +
                    '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '="' + comorbidityOptions[i].key + '" aria-describedby="' + dataAttr + '-help">' +
                    '<span>' + comorbidityOptions[i].label + '</span>' +
                '</label>';
        }
        btns +=
            '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors mt-2">' +
                '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '-none="true" aria-describedby="' + noneHintId + '">' +
                '<span>None of the above</span>' +
            '</label>' +
            '<span id="' + noneHintId + '" class="sr-only">Selecting None of the above will clear all other selections.</span>';
        return screenWrap(SCREEN.CONDITIONS,
            '<div class="text-center">' +
                '<h2 id="' + headingId + '" class="text-3xl font-bold text-brand-light mb-2 font-heading">Do any of these apply to you?</h2>' +
                '<p id="' + dataAttr + '-help" class="text-brand-gray font-light mb-10">Select all that apply, or \'None of the above\'. Some weight-related conditions can lower the BMI threshold for clinical eligibility.</p>' +
                '<div aria-labelledby="' + headingId + '" class="flex flex-col gap-2 max-w-md mx-auto text-left">' + btns + '</div>' +
                '<div class="mt-8"><button type="button" id="quiz-cond-continue" class="btn-primary px-10 py-3" data-' + dataAttr + '-continue="true" disabled aria-disabled="true">Continue</button></div>' +
            '</div>'
        );
    }

    // ASCVD screen — three OPTIONAL number inputs. Continue is always
    // enabled. Empty values save as null; non-empty values are validated
    // against range and saved as numbers.
    function buildAscvd() {
        return screenWrap(SCREEN.ASCVD,
            '<div class="text-center">' +
                '<p class="sr-only" aria-live="polite">An optional cholesterol question was added based on your previous selection.</p>' +
                '<h2 id="screen-' + SCREEN.ASCVD + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Recent cholesterol numbers (optional)</h2>' +
                '<p class="text-brand-gray font-light mb-8 max-w-lg mx-auto">If you have recent labs, enter what you remember. All three fields are optional — you can skip any field or all of them and click Continue.</p>' +
                '<div class="max-w-md mx-auto space-y-4 text-left">' +
                    '<div>' +
                        '<label for="quiz-tc-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">Total cholesterol (mg/dL)</label>' +
                        '<input type="number" inputmode="numeric" id="quiz-tc-input" min="50" max="500" step="1" placeholder="optional, e.g. 195" aria-describedby="quiz-ascvd-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<div>' +
                        '<label for="quiz-ldl-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">LDL (mg/dL)</label>' +
                        '<input type="number" inputmode="numeric" id="quiz-ldl-input" min="0" max="400" step="1" placeholder="optional, e.g. 110" aria-describedby="quiz-ascvd-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<div>' +
                        '<label for="quiz-hdl-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">HDL (mg/dL)</label>' +
                        '<input type="number" inputmode="numeric" id="quiz-hdl-input" min="10" max="150" step="1" placeholder="optional, e.g. 50" aria-describedby="quiz-ascvd-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<p id="quiz-ascvd-error" role="alert" class="text-red-500 text-xs mt-2 hidden"></p>' +
                    '<button type="button" id="quiz-ascvd-continue" class="btn-primary w-full py-3 mt-4">Continue</button>' +
                    '<p class="text-brand-gray/60 text-xs">Skip any field you don\'t know — these inputs only refine the triage estimate.</p>' +
                '</div>' +
            '</div>'
        );
    }

    function buildAttempts() {
        var btns = '';
        for (var i = 0; i < priorAttemptOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-attempt="' + priorAttemptOptions[i].key + '">' + priorAttemptOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.ATTEMPTS,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.ATTEMPTS + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Have you tried to lose weight in the past 12 months?</h2>' +
                '<p class="text-brand-gray font-light mb-10">FDA labeling expects documented prior weight-loss attempts before initiating prescription therapy.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.ATTEMPTS + '-heading" class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-attempt-continue" class="btn-primary px-10 py-3" data-attempt-continue="true" disabled aria-disabled="true">Continue</button></div>' +
            '</div>'
        );
    }

    // Multi-select with an exclusive "None of these" option.
    function buildHistory() {
        var dataAttr = 'hx';
        var headingId = 'screen-' + SCREEN.HISTORY + '-heading';
        var noneHintId = dataAttr + '-none-hint';
        var btns = '';
        for (var i = 0; i < historyOptions.length; i++) {
            btns +=
                '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors">' +
                    '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '="' + historyOptions[i].key + '" aria-describedby="' + dataAttr + '-help">' +
                    '<span>' + historyOptions[i].label + '</span>' +
                '</label>';
        }
        btns +=
            '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors mt-2">' +
                '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '-none="true" aria-describedby="' + noneHintId + '">' +
                '<span>None of these</span>' +
            '</label>' +
            '<span id="' + noneHintId + '" class="sr-only">Selecting None of these will clear all other selections.</span>';
        return screenWrap(SCREEN.HISTORY,
            '<div class="text-center">' +
                '<h2 id="' + headingId + '" class="text-3xl font-bold text-brand-light mb-2 font-heading">Do any of these apply to you?</h2>' +
                '<p id="' + dataAttr + '-help" class="text-brand-gray font-light mb-10">Select all that apply. This is the safety panel — flagging these helps us route you to the right next step before any prescription weight-management option is considered.</p>' +
                '<div aria-labelledby="' + headingId + '" class="flex flex-col gap-2 max-w-md mx-auto text-left">' + btns + '</div>' +
                '<div class="mt-8"><button type="button" id="quiz-hx-continue" class="btn-primary px-10 py-3" data-' + dataAttr + '-continue="true">Continue</button></div>' +
            '</div>'
        );
    }

    function buildPregnancy() {
        var btns = '';
        for (var i = 0; i < pregnancyOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-center hover:border-brand-gray/40 flex-1" data-pregnancy="' + pregnancyOptions[i].key + '">' + pregnancyOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.PREGNANCY,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.PREGNANCY + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Are you currently pregnant, breastfeeding, or planning pregnancy in the next 6 months?</h2>' +
                '<p class="text-brand-gray font-light mb-10">This class of therapy is not appropriate during these windows.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.PREGNANCY + '-heading" class="flex gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-pregnancy-continue" class="btn-primary px-10 py-3" data-pregnancy-continue="true" disabled aria-disabled="true">Continue</button></div>' +
            '</div>'
        );
    }

    function buildBariatric() {
        var btns = '';
        for (var i = 0; i < bariatricOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-center hover:border-brand-gray/40 flex-1" data-bariatric="' + bariatricOptions[i].key + '">' + bariatricOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.BARIATRIC,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.BARIATRIC + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Have you had bariatric surgery?</h2>' +
                '<p class="text-brand-gray font-light mb-10">A modifier, not a disqualifier. Patients post-bariatric are routed toward a specialist evaluation pathway.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.BARIATRIC + '-heading" class="flex gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-bariatric-continue" class="btn-primary px-10 py-3" data-bariatric-continue="true" disabled aria-disabled="true">Continue</button></div>' +
            '</div>'
        );
    }

    // OTHER screen — free-text catch-all. Continue always enabled. Any
    // non-empty trimmed string routes to contraindication-identified.
    function buildOther() {
        return screenWrap(SCREEN.OTHER,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.OTHER + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Anything else?</h2>' +
                '<p class="text-brand-gray font-light mb-8 max-w-lg mx-auto">Are there any other medical conditions or medications you\'ve been told affect medication choices? (Optional)</p>' +
                '<div class="max-w-md mx-auto text-left">' +
                    '<label for="quiz-other-input" class="sr-only">Other conditions or medications (optional)</label>' +
                    '<textarea id="quiz-other-input" maxlength="200" rows="4" placeholder="Optional — leave blank if none." aria-describedby="quiz-other-help" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-base"></textarea>' +
                    '<p id="quiz-other-help" class="text-brand-gray/60 text-xs mt-1">Up to 200 characters. Anything you flag here will route your result toward a clinical-attention path.</p>' +
                    '<button type="button" id="quiz-other-continue" class="btn-primary w-full py-3 mt-4">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    // READINESS screen — 1-5 Likert radiogroup.
    function buildReadiness() {
        var btns = '';
        for (var i = 0; i < readinessOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-readiness="' + readinessOptions[i].key + '"><span class="text-brand-gray/60 text-xs uppercase tracking-widest mr-3">' + readinessOptions[i].key + '</span>' + readinessOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.READINESS,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.READINESS + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">On a scale of 1-5, how ready are you to make changes to support weight loss?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Best fit right now.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.READINESS + '-heading" class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-readiness-continue" class="btn-primary px-10 py-3" data-readiness-continue="true" disabled aria-disabled="true">Continue</button></div>' +
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
                '<div class="max-w-sm mx-auto text-left" aria-hidden="true">' + markers + '</div>' +
                '<p id="calculating-current-step" class="sr-only" aria-live="polite" aria-atomic="true"></p>' +
            '</div>'
        );
    }

    function buildResultsShell() {
        return '<div class="quiz-screen flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + SCREEN.RESULTS + '" role="region" aria-labelledby="screen-' + SCREEN.RESULTS + '-heading">' +
            '<div class="max-w-2xl w-full" id="quiz-results-inner"></div></div>';
    }

    // ── Build all screens ────────────────────────────────────────────

    function buildAllScreens() {
        var html = '';
        html += buildWelcome();
        html += buildAgeGate();
        html += buildAgeBlock();
        html += buildDemo();
        html += buildBody();
        html += buildConditions();
        html += buildAscvd();
        html += buildAttempts();
        html += buildHistory();
        html += buildPregnancy();
        html += buildBariatric();
        html += buildOther();
        html += buildReadiness();
        html += buildState();
        html += buildAck();
        html += buildCalculating();
        html += buildResultsShell();
        root.innerHTML = html;
    }

    // ── Navigation Helpers ───────────────────────────────────────────

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
        var cont = root.querySelector('[data-' + groupAttr + '-continue]');
        if (cont) {
            cont.disabled = false;
            cont.removeAttribute('aria-disabled');
        }
    }

    // Variant: selects radio in a single group without enabling a per-group
    // continue button. Used for groups where the continue button is gated
    // on a separate condition (e.g. DEMO needs both sex + age).
    function selectRadioRow(groupAttr, value) {
        var all = root.querySelectorAll('[data-' + groupAttr + ']');
        for (var i = 0; i < all.length; i++) {
            var matches = all[i].getAttribute('data-' + groupAttr) === value;
            all[i].classList.toggle('selected', matches);
            if (all[i].getAttribute('role') === 'radio') {
                all[i].setAttribute('aria-checked', matches ? 'true' : 'false');
                all[i].setAttribute('tabindex', matches ? '0' : '-1');
            }
        }
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
    // Per WCAG 2.2.1, radio selections do NOT auto-advance. Users select
    // an option and then click Continue at their own pace.
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
            var result = scoreGlp1(state);
            renderResults(result);
            ga('quiz_results_view', SCREEN.RESULTS);
            show(SCREEN.RESULTS);
            if (progressBar) progressBar.style.width = '100%';
        });
    }

    // ── Results Renderer ─────────────────────────────────────────────

    function buildBookingHref(slug) {
        return '/booking/?source=glp1-quiz&result=' + encodeURIComponent(slug);
    }

    // Tier-specific body copy. VERBATIM from spec — do NOT paraphrase.
    // Each branch returns { heading, body, ctaLabel, slug }. The renderer
    // uses these to fill the result card. CTA URLs use buildBookingHref().
    //
    // IMPORTANT: tier body strings MUST remain static constants. Do NOT
    // interpolate user input into tier bodies — they are concatenated into
    // innerHTML on the result page and on the email path with no escaping.
    // User-controlled data goes only through escapeHtml in the netlify
    // handler; the browser engine does not sanitize tier body strings.
    function tierBody(result) {
        var internalTier = result.internalTier;
        var heading = result.internalTierLabel;
        var body;
        var ctaLabel;
        var slug = result.resultSlug;

        if (internalTier === 'contraindication-identified') {
            body = 'Based on your responses, your medical history requires clinical attention before any prescription weight-management medication is considered. Please discuss with your primary care physician or the appropriate specialist. We recommend a non-prescription evaluation path until any contraindications are addressed.';
            ctaLabel = 'Book a non-prescription evaluation';
        } else if (internalTier === 'specialist-evaluation') {
            body = 'Your responses describe prior bariatric surgery. Medical weight management after bariatric surgery typically requires specialist evaluation — a consultation can identify whether on-site care or a referral path fits your situation.';
            ctaLabel = 'Book a consultation';
        } else if (internalTier === 'eligibility-not-met-bmi') {
            body = 'Based on your responses, the FDA labeling threshold for prescription weight-management medications (BMI of 30 or higher, or BMI of 27 or higher with a weight-related condition) is not met. Comprehensive evaluation can still be useful — a consultation can review the full clinical picture and identify which evaluation paths fit your goals.';
            ctaLabel = 'Book a comprehensive evaluation';
        } else if (internalTier === 'eligibility-mixed') {
            body = 'Your responses describe a mix of factors. Some elements meet the FDA labeling expectations for prescription weight-management medications, and others — including documented prior weight-loss attempts and current readiness — require clinical evaluation to determine whether prescription therapy is appropriate. Book a consultation to discuss which evaluation path fits your situation.';
            ctaLabel = 'Book a consultation';
        } else {
            // eligibility-present — bold disclaimer is REQUIRED here.
            body = 'Your responses describe characteristics that the FDA labeling for prescription weight-management medications lists as relevant to candidacy. <strong class="text-brand-light">This is not a determination that you are a candidate.</strong> Only a licensed clinician, after a comprehensive in-person evaluation including medical history and laboratory testing, can determine whether any prescription therapy is appropriate. Book a consultation to begin that evaluation.';
            ctaLabel = 'Book a comprehensive consultation';
        }

        return {
            heading: heading,
            body: body,
            ctaLabel: ctaLabel,
            slug: slug
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
            var copy = tierBody(result);

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
                '<a href="' + buildBookingHref(copy.slug) + '" class="btn-primary text-lg px-10 py-4 inline-block quiz-cta" data-cta="' + copy.slug + '">' + copy.ctaLabel + '</a>' +
                '<p class="text-brand-gray/60 text-sm mt-4"><a href="tel:+12244354280" class="text-brand-light hover:underline quiz-cta" data-cta="phone">(224) 435-4280</a> if you\'d rather call</p>' +
            '</div>';
        }

        // Result-specific disclaimer (always shown for IL residents).
        if (!result.outOfState) {
            html += '<div class="bg-white/5 border-l-2 border-brand-gray/50 rounded-sm p-4 mb-6">' +
                '<p class="text-brand-gray text-xs italic font-light leading-relaxed">' + RESULT_DISCLAIMER + '</p>' +
            '</div>';
        }

        // ── Email capture (post-result, separate opt-in, never gates result)
        if (!result.outOfState) {
            html += '<div class="bg-white/5 border border-white/10 rounded-sm p-6 mb-6">' +
                '<h3 class="text-brand-light font-bold mb-3">Want a copy of your result?</h3>' +
                '<p class="text-brand-gray text-sm font-light mb-4">Optional — you do not need to enter anything to keep this result.</p>' +
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
                    '<p id="quiz-submit-msg" role="status" class="text-brand-gray text-xs hidden"></p>' +
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
                var validSlug = result.resultSlug && /^(contraindication|specialist|not-met|mixed|present)$/.test(result.resultSlug);
                if (validSlug) {
                    window.history.replaceState(null, '', '/quiz/glp1/?r=' + result.resultSlug);
                }
            } catch (e) { /* ignore */ }
        }

        // Update OG meta
        try {
            var metaTitle = document.querySelector('meta[property="og:title"]');
            var metaDesc = document.querySelector('meta[property="og:description"]');
            if (metaTitle) metaTitle.setAttribute('content', 'My GLP-1 Readiness Screener Result | Moonshot Medical');
            if (metaDesc) metaDesc.setAttribute('content', 'Take the free 2-3 minute screener to find out whether your responses meet the FDA labeling expectations for prescription weight-management medications.');
        } catch (e) { /* ignore */ }

        bindResultsHandlers();

        // Clear PII from in-memory state after the result has rendered. The
        // email opt-in form below reads directly from input.value, so it
        // captures fresh input — these zeroed fields don't break it. Protects
        // shared-device users from seeing prefilled fields if they hit Retake.
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

        // Trim + length-clamp before storing. Caps: name 80, email 254
        // (RFC 5321 max email length), phone 32.
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
            // Use textContent (not innerHTML) and a literal Unicode em-dash
            // (not the HTML entity) to avoid an injected entity rendering
            // as a string.
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
    // fields. CRITICAL: never send raw `otherCondition` free-text — only
    // its length. Free-text could contain unsanitizeable PHI; the engine
    // already derived `hasOtherConditionHardStop` from non-empty length and
    // the handler trusts that boolean.
    function sendResults() {
        var result = scoreGlp1(state);

        var payload = {
            name: state.name || null,
            email: state.email,
            phone: state.phone || null,
            marketingOptIn: !!state.marketingOptIn,
            result: {
                internalTier: result.internalTier,
                internalTierLabel: result.internalTierLabel,
                bmi: result.bmi,
                hasComorbidity: result.hasComorbidity,
                hasMedicalHardStop: result.hasMedicalHardStop,
                hasPregnancyHardStop: result.hasPregnancyHardStop,
                hasOtherConditionHardStop: result.hasOtherConditionHardStop,
                hasBariatricModifier: result.hasBariatricModifier,
                bmiMeetsThreshold: result.bmiMeetsThreshold,
                bmiBorderline: result.bmiBorderline,
                bmiBelowThreshold: result.bmiBelowThreshold,
                priorAttemptYes: result.priorAttemptYes,
                readinessAdequate: result.readinessAdequate,
                resultSlug: result.resultSlug
            },
            profile: {
                age: state.age,
                sex: state.sex,
                heightInches: state.heightInches,
                weightLbs: state.weightLbs,
                comorbidityCount: Array.isArray(state.comorbidities) ? state.comorbidities.length : 0,
                // Send sanitized keys only (short enum strings — safe).
                comorbidityCategories: Array.isArray(state.comorbidities) ? state.comorbidities.slice() : [],
                ascvd: {
                    totalCholesterol: (state.ascvd && Number.isFinite(state.ascvd.totalCholesterol)) ? state.ascvd.totalCholesterol : null,
                    ldl:              (state.ascvd && Number.isFinite(state.ascvd.ldl))              ? state.ascvd.ldl              : null,
                    hdl:              (state.ascvd && Number.isFinite(state.ascvd.hdl))              ? state.ascvd.hdl              : null
                },
                priorAttempt: state.priorAttempt,
                medicalHistoryCount: Array.isArray(state.medicalHistory) ? state.medicalHistory.length : 0,
                medicalHistoryCategories: Array.isArray(state.medicalHistory) ? state.medicalHistory.slice() : [],
                pregnancyOrPlanning: state.pregnancyOrPlanning,
                bariatricHistory: state.bariatricHistory,
                // Length only — NEVER send raw free-text. The boolean
                // hasOtherConditionHardStop above is the only signal the
                // handler should rely on.
                otherConditionLength: (typeof state.otherCondition === 'string') ? state.otherCondition.trim().length : 0,
                readiness: state.readiness,
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
            fetch('/.netlify/functions/glp1-quiz-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function() { /* fire-and-forget */ });
        } catch (e) { /* ignore */ }
    }

    // ── Shared Result View (?r=contraindication|specialist|not-met|mixed|present) ─

    function showSharedResult(slug) {
        if (!/^(contraindication|specialist|not-met|mixed|present)$/.test(slug)) {
            // Invalid slug; fall through to normal init.
            return false;
        }
        // The slug being valid is enough to confirm someone took the screener;
        // the actual tier-specific copy stays private. Render only a neutral
        // non-personalized message — no tier body, no eligibility framing.
        // This avoids exposing what reads like a personalized clinical
        // recommendation to out-of-state visitors who cannot access the clinic.
        var html = '<div class="flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12">' +
            '<div class="max-w-2xl w-full">' +
                '<div class="text-center mb-8">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Shared screener result</p>' +
                    '<h2 class="text-3xl font-bold text-brand-light mb-4 font-heading">A friend completed the readiness screener</h2>' +
                '</div>' +
                '<div class="border border-brand-gray/40 rounded-sm p-8 mb-8" style="background: rgba(178, 191, 190, 0.05)">' +
                    '<p class="text-brand-light font-light leading-relaxed">' +
                    'Someone shared a screener result category with you. Take the screener yourself to get your own context and recommended next step. Moonshot Medical clinicians are licensed in Illinois only — patients in other states should consult a clinician licensed in their state.' +
                    '</p>' +
                '</div>' +
                '<div class="bg-white/5 border border-white/10 rounded-sm p-6 mb-8 text-center">' +
                    '<p class="text-brand-gray font-light mb-6">Free, takes 2-3 minutes. Results are private to your device.</p>' +
                    '<button type="button" id="shared-result-cta" class="btn-primary text-lg px-10 py-4">Take the Screener</button>' +
                '</div>' +
            '</div>' +
        '</div>';

        root.innerHTML = html;
        if (progressBar) progressBar.style.width = '0%';

        var ctaBtn = document.getElementById('shared-result-cta');
        if (ctaBtn) {
            ctaBtn.addEventListener('click', function () {
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '/quiz/glp1/');
                }
                ga('quiz_cta_click', 'shared');
                restoreQuiz();
            });
        }
        return true;
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

        // ── Delegated card clicks ────────────────────────────────────
        root.addEventListener('click', function(e) {
            var target = e.target;

            // Age gate
            var ageGateBtn = target.closest('[data-age-gate]');
            if (ageGateBtn) {
                state.ageGate = ageGateBtn.getAttribute('data-age-gate');
                selectRadio('age-gate', state.ageGate);
                if (state.ageGate === 'no') {
                    // No recovery path — advance immediately to terminal block.
                    ga('screen_advance', SCREEN.AGE_GATE);
                    show(SCREEN.AGE_BLOCK);
                }
                // For "yes" the user must click Continue (no auto-advance).
                return;
            }
            var ageGateCont = target.closest('#quiz-age-gate-continue');
            if (ageGateCont && state.ageGate === 'yes') {
                advanceFrom(SCREEN.AGE_GATE);
                return;
            }

            // ── DEMO: sex radiogroup ─────────────────────────────────
            var sexBtn = target.closest('[data-sex]');
            if (sexBtn) {
                state.sex = sexBtn.getAttribute('data-sex');
                selectRadioRow('sex', state.sex);
                saveState();
                return;
            }

            // ── ATTEMPTS ────────────────────────────────────────────
            var attemptBtn = target.closest('[data-attempt]');
            if (attemptBtn) {
                state.priorAttempt = attemptBtn.getAttribute('data-attempt');
                selectRadio('attempt', state.priorAttempt);
                saveState();
                return;
            }
            var attemptCont = target.closest('#quiz-attempt-continue');
            if (attemptCont && state.priorAttempt) {
                advanceFrom(SCREEN.ATTEMPTS);
                return;
            }

            // ── CONDITIONS (multi-check) Continue ────────────────────
            if (target.closest('[data-cond-continue]')) {
                if (state.currentScreen === SCREEN.CONDITIONS) {
                    advanceFrom(SCREEN.CONDITIONS);
                }
                return;
            }

            // ── HISTORY (multi-check) Continue ───────────────────────
            if (target.closest('[data-hx-continue]')) {
                if (state.currentScreen === SCREEN.HISTORY) {
                    advanceFrom(SCREEN.HISTORY);
                }
                return;
            }

            // ── PREGNANCY ────────────────────────────────────────────
            var pregBtn = target.closest('[data-pregnancy]');
            if (pregBtn) {
                state.pregnancyOrPlanning = pregBtn.getAttribute('data-pregnancy');
                selectRadio('pregnancy', state.pregnancyOrPlanning);
                saveState();
                return;
            }
            var pregCont = target.closest('#quiz-pregnancy-continue');
            if (pregCont && state.pregnancyOrPlanning) {
                advanceFrom(SCREEN.PREGNANCY);
                return;
            }

            // ── BARIATRIC ────────────────────────────────────────────
            var bariBtn = target.closest('[data-bariatric]');
            if (bariBtn) {
                state.bariatricHistory = bariBtn.getAttribute('data-bariatric');
                selectRadio('bariatric', state.bariatricHistory);
                saveState();
                return;
            }
            var bariCont = target.closest('#quiz-bariatric-continue');
            if (bariCont && state.bariatricHistory) {
                advanceFrom(SCREEN.BARIATRIC);
                return;
            }

            // ── READINESS ────────────────────────────────────────────
            var readBtn = target.closest('[data-readiness]');
            if (readBtn) {
                var rRaw = readBtn.getAttribute('data-readiness');
                var rN = parseInt(rRaw, 10);
                if (Number.isFinite(rN) && rN >= 1 && rN <= 5) {
                    state.readiness = rN;
                    selectRadio('readiness', rRaw);
                    saveState();
                }
                return;
            }
            var readCont = target.closest('#quiz-readiness-continue');
            if (readCont && Number.isFinite(state.readiness)) {
                advanceFrom(SCREEN.READINESS);
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

            // Comorbidities
            var condKey = t.getAttribute('data-cond');
            if (condKey != null) {
                handleMultiCheck(state.comorbidities, condKey, t.checked, 'cond');
                state.comorbiditiesNoneSelected = false;
                refreshConditionsContinue();
                return;
            }
            if (t.getAttribute('data-cond-none') === 'true') {
                handleNoneOf(state.comorbidities, t.checked, 'cond');
                state.comorbiditiesNoneSelected = !!t.checked;
                refreshConditionsContinue();
                return;
            }

            // Medical history
            var hxKey = t.getAttribute('data-hx');
            if (hxKey != null) {
                handleMultiCheck(state.medicalHistory, hxKey, t.checked, 'hx');
                state.medicalHistoryNoneSelected = false;
                return;
            }
            if (t.getAttribute('data-hx-none') === 'true') {
                handleNoneOf(state.medicalHistory, t.checked, 'hx');
                state.medicalHistoryNoneSelected = !!t.checked;
                return;
            }
        });

        // ── Per-screen input handlers ────────────────────────────────
        bindDemoScreen();
        bindBodyScreen();
        bindAscvdScreen();
        bindOtherScreen();
        bindStateScreen();
        bindAckScreen();
        // ── WAI-ARIA radiogroup keyboard nav ──────────────────────────
        bindRadiogroupKeyboard();
    }

    function handleMultiCheck(arr, key, checked, dataAttr) {
        var idx = arr.indexOf(key);
        if (checked) {
            if (idx === -1) arr.push(key);
            // Uncheck the "None of these" if a regular item is now checked.
            var noneInput = root.querySelector('[data-' + dataAttr + '-none]');
            if (noneInput) noneInput.checked = false;
        } else {
            if (idx !== -1) arr.splice(idx, 1);
        }
        saveState();
    }

    function handleNoneOf(arr, checked, dataAttr) {
        if (checked) {
            // Clear all other multi-check entries.
            arr.length = 0;
            var inputs = root.querySelectorAll('[data-' + dataAttr + ']');
            for (var i = 0; i < inputs.length; i++) {
                inputs[i].checked = false;
            }
        }
        saveState();
    }

    // Conditions screen: Continue is gated until the user picks at least one
    // real comorbidity OR explicitly picks "None of the above". Mirrors the
    // selection-required pattern used by ATTEMPTS / HISTORY radiogroups.
    function refreshConditionsContinue() {
        var btn = document.getElementById('quiz-cond-continue');
        if (!btn) return;
        var hasSelection = (Array.isArray(state.comorbidities) && state.comorbidities.length > 0) ||
            !!state.comorbiditiesNoneSelected;
        if (hasSelection) {
            btn.disabled = false;
            btn.removeAttribute('aria-disabled');
        } else {
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
        }
    }

    function bindDemoScreen() {
        var ageInput = document.getElementById('quiz-age-input');
        var btn = document.getElementById('quiz-demo-continue');
        if (!ageInput || !btn) return;

        ageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });

        btn.addEventListener('click', function() {
            var ageRaw = (ageInput.value || '').trim();
            var age = parseInt(ageRaw, 10);
            ageInput.style.borderColor = '';

            var sexOk = !!state.sex && Object.prototype.hasOwnProperty.call(SEX_VALUES, state.sex);
            var ageOk = !!ageRaw && Number.isFinite(age) && age >= 18 && age <= 100;

            if (!sexOk || !ageOk) {
                showFieldError('quiz-demo-error', 'Please choose a sex and enter an age between 18 and 100.');
                if (!ageOk) {
                    ageInput.style.borderColor = '#dc2626';
                    try { ageInput.focus(); } catch (e) {}
                }
                return;
            }
            showFieldError('quiz-demo-error', '');
            state.age = age;
            saveState();
            advanceFrom(SCREEN.DEMO);
        });
    }

    function bindBodyScreen() {
        var heightInput = document.getElementById('quiz-height-input');
        var weightInput = document.getElementById('quiz-weight-input');
        var btn = document.getElementById('quiz-body-continue');
        if (!heightInput || !weightInput || !btn) return;

        var inputs = [heightInput, weightInput];
        for (var i = 0; i < inputs.length; i++) {
            (function(inp) {
                inp.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        btn.click();
                    }
                });
            })(inputs[i]);
        }

        btn.addEventListener('click', function() {
            var heightRaw = (heightInput.value || '').trim();
            var weightRaw = (weightInput.value || '').trim();
            var height = parseFloat(heightRaw);
            var weight = parseFloat(weightRaw);

            heightInput.style.borderColor = '';
            weightInput.style.borderColor = '';

            var firstBadInput = null;
            var heightOk = !!heightRaw && Number.isFinite(height) && height >= 36 && height <= 96;
            var weightOk = !!weightRaw && Number.isFinite(weight) && weight >= 50 && weight <= 700;

            if (!heightOk) {
                heightInput.style.borderColor = '#dc2626';
                if (!firstBadInput) firstBadInput = heightInput;
            }
            if (!weightOk) {
                weightInput.style.borderColor = '#dc2626';
                if (!firstBadInput) firstBadInput = weightInput;
            }

            if (!heightOk || !weightOk) {
                showFieldError('quiz-body-error', 'Please enter valid values: height 36-96 inches, weight 50-700 lbs.');
                if (firstBadInput) try { firstBadInput.focus(); } catch (e) {}
                return;
            }
            showFieldError('quiz-body-error', '');
            state.heightInches = height;
            state.weightLbs = weight;
            saveState();
            advanceFrom(SCREEN.BODY);
        });
    }

    // ASCVD screen handler — three OPTIONAL inputs. Empty = null. Out-of-
    // range = inline error. Continue is always enabled (Continue button
    // never disabled), but if a field IS filled, it must be valid.
    function bindAscvdScreen() {
        var tcInput = document.getElementById('quiz-tc-input');
        var ldlInput = document.getElementById('quiz-ldl-input');
        var hdlInput = document.getElementById('quiz-hdl-input');
        var btn = document.getElementById('quiz-ascvd-continue');
        if (!tcInput || !ldlInput || !hdlInput || !btn) return;

        var inputs = [tcInput, ldlInput, hdlInput];
        for (var i = 0; i < inputs.length; i++) {
            (function(inp) {
                inp.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        btn.click();
                    }
                });
            })(inputs[i]);
        }

        btn.addEventListener('click', function() {
            tcInput.style.borderColor = '';
            ldlInput.style.borderColor = '';
            hdlInput.style.borderColor = '';

            // Optional: empty raw → null. Non-empty → must parse and be in range.
            var tcRaw = (tcInput.value || '').trim();
            var ldlRaw = (ldlInput.value || '').trim();
            var hdlRaw = (hdlInput.value || '').trim();

            var tc = null;
            var ldl = null;
            var hdl = null;
            var firstBadInput = null;
            var errMsg = '';

            if (tcRaw) {
                var n = parseFloat(tcRaw);
                if (!Number.isFinite(n) || n < 50 || n > 500) {
                    tcInput.style.borderColor = '#dc2626';
                    if (!firstBadInput) firstBadInput = tcInput;
                    errMsg = 'Total cholesterol must be 50-500, or leave it blank.';
                } else {
                    tc = n;
                }
            }
            if (ldlRaw) {
                var nl = parseFloat(ldlRaw);
                if (!Number.isFinite(nl) || nl < 0 || nl > 400) {
                    ldlInput.style.borderColor = '#dc2626';
                    if (!firstBadInput) firstBadInput = ldlInput;
                    errMsg = errMsg || 'LDL must be 0-400, or leave it blank.';
                } else {
                    ldl = nl;
                }
            }
            if (hdlRaw) {
                var nh = parseFloat(hdlRaw);
                if (!Number.isFinite(nh) || nh < 10 || nh > 150) {
                    hdlInput.style.borderColor = '#dc2626';
                    if (!firstBadInput) firstBadInput = hdlInput;
                    errMsg = errMsg || 'HDL must be 10-150, or leave it blank.';
                } else {
                    hdl = nh;
                }
            }

            if (errMsg) {
                showFieldError('quiz-ascvd-error', errMsg);
                if (firstBadInput) try { firstBadInput.focus(); } catch (e) {}
                return;
            }

            showFieldError('quiz-ascvd-error', '');
            state.ascvd = { totalCholesterol: tc, ldl: ldl, hdl: hdl };
            saveState();
            advanceFrom(SCREEN.ASCVD);
        });
    }

    function bindOtherScreen() {
        var input = document.getElementById('quiz-other-input');
        var btn = document.getElementById('quiz-other-continue');
        if (!input || !btn) return;

        input.addEventListener('input', function() {
            // Length-clamp on every input event in case the browser ignored
            // maxlength (e.g. paste). Trim is deferred until submit so the
            // user can keep typing trailing whitespace.
            var v = input.value || '';
            if (v.length > 200) {
                v = v.slice(0, 200);
                input.value = v;
            }
            state.otherCondition = v;
            saveState();
        });

        btn.addEventListener('click', function() {
            // Capture final value (length-clamp + preserve raw for hard-stop
            // computation; trim is applied by hasOtherConditionHardStop).
            var v = (input.value || '').slice(0, 200);
            state.otherCondition = v;
            saveState();
            advanceFrom(SCREEN.OTHER);
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
        state.sex = null;
        state.age = null;
        state.heightInches = null;
        state.weightLbs = null;
        state.comorbidities = [];
        state.comorbiditiesNoneSelected = false;
        state.ascvd = { totalCholesterol: null, ldl: null, hdl: null };
        state.priorAttempt = null;
        state.medicalHistory = [];
        state.medicalHistoryNoneSelected = false;
        state.pregnancyOrPlanning = null;
        state.bariatricHistory = null;
        state.otherCondition = '';
        state.readiness = null;
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
    // allowlist is rejected — protects scoring from corrupted localStorage
    // values planted via DevTools or older schema versions.
    var ENUM_AGE_GATE = { 'yes': 1, 'no': 1 };
    var ENUM_SEX = SEX_VALUES;
    var ENUM_PRIOR_ATTEMPT = PRIOR_ATTEMPT_VALUES;
    var ENUM_PREGNANCY = { 'yes': 1, 'no': 1 };
    var ENUM_BARIATRIC = { 'yes': 1, 'no': 1 };
    // Comorbidity allowlist excludes 'none' (tracked via the separate
    // comorbiditiesNoneSelected flag, not in the array).
    var ENUM_COMORBIDITIES = {
        't2d-or-prediabetes': 1,
        'high-blood-pressure': 1,
        'high-cholesterol': 1,
        'sleep-apnea': 1,
        'pcos': 1,
        'nafld': 1,
        'cardiovascular-disease': 1
    };
    // History allowlist excludes 'none' (tracked via medicalHistoryNoneSelected).
    var ENUM_HISTORY = {
        'mtc-or-men2': 1,
        'pancreatitis': 1,
        'severe-gastroparesis': 1,
        't1d': 1,
        'eating-disorder': 1,
        'suicidal-ideation-or-recent-psych-hospitalization': 1,
        'severe-esrd': 1,
        'severe-diabetic-retinopathy-on-insulin': 1
    };

    function pickEnum(value, allow, fallback) {
        if (typeof value !== 'string') return fallback;
        return Object.prototype.hasOwnProperty.call(allow, value) ? value : fallback;
    }

    // CSS.escape polyfill for very old browsers — Tom's audience is modern,
    // but harmless to fall back to a regex-based escape.
    function safeAttrEscape(value) {
        if (typeof value !== 'string') return '';
        if (typeof window.CSS !== 'undefined' &&
            typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }
        return value.replace(/["\\\]]/g, '\\$&');
    }

    // Validate a saved string-array against an enum allowlist.
    function pickEnumArray(saved, allow) {
        if (!Array.isArray(saved)) return [];
        var out = [];
        for (var i = 0; i < saved.length; i++) {
            var v = saved[i];
            if (typeof v === 'string' &&
                Object.prototype.hasOwnProperty.call(allow, v)) {
                out.push(v);
            }
        }
        return out;
    }

    // Validate a saved ASCVD object — each numeric field must be finite
    // and in range, otherwise null.
    function pickAscvd(saved) {
        var out = { totalCholesterol: null, ldl: null, hdl: null };
        if (!saved || typeof saved !== 'object') return out;
        if (Number.isFinite(saved.totalCholesterol) && saved.totalCholesterol >= 50 && saved.totalCholesterol <= 500) {
            out.totalCholesterol = saved.totalCholesterol;
        }
        if (Number.isFinite(saved.ldl) && saved.ldl >= 0 && saved.ldl <= 400) {
            out.ldl = saved.ldl;
        }
        if (Number.isFinite(saved.hdl) && saved.hdl >= 10 && saved.hdl <= 150) {
            out.hdl = saved.hdl;
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
        state.sex = pickEnum(saved.sex, ENUM_SEX, null);
        state.age = (Number.isFinite(saved.age) && saved.age >= 18 && saved.age <= 100 && Math.floor(saved.age) === saved.age) ? saved.age : null;
        state.heightInches = (Number.isFinite(saved.heightInches) && saved.heightInches >= 36 && saved.heightInches <= 96) ? saved.heightInches : null;
        state.weightLbs = (Number.isFinite(saved.weightLbs) && saved.weightLbs >= 50 && saved.weightLbs <= 700) ? saved.weightLbs : null;
        state.comorbidities = pickEnumArray(saved.comorbidities, ENUM_COMORBIDITIES);
        state.comorbiditiesNoneSelected = !!saved.comorbiditiesNoneSelected;
        state.ascvd = pickAscvd(saved.ascvd);
        state.priorAttempt = pickEnum(saved.priorAttempt, ENUM_PRIOR_ATTEMPT, null);
        state.medicalHistory = pickEnumArray(saved.medicalHistory, ENUM_HISTORY);
        state.medicalHistoryNoneSelected = !!saved.medicalHistoryNoneSelected;
        state.pregnancyOrPlanning = pickEnum(saved.pregnancyOrPlanning, ENUM_PREGNANCY, null);
        state.bariatricHistory = pickEnum(saved.bariatricHistory, ENUM_BARIATRIC, null);
        state.otherCondition = (typeof saved.otherCondition === 'string') ? saved.otherCondition.slice(0, 200) : '';
        state.readiness = (Number.isFinite(saved.readiness) && saved.readiness >= 1 && saved.readiness <= 5 && Math.floor(saved.readiness) === saved.readiness) ? saved.readiness : null;
        // stateCode: must match /^[A-Z]{2}$/ (case-insensitive, normalized up).
        state.stateCode = (typeof saved.stateCode === 'string' && /^[A-Za-z]{2}$/.test(saved.stateCode))
            ? saved.stateCode.toUpperCase()
            : '';
        state.name = (typeof saved.name === 'string') ? saved.name.slice(0, 80) : '';
        state.email = (typeof saved.email === 'string') ? saved.email.slice(0, 254) : '';
        state.phone = (typeof saved.phone === 'string') ? saved.phone.slice(0, 32) : '';
        state.ackTimestamp = (typeof saved.ackTimestamp === 'string' && !isNaN(Date.parse(saved.ackTimestamp))) ? saved.ackTimestamp.slice(0, 64) : null;
        state.marketingOptIn = !!saved.marketingOptIn;
        state.emailOptIn = !!saved.emailOptIn;

        // Rehydrate UI selections — single-select cards.
        if (state.ageGate) selectRadio('age-gate', state.ageGate);
        if (state.sex) selectRadioRow('sex', state.sex);
        if (state.priorAttempt) selectRadio('attempt', state.priorAttempt);
        if (state.pregnancyOrPlanning) selectRadio('pregnancy', state.pregnancyOrPlanning);
        if (state.bariatricHistory) selectRadio('bariatric', state.bariatricHistory);
        if (Number.isFinite(state.readiness)) selectRadio('readiness', String(state.readiness));

        // Rehydrate inputs.
        var ageInput = document.getElementById('quiz-age-input');
        if (ageInput && state.age != null) ageInput.value = String(state.age);
        var heightInput = document.getElementById('quiz-height-input');
        if (heightInput && state.heightInches != null) heightInput.value = String(state.heightInches);
        var weightInput = document.getElementById('quiz-weight-input');
        if (weightInput && state.weightLbs != null) weightInput.value = String(state.weightLbs);
        var tcInput = document.getElementById('quiz-tc-input');
        if (tcInput && state.ascvd && state.ascvd.totalCholesterol != null) tcInput.value = String(state.ascvd.totalCholesterol);
        var ldlInput = document.getElementById('quiz-ldl-input');
        if (ldlInput && state.ascvd && state.ascvd.ldl != null) ldlInput.value = String(state.ascvd.ldl);
        var hdlInput = document.getElementById('quiz-hdl-input');
        if (hdlInput && state.ascvd && state.ascvd.hdl != null) hdlInput.value = String(state.ascvd.hdl);
        var otherInput = document.getElementById('quiz-other-input');
        if (otherInput && state.otherCondition) otherInput.value = state.otherCondition;
        var stateSel = document.getElementById('quiz-state-select');
        if (stateSel && state.stateCode) stateSel.value = state.stateCode;

        // Rehydrate multi-checks — escape attribute values to prevent any
        // hostile string from breaking out of the selector.
        if (state.comorbidities.length) {
            for (var ci = 0; ci < state.comorbidities.length; ci++) {
                var condEl = root.querySelector('[data-cond="' + safeAttrEscape(state.comorbidities[ci]) + '"]');
                if (condEl) condEl.checked = true;
            }
        } else if (state.comorbiditiesNoneSelected) {
            var noneCondEl = root.querySelector('[data-cond-none="true"]');
            if (noneCondEl) noneCondEl.checked = true;
        }
        if (state.medicalHistory.length) {
            for (var hi = 0; hi < state.medicalHistory.length; hi++) {
                var hxEl = root.querySelector('[data-hx="' + safeAttrEscape(state.medicalHistory[hi]) + '"]');
                if (hxEl) hxEl.checked = true;
            }
        } else if (state.medicalHistoryNoneSelected) {
            var noneHxEl = root.querySelector('[data-hx-none="true"]');
            if (noneHxEl) noneHxEl.checked = true;
        }

        // Sync gated Continue buttons with rehydrated state.
        refreshConditionsContinue();

        // Determine target screen — never restore directly to calculating or
        // results. If the saved currentScreen is past the ack, send the user
        // to ack so they explicitly re-acknowledge before re-rendering.
        // Also: if the user previously selected high-cholesterol but the
        // saved currentScreen was AFTER the conditional ASCVD (which is now
        // re-included), the ordered nav still works because we look up
        // the order via activeScreenOrder() in nextScreenFrom/prevScreenFrom.
        var target = (typeof saved.currentScreen === 'number') ? saved.currentScreen : SCREEN.WELCOME;
        if (target === SCREEN.AGE_BLOCK || target === SCREEN.CALCULATING || target === SCREEN.RESULTS) {
            target = SCREEN.ACK;
        }
        if (target < SCREEN.WELCOME) target = SCREEN.WELCOME;
        if (target > SCREEN.ACK) target = SCREEN.ACK;
        // If the saved target is the conditional ASCVD screen but the user
        // no longer has 'high-cholesterol' selected (e.g. they edited via
        // back navigation), bounce them back to the conditions screen so
        // they can re-confirm.
        if (target === SCREEN.ASCVD &&
            (!Array.isArray(state.comorbidities) ||
             state.comorbidities.indexOf('high-cholesterol') === -1)) {
            target = SCREEN.CONDITIONS;
        }
        show(target);
    }

    // ── Init ─────────────────────────────────────────────────────────

    function init() {
        if (!root) return;

        // Shared result URL: /quiz/glp1/?r=contraindication|specialist|not-met|mixed|present
        try {
            var urlParams = new URLSearchParams(window.location.search);
            var sharedSlug = (urlParams.get('r') || '').trim().toLowerCase();
            if (sharedSlug && /^(contraindication|specialist|not-met|mixed|present)$/.test(sharedSlug)) {
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
