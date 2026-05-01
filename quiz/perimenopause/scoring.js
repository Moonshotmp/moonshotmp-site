/*
 * Perimenopause Screener — Pure Scoring Module
 * =============================================
 *
 * Canonical, tested implementation of the perimenopause-quiz tiering
 * logic. Pure module: input → output, no DOM, no side effects, no globals.
 *
 * The browser-side quiz at /quiz/perimenopause/quiz-engine.js inlines the
 * same logic inside an IIFE for runtime simplicity (no build step). The
 * Vitest suite at tests/perimenopause-scoring.test.js pins the expected
 * behavior — if this file or the engine drifts, tests break.
 *
 * Validated basis:
 *   Menopause Rating Scale (MRS) — Heinemann et al. 11-item validated
 *   instrument, public domain. Each item scored 0-4. Total interpretation:
 *
 *     0-4   none
 *     5-8   mild
 *     9-16  moderate
 *     ≥17   severe   (CORRECTED: v1 said "16+" which is wrong and citable)
 *
 * Plus: full HRT contraindication screen (9 items + catch-all). Plus:
 * cardiac/thyroid red-flag override when Q4 (palpitations) ≥3 AND Q8
 * (anxiety) ≥3 — interstitial warning surfaces before the result and the
 * red-flag flag travels with the submit payload.
 *
 * NEVER name specific drugs or hormones in tier output. NEVER tell the
 * user they "should start HRT." NEVER expose internal tier labels to the
 * patient ("severe" is OK as a clinical descriptor in supporting copy;
 * "Strong candidate" is not).
 *
 * Inputs (state object):
 *   age:                  number (years, ≥18 enforced upstream)
 *   menstrualStatus:      enum (see MENSTRUAL_STATUS_VALUES below)
 *   mrs:                  number[11] — values 0-4 each, indexed Q3..Q13
 *                         in the spec (mrs[0]=Q3 hot flushes, mrs[1]=Q4
 *                         palpitations, ..., mrs[5]=Q8 anxiety, ...)
 *   contraindications:    string[]   (multi-check, ANY entry triggers
 *                         the contraindication overlay)
 *   stateCode:            'IL' | 'CA' | ... (2-letter US state)
 *
 * Output:
 *   {
 *     mrsScore:             number   (sum of mrs items, 0-44),
 *     mrsTier:              'none' | 'mild' | 'moderate' | 'severe',
 *     hasHrtContraindication: boolean,
 *     hasRedFlag:           boolean   (Q4 ≥3 AND Q8 ≥3),
 *     internalTier:         (see INTERNAL_TIER_VALUES),
 *     internalTierLabel:    neutral patient-safe header,
 *     resultSlug:           short URL-safe key for ?source=&severity=,
 *     outOfState:           boolean   (true if stateCode !== 'IL'),
 *   }
 */

// MRS item indices into the 11-element mrs array. Q3 in the spec is
// mrs[0] in code — we keep the spec-numbered names so reviewers can
// cross-check against Heinemann et al. without translating offsets.
export const MRS_INDEX = {
    Q3_HOT_FLUSHES:        0,
    Q4_PALPITATIONS:       1,   // red-flag input
    Q5_SLEEP:              2,
    Q6_DEPRESSIVE:         3,
    Q7_IRRITABILITY:       4,
    Q8_ANXIETY:            5,   // red-flag input
    Q9_EXHAUSTION:         6,
    Q10_SEXUAL:            7,
    Q11_BLADDER:           8,
    Q12_VAGINAL_DRYNESS:   9,
    Q13_JOINT_MUSCLE:     10
};

export const MRS_ITEM_COUNT = 11;
export const MRS_VALUE_MIN = 0;
export const MRS_VALUE_MAX = 4;

export const MENSTRUAL_STATUS_VALUES = new Set([
    'regular',
    'irregular',
    'less-than-12-months-since-lmp',
    '12-or-more-months-since-lmp',
    'hyst-with-ovaries',
    'hyst-with-oophorectomy',
    'on-hormonal-contraception-or-hrt'
]);

export const INTERNAL_TIER_VALUES = new Set([
    'contraindication-identified',
    'eligibility-factors-present',
    'eligibility-factors-mixed',
    'eligibility-factors-not-met'
]);

// Patient-safe header strings. Match the four neutral labels approved in
// the v2 plan's universal guardrail #8.
export const INTERNAL_TIER_LABELS = {
    'contraindication-identified': 'Contraindication identified',
    'eligibility-factors-present': 'Eligibility factors present',
    'eligibility-factors-mixed':   'Eligibility factors mixed',
    'eligibility-factors-not-met': 'Eligibility factors not met'
};

// Short URL-safe key used in the booking CTA's ?severity= param.
// NOT shown to the patient. Used internally for capacity gating and
// booking-page personalization.
export const RESULT_SLUGS = {
    'contraindication-identified': 'contraindication',
    'eligibility-factors-present': 'present',
    'eligibility-factors-mixed':   'mixed',
    'eligibility-factors-not-met': 'not-met'
};

// MRS tier cutoffs. Heinemann et al. — DO NOT alter without re-citing.
// 16+ is wrong (v1's mistake); ≥17 is correct.
export const MRS_TIER_CUTOFFS = {
    NONE_MAX:     4,
    MILD_MAX:     8,
    MODERATE_MAX: 16
    // anything > MODERATE_MAX is severe
};

