/*
 * GLP-1 Readiness Screener — Pure Scoring Module
 * ===============================================
 *
 * Canonical, tested implementation of the GLP-1 quiz tiering logic.
 * Pure module: input → output, no DOM, no side effects, no globals.
 *
 * The browser-side quiz at /quiz/glp1/quiz-engine.js inlines the same
 * logic inside an IIFE for runtime simplicity (no build step). The
 * Vitest suite at tests/glp1-scoring.test.js pins the expected
 * behavior — if this file or the engine drifts, tests break.
 *
 * Validated basis:
 *   - FDA labeling for prescription weight-management medications
 *     (Wegovy semaglutide 2.4mg, Zepbound tirzepatide) defines
 *     candidacy: BMI ≥30, OR BMI ≥27 with at least one weight-related
 *     comorbidity (T2D, HTN, dyslipidemia, OSA, CV disease, NAFLD,
 *     PCOS). Documented prior weight-loss attempt expected.
 *   - Hard contraindications drawn from labeling + FDA-required
 *     warnings: MTC/MEN2 personal or family history, pancreatitis,
 *     severe gastroparesis, T1D, active eating disorder, recent
 *     psychiatric hospitalization or current SI, severe ESRD,
 *     severe diabetic retinopathy on insulin. Pregnancy is a separate
 *     hard-stop.
 *   - Bariatric-surgery history routes to a specialist-evaluation
 *     tier (modifier — does not block, but redirects the consult).
 *
 * Tier precedence (strict — earlier wins):
 *
 *   1. contraindication-identified  — any medical hard-stop OR pregnancy
 *                                     OR free-text "other" catch-all
 *   2. specialist-evaluation        — bariatric-surgery modifier
 *   3. eligibility-not-met-bmi      — BMI <27, FDA labeling threshold
 *                                     not met
 *   4. eligibility-mixed            — BMI 27-30 without comorbidity, OR
 *                                     BMI ≥27 missing prior attempt or
 *                                     readiness ≥3
 *   5. eligibility-present          — BMI ≥30 OR (BMI ≥27 + comorbidity),
 *                                     prior weight-loss attempt yes,
 *                                     readiness ≥3
 *
 * Patient-facing tier labels collapse into 4 neutral guardrail-approved
 * strings (universal guardrail #8). The renderer differentiates body
 * copy by `internalTier`.
 *
 * NEVER name specific GLP-1 drugs in tier output. Banned: semaglutide,
 * tirzepatide, Wegovy, Ozempic, Zepbound, Mounjaro, Saxenda, Victoza,
 * Trulicity, Rybelsus. Banned phrases: "you qualify for", "compounded
 * versions are equivalent", "candidate" framing in patient-facing tier
 * labels. Tier labels use neutral guardrail strings only.
 *
 * Inputs (state object):
 *   age:                  number
 *   sex:                  'male' | 'female' | 'prefer-not'
 *   heightInches:         number
 *   weightLbs:            number
 *   comorbidities:        string[]   subset of COMORBIDITY_KEYS
 *   ascvd:                { totalCholesterol?, ldl?, hdl? } — optional;
 *                         only collected if Q4 includes 'high-cholesterol'
 *   priorAttempt:         'yes' | 'no' | 'prefer-not'
 *   medicalHistory:       string[]   subset of MED_HISTORY_KEYS (incl
 *                         all 8 hard-stops + 'none'). The free-text
 *                         catch-all from Q9 routes through `otherCondition`
 *                         (separate field; non-empty triggers contraind).
 *   pregnancyOrPlanning:  'yes' | 'no'
 *   bariatricHistory:     'yes' | 'no'
 *   otherCondition:       string     non-empty triggers contraind
 *   readiness:            number     1-5 Likert
 *   stateCode:            'IL' | ...
 *
 * Output:
 *   {
 *     bmi:                       number | null,
 *     hasComorbidity:            boolean,
 *     hasMedicalHardStop:        boolean,
 *     hasPregnancyHardStop:      boolean,
 *     hasOtherConditionHardStop: boolean,
 *     hasBariatricModifier:      boolean,
 *     bmiMeetsThreshold:         boolean   (≥30 OR ≥27 + comorbidity),
 *     bmiBorderline:             boolean   (27-30 without comorbidity),
 *     bmiBelowThreshold:         boolean   (<27),
 *     priorAttemptYes:           boolean,
 *     readinessAdequate:         boolean   (≥3),
 *     internalTier:              one of 5,
 *     internalTierLabel:         neutral patient-safe header,
 *     resultSlug:                short URL key for ?result=,
 *     outOfState:                boolean,
 *   }
 */

