/*
 * Moonshot Low-T (TRT Readiness) Screener — Quiz Engine
 * ======================================================
 * Browser-side IIFE that runs the entire low-T screening flow:
 * welcome → age-gate → adam (10-row Yes/No) → body (age/height/weight)
 * → sleep → fertility → history (multi-check) → psa → ipss (3-row 0-5)
 * → meds (multi-check) → state → ack → calculating → results.
 *
 * Scoring logic is INLINED from /quiz/low-t/scoring.js (the canonical pure
 * module). Both files MUST stay in sync — the Vitest suite pins the contract
 * on the scoring module; this engine reproduces it verbatim because the page
 * loads as a non-module script tag (no ESM imports).
 *
 * Output contract (must match scoring.js exactly):
 *   { adamPositive, adamYesCount, bmi, ipssSum, hasHardStopMedical,
 *     hasFertilityStop, hasPsaConcern, hasIpssConcern, hasOsaConfounder,
 *     hasMedConfounder, internalTier, internalTierLabel, resultSlug,
 *     outOfState }
 *
 * Privacy / first-party analytics:
 *   Health values NEVER leave the browser as analytics. The ga() shim only
 *   forwards generic funnel events to /.netlify/functions/quiz-event with
 *   the strict 4-field contract { quiz: 'low-t', event, screen, timestamp }.
 *   Health data flows through /.netlify/functions/low-t-quiz-submit for the
 *   email and CRM pipeline only. Screen labels are pre-checked against
 *   HEALTH_TERMS — none of our labels (welcome, age-gate, age-block, adam,
 *   body, sleep, fertility, history, psa, ipss, meds, state, ack, calc,
 *   results) contain any forbidden substrings.
 *
 * Compliance rails (NEVER violate these):
 *   - Never name specific drugs in result output (no Clomid, HCG, cypionate,
 *     enanthate, anastrozole, AndroGel, Testim, Axiron, Striant, DHEA).
 *   - The v1 line "There are alternatives (Clomid, HCG-based protocols,
 *     lifestyle optimization) that preserve fertility" is permanently
 *     retired — replaced by the generic non-testosterone phrasing below.
 *   - Never tell the user they "should start TRT".
 *   - Never tell the user "you have low testosterone" (diagnosis).
 *   - Never give specific dose recommendations.
 *   - Never use "Strong candidate" / "Possible candidate" — neutral labels only.
 *   - Tier labels are the four neutral strings from INTERNAL_TIER_LABELS.
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

    var ADAM_ITEM_COUNT = 10;
    var ADAM_LIBIDO_INDEX = 0;        // Q1 (decrease in libido)
    var ADAM_ERECTIONS_INDEX = 6;     // Q7 (erections less strong)
    var ADAM_OTHERS_THRESHOLD = 3;    // ≥3 other items 'yes' triggers ADAM positive

    // Hard-stop medical history keys. Any single one routes to 'hard-stop'.
    var HARD_STOP_MEDICAL = {
        'untreated-male-breast-cancer': 1,
        'severe-untreated-chf': 1,
        'active-prostate-nodule-or-elevated-psa-pending': 1
    };

    // Flag-only medical history keys. NOT a hard stop on their own.
    var FLAG_MEDICAL = {
        'prostate-cancer-history': 1,
        'hematocrit-hx-gt-54': 1,
        'untreated-severe-osa': 1,
        'severe-bph-or-luts': 1,
        'severe-depression-with-si': 1
    };

    // Combined allowlist for medical-history multi-check (validation only).
    var MED_HISTORY_KEYS = {
        'untreated-male-breast-cancer': 1,
        'severe-untreated-chf': 1,
        'active-prostate-nodule-or-elevated-psa-pending': 1,
        'prostate-cancer-history': 1,
        'hematocrit-hx-gt-54': 1,
        'untreated-severe-osa': 1,
        'severe-bph-or-luts': 1,
        'severe-depression-with-si': 1,
        'other': 1
    };

    // Allowlist for current-medications multi-check.
    var MEDS_KEYS = {
        'opioids': 1,
        'ssri-snri': 1,
        'beta-blockers': 1,
        'statins': 1,
        'glucocorticoids': 1,
        'prior-or-current-testosterone': 1,
        'none': 1
    };

    // Confounder-medications: opioids and SSRIs/SNRIs are documented to
    // suppress testosterone. They shift ADAM-positive patients into the
    // 'eligibility-mixed' bucket so the result body surfaces the confounder.
    var CONFOUNDER_MEDS = { 'opioids': 1, 'ssri-snri': 1 };

    var FERTILITY_PLAN_VALUES = {
        'currently-trying-or-12mo': 1,
        'planning-eventually': 1,
        'not-planning': 1,
        'na': 1
    };

    // PSA tier inputs. >4.0 ng/mL routes to urology referral first; >10.0 is urgent.
    var PSA_TIER_VALUES = {
        'le-2.5': 1, '2.5-4.0': 1, '4.0-10.0': 1, 'gt-10.0': 1,
        'unknown': 1, 'no-test': 1
    };
    var PSA_CONCERN_TIERS = { '4.0-10.0': 1, 'gt-10.0': 1 };

    var IPSS_ITEM_COUNT = 3;
    var IPSS_VALUE_MIN = 0;
    var IPSS_VALUE_MAX = 5;
    var IPSS_CONCERN_THRESHOLD = 7;   // sum >7 triggers concern

    var INTERNAL_TIER_VALUES = {
        'hard-stop': 1,
        'fertility-stop': 1,
        'psa-ipss-concern': 1,
        'eligibility-present': 1,
        'eligibility-mixed': 1,
        'eligibility-not-met': 1
    };

    // Patient-facing tier labels — neutral strings (universal guardrail).
    // Multiple internal tiers map to the same label; the renderer differentiates
    // body copy by internalTier.
    var INTERNAL_TIER_LABELS = {
        'hard-stop':            'Contraindication identified',
        'fertility-stop':       'Contraindication identified',
        'psa-ipss-concern':     'Contraindication identified',
        'eligibility-present':  'Eligibility factors present',
        'eligibility-mixed':    'Eligibility factors mixed',
        'eligibility-not-met':  'Eligibility factors not met'
    };

    var RESULT_SLUGS = {
        'hard-stop':            'hard-stop',
        'fertility-stop':       'fertility-stop',
        'psa-ipss-concern':     'psa-ipss',
        'eligibility-present':  'present',
        'eligibility-mixed':    'mixed',
        'eligibility-not-met':  'not-met'
    };

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

    function adamYesCount(adam) {
        if (!Array.isArray(adam)) return 0;
        var count = 0;
        for (var i = 0; i < ADAM_ITEM_COUNT; i++) {
            if (adam[i] === true) count += 1;
        }
        return count;
    }

    function isAdamPositive(adam) {
        if (!Array.isArray(adam)) return false;
        if (adam[ADAM_LIBIDO_INDEX] === true) return true;
        if (adam[ADAM_ERECTIONS_INDEX] === true) return true;
        var others = 0;
        for (var i = 0; i < ADAM_ITEM_COUNT; i++) {
            if (i === ADAM_LIBIDO_INDEX || i === ADAM_ERECTIONS_INDEX) continue;
            if (adam[i] === true) others += 1;
        }
        return others >= ADAM_OTHERS_THRESHOLD;
    }

    function clampIpssValue(v) {
        if (!Number.isFinite(v)) return 0;
        if (v < IPSS_VALUE_MIN) return IPSS_VALUE_MIN;
        if (v > IPSS_VALUE_MAX) return IPSS_VALUE_MAX;
        return Math.floor(v);
    }

    function sumIpss(ipss) {
        if (!Array.isArray(ipss)) return 0;
        var total = 0;
        for (var i = 0; i < IPSS_ITEM_COUNT; i++) {
            total += clampIpssValue(ipss[i]);
        }
        return total;
    }

    function hasHardStopMedical(medicalHistory) {
        if (!Array.isArray(medicalHistory)) return false;
        for (var i = 0; i < medicalHistory.length; i++) {
            if (Object.prototype.hasOwnProperty.call(HARD_STOP_MEDICAL, medicalHistory[i])) return true;
        }
        return false;
    }

    function hasFertilityStop(s) {
        return !!(s && s.fertilityPlan === 'currently-trying-or-12mo');
    }

    function hasPsaConcern(s) {
        if (!s || typeof s.psaTier !== 'string') return false;
        return Object.prototype.hasOwnProperty.call(PSA_CONCERN_TIERS, s.psaTier);
    }

    function hasIpssConcern(s) {
        return !!(s && sumIpss(s.ipss) > IPSS_CONCERN_THRESHOLD);
    }

    function hasOsaConfounder(s) {
        return !!(s && s.loudSnoringOrApneas === true);
    }

    function hasMedConfounder(s) {
        if (!s || !Array.isArray(s.medications)) return false;
        for (var i = 0; i < s.medications.length; i++) {
            if (Object.prototype.hasOwnProperty.call(CONFOUNDER_MEDS, s.medications[i])) return true;
        }
        return false;
    }

    // Tadalafil-candidate flag (mirrors scoring.js isTadalafilCandidate).
    // Surfaces Daily Tadalafil to Tom on lead intake AND powers conditional
    // patient-facing copy in the result body when ED or LUTS symptoms are
    // present.
    function isTadalafilCandidate(s) {
        if (!s) return false;
        var a = s.adam;
        var adamErectionsYes = Array.isArray(a) && a[ADAM_ERECTIONS_INDEX] === true;
        var ipssOver7 = sumIpss(s.ipss) > IPSS_CONCERN_THRESHOLD;
        var fertilityStop = hasFertilityStop(s);
        return adamErectionsYes || ipssOver7 || fertilityStop;
    }

    function scoreLowT(s) {
        var adam = s && s.adam;
        var adamPositive = isAdamPositive(adam);
        var adamCount = adamYesCount(adam);
        var bmi = computeBmi(s);
        var ipssSum = sumIpss(s && s.ipss);
        var hardStopMedical = hasHardStopMedical(s && s.medicalHistory);
        var fertilityStop = hasFertilityStop(s);
        var psaConcern = hasPsaConcern(s);
        var ipssConcern = hasIpssConcern(s);
        var osaConfounder = hasOsaConfounder(s);
        var medConfounder = hasMedConfounder(s);
        var tadalafilCandidate = isTadalafilCandidate(s);

        var internalTier;
        if (hardStopMedical) {
            internalTier = 'hard-stop';
        } else if (fertilityStop) {
            internalTier = 'fertility-stop';
        } else if (psaConcern || ipssConcern) {
            internalTier = 'psa-ipss-concern';
        } else if (adamPositive && (osaConfounder || medConfounder)) {
            internalTier = 'eligibility-mixed';
        } else if (adamPositive) {
            internalTier = 'eligibility-present';
        } else {
            internalTier = 'eligibility-not-met';
        }

        var stateCode = s && typeof s.stateCode === 'string'
            ? s.stateCode.toUpperCase()
            : '';

        return {
            adamPositive: adamPositive,
            adamYesCount: adamCount,
            bmi: bmi,
            ipssSum: ipssSum,
            hasHardStopMedical: hardStopMedical,
            hasFertilityStop: fertilityStop,
            hasPsaConcern: psaConcern,
            hasIpssConcern: ipssConcern,
            hasOsaConfounder: osaConfounder,
            hasMedConfounder: medConfounder,
            tadalafilCandidate: tadalafilCandidate,
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
        ADAM:         3,
        BODY:         4,
        SLEEP:        5,
        FERTILITY:    6,
        HISTORY:      7,
        PSA:          8,
        IPSS:         9,
        MEDS:        10,
        STATE:       11,
        ACK:         12,
        CALCULATING: 13,
        RESULTS:     14
    };

    // Short, neutral labels that pass the HEALTH_TERMS allowlist on
    // /.netlify/functions/quiz-event. No clinical jargon, no "libido",
    // no "testosterone", no severity words. These strings are the ONLY
    // thing sent in analytics.
    var SCREEN_LABEL = {};
    SCREEN_LABEL[SCREEN.WELCOME]     = 'welcome';
    SCREEN_LABEL[SCREEN.AGE_GATE]    = 'age-gate';
    SCREEN_LABEL[SCREEN.AGE_BLOCK]   = 'age-block';
    SCREEN_LABEL[SCREEN.ADAM]        = 'adam';
    SCREEN_LABEL[SCREEN.BODY]        = 'body';
    SCREEN_LABEL[SCREEN.SLEEP]       = 'sleep';
    SCREEN_LABEL[SCREEN.FERTILITY]   = 'fertility';
    SCREEN_LABEL[SCREEN.HISTORY]     = 'history';
    SCREEN_LABEL[SCREEN.PSA]         = 'psa';
    SCREEN_LABEL[SCREEN.IPSS]        = 'ipss';
    SCREEN_LABEL[SCREEN.MEDS]        = 'meds';
    SCREEN_LABEL[SCREEN.STATE]       = 'state';
    SCREEN_LABEL[SCREEN.ACK]         = 'ack';
    SCREEN_LABEL[SCREEN.CALCULATING] = 'calc';
    SCREEN_LABEL[SCREEN.RESULTS]     = 'results';

    // ── Option Data ──────────────────────────────────────────────────

    var ageGateOptions = [
        { label: 'Yes, I am 18 or older', key: 'yes' },
        { label: 'No',                    key: 'no' }
    ];

    // ADAM 10-item screener. Indexed 0..9. Q1 (libido) and Q7 (erections)
    // are key items per the validated instrument. Visible question text
    // intentionally uses the standard ADAM phrasing — the analytics screen
    // label remains the neutral 'adam' string.
    var adamItems = [
        { idx: 0, prompt: 'Decrease in libido?' },
        { idx: 1, prompt: 'Lack of energy?' },
        { idx: 2, prompt: 'Decrease in strength/endurance?' },
        { idx: 3, prompt: 'Lost height?' },
        { idx: 4, prompt: 'Decreased enjoyment of life?' },
        { idx: 5, prompt: 'Sad and/or grumpy?' },
        { idx: 6, prompt: 'Erections less strong?' },
        { idx: 7, prompt: 'Recent deterioration in ability to play sports?' },
        { idx: 8, prompt: 'Falling asleep after dinner?' },
        { idx: 9, prompt: 'Recent deterioration in work performance?' }
    ];

    // Fertility plan radiogroup options.
    var fertilityOptions = [
        { label: 'Currently trying or planning within the next 12 months', key: 'currently-trying-or-12mo' },
        { label: 'Planning eventually but not in next 12 months',           key: 'planning-eventually' },
        { label: 'Not planning more children',                              key: 'not-planning' },
        { label: 'Not applicable',                                          key: 'na' }
    ];

    // Medical history multi-check options. Keys are short enums — safe to
    // include in submit payload's `medicalHistoryCategories`. The 'none'
    // option is rendered separately as an exclusive choice.
    var historyOptions = [
        { label: 'Untreated male breast cancer',                                                               key: 'untreated-male-breast-cancer' },
        { label: 'Severe untreated congestive heart failure',                                                  key: 'severe-untreated-chf' },
        { label: 'Personal or first-degree-relative history of prostate cancer',                              key: 'prostate-cancer-history' },
        { label: 'History of hematocrit greater than 54%',                                                     key: 'hematocrit-hx-gt-54' },
        { label: 'Untreated severe sleep apnea',                                                               key: 'untreated-severe-osa' },
        { label: 'Severe BPH or significant urinary symptoms (frequent waking, difficulty starting)',         key: 'severe-bph-or-luts' },
        { label: 'Active prostate nodule or known elevated PSA pending workup',                                key: 'active-prostate-nodule-or-elevated-psa-pending' },
        { label: 'Severe untreated depression with thoughts of self-harm',                                     key: 'severe-depression-with-si' },
        { label: 'OR any other condition you\'ve been told affects testosterone or hormone-based therapy',     key: 'other' }
    ];

    // PSA tier radiogroup options.
    var psaOptions = [
        { label: 'Yes, value was 2.5 or less ng/mL',          key: 'le-2.5' },
        { label: 'Yes, value was 2.5–4.0 ng/mL',         key: '2.5-4.0' },
        { label: 'Yes, value was 4.0–10.0 ng/mL',        key: '4.0-10.0' },
        { label: 'Yes, value was greater than 10.0 ng/mL',    key: 'gt-10.0' },
        { label: 'Yes, but I don\'t remember the value',      key: 'unknown' },
        { label: 'No, I haven\'t had a PSA test',             key: 'no-test' }
    ];

    // IPSS items — 3 sub-questions each on a 0-5 frequency scale.
    var ipssItems = [
        { idx: 0, prompt: 'Over the past month, how often have you had a sensation of not emptying your bladder completely after urinating?' },
        { idx: 1, prompt: 'How often have you had to urinate again less than two hours after finishing?' },
        { idx: 2, prompt: 'How often have you had to get up at night to urinate?' }
    ];

    var ipssScaleOptions = [
        { label: 'Not at all (0)',                key: '0' },
        { label: 'Less than 1 in 5 times (1)',    key: '1' },
        { label: 'Less than half the time (2)',   key: '2' },
        { label: 'About half the time (3)',       key: '3' },
        { label: 'More than half the time (4)',   key: '4' },
        { label: 'Almost always (5)',             key: '5' }
    ];

    // Medications multi-check options.
    var medsOptions = [
        { label: 'Opioids (long-term)',                          key: 'opioids' },
        { label: 'SSRIs / SNRIs',                                key: 'ssri-snri' },
        { label: 'Beta blockers',                                key: 'beta-blockers' },
        { label: 'Statins',                                      key: 'statins' },
        { label: 'Glucocorticoids (e.g. prednisone, ≥3 months)', key: 'glucocorticoids' },
        { label: 'Prior or current testosterone use',            key: 'prior-or-current-testosterone' }
    ];

    // Yes/No radiogroup options (used for sleep snoring and ADAM rows).
    var yesNoOptions = [
        { label: 'Yes', key: 'yes' },
        { label: 'No',  key: 'no' }
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
    // so screen readers receive textContent changes (opacity changes alone
    // don't trigger live-region updates).
    var calculatingSteps = [
        'Reviewing your responses...',
        'Tabulating ADAM screener score...',
        'Comparing PSA and IPSS thresholds...',
        'Checking medication and fertility flags...',
        'Cross-referencing with hard-stop criteria...',
        'Preparing your result summary...'
    ];

    // ── Universal Disclaimers (verbatim from spec) ───────────────────

    var RESULT_DISCLAIMER = 'This is a screening tool, not a clinical diagnosis. Only a clinician can confirm whether your symptoms are due to low testosterone or another cause. Your provider can determine whether further workup, lab testing, or treatment is appropriate based on your full clinical picture.';

    // The universal footer disclaimer is rendered by the static HTML below
    // the quiz mount in /quiz/low-t/index.html. It is NOT duplicated by this
    // engine — the static placement is canonical and is always visible
    // because the quiz is inline (not modal). Mirrors perimenopause.

    // Author attribution — Missy-only (she has FPA; no collaborator clause).
    var AUTHOR_ATTRIBUTION = 'Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC. This review is of the tool, not of your individual responses. You have not been examined or treated by Moonshot Medical.';

    // ── State ────────────────────────────────────────────────────────

    // Field names match scoring.js EXACTLY. Do not rename without also
    // changing the scoring module and its Vitest suite.
    var state = {
        currentScreen: 0,
        ageGate: null,                  // 'yes' | 'no'
        // ADAM 10-item screener — booleans (true=yes, false=no, null=not answered).
        adam: [null, null, null, null, null, null, null, null, null, null],
        // BODY
        age: null,                       // number 18..100
        heightInches: null,              // number
        weightLbs: null,                 // number
        // SLEEP
        loudSnoringOrApneas: null,       // boolean
        sleepHours: null,                // number 0..14
        // FERTILITY / HISTORY / PSA / IPSS / MEDS
        fertilityPlan: null,             // string in FERTILITY_PLAN_VALUES
        medicalHistory: [],              // string[] (subset of MED_HISTORY_KEYS minus 'none')
        medicalHistoryNoneSelected: false,
        psaTier: null,                   // string in PSA_TIER_VALUES
        ipss: [null, null, null],         // 0..5 each
        medications: [],                  // string[] (subset of MEDS_KEYS minus 'none')
        medicationsNoneSelected: false,
        stateCode: '',                    // 'IL' | 'CA' | ...
        ackTimestamp: null,
        name: '',
        email: '',
        phone: '',
        marketingOptIn: false,
        emailOptIn: false
    };

    var root = document.getElementById('quiz-root');
    var progressBar = document.getElementById('quiz-progress-bar');

    // ── State Persistence ────────────────────────────────────────────

    var STORAGE_KEY = 'mmp_low_t_quiz_state';
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
            quiz: 'low-t',
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

    // The flow is fully linear (no conditional interstitial like
    // perimenopause's red-flag screen).
    function activeScreenOrder() {
        return [
            SCREEN.WELCOME,
            SCREEN.AGE_GATE,
            SCREEN.ADAM,
            SCREEN.BODY,
            SCREEN.SLEEP,
            SCREEN.FERTILITY,
            SCREEN.HISTORY,
            SCREEN.PSA,
            SCREEN.IPSS,
            SCREEN.MEDS,
            SCREEN.STATE,
            SCREEN.ACK
        ];
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
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-6">Free TRT Readiness Screener</p>' +
                '<h2 id="screen-' + SCREEN.WELCOME + '-heading" class="text-4xl md:text-5xl font-bold text-brand-light mb-6 font-heading">Should you get a clinical evaluation?</h2>' +
                '<p class="text-brand-gray text-lg font-light mb-10 max-w-lg mx-auto">Takes about 2-3 minutes. Walks through validated symptom and safety questions — the ADAM screener, IPSS urinary symptoms, PSA history, and key medical / medication context — to help you decide whether a clinical evaluation is worth your time. Reviewed by a Doctor of Nursing Practice.</p>' +
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
                '<p class="text-brand-gray font-light mb-6 max-w-lg mx-auto">This tool is only for users 18 or older. If you have questions about your symptoms, please speak with a parent, guardian, or pediatric clinician.</p>' +
                '<p class="text-brand-gray/60 text-sm">You can return to <a href="/" class="text-brand-light underline">moonshotmp.com</a> any time.</p>' +
            '</div>'
        );
    }

    // ADAM screen — 10 stacked rows. Each row is its own role="radiogroup"
    // with a Yes / No pair of role="radio" buttons. Continue enabled only
    // when ALL 10 have a selection.
    function buildAdam() {
        var rowsHtml = '';
        for (var i = 0; i < adamItems.length; i++) {
            var item = adamItems[i];
            var attr = 'adam-' + item.idx;
            var rowHeadingId = 'adam-row-' + item.idx + '-heading';
            var btns = '';
            for (var j = 0; j < yesNoOptions.length; j++) {
                var tabIdx = j === 0 ? '0' : '-1';
                btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-5 py-3 text-brand-light font-medium text-center hover:border-brand-gray/40 flex-1" data-' + attr + '="' + yesNoOptions[j].key + '">' + yesNoOptions[j].label + '</button>';
            }
            rowsHtml +=
                '<div class="border border-white/10 rounded-sm p-5 mb-3 text-left">' +
                    '<p id="' + rowHeadingId + '" class="text-brand-light font-medium mb-3"><span class="text-brand-gray/60 text-xs uppercase tracking-widest mr-2">' + (item.idx + 1) + '.</span>' + item.prompt + '</p>' +
                    '<div role="radiogroup" aria-labelledby="' + rowHeadingId + '" class="flex gap-3 max-w-sm">' + btns + '</div>' +
                '</div>';
        }
        return screenWrap(SCREEN.ADAM,
            '<div>' +
                '<div class="text-center mb-8">' +
                    '<h2 id="screen-' + SCREEN.ADAM + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">A few quick questions about how you\'re feeling</h2>' +
                    '<p class="text-brand-gray font-light">Answer Yes or No for each of the 10 questions. Best fit over the past few weeks.</p>' +
                '</div>' +
                '<div class="max-w-2xl mx-auto">' + rowsHtml + '</div>' +
                '<div class="mt-6 text-center"><button type="button" id="quiz-adam-continue" class="btn-primary px-10 py-3" disabled aria-disabled="true">Continue</button></div>' +
            '</div>'
        );
    }

    function buildBody() {
        return screenWrap(SCREEN.BODY,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.BODY + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">A bit about you</h2>' +
                '<p class="text-brand-gray font-light mb-10">We use this to compute BMI for clinical context.</p>' +
                '<div class="max-w-md mx-auto space-y-4 text-left">' +
                    '<div>' +
                        '<label for="quiz-age-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">Age in years <span class="text-red-400" aria-hidden="true">*</span></label>' +
                        '<input type="number" inputmode="numeric" id="quiz-age-input" min="18" max="100" step="1" required aria-required="true" placeholder="e.g. 45" aria-describedby="quiz-body-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<div>' +
                        '<label for="quiz-height-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">Height in inches <span class="text-red-400" aria-hidden="true">*</span></label>' +
                        '<input type="number" inputmode="numeric" id="quiz-height-input" min="48" max="90" step="0.5" required aria-required="true" placeholder="e.g. 70" aria-describedby="quiz-body-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<div>' +
                        '<label for="quiz-weight-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">Weight in pounds <span class="text-red-400" aria-hidden="true">*</span></label>' +
                        '<input type="number" inputmode="numeric" id="quiz-weight-input" min="80" max="500" step="1" required aria-required="true" placeholder="e.g. 185" aria-describedby="quiz-body-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<p id="quiz-body-error" role="alert" class="text-red-500 text-xs mt-2 hidden">Please enter valid values for all three fields.</p>' +
                    '<button type="button" id="quiz-body-continue" class="btn-primary w-full py-3 mt-4">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildSleep() {
        var snoreHeadingId = 'sleep-snore-heading';
        var btns = '';
        for (var i = 0; i < yesNoOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-center hover:border-brand-gray/40 flex-1" data-snore="' + yesNoOptions[i].key + '">' + yesNoOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.SLEEP,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.SLEEP + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Sleep questions</h2>' +
                '<p class="text-brand-gray font-light mb-8">Sleep is a major factor in symptoms. Two quick questions.</p>' +
                '<div class="max-w-md mx-auto space-y-6 text-left">' +
                    '<div>' +
                        '<p id="' + snoreHeadingId + '" class="text-brand-light font-medium mb-3">Loud snoring or witnessed apneas? <span class="text-red-400" aria-hidden="true">*</span></p>' +
                        '<div role="radiogroup" aria-labelledby="' + snoreHeadingId + '" class="flex gap-3">' + btns + '</div>' +
                    '</div>' +
                    '<div>' +
                        '<label for="quiz-sleep-hours-input" class="block text-brand-gray text-xs uppercase tracking-widest mb-1">Average sleep hours per night <span class="text-red-400" aria-hidden="true">*</span></label>' +
                        '<input type="number" inputmode="decimal" id="quiz-sleep-hours-input" min="0" max="14" step="0.5" required aria-required="true" placeholder="e.g. 7" aria-describedby="quiz-sleep-error" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-lg">' +
                    '</div>' +
                    '<p id="quiz-sleep-error" role="alert" class="text-red-500 text-xs hidden">Please answer the snoring question and enter a sleep hours value between 0 and 14.</p>' +
                    '<button type="button" id="quiz-sleep-continue" class="btn-primary w-full py-3 mt-2">Continue</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildFertility() {
        var btns = '';
        for (var i = 0; i < fertilityOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-fertility="' + fertilityOptions[i].key + '">' + fertilityOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.FERTILITY,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.FERTILITY + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">What are your fertility plans?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Some treatment paths affect fertility. This question helps us route you appropriately.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.FERTILITY + '-heading" class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-fertility-continue" class="btn-primary px-10 py-3" data-fertility-continue="true" disabled aria-disabled="true">Continue</button></div>' +
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
                '<p id="' + dataAttr + '-help" class="text-brand-gray font-light mb-10">Select all that apply. This helps us flag situations that need careful clinical review before any testosterone-based options are considered.</p>' +
                '<div role="group" aria-labelledby="' + headingId + '" class="flex flex-col gap-2 max-w-md mx-auto text-left">' + btns + '</div>' +
                '<div class="mt-8"><button type="button" id="quiz-hx-continue" class="btn-primary px-10 py-3" data-' + dataAttr + '-continue="true">Continue</button></div>' +
            '</div>'
        );
    }

    function buildPsa() {
        var btns = '';
        for (var i = 0; i < psaOptions.length; i++) {
            var tabIdx = i === 0 ? '0' : '-1';
            btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-psa="' + psaOptions[i].key + '">' + psaOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.PSA,
            '<div class="text-center">' +
                '<h2 id="screen-' + SCREEN.PSA + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Have you had a PSA test in the last 12 months?</h2>' +
                '<p class="text-brand-gray font-light mb-10">PSA stands for prostate-specific antigen. Pick the closest match.</p>' +
                '<div role="radiogroup" aria-labelledby="screen-' + SCREEN.PSA + '-heading" class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
                '<div class="mt-6"><button type="button" id="quiz-psa-continue" class="btn-primary px-10 py-3" data-psa-continue="true" disabled aria-disabled="true">Continue</button></div>' +
            '</div>'
        );
    }

    // IPSS screen — 3 stacked rows, each with a 0-5 frequency radiogroup.
    // Continue enabled only when ALL 3 have a selection.
    function buildIpss() {
        var rowsHtml = '';
        for (var i = 0; i < ipssItems.length; i++) {
            var item = ipssItems[i];
            var attr = 'ipss-' + item.idx;
            var rowHeadingId = 'ipss-row-' + item.idx + '-heading';
            var btns = '';
            for (var j = 0; j < ipssScaleOptions.length; j++) {
                var tabIdx = j === 0 ? '0' : '-1';
                btns += '<button type="button" role="radio" aria-checked="false" tabindex="' + tabIdx + '" class="quiz-card border border-white/10 rounded-sm px-4 py-3 text-brand-light font-medium text-left w-full hover:border-brand-gray/40 text-sm" data-' + attr + '="' + ipssScaleOptions[j].key + '">' + ipssScaleOptions[j].label + '</button>';
            }
            rowsHtml +=
                '<div class="border border-white/10 rounded-sm p-5 mb-4 text-left">' +
                    '<p id="' + rowHeadingId + '" class="text-brand-light font-medium mb-3">' + item.prompt + '</p>' +
                    '<div role="radiogroup" aria-labelledby="' + rowHeadingId + '" class="flex flex-col gap-2">' + btns + '</div>' +
                '</div>';
        }
        return screenWrap(SCREEN.IPSS,
            '<div>' +
                '<div class="text-center mb-8">' +
                    '<h2 id="screen-' + SCREEN.IPSS + '-heading" class="text-3xl font-bold text-brand-light mb-2 font-heading">Urinary symptoms</h2>' +
                    '<p class="text-brand-gray font-light">Three short questions adapted from the validated IPSS short form.</p>' +
                '</div>' +
                '<div class="max-w-xl mx-auto">' + rowsHtml + '</div>' +
                '<div class="mt-6 text-center"><button type="button" id="quiz-ipss-continue" class="btn-primary px-10 py-3" disabled aria-disabled="true">Continue</button></div>' +
            '</div>'
        );
    }

    function buildMeds() {
        var dataAttr = 'meds';
        var headingId = 'screen-' + SCREEN.MEDS + '-heading';
        var noneHintId = dataAttr + '-none-hint';
        var btns = '';
        for (var i = 0; i < medsOptions.length; i++) {
            btns +=
                '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors">' +
                    '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '="' + medsOptions[i].key + '" aria-describedby="' + dataAttr + '-help">' +
                    '<span>' + medsOptions[i].label + '</span>' +
                '</label>';
        }
        btns +=
            '<label class="quiz-check-item border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full flex items-start gap-3 cursor-pointer hover:border-brand-gray/40 transition-colors mt-2">' +
                '<input type="checkbox" class="mt-1 flex-shrink-0" data-' + dataAttr + '-none="true" aria-describedby="' + noneHintId + '">' +
                '<span>None of these</span>' +
            '</label>' +
            '<span id="' + noneHintId + '" class="sr-only">Selecting None of these will clear all other selections.</span>';
        return screenWrap(SCREEN.MEDS,
            '<div class="text-center">' +
                '<h2 id="' + headingId + '" class="text-3xl font-bold text-brand-light mb-2 font-heading">Are you currently on any of these?</h2>' +
                '<p id="' + dataAttr + '-help" class="text-brand-gray font-light mb-10">Select all that apply. Some medications affect symptoms or treatment options.</p>' +
                '<div role="group" aria-labelledby="' + headingId + '" class="flex flex-col gap-2 max-w-md mx-auto text-left">' + btns + '</div>' +
                '<div class="mt-8"><button type="button" id="quiz-meds-continue" class="btn-primary px-10 py-3" data-' + dataAttr + '-continue="true">Continue</button></div>' +
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
        html += buildAdam();
        html += buildBody();
        html += buildSleep();
        html += buildFertility();
        html += buildHistory();
        html += buildPsa();
        html += buildIpss();
        html += buildMeds();
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
    // continue button. Used for ADAM and IPSS rows where ONE shared continue
    // button gates on ALL rows being answered.
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

    // True when all 10 ADAM rows have a non-null boolean answer.
    function isAdamComplete() {
        for (var i = 0; i < ADAM_ITEM_COUNT; i++) {
            if (state.adam[i] !== true && state.adam[i] !== false) return false;
        }
        return true;
    }

    // True when all 3 IPSS rows have a numeric 0-5 answer.
    function isIpssComplete() {
        for (var i = 0; i < IPSS_ITEM_COUNT; i++) {
            var v = state.ipss[i];
            if (!Number.isFinite(v)) return false;
            if (v < IPSS_VALUE_MIN || v > IPSS_VALUE_MAX) return false;
        }
        return true;
    }

    function refreshAdamContinue() {
        var btn = document.getElementById('quiz-adam-continue');
        if (!btn) return;
        if (isAdamComplete()) {
            btn.disabled = false;
            btn.removeAttribute('aria-disabled');
        } else {
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
        }
    }

    function refreshIpssContinue() {
        var btn = document.getElementById('quiz-ipss-continue');
        if (!btn) return;
        if (isIpssComplete()) {
            btn.disabled = false;
            btn.removeAttribute('aria-disabled');
        } else {
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
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
            var result = scoreLowT(state);
            renderResults(result);
            ga('quiz_results_view', SCREEN.RESULTS);
            show(SCREEN.RESULTS);
            if (progressBar) progressBar.style.width = '100%';
        });
    }

    // ── Results Renderer ─────────────────────────────────────────────

    function buildBookingHref(slug) {
        return '/booking/?source=low-t-quiz&result=' + encodeURIComponent(slug);
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

        if (internalTier === 'hard-stop') {
            body = 'Your responses describe medical history that requires evaluation before any testosterone-based therapy. Several non-testosterone evaluation paths exist and a consultation can identify the right approach for your situation.';
            ctaLabel = 'Book a consultation';
        } else if (internalTier === 'fertility-stop') {
            // Tom's explicit handoff text. The v1 line that named Clomid +
            // HCG-based protocols by name is permanently retired. Daily
            // Tadalafil is named because it's an existing Moonshot service
            // page and the FDA-approved on-label option for ED/LUTS that
            // does not suppress fertility.
            body = 'Traditional testosterone-based therapy can suppress fertility. Several non-testosterone-based approaches exist that may preserve fertility — these require clinical evaluation to determine fit. FDA-approved options for erectile and lower-urinary-tract symptoms — including <a href="/medical/tadalafil/" class="text-brand-light underline decoration-brand-gray/40 hover:decoration-brand-gray transition">Daily Tadalafil</a> — can be evaluated independently and don\'t suppress fertility.';
            ctaLabel = 'Book a fertility-aware consultation';
        } else if (internalTier === 'psa-ipss-concern') {
            body = 'Your responses describe urinary or PSA findings that warrant evaluation by a urologist or primary care physician before testosterone-based therapy is considered. We\'d recommend that workup first; once cleared, a consultation here can address symptoms. Tadalafil is also FDA-approved for benign prostatic hyperplasia (BPH); <a href="/medical/tadalafil/" class="text-brand-light underline decoration-brand-gray/40 hover:decoration-brand-gray transition">Daily Tadalafil</a> is a path your urologist or our clinic can discuss alongside testosterone evaluation.';
            ctaLabel = 'Book a consultation';
        } else if (internalTier === 'eligibility-present') {
            // ADAM ~88% sensitivity / 60% specificity disclosure required.
            body = 'Your symptom pattern overlaps with patterns associated with low testosterone. ADAM has approximately 88% sensitivity and 60% specificity, meaning roughly 40% of positive screens are not associated with biochemical hypogonadism. A serum testosterone test ordered by a clinician — alongside a 60+ marker comprehensive panel — is the only way to determine whether testosterone deficiency is present and what\'s driving symptoms. Book a consultation to begin that workup. If erectile or lower-urinary-tract symptoms are a primary concern, <a href="/medical/tadalafil/" class="text-brand-light underline decoration-brand-gray/40 hover:decoration-brand-gray transition">Daily Tadalafil</a> is an FDA-approved option that can be evaluated alongside or instead of testosterone-based therapy.';
            ctaLabel = 'Book lab work + consultation';
        } else if (internalTier === 'eligibility-mixed') {
            body = 'Your symptoms overlap with patterns associated with low testosterone, but several factors can produce similar symptoms — sleep apnea, certain medications, sleep quality. A comprehensive evaluation will identify which factors are driving symptoms and which need to be addressed first. If erectile or lower-urinary-tract symptoms are part of what you\'re tracking, <a href="/medical/tadalafil/" class="text-brand-light underline decoration-brand-gray/40 hover:decoration-brand-gray transition">Daily Tadalafil</a> is an FDA-approved option some patients use alongside or instead of testosterone-based therapy.';
            ctaLabel = 'Book a comprehensive evaluation';
        } else {
            // eligibility-not-met
            body = 'Your symptom pattern doesn\'t strongly overlap with low-testosterone patterns. Several factors can mimic symptoms or low T can be subclinical. A comprehensive lab panel is the answer if you want to know definitively.';
            ctaLabel = 'Book a comprehensive lab panel';
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
                var validSlug = result.resultSlug && /^(hard-stop|fertility-stop|psa-ipss|present|mixed|not-met)$/.test(result.resultSlug);
                if (validSlug) {
                    window.history.replaceState(null, '', '/quiz/low-t/?r=' + result.resultSlug);
                }
            } catch (e) { /* ignore */ }
        }

        // Update OG meta
        try {
            var metaTitle = document.querySelector('meta[property="og:title"]');
            var metaDesc = document.querySelector('meta[property="og:description"]');
            if (metaTitle) metaTitle.setAttribute('content', 'My TRT Readiness Screener Result | Moonshot Medical');
            if (metaDesc) metaDesc.setAttribute('content', 'Take the free 2-3 minute screener to find out whether your symptoms warrant a clinical evaluation.');
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
    // fields, NEVER raw symptom values or individual ADAM item answers.
    function sendResults() {
        var result = scoreLowT(state);

        var payload = {
            name: state.name || null,
            email: state.email,
            phone: state.phone || null,
            marketingOptIn: !!state.marketingOptIn,
            result: {
                internalTier: result.internalTier,
                internalTierLabel: result.internalTierLabel,
                adamPositive: result.adamPositive,
                adamYesCount: result.adamYesCount,
                bmi: result.bmi,
                ipssSum: result.ipssSum,
                hasHardStopMedical: result.hasHardStopMedical,
                hasFertilityStop: result.hasFertilityStop,
                hasPsaConcern: result.hasPsaConcern,
                hasIpssConcern: result.hasIpssConcern,
                hasOsaConfounder: result.hasOsaConfounder,
                hasMedConfounder: result.hasMedConfounder,
                tadalafilCandidate: result.tadalafilCandidate,
                resultSlug: result.resultSlug
            },
            profile: {
                age: state.age,
                heightInches: state.heightInches,
                weightLbs: state.weightLbs,
                fertilityPlan: state.fertilityPlan,
                sleepHours: state.sleepHours,
                medicalHistoryCount: Array.isArray(state.medicalHistory) ? state.medicalHistory.length : 0,
                // Send sanitized keys only (short enum strings — safe).
                medicalHistoryCategories: Array.isArray(state.medicalHistory) ? state.medicalHistory.slice() : [],
                psaTier: state.psaTier,
                medicationCount: Array.isArray(state.medications) ? state.medications.length : 0,
                medicationCategories: Array.isArray(state.medications) ? state.medications.slice() : [],
                stateCode: state.stateCode
            },
            ackTimestamp: state.ackTimestamp
        };

        try {
            fetch('/.netlify/functions/low-t-quiz-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function() { /* fire-and-forget */ });
        } catch (e) { /* ignore */ }
    }

    // ── Shared Result View (?r=hard-stop|fertility-stop|psa-ipss|present|mixed|not-met) ─

    function showSharedResult(slug) {
        if (!/^(hard-stop|fertility-stop|psa-ipss|present|mixed|not-met)$/.test(slug)) {
            // Invalid slug; fall through to normal init.
            return false;
        }
        // The slug being valid is enough to confirm someone took the screener;
        // the actual tier-specific copy stays private. Render only a neutral
        // non-personalized message — no tier body, no ADAM stats, no
        // eligibility framing. This avoids exposing what reads like a
        // personalized clinical recommendation to out-of-state visitors who
        // cannot access the clinic.
        var html = '<div class="flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12">' +
            '<div class="max-w-2xl w-full">' +
                '<div class="text-center mb-8">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Shared screener result</p>' +
                    '<h2 class="text-3xl font-bold text-brand-light mb-4 font-heading">A friend completed the TRT Readiness Screener</h2>' +
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
                    window.history.replaceState(null, '', '/quiz/low-t/');
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

            // ── ADAM rows (10 yes/no radiogroups, one shared continue) ──
            for (var ai = 0; ai < adamItems.length; ai++) {
                var aAttr = 'adam-' + ai;
                var adamBtn = target.closest('[data-' + aAttr + ']');
                if (adamBtn) {
                    var aVal = adamBtn.getAttribute('data-' + aAttr);
                    if (aVal === 'yes' || aVal === 'no') {
                        state.adam[ai] = (aVal === 'yes');
                        selectRadioRow(aAttr, aVal);
                        refreshAdamContinue();
                        saveState();
                    }
                    return;
                }
            }
            var adamCont = target.closest('#quiz-adam-continue');
            if (adamCont && isAdamComplete()) {
                advanceFrom(SCREEN.ADAM);
                return;
            }

            // ── Sleep snore radiogroup ───────────────────────────────
            var snoreBtn = target.closest('[data-snore]');
            if (snoreBtn) {
                var sVal = snoreBtn.getAttribute('data-snore');
                state.loudSnoringOrApneas = (sVal === 'yes');
                selectRadioRow('snore', sVal);
                saveState();
                return;
            }

            // ── Fertility ────────────────────────────────────────────
            var fertBtn = target.closest('[data-fertility]');
            if (fertBtn) {
                state.fertilityPlan = fertBtn.getAttribute('data-fertility');
                selectRadio('fertility', state.fertilityPlan);
                saveState();
                return;
            }
            var fertCont = target.closest('#quiz-fertility-continue');
            if (fertCont && state.fertilityPlan) {
                advanceFrom(SCREEN.FERTILITY);
                return;
            }

            // ── History (multi-check) Continue ───────────────────────
            if (target.closest('[data-hx-continue]')) {
                if (state.currentScreen === SCREEN.HISTORY) {
                    advanceFrom(SCREEN.HISTORY);
                }
                return;
            }

            // ── PSA ──────────────────────────────────────────────────
            var psaBtn = target.closest('[data-psa]');
            if (psaBtn) {
                state.psaTier = psaBtn.getAttribute('data-psa');
                selectRadio('psa', state.psaTier);
                saveState();
                return;
            }
            var psaCont = target.closest('#quiz-psa-continue');
            if (psaCont && state.psaTier) {
                advanceFrom(SCREEN.PSA);
                return;
            }

            // ── IPSS rows (3 0-5 radiogroups, one shared continue) ───
            for (var ii = 0; ii < ipssItems.length; ii++) {
                var iAttr = 'ipss-' + ii;
                var ipssBtn = target.closest('[data-' + iAttr + ']');
                if (ipssBtn) {
                    var iRaw = ipssBtn.getAttribute('data-' + iAttr);
                    var iN = parseInt(iRaw, 10);
                    if (Number.isFinite(iN) && iN >= IPSS_VALUE_MIN && iN <= IPSS_VALUE_MAX) {
                        state.ipss[ii] = iN;
                        selectRadioRow(iAttr, iRaw);
                        refreshIpssContinue();
                        saveState();
                    }
                    return;
                }
            }
            var ipssCont = target.closest('#quiz-ipss-continue');
            if (ipssCont && isIpssComplete()) {
                advanceFrom(SCREEN.IPSS);
                return;
            }

            // ── Meds (multi-check) Continue ──────────────────────────
            if (target.closest('[data-meds-continue]')) {
                if (state.currentScreen === SCREEN.MEDS) {
                    advanceFrom(SCREEN.MEDS);
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

            // Medications
            var medsKey = t.getAttribute('data-meds');
            if (medsKey != null) {
                handleMultiCheck(state.medications, medsKey, t.checked, 'meds');
                state.medicationsNoneSelected = false;
                return;
            }
            if (t.getAttribute('data-meds-none') === 'true') {
                handleNoneOf(state.medications, t.checked, 'meds');
                state.medicationsNoneSelected = !!t.checked;
                return;
            }
        });

        // ── Per-screen input handlers ────────────────────────────────
        bindBodyScreen();
        bindSleepScreen();
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

    function bindBodyScreen() {
        var ageInput = document.getElementById('quiz-age-input');
        var heightInput = document.getElementById('quiz-height-input');
        var weightInput = document.getElementById('quiz-weight-input');
        var btn = document.getElementById('quiz-body-continue');
        if (!ageInput || !heightInput || !weightInput || !btn) return;

        var inputs = [ageInput, heightInput, weightInput];
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
            var ageRaw = (ageInput.value || '').trim();
            var heightRaw = (heightInput.value || '').trim();
            var weightRaw = (weightInput.value || '').trim();
            var age = parseInt(ageRaw, 10);
            var height = parseFloat(heightRaw);
            var weight = parseFloat(weightRaw);

            ageInput.style.borderColor = '';
            heightInput.style.borderColor = '';
            weightInput.style.borderColor = '';

            var firstBadInput = null;
            var ageOk = !!ageRaw && Number.isFinite(age) && age >= 18 && age <= 100;
            var heightOk = !!heightRaw && Number.isFinite(height) && height >= 48 && height <= 90;
            var weightOk = !!weightRaw && Number.isFinite(weight) && weight >= 80 && weight <= 500;

            if (!ageOk) {
                ageInput.style.borderColor = '#dc2626';
                if (!firstBadInput) firstBadInput = ageInput;
            }
            if (!heightOk) {
                heightInput.style.borderColor = '#dc2626';
                if (!firstBadInput) firstBadInput = heightInput;
            }
            if (!weightOk) {
                weightInput.style.borderColor = '#dc2626';
                if (!firstBadInput) firstBadInput = weightInput;
            }

            if (!ageOk || !heightOk || !weightOk) {
                showFieldError('quiz-body-error', 'Please enter valid values: age 18-100, height 48-90 inches, weight 80-500 lbs.');
                if (firstBadInput) try { firstBadInput.focus(); } catch (e) {}
                return;
            }
            showFieldError('quiz-body-error', '');
            state.age = age;
            state.heightInches = height;
            state.weightLbs = weight;
            saveState();
            advanceFrom(SCREEN.BODY);
        });
    }

    function bindSleepScreen() {
        var input = document.getElementById('quiz-sleep-hours-input');
        var btn = document.getElementById('quiz-sleep-continue');
        if (!input || !btn) return;
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

            var snoreOk = (state.loudSnoringOrApneas === true || state.loudSnoringOrApneas === false);
            var hoursOk = !!raw && Number.isFinite(n) && n >= 0 && n <= 14;
            if (!snoreOk || !hoursOk) {
                showFieldError('quiz-sleep-error', 'Please answer the snoring question and enter a sleep hours value between 0 and 14.');
                if (!hoursOk) {
                    input.style.borderColor = '#dc2626';
                    try { input.focus(); } catch (e) {}
                }
                return;
            }
            showFieldError('quiz-sleep-error', '');
            state.sleepHours = n;
            saveState();
            advanceFrom(SCREEN.SLEEP);
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
        state.adam = [null, null, null, null, null, null, null, null, null, null];
        state.age = null;
        state.heightInches = null;
        state.weightLbs = null;
        state.loudSnoringOrApneas = null;
        state.sleepHours = null;
        state.fertilityPlan = null;
        state.medicalHistory = [];
        state.medicalHistoryNoneSelected = false;
        state.psaTier = null;
        state.ipss = [null, null, null];
        state.medications = [];
        state.medicationsNoneSelected = false;
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
    var ENUM_FERTILITY = FERTILITY_PLAN_VALUES;
    var ENUM_PSA_TIER = PSA_TIER_VALUES;
    // History allowlist excludes 'none' (which is tracked via the separate
    // medicalHistoryNoneSelected flag, not in the array).
    var ENUM_HISTORY = {
        'untreated-male-breast-cancer': 1,
        'severe-untreated-chf': 1,
        'active-prostate-nodule-or-elevated-psa-pending': 1,
        'prostate-cancer-history': 1,
        'hematocrit-hx-gt-54': 1,
        'untreated-severe-osa': 1,
        'severe-bph-or-luts': 1,
        'severe-depression-with-si': 1,
        'other': 1
    };
    // Meds allowlist excludes 'none' (tracked via medicationsNoneSelected).
    var ENUM_MEDS = {
        'opioids': 1,
        'ssri-snri': 1,
        'beta-blockers': 1,
        'statins': 1,
        'glucocorticoids': 1,
        'prior-or-current-testosterone': 1
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

    // Validate a saved adam array — must be 10 entries of boolean or null.
    function pickAdamArray(saved) {
        var out = [null, null, null, null, null, null, null, null, null, null];
        if (!Array.isArray(saved)) return out;
        for (var i = 0; i < ADAM_ITEM_COUNT; i++) {
            var v = saved[i];
            if (v === true || v === false) out[i] = v;
        }
        return out;
    }

    // Validate a saved ipss array — must be 3 entries of integer 0-5 or null.
    function pickIpssArray(saved) {
        var out = [null, null, null];
        if (!Array.isArray(saved)) return out;
        for (var i = 0; i < IPSS_ITEM_COUNT; i++) {
            var v = saved[i];
            if (Number.isFinite(v) && v >= IPSS_VALUE_MIN && v <= IPSS_VALUE_MAX && Math.floor(v) === v) {
                out[i] = v;
            }
        }
        return out;
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
        state.adam = pickAdamArray(saved.adam);
        state.age = (Number.isFinite(saved.age) && saved.age >= 18 && saved.age <= 100) ? saved.age : null;
        state.heightInches = (Number.isFinite(saved.heightInches) && saved.heightInches >= 48 && saved.heightInches <= 90) ? saved.heightInches : null;
        state.weightLbs = (Number.isFinite(saved.weightLbs) && saved.weightLbs >= 80 && saved.weightLbs <= 500) ? saved.weightLbs : null;
        state.loudSnoringOrApneas = (saved.loudSnoringOrApneas === true || saved.loudSnoringOrApneas === false) ? saved.loudSnoringOrApneas : null;
        state.sleepHours = (Number.isFinite(saved.sleepHours) && saved.sleepHours >= 0 && saved.sleepHours <= 14) ? saved.sleepHours : null;
        state.fertilityPlan = pickEnum(saved.fertilityPlan, ENUM_FERTILITY, null);
        state.medicalHistory = pickEnumArray(saved.medicalHistory, ENUM_HISTORY);
        state.medicalHistoryNoneSelected = !!saved.medicalHistoryNoneSelected;
        state.psaTier = pickEnum(saved.psaTier, ENUM_PSA_TIER, null);
        state.ipss = pickIpssArray(saved.ipss);
        state.medications = pickEnumArray(saved.medications, ENUM_MEDS);
        state.medicationsNoneSelected = !!saved.medicationsNoneSelected;
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
        if (state.fertilityPlan) selectRadio('fertility', state.fertilityPlan);
        if (state.psaTier) selectRadio('psa', state.psaTier);
        if (state.loudSnoringOrApneas === true) selectRadioRow('snore', 'yes');
        else if (state.loudSnoringOrApneas === false) selectRadioRow('snore', 'no');

        // Rehydrate ADAM rows.
        for (var ai = 0; ai < ADAM_ITEM_COUNT; ai++) {
            if (state.adam[ai] === true) selectRadioRow('adam-' + ai, 'yes');
            else if (state.adam[ai] === false) selectRadioRow('adam-' + ai, 'no');
        }
        refreshAdamContinue();

        // Rehydrate IPSS rows.
        for (var ii = 0; ii < IPSS_ITEM_COUNT; ii++) {
            if (Number.isFinite(state.ipss[ii])) {
                selectRadioRow('ipss-' + ii, String(state.ipss[ii]));
            }
        }
        refreshIpssContinue();

        // Rehydrate inputs.
        var ageInput = document.getElementById('quiz-age-input');
        if (ageInput && state.age != null) ageInput.value = String(state.age);
        var heightInput = document.getElementById('quiz-height-input');
        if (heightInput && state.heightInches != null) heightInput.value = String(state.heightInches);
        var weightInput = document.getElementById('quiz-weight-input');
        if (weightInput && state.weightLbs != null) weightInput.value = String(state.weightLbs);
        var sleepInput = document.getElementById('quiz-sleep-hours-input');
        if (sleepInput && state.sleepHours != null) sleepInput.value = String(state.sleepHours);
        var stateSel = document.getElementById('quiz-state-select');
        if (stateSel && state.stateCode) stateSel.value = state.stateCode;

        // Rehydrate multi-checks — escape attribute values to prevent any
        // hostile string from breaking out of the selector.
        if (state.medicalHistory.length) {
            for (var ci = 0; ci < state.medicalHistory.length; ci++) {
                var hxEl = root.querySelector('[data-hx="' + safeAttrEscape(state.medicalHistory[ci]) + '"]');
                if (hxEl) hxEl.checked = true;
            }
        } else if (state.medicalHistoryNoneSelected) {
            var noneHxEl = root.querySelector('[data-hx-none="true"]');
            if (noneHxEl) noneHxEl.checked = true;
        }
        if (state.medications.length) {
            for (var mi = 0; mi < state.medications.length; mi++) {
                var medsEl = root.querySelector('[data-meds="' + safeAttrEscape(state.medications[mi]) + '"]');
                if (medsEl) medsEl.checked = true;
            }
        } else if (state.medicationsNoneSelected) {
            var noneMedsEl = root.querySelector('[data-meds-none="true"]');
            if (noneMedsEl) noneMedsEl.checked = true;
        }

        // Determine target screen — never restore directly to calculating or
        // results. If the saved currentScreen is past the ack, send the user
        // to ack so they explicitly re-acknowledge before re-rendering.
        var target = (typeof saved.currentScreen === 'number') ? saved.currentScreen : SCREEN.WELCOME;
        if (target === SCREEN.AGE_BLOCK || target === SCREEN.CALCULATING || target === SCREEN.RESULTS) {
            target = SCREEN.ACK;
        }
        if (target < SCREEN.WELCOME) target = SCREEN.WELCOME;
        if (target > SCREEN.ACK) target = SCREEN.ACK;
        show(target);
    }

    // ── Init ─────────────────────────────────────────────────────────

    function init() {
        if (!root) return;

        // Shared result URL: /quiz/low-t/?r=hard-stop|fertility-stop|psa-ipss|present|mixed|not-met
        try {
            var urlParams = new URLSearchParams(window.location.search);
            var sharedSlug = (urlParams.get('r') || '').trim().toLowerCase();
            if (sharedSlug && /^(hard-stop|fertility-stop|psa-ipss|present|mixed|not-met)$/.test(sharedSlug)) {
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
