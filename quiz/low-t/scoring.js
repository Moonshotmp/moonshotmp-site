/*
 * Low Testosterone (TRT Readiness) Screener — Pure Scoring Module
 * ================================================================
 *
 * Canonical, tested implementation of the low-T quiz tiering logic.
 * Pure module: input → output, no DOM, no side effects, no globals.
 *
 * The browser-side quiz at /quiz/low-t/quiz-engine.js inlines the same
 * logic inside an IIFE for runtime simplicity (no build step). The
 * Vitest suite at tests/low-t-scoring.test.js pins the expected
 * behavior — if this file or the engine drifts, tests break.
 *
 * Validated basis:
 *   - ADAM (Androgen Deficiency in Aging Males) — 10 yes/no items.
 *     Approximately 88% sensitivity, 60% specificity. Positive when
 *     Q1 (libido decrease) OR Q7 (weaker erections) is yes, OR ≥3 of
 *     any other items are yes.
 *   - PSA tier (patient self-reported value, banded for screening) —
 *     >4.0 ng/mL routes to urology referral first; >10.0 ng/mL is
 *     urgent.
 *   - IPSS short-form (3 items, 0-5 each, sum 0-15). Sum >7 indicates
 *     bothersome lower-urinary-tract symptoms warranting workup.
 *
 * Tier precedence (strict — earlier wins):
 *
 *   1. hard-stop          — any medical hard-stop contraindication
 *                           (untreated male breast cancer, severe
 *                           untreated CHF, active prostate nodule /
 *                           known elevated PSA pending workup)
 *   2. fertility-stop     — currently trying to conceive OR planning
 *                           to in next 12 months (Q5)
 *   3. psa-ipss-concern   — PSA >4.0 ng/mL or IPSS sum >7
 *   4. eligibility-present  — ADAM positive, no confounder, no above
 *   5. eligibility-mixed    — ADAM positive WITH confounder
 *                             (untreated severe OSA OR opioid/SSRI use)
 *   6. eligibility-not-met  — ADAM negative
 *
 * Patient-facing tier labels collapse the 6 internal tiers into 3
 * neutral guardrail-approved labels (universal guardrail #8):
 *
 *   Contraindication identified  → hard-stop / fertility-stop / psa-ipss-concern
 *   Eligibility factors present  → eligibility-present
 *   Eligibility factors mixed    → eligibility-mixed
 *   Eligibility factors not met  → eligibility-not-met
 *
 * NEVER name specific drugs in tier output. The v1 line "There are
 * alternatives (Clomid, HCG-based protocols, lifestyle optimization)
 * that preserve fertility" is permanently retired — replaced with the
 * generic "Several non-testosterone-based approaches exist that may
 * preserve fertility — these require clinical evaluation to determine
 * fit." (engine + handler render this verbatim).
 *
 * Inputs (state object):
 *   age:                   number
 *   heightInches:          number
 *   weightLbs:              number
 *   adam:                   boolean[10]   true if "yes" for that item
 *   loudSnoringOrApneas:    boolean       Q4 OSA flag input
 *   sleepHours:             number
 *   fertilityPlan:          'currently-trying-or-12mo' | 'planning-eventually' | 'not-planning' | 'na'
 *   medicalHistory:         string[]      multi-check; entries from MED_HISTORY_KEYS
 *   psaTier:                'le-2.5' | '2.5-4.0' | '4.0-10.0' | 'gt-10.0' | 'unknown' | 'no-test'
 *   ipss:                   number[3]     each 0-5
 *   medications:            string[]      multi-check; entries from MEDS_KEYS
 *   stateCode:              'IL' | ...
 *
 * Output:
 *   {
 *     adamPositive:        boolean,
 *     adamYesCount:        number,
 *     bmi:                 number | null,    // null if inputs invalid
 *     ipssSum:             number,
 *     hasHardStopMedical:  boolean,
 *     hasFertilityStop:    boolean,
 *     hasPsaConcern:       boolean,
 *     hasIpssConcern:      boolean,
 *     hasOsaConfounder:    boolean,
 *     hasMedConfounder:    boolean,
 *     internalTier:        (one of 6),
 *     internalTierLabel:   patient-safe header,
 *     resultSlug:          short URL key for ?result=,
 *     outOfState:          boolean,
 *   }
 */