// 8 hard-stop medical history keys — any single one routes to
// contraindication-identified. Drawn from FDA labeling + REMS-style
// warnings. T1D and severe ESRD added per P0 #16 review (v1 missed).
export const HARD_STOP_MEDICAL = new Set([
    'mtc-or-men2',
    'pancreatitis',
    'severe-gastroparesis',
    't1d',
    'eating-disorder',
    'suicidal-ideation-or-recent-psych-hospitalization',
    'severe-esrd',
    'severe-diabetic-retinopathy-on-insulin'
]);

// Allowlist for medical-history multi-check (validation only). 'none'
// means user explicitly checked None of these.
export const MED_HISTORY_KEYS = new Set([
    ...HARD_STOP_MEDICAL,
    'none'
]);

// Comorbidity keys for the BMI-≥27 weight-related condition path.
// 'none' clears the others. Order matches FDA labeling.
export const COMORBIDITY_KEYS = new Set([
    't2d-or-prediabetes',
    'high-blood-pressure',
    'high-cholesterol',
    'sleep-apnea',
    'pcos',
    'nafld',
    'cardiovascular-disease',
    'none'
]);

// The 7 weight-related comorbidities that satisfy FDA labeling's
// "≥27 BMI with comorbidity" path. 'none' is excluded.
const QUALIFYING_COMORBIDITIES = new Set([
    't2d-or-prediabetes',
    'high-blood-pressure',
    'high-cholesterol',
    'sleep-apnea',
    'pcos',
    'nafld',
    'cardiovascular-disease'
]);

export const PRIOR_ATTEMPT_VALUES = new Set(['yes', 'no', 'prefer-not']);

export const SEX_VALUES = new Set(['male', 'female', 'prefer-not']);

export const INTERNAL_TIER_VALUES = new Set([
    'contraindication-identified',
    'specialist-evaluation',
    'eligibility-not-met-bmi',
    'eligibility-mixed',
    'eligibility-present'
]);

// Patient-facing tier labels — four neutral strings (guardrail #8).
// Specialist-evaluation gets its own neutral label since it's not a
// contraindication and not an eligibility tier.
export const INTERNAL_TIER_LABELS = {
    'contraindication-identified': 'Contraindication identified',
    'specialist-evaluation':       'Specialist evaluation indicated',
    'eligibility-not-met-bmi':     'Eligibility factors not met',
    'eligibility-mixed':           'Eligibility factors mixed',
    'eligibility-present':         'Eligibility factors present'
};

// Short URL-safe keys for booking CTA's ?result= param.
export const RESULT_SLUGS = {
    'contraindication-identified': 'contraindication',
    'specialist-evaluation':       'specialist',
    'eligibility-not-met-bmi':     'not-met',
    'eligibility-mixed':           'mixed',
    'eligibility-present':         'present'
};

// BMI thresholds drawn directly from FDA labeling for prescription
// weight-management medications. Do NOT alter without re-citing
// Wegovy / Zepbound prescribing information.
export const BMI_THRESHOLD_OBESITY = 30;
export const BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY = 27;
export const READINESS_ADEQUATE_MIN = 3;

const LBS_TO_KG = 0.45359237;
const INCHES_TO_METERS = 0.0254;

/**
 * BMI = weightKg / heightMeters^2. Returns null if either input is
 * not a positive finite number. Used as the primary tier branch.
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
 * Has at least one of the 7 qualifying weight-related comorbidities.
 * 'none' explicitly does NOT qualify. Empty array does not qualify.
 */