// Red-flag thresholds. Both must hit ≥3 simultaneously.
export const RED_FLAG_MIN = 3;

/**
 * Coerce a single MRS item value to an integer 0-4. Out-of-range or
 * non-numeric inputs become 0 (defensive — never let an injected string
 * skew the score). Returns 0 for null/undefined.
 */
function clampMrsValue(v) {
    if (typeof v !== 'number' || Number.isNaN(v)) return 0;
    if (v < MRS_VALUE_MIN) return MRS_VALUE_MIN;
    if (v > MRS_VALUE_MAX) return MRS_VALUE_MAX;
    return Math.floor(v);
}

/**
 * Sum the 11 MRS items. If `mrs` isn't an array of the expected shape
 * (or has fewer than 11 entries), missing slots count as 0. Extra
 * entries beyond 11 are ignored — we never sum past the validated set.
 */
export function sumMrs(mrs) {
    if (!Array.isArray(mrs)) return 0;
    let total = 0;
    for (let i = 0; i < MRS_ITEM_COUNT; i++) {
        total += clampMrsValue(mrs[i]);
    }
    return total;
}

/**
 * Map raw MRS total to one of four validated tiers. Boundary values
 * (4, 8, 16) belong to the LOWER tier. The tests pin every boundary.
 *
 * Use Number.isFinite — `typeof NaN === 'number'` is true, so a plain
 * typeof check would let NaN fall through every comparison and land in
 * the 'severe' branch. That's the worst possible failure mode for a
 * clinical screener: corrupted state escalates the patient to the
 * highest-tier output. Number.isFinite rejects NaN AND ±Infinity.
 */
export function mrsTier(score) {
    if (!Number.isFinite(score) || score < 0) return 'none';
    if (score <= MRS_TIER_CUTOFFS.NONE_MAX) return 'none';
    if (score <= MRS_TIER_CUTOFFS.MILD_MAX) return 'mild';
    if (score <= MRS_TIER_CUTOFFS.MODERATE_MAX) return 'moderate';
    return 'severe';
}

/**
 * Detect the cardiac/thyroid red-flag combination. Q4 (palpitations) AND
 * Q8 (anxiety) both ≥3. Triggers the interstitial warning screen before
 * the result renders — this routes patients with potentially serious
 * non-hormonal causes (paroxysmal AFib, thyroid disease) to a clinician
 * before they default to a perimenopausal explanation.
 */
export function hasRedFlag(mrs) {
    if (!Array.isArray(mrs)) return false;
    const palpitations = clampMrsValue(mrs[MRS_INDEX.Q4_PALPITATIONS]);
    const anxiety = clampMrsValue(mrs[MRS_INDEX.Q8_ANXIETY]);
    return palpitations >= RED_FLAG_MIN && anxiety >= RED_FLAG_MIN;
}

/**
 * Any non-empty contraindication selection triggers the contraindication
 * overlay AND overrides the MRS-derived internalTier with the
 * "contraindication-identified" tier. The patient-facing copy adds an
 * overlay paragraph noting non-hormone-based evaluation paths exist.
 */
export function hasHrtContraindication(contraindications) {
    if (!Array.isArray(contraindications)) return false;
    return contraindications.length > 0;
}

/**
 * Assemble the full scoring result. Tier rules:
 *
 *   1. Any contraindication        → contraindication-identified
 *   2. mrsTier severe OR moderate  → eligibility-factors-present
 *   3. mrsTier mild                → eligibility-factors-mixed
 *   4. else                        → eligibility-factors-not-met
 *
 * The contraindication branch wins regardless of MRS score. A patient
 * with severe symptoms AND a contraindication is routed to the
 * contraindication path (that's the safer clinical default).
 *
 * The red-flag flag is independent of internalTier — it controls whether
 * the engine renders the interstitial warning before the result, but
 * does not change the tier itself. A red-flag patient with severe MRS
 * still receives the severe-symptom result; the interstitial just
 * forces them to acknowledge the cardiac/thyroid warning first.
 */
export function scorePerimenopause(state) {
    const mrs = state && state.mrs;
    const contraindications = state && state.contraindications;

    const mrsScore = sumMrs(mrs);
    const tier = mrsTier(mrsScore);
    const redFlag = hasRedFlag(mrs);
    const contraindication = hasHrtContraindication(contraindications);

    let internalTier;
    if (contraindication) {
        internalTier = 'contraindication-identified';
    } else if (tier === 'severe' || tier === 'moderate') {
        internalTier = 'eligibility-factors-present';
    } else if (tier === 'mild') {
        internalTier = 'eligibility-factors-mixed';
    } else {
        internalTier = 'eligibility-factors-not-met';
    }

    const stateCode = state && typeof state.stateCode === 'string'
        ? state.stateCode.toUpperCase()
        : '';

    return {
        mrsScore,
        mrsTier: tier,
        hasHrtContraindication: contraindication,
        hasRedFlag: redFlag,
        internalTier,
        internalTierLabel: INTERNAL_TIER_LABELS[internalTier],
        resultSlug: RESULT_SLUGS[internalTier],
        outOfState: stateCode !== 'IL'
    };
}
