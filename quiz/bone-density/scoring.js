/*
 * Bone Density Screener — Pure Scoring Module
 * ============================================
 *
 * Canonical, tested implementation of the bone-density quiz tiering logic.
 * Pure module: input → output, no DOM, no side effects, no globals.
 *
 * The browser-side quiz at /quiz/bone-density/quiz-engine.js inlines the
 * same logic inside an IIFE for runtime simplicity (no build step). The
 * Vitest suite at tests/bone-density-scoring.test.js pins the expected
 * behavior — if this file or the engine drifts, tests break.
 *
 * Validated basis: Osteoporosis Self-Assessment Tool (OST) — public domain.
 *   ostScore = 0.2 * (weightKg - ageYears)
 *   OST <2 cutoff applies ONLY to women ≥45.
 * Plus a custom risk-factor count drawn from AACE / Endocrine Society / NOF
 * clinical guidelines (public-domain factors, not FRAX scoring weights).
 *
 * NEVER reference "FRAX" — that name is licensed by University of Sheffield.
 *
 * Inputs (state object):
 *   age:                     number (years, ≥18 enforced upstream)
 *   sex:                     'male' | 'female' | 'prefer-not'
 *   weightKg:                number (preferred)
 *   weightLbs:               number (alternative; converted internally)
 *   heightLoss:              'yes' | 'no' | 'unknown'
 *   priorFragilityFracture:  'yes' | 'no'
 *   parentalHipFracture:     'yes' | 'no'
 *   smokingOrAlcohol:        'yes' | 'no'
 *   medications:             string[]   (multi-check, count length)
 *   prematureMenopause:      'yes' | 'no' | 'na'   (women only)
 *   secondaryConditions:     string[]   (multi-check, count length)
 *   stateCode:               'IL' | 'CA' | ... (2-letter US state)
 *
 * Output:
 *   {
 *     tier:            'A' | 'B' | 'C' | 'D',
 *     tierLabel:       neutral patient-facing header,
 *     resultSlug:      'clinical-indication' | 'high' | 'moderate' | 'low',
 *     ostScore:        number | null  (null when not applicable to woman ≥45),
 *     riskFactorCount: number,
 *     outOfState:      boolean        (true if stateCode !== 'IL'),
 *   }
 */

const LBS_TO_KG = 0.45359237;

export const TIER_LABELS = {
    A: 'Eligibility factors present',
    B: 'Eligibility factors present',
    C: 'Eligibility factors mixed',
    D: 'Eligibility factors not met'
};

export const RESULT_SLUGS = {
    A: 'clinical-indication',
    B: 'high',
    C: 'moderate',
    D: 'low'
};

/**
 * Resolve effective weight in kilograms. Prefers weightKg if provided,
 * otherwise converts weightLbs. Returns null if neither is a positive number.
 */
export function resolveWeightKg(state) {
    if (state == null) return null;
    if (typeof state.weightKg === 'number' && state.weightKg > 0) {
        return state.weightKg;
    }
    if (typeof state.weightLbs === 'number' && state.weightLbs > 0) {
        return state.weightLbs * LBS_TO_KG;
    }
    return null;
}

/**
 * OST = 0.2 * (weightKg - ageYears). Applied ONLY to women aged ≥45 per
 * the validated cutoff. Returns null when not applicable so the engine
 * can branch correctly. Never use OST <2 for men or women <45.
 */
export function computeOst(state) {
    if (!state) return null;
    if (state.sex !== 'female') return null;
    if (typeof state.age !== 'number' || state.age < 45) return null;
    const weightKg = resolveWeightKg(state);
    if (weightKg == null) return null;
    return 0.2 * (weightKg - state.age);
}

/**
 * Count the discrete risk factors per the v2 plan.
 *
 *   priorFragilityFracture (1 if 'yes', else 0)
 * + heightLoss             (1 if 'yes', else 0)
 * + parentalHipFracture    (1 if 'yes', else 0)
 * + smokingOrAlcohol       (1 if 'yes', else 0)
 * + medications.length     (multi-check count)
 * + prematureMenopause     (1 if 'yes', else 0; ignored for non-female)
 * + secondaryConditions.length (multi-check count)
 */
export function countRiskFactors(state) {
    if (!state) return 0;
    let count = 0;
    if (state.priorFragilityFracture === 'yes') count += 1;
    if (state.heightLoss === 'yes') count += 1;
    if (state.parentalHipFracture === 'yes') count += 1;
    if (state.smokingOrAlcohol === 'yes') count += 1;
    if (Array.isArray(state.medications)) count += state.medications.length;
    if (state.sex === 'female' && state.prematureMenopause === 'yes') count += 1;
    if (Array.isArray(state.secondaryConditions)) count += state.secondaryConditions.length;
    return count;
}

/**
 * Compute the final tier and metadata for rendering.
 *
 * Tier rules (stratified — NOT OR-logic):
 *   1. priorFragilityFracture === 'yes'     → TIER A (clinical indication)
 *   2. (woman ≥45 AND ostScore < 2)         → TIER B (high risk)
 *   3. riskFactorCount >= 3                 → TIER B (high risk)
 *   4. riskFactorCount >= 1                 → TIER C (moderate)
 *   5. else                                 → TIER D (low)
 *
 * Out-of-state users still receive a tier — the engine separately renders
 * an IL-gating message instead of the personalized result. Surfacing
 * `outOfState: true` lets the engine make that routing decision.
 */
export function scoreBoneDensity(state) {
    const ost = computeOst(state);
    const riskFactorCount = countRiskFactors(state);
    const isWomanOver45 = state && state.sex === 'female' &&
        typeof state.age === 'number' && state.age >= 45;

    let tier;
    if (state && state.priorFragilityFracture === 'yes') {
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

    const stateCode = state && typeof state.stateCode === 'string'
        ? state.stateCode.toUpperCase()
        : '';

    return {
        tier,
        tierLabel: TIER_LABELS[tier],
        resultSlug: RESULT_SLUGS[tier],
        ostScore: ost,
        riskFactorCount,
        outOfState: stateCode !== 'IL'
    };
}