export function hasComorbidity(state) {
    if (!state || !Array.isArray(state.comorbidities)) return false;
    for (let i = 0; i < state.comorbidities.length; i++) {
        if (QUALIFYING_COMORBIDITIES.has(state.comorbidities[i])) return true;
    }
    return false;
}

export function hasMedicalHardStop(state) {
    if (!state || !Array.isArray(state.medicalHistory)) return false;
    for (let i = 0; i < state.medicalHistory.length; i++) {
        if (HARD_STOP_MEDICAL.has(state.medicalHistory[i])) return true;
    }
    return false;
}

export function hasPregnancyHardStop(state) {
    return !!(state && state.pregnancyOrPlanning === 'yes');
}

/**
 * Free-text catch-all from Q9 ("OR any other condition you've been
 * told affects medication choices?"). Any non-empty string after
 * trimming routes to contraindication. The catch-all exists per
 * universal guardrail #9 to defeat the implicit-warranty trap.
 */
export function hasOtherConditionHardStop(state) {
    if (!state || typeof state.otherCondition !== 'string') return false;
    return state.otherCondition.trim().length > 0;
}

export function hasBariatricModifier(state) {
    return !!(state && state.bariatricHistory === 'yes');
}

export function priorAttemptYes(state) {
    return !!(state && state.priorAttempt === 'yes');
}

export function readinessAdequate(state) {
    return !!(state &&
        Number.isFinite(state.readiness) &&
        state.readiness >= READINESS_ADEQUATE_MIN);
}

/**
 * BMI threshold check per FDA labeling: ≥30, OR ≥27 with at least one
 * qualifying comorbidity. Returns true when this threshold is met.
 */
export function bmiMeetsThreshold(state) {
    const bmi = computeBmi(state);
    if (bmi === null) return false;
    if (bmi >= BMI_THRESHOLD_OBESITY) return true;
    if (bmi >= BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY && hasComorbidity(state)) return true;
    return false;
}

/**
 * BMI is in the 27-30 range AND no qualifying comorbidity. This is the
 * borderline range where FDA labeling does not authorize prescription
 * weight-management therapy on its own.
 */
export function bmiBorderline(state) {
    const bmi = computeBmi(state);
    if (bmi === null) return false;
    if (bmi < BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY) return false;
    if (bmi >= BMI_THRESHOLD_OBESITY) return false;
    return !hasComorbidity(state);
}

/**
 * BMI <27 is below FDA labeling threshold for any prescription
 * weight-management medication. Returns true when BMI is computed
 * and below 27.
 */
export function bmiBelowThreshold(state) {
    const bmi = computeBmi(state);
    if (bmi === null) return false;
    return bmi < BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY;
}

/**
 * Compute the full scoring result. Strict precedence ladder — earliest
 * branch wins. The bariatric modifier comes BEFORE BMI checks because
 * post-bariatric weight management is a specialist conversation
 * regardless of current BMI.
 */
export function scoreGlp1(state) {
    const bmi = computeBmi(state);
    const comorbidity = hasComorbidity(state);
    const medicalHardStop = hasMedicalHardStop(state);
    const pregnancyHardStop = hasPregnancyHardStop(state);
    const otherConditionHardStop = hasOtherConditionHardStop(state);
    const bariatricModifier = hasBariatricModifier(state);
    const meetsThreshold = bmiMeetsThreshold(state);
    const borderline = bmiBorderline(state);
    const belowThreshold = bmiBelowThreshold(state);
    const priorAttempt = priorAttemptYes(state);
    const readyEnough = readinessAdequate(state);

    let internalTier;
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

    const stateCode = state && typeof state.stateCode === 'string'
        ? state.stateCode.toUpperCase()
        : '';

    return {
        bmi,
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
        internalTier,
        internalTierLabel: INTERNAL_TIER_LABELS[internalTier],
        resultSlug: RESULT_SLUGS[internalTier],
        outOfState: stateCode !== 'IL'
    };
}