export const ADAM_ITEM_COUNT = 10;
export const ADAM_LIBIDO_INDEX = 0;       // Q1 (decrease in libido)
export const ADAM_ERECTIONS_INDEX = 6;    // Q7 (erections less strong)
export const ADAM_OTHERS_THRESHOLD = 3;   // ≥3 other items 'yes' triggers ADAM positive

// Hard-stop medical history keys. Any single one routes to 'hard-stop'.
export const HARD_STOP_MEDICAL = new Set([
    'untreated-male-breast-cancer',
    'severe-untreated-chf',
    'active-prostate-nodule-or-elevated-psa-pending'
]);

// Flag-only medical history keys. NOT a hard stop on their own — these
// surface in clinical context but don't override ADAM tiering by
// themselves.
export const FLAG_MEDICAL = new Set([
    'prostate-cancer-history',
    'hematocrit-hx-gt-54',
    'untreated-severe-osa',
    'severe-bph-or-luts',
    'severe-depression-with-si'
]);

// Combined allowlist for medical-history multi-check (validation only).
export const MED_HISTORY_KEYS = new Set([
    ...HARD_STOP_MEDICAL,
    ...FLAG_MEDICAL,
    'other'   // catch-all
]);

// Allowlist for current-medications multi-check.
export const MEDS_KEYS = new Set([
    'opioids',
    'ssri-snri',
    'beta-blockers',
    'statins',
    'glucocorticoids',
    'prior-or-current-testosterone',
    'none'
]);

// Confounder-medications: opioids and SSRIs/SNRIs are documented to
// suppress testosterone. These don't block — they shift ADAM-positive
// patients into the 'eligibility-mixed' bucket so the result body
// surfaces the confounder context.
export const CONFOUNDER_MEDS = new Set(['opioids', 'ssri-snri']);

export const FERTILITY_PLAN_VALUES = new Set([
    'currently-trying-or-12mo',
    'planning-eventually',
    'not-planning',
    'na'
]);

// PSA tier inputs (patient self-reported, banded). >4.0 ng/mL routes
// to urology referral first; >10.0 ng/mL is urgent. Below 4.0 does not
// trigger psa-ipss-concern on its own. 'unknown' and 'no-test' are
// treated as "no PSA flag" — clinician will order one if appropriate.
export const PSA_TIER_VALUES = new Set([
    'le-2.5', '2.5-4.0', '4.0-10.0', 'gt-10.0', 'unknown', 'no-test'
]);
const PSA_CONCERN_TIERS = new Set(['4.0-10.0', 'gt-10.0']);

export const IPSS_ITEM_COUNT = 3;
export const IPSS_VALUE_MIN = 0;
export const IPSS_VALUE_MAX = 5;
export const IPSS_CONCERN_THRESHOLD = 7;   // sum >7 triggers concern

export const INTERNAL_TIER_VALUES = new Set([
    'hard-stop',
    'fertility-stop',
    'psa-ipss-concern',
    'eligibility-present',
    'eligibility-mixed',
    'eligibility-not-met'
]);

// Patient-facing tier labels — three neutral strings (universal
// guardrail #8). Multiple internal tiers map to the same label; the
// renderer differentiates body copy by internalTier.
export const INTERNAL_TIER_LABELS = {
    'hard-stop':            'Contraindication identified',
    'fertility-stop':       'Contraindication identified',
    'psa-ipss-concern':     'Contraindication identified',
    'eligibility-present':  'Eligibility factors present',
    'eligibility-mixed':    'Eligibility factors mixed',
    'eligibility-not-met':  'Eligibility factors not met'
};

// Short URL-safe keys for booking CTA's ?result= param.
export const RESULT_SLUGS = {
    'hard-stop':            'hard-stop',
    'fertility-stop':       'fertility-stop',
    'psa-ipss-concern':     'psa-ipss',
    'eligibility-present':  'present',
    'eligibility-mixed':    'mixed',
    'eligibility-not-met':  'not-met'
};

const LBS_TO_KG = 0.45359237;
const INCHES_TO_METERS = 0.0254;

/**
 * BMI = weightKg / heightMeters^2. Returns null if either input is
 * not a positive finite number. Used for context only — does not
 * influence tier directly. (Future: BMI ≥30 may modify confounder
 * behavior, but per v2 plan it's reported but not scored.)
 */
export function computeBmi(state) {
    if (!state) return null;
    if (!Number.isFinite(state.heightInches) || state.heightInches <= 0) return null;
    if (!Number.isFinite(state.weightLbs) || state.weightLbs <= 0) return null;
    const meters = state.heightInches * INCHES_TO_METERS;
    const kg = state.weightLbs * LBS_TO_KG;
    return kg / (meters * meters);
}

/**
 * ADAM positive = Q1 yes OR Q7 yes OR ≥3 of any other items yes.
 * (Q1 and Q7 are the "key" items per the validated instrument.)
 */
export function adamYesCount(adam) {
    if (!Array.isArray(adam)) return 0;
    let count = 0;
    for (let i = 0; i < ADAM_ITEM_COUNT; i++) {
        if (adam[i] === true) count += 1;
    }
    return count;
}

export function isAdamPositive(adam) {
    if (!Array.isArray(adam)) return false;
    if (adam[ADAM_LIBIDO_INDEX] === true) return true;
    if (adam[ADAM_ERECTIONS_INDEX] === true) return true;
    // Count "other" items (excluding Q1 and Q7) — ≥3 triggers positive.
    let others = 0;
    for (let i = 0; i < ADAM_ITEM_COUNT; i++) {
        if (i === ADAM_LIBIDO_INDEX || i === ADAM_ERECTIONS_INDEX) continue;
        if (adam[i] === true) others += 1;
    }
    return others >= ADAM_OTHERS_THRESHOLD;
}

export function clampIpssValue(v) {
    if (!Number.isFinite(v)) return 0;
    if (v < IPSS_VALUE_MIN) return IPSS_VALUE_MIN;
    if (v > IPSS_VALUE_MAX) return IPSS_VALUE_MAX;
    return Math.floor(v);
}

export function sumIpss(ipss) {
    if (!Array.isArray(ipss)) return 0;
    let total = 0;
    for (let i = 0; i < IPSS_ITEM_COUNT; i++) {
        total += clampIpssValue(ipss[i]);
    }
    return total;
}

export function hasHardStopMedical(medicalHistory) {
    if (!Array.isArray(medicalHistory)) return false;
    for (let i = 0; i < medicalHistory.length; i++) {
        if (HARD_STOP_MEDICAL.has(medicalHistory[i])) return true;
    }
    return false;
}

export function hasFertilityStop(state) {
    return state && state.fertilityPlan === 'currently-trying-or-12mo';
}

export function hasPsaConcern(state) {
    if (!state || typeof state.psaTier !== 'string') return false;
    return PSA_CONCERN_TIERS.has(state.psaTier);
}

export function hasIpssConcern(state) {
    return state && sumIpss(state.ipss) > IPSS_CONCERN_THRESHOLD;
}

export function hasOsaConfounder(state) {
    return !!(state && state.loudSnoringOrApneas === true);
}

export function hasMedConfounder(state) {
    if (!state || !Array.isArray(state.medications)) return false;
    for (let i = 0; i < state.medications.length; i++) {
        if (CONFOUNDER_MEDS.has(state.medications[i])) return true;
    }
    return false;
}

/**
 * Compute the full scoring result. Strict precedence ladder — earliest
 * branch wins. ADAM is only consulted after all hard-stops clear.
 */
export function scoreLowT(state) {
    const adam = state && state.adam;
    const adamPositive = isAdamPositive(adam);
    const adamCount = adamYesCount(adam);
    const bmi = computeBmi(state);
    const ipssSum = sumIpss(state && state.ipss);
    const hardStopMedical = hasHardStopMedical(state && state.medicalHistory);
    const fertilityStop = hasFertilityStop(state);
    const psaConcern = hasPsaConcern(state);
    const ipssConcern = hasIpssConcern(state);
    const osaConfounder = hasOsaConfounder(state);
    const medConfounder = hasMedConfounder(state);

    let internalTier;
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

    const stateCode = state && typeof state.stateCode === 'string'
        ? state.stateCode.toUpperCase()
        : '';

    return {
        adamPositive,
        adamYesCount: adamCount,
        bmi,
        ipssSum,
        hasHardStopMedical: hardStopMedical,
        hasFertilityStop: fertilityStop,
        hasPsaConcern: psaConcern,
        hasIpssConcern: ipssConcern,
        hasOsaConfounder: osaConfounder,
        hasMedConfounder: medConfounder,
        internalTier,
        internalTierLabel: INTERNAL_TIER_LABELS[internalTier],
        resultSlug: RESULT_SLUGS[internalTier],
        outOfState: stateCode !== 'IL'
    };
}
