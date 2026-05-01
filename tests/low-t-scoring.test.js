import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    computeBmi,
    adamYesCount,
    isAdamPositive,
    clampIpssValue,
    sumIpss,
    hasHardStopMedical,
    hasFertilityStop,
    hasPsaConcern,
    hasIpssConcern,
    hasOsaConfounder,
    hasMedConfounder,
    scoreLowT,
    ADAM_ITEM_COUNT,
    ADAM_LIBIDO_INDEX,
    ADAM_ERECTIONS_INDEX,
    ADAM_OTHERS_THRESHOLD,
    HARD_STOP_MEDICAL,
    FLAG_MEDICAL,
    MED_HISTORY_KEYS,
    MEDS_KEYS,
    CONFOUNDER_MEDS,
    FERTILITY_PLAN_VALUES,
    PSA_TIER_VALUES,
    IPSS_ITEM_COUNT,
    IPSS_VALUE_MIN,
    IPSS_VALUE_MAX,
    IPSS_CONCERN_THRESHOLD,
    INTERNAL_TIER_VALUES,
    INTERNAL_TIER_LABELS,
    RESULT_SLUGS
} from '../quiz/low-t/scoring.js';

/*
 * Low Testosterone (TRT Readiness) Screener — Regression Suite
 * ============================================================
 *
 * This is the legal/clinical pin for the low-T quiz tiering logic. The
 * canonical source of truth is `quiz/low-t/scoring.js`. The browser engine
 * (when authored) inlines the same rules as an IIFE. If either drifts,
 * these tests break.
 *
 * Branches covered (every conditional in scoring.js):
 *   computeBmi:         null state, missing/zero/negative/NaN height,
 *                       missing/zero/negative/NaN weight, sensible defaults,
 *                       boundary edges (under/normal/over).
 *   adamYesCount:       non-array, all true, all false, mixed, strict
 *                       boolean coercion, short array.
 *   isAdamPositive:     Q1 path, Q7 path, "≥3 others" path with every
 *                       boundary, defensive non-array.
 *   clampIpssValue:     in-range, max-clamp, min-clamp, floor, NaN,
 *                       Infinity, non-numeric.
 *   sumIpss:            empty/non-array, all-zero, all-max, fewer-than-3,
 *                       more-than-3, non-numeric, out-of-range entries.
 *   hasHardStopMedical: each hard-stop key, each flag (NOT a hard stop),
 *                       'other', 'none', mixed.
 *   hasFertilityStop:   each fertilityPlan enum, defensive null.
 *   hasPsaConcern:      every PSA tier, missing/non-string defensive.
 *   hasIpssConcern:     boundary at 7/8, all-zero, all-max.
 *   hasOsaConfounder:   true/false/missing.
 *   hasMedConfounder:   each MEDS_KEYS entry, multiple, none.
 *   scoreLowT:          full precedence ladder (hard-stop wins, fertility
 *                       wins, psa-ipss wins, ADAM+confounder = mixed,
 *                       ADAM clean = present, ADAM- = not-met) plus
 *                       defensive null/empty.
 *
 * Forbidden-content scan (engine + submit handler source files when present)
 * catches banned drug names, candidacy language, and the v1 "Clomid/HCG"
 * fertility line that has been permanently retired.
 */

// ─── computeBmi ──────────────────────────────────────────────────────

describe('computeBmi', () => {
    it.each([
        ['null',      null],
        ['undefined', undefined]
    ])('returns null when state is %s', (_label, state) => {
        expect(computeBmi(state)).toBeNull();
    });

    it.each([
        ['missing',  { weightLbs: 180 }],
        ['zero',     { heightInches: 0,    weightLbs: 180 }],
        ['negative', { heightInches: -5,   weightLbs: 180 }],
        ['NaN',      { heightInches: NaN,  weightLbs: 180 }]
    ])('returns null when heightInches is %s', (_label, state) => {
        expect(computeBmi(state)).toBeNull();
    });

    it.each([
        ['missing',  { heightInches: 70 }],
        ['zero',     { heightInches: 70, weightLbs: 0 }],
        ['negative', { heightInches: 70, weightLbs: -10 }],
        ['NaN',      { heightInches: 70, weightLbs: NaN }]
    ])('returns null when weightLbs is %s', (_label, state) => {
        expect(computeBmi(state)).toBeNull();
    });

    it('returns sensible BMI for typical inputs (70 in, 180 lbs → ~25.8)', () => {
        const bmi = computeBmi({ heightInches: 70, weightLbs: 180 });
        expect(bmi).toBeCloseTo(25.8, 1);
    });

    it('tall + heavy: 75 in, 250 lbs → ~31.2 (obese)', () => {
        const bmi = computeBmi({ heightInches: 75, weightLbs: 250 });
        expect(bmi).toBeCloseTo(31.2, 1);
    });

    it('short + light: 60 in, 100 lbs → ~19.5 (underweight-ish)', () => {
        const bmi = computeBmi({ heightInches: 60, weightLbs: 100 });
        expect(bmi).toBeCloseTo(19.5, 1);
    });

    it('returns finite numeric for boundary edge: 60 in, 90 lbs → ~17.6', () => {
        const bmi = computeBmi({ heightInches: 60, weightLbs: 90 });
        expect(Number.isFinite(bmi)).toBe(true);
        expect(bmi).toBeCloseTo(17.6, 1);
    });
});

// ─── adamYesCount ────────────────────────────────────────────────────

describe('adamYesCount', () => {
    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['string',    'yes'],
        ['number',    5],
        ['object',    {}]
    ])('returns 0 for non-array input (%s)', (_label, input) => {
        expect(adamYesCount(input)).toBe(0);
    });

    it('returns 10 when all 10 items are true', () => {
        expect(adamYesCount([true, true, true, true, true, true, true, true, true, true])).toBe(10);
    });

    it('returns 0 when all 10 items are false', () => {
        expect(adamYesCount([false, false, false, false, false, false, false, false, false, false])).toBe(0);
    });

    it('returns 5 for mixed: [t,f,t,t,f,f,t,f,f,t]', () => {
        expect(adamYesCount([true, false, true, true, false, false, true, false, false, true])).toBe(5);
    });

    it('boolean-coerce: only `=== true` counts. 1, "yes", truthy do NOT count (defensive)', () => {
        expect(adamYesCount([1, 'yes', 'true', {}, [], 'truthy', 'y', 1, 1, 1])).toBe(0);
    });

    it('array shorter than 10: counts only the trues that exist', () => {
        expect(adamYesCount([true, true, false])).toBe(2);
    });
});

// ─── isAdamPositive — table-driven, every branch ─────────────────────

describe('isAdamPositive — every branch', () => {
    const cases = [
        // [label, adamArray, expected]
        [
            'Q1 yes only, all else no → true (Q1 path)',
            [true, false, false, false, false, false, false, false, false, false],
            true
        ],
        [
            'Q7 yes only (index 6), all else no → true (Q7 path)',
            [false, false, false, false, false, false, true, false, false, false],
            true
        ],
        [
            'Q3,Q4,Q5 yes (3 others) → true',
            [false, false, true, true, true, false, false, false, false, false],
            true
        ],
        [
            'only 2 others (Q3,Q4) → false',
            [false, false, true, true, false, false, false, false, false, false],
            false
        ],
        [
            'Q3,Q8,Q10 (3 others) → true',
            [false, false, true, false, false, false, false, true, false, true],
            true
        ],
        [
            'all false → false',
            [false, false, false, false, false, false, false, false, false, false],
            false
        ],
        [
            'all true → true (Q1 yes alone is enough)',
            [true, true, true, true, true, true, true, true, true, true],
            true
        ],
        [
            'Q8,Q9,Q10 (3 others) → true',
            [false, false, false, false, false, false, false, true, true, true],
            true
        ],
        [
            'Q8,Q9 (2 others) → false',
            [false, false, false, false, false, false, false, true, true, false],
            false
        ],
        [
            'Q1 alone, no Q7, 0 others → true (Q1 path)',
            [true, false, false, false, false, false, false, false, false, false],
            true
        ],
        [
            'Q7 alone, no Q1, 0 others → true (Q7 path)',
            [false, false, false, false, false, false, true, false, false, false],
            true
        ]
    ];

    it.each(cases)('%s', (_label, adam, expected) => {
        expect(isAdamPositive(adam)).toBe(expected);
    });

    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['string',    'yes'],
        ['number',    5],
        ['object',    {}]
    ])('non-array input (%s) → false (defensive)', (_label, input) => {
        expect(isAdamPositive(input)).toBe(false);
    });
});

// ─── clampIpssValue — table-driven ───────────────────────────────────

describe('clampIpssValue', () => {
    it.each([
        // [label, input, expected]
        ['0 → 0',                          0,         0],
        ['5 → 5 (max in range)',           5,         5],
        ['6 → 5 (clamped)',                6,         5],
        ['-1 → 0 (clamped)',               -1,        0],
        ['2.7 → 2 (Math.floor)',           2.7,       2],
        ['NaN → 0',                        NaN,       0],
        ['Infinity → 0 (not finite)',      Infinity,  0],
        ['-Infinity → 0 (not finite)',     -Infinity, 0],
        ["'string' → 0 (not finite)",      'string',  0]
    ])('clampIpssValue(%s)', (_label, input, expected) => {
        expect(clampIpssValue(input)).toBe(expected);
    });
});

// ─── sumIpss ─────────────────────────────────────────────────────────

describe('sumIpss', () => {
    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['string',    'arr'],
        ['number',    5],
        ['object',    {}]
    ])('returns 0 for non-array input (%s)', (_label, input) => {
        expect(sumIpss(input)).toBe(0);
    });

    it('returns 0 for [0,0,0]', () => {
        expect(sumIpss([0, 0, 0])).toBe(0);
    });

    it('returns 15 for [5,5,5] (theoretical max)', () => {
        expect(sumIpss([5, 5, 5])).toBe(15);
    });

    it('returns 9 for [3,3,3]', () => {
        expect(sumIpss([3, 3, 3])).toBe(9);
    });

    it('clamps out-of-range entries: [10,5,-1] → 5+5+0 = 10', () => {
        expect(sumIpss([10, 5, -1])).toBe(10);
    });

    it('treats fewer-than-3 entries as 0: [4,4] → 4+4+0 = 8', () => {
        expect(sumIpss([4, 4])).toBe(8);
    });

    it('only first 3 entries summed: [4,4,4,5,5] → 12', () => {
        expect(sumIpss([4, 4, 4, 5, 5])).toBe(12);
    });

    it("non-numeric entries → 0: ['x', 2, 3] → 0+2+3 = 5", () => {
        expect(sumIpss(['x', 2, 3])).toBe(5);
    });
});

// ─── hasHardStopMedical — table-driven ───────────────────────────────

describe('hasHardStopMedical', () => {
    it.each([
        ['empty',  []],
        ['null',   null],
        ['undef',  undefined]
    ])('returns false for %s input', (_label, input) => {
        expect(hasHardStopMedical(input)).toBe(false);
    });

    it.each([
        ['untreated-male-breast-cancer', ['untreated-male-breast-cancer'], true],
        ['severe-untreated-chf',         ['severe-untreated-chf'],         true],
        ['active-prostate-nodule-or-elevated-psa-pending',
            ['active-prostate-nodule-or-elevated-psa-pending'], true],
        ['prostate-cancer-history (FLAG, not HARD-STOP)',
            ['prostate-cancer-history'], false],
        ['hematocrit-hx-gt-54 (FLAG)',     ['hematocrit-hx-gt-54'],     false],
        ['untreated-severe-osa (FLAG)',    ['untreated-severe-osa'],    false],
        ['severe-bph-or-luts (FLAG)',      ['severe-bph-or-luts'],      false],
        ['severe-depression-with-si (FLAG)', ['severe-depression-with-si'], false],
        ["'other' catch-all is NOT a hard stop", ['other'], false],
        ["'none' is NOT a hard stop",            ['none'],  false]
    ])('%s → %s', (_label, input, expected) => {
        expect(hasHardStopMedical(input)).toBe(expected);
    });

    it('multiple entries including a hard-stop → true', () => {
        expect(hasHardStopMedical(['hematocrit-hx-gt-54', 'severe-untreated-chf'])).toBe(true);
    });
});

// ─── hasFertilityStop ────────────────────────────────────────────────

describe('hasFertilityStop', () => {
    it("'currently-trying-or-12mo' → true", () => {
        expect(hasFertilityStop({ fertilityPlan: 'currently-trying-or-12mo' })).toBe(true);
    });

    it("'planning-eventually' → false", () => {
        expect(hasFertilityStop({ fertilityPlan: 'planning-eventually' })).toBe(false);
    });

    it("'not-planning' → false", () => {
        expect(hasFertilityStop({ fertilityPlan: 'not-planning' })).toBe(false);
    });

    it("'na' → false", () => {
        expect(hasFertilityStop({ fertilityPlan: 'na' })).toBe(false);
    });

    it.each([
        ['null',      null],
        ['undefined', undefined]
    ])('%s state → false (defensive)', (_label, state) => {
        expect(hasFertilityStop(state)).toBeFalsy();
    });
});

// ─── hasPsaConcern — every tier ──────────────────────────────────────

describe('hasPsaConcern', () => {
    it.each([
        // [tier, expected]
        ['le-2.5',   false],
        ['2.5-4.0',  false],
        ['4.0-10.0', true],
        ['gt-10.0',  true],
        ['unknown',  false],
        ['no-test',  false]
    ])('psaTier=%s → %s', (psaTier, expected) => {
        expect(hasPsaConcern({ psaTier })).toBe(expected);
    });

    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['missing',   {}]
    ])('%s state → false (defensive)', (_label, state) => {
        expect(hasPsaConcern(state)).toBe(false);
    });

    it.each([
        ['number',    1],
        ['object',    {}],
        ['array',     []],
        ['null value', null],
        ['undefined value', undefined]
    ])('non-string psaTier (%s) → false (defensive)', (_label, value) => {
        expect(hasPsaConcern({ psaTier: value })).toBe(false);
    });
});

// ─── hasIpssConcern — boundary tests ─────────────────────────────────

describe('hasIpssConcern', () => {
    it('ipss sum 7 → false (≤7 not concern)', () => {
        // 5+2+0 = 7
        expect(hasIpssConcern({ ipss: [5, 2, 0] })).toBe(false);
    });

    it('ipss sum 8 → true (>7 triggers concern)', () => {
        // 5+3+0 = 8
        expect(hasIpssConcern({ ipss: [5, 3, 0] })).toBe(false === false ? true : true);
        // re-assert directly so failure is unambiguous
        expect(hasIpssConcern({ ipss: [5, 3, 0] })).toBe(true);
    });

    it('ipss sum 0 → false', () => {
        expect(hasIpssConcern({ ipss: [0, 0, 0] })).toBe(false);
    });

    it('ipss sum 15 → true (max)', () => {
        expect(hasIpssConcern({ ipss: [5, 5, 5] })).toBe(true);
    });

    it('non-array ipss → false', () => {
        expect(hasIpssConcern({ ipss: null })).toBe(false);
    });
});

// ─── hasOsaConfounder ────────────────────────────────────────────────

describe('hasOsaConfounder', () => {
    it('loudSnoringOrApneas=true → true', () => {
        expect(hasOsaConfounder({ loudSnoringOrApneas: true })).toBe(true);
    });

    it('loudSnoringOrApneas=false → false', () => {
        expect(hasOsaConfounder({ loudSnoringOrApneas: false })).toBe(false);
    });

    it('missing loudSnoringOrApneas → false', () => {
        expect(hasOsaConfounder({})).toBe(false);
    });
});

// ─── hasMedConfounder — table-driven ─────────────────────────────────

describe('hasMedConfounder', () => {
    it.each([
        ['empty array',                        [],                              false],
        ['opioids only',                       ['opioids'],                     true],
        ['ssri-snri only',                     ['ssri-snri'],                   true],
        ['beta-blockers only (NOT a confounder)',  ['beta-blockers'],          false],
        ['statins only (NOT a confounder)',        ['statins'],                false],
        ['glucocorticoids only (NOT a confounder)', ['glucocorticoids'],       false],
        ['prior-or-current-testosterone (context, not confounder)',
            ['prior-or-current-testosterone'], false],
        ['none',                               ['none'],                       false],
        ['opioids + ssri-snri',                ['opioids', 'ssri-snri'],       true],
        ['statins + beta-blockers',            ['statins', 'beta-blockers'],   false]
    ])('medications=[%s] → %s', (_label, medications, expected) => {
        expect(hasMedConfounder({ medications })).toBe(expected);
    });
});

// ─── scoreLowT — full precedence ladder ──────────────────────────────
// Helpers to build test states cleanly.

const ADAM_FALSE = [false, false, false, false, false, false, false, false, false, false];

function adamWith(indices) {
    const adam = ADAM_FALSE.slice();
    for (const i of indices) adam[i] = true;
    return adam;
}

const CLEAN_DEFAULTS = {
    age: 50,
    heightInches: 70,
    weightLbs: 180,
    adam: ADAM_FALSE,
    loudSnoringOrApneas: false,
    sleepHours: 7,
    fertilityPlan: 'not-planning',
    medicalHistory: [],
    psaTier: 'le-2.5',
    ipss: [0, 0, 0],
    medications: [],
    stateCode: 'IL'
};

describe('scoreLowT — hard-stop wins over everything', () => {
    it('hard-stop wins over ADAM positive', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            medicalHistory: ['severe-untreated-chf'],
            adam: adamWith([ADAM_LIBIDO_INDEX])  // Q1 yes
        });
        expect(result.internalTier).toBe('hard-stop');
    });

    it('hard-stop wins over fertility-stop', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            medicalHistory: ['untreated-male-breast-cancer'],
            fertilityPlan: 'currently-trying-or-12mo'
        });
        expect(result.internalTier).toBe('hard-stop');
    });

    it('hard-stop wins over psa-ipss-concern', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            medicalHistory: ['active-prostate-nodule-or-elevated-psa-pending'],
            psaTier: 'gt-10.0',
            ipss: [5, 5, 5]
        });
        expect(result.internalTier).toBe('hard-stop');
    });
});

describe('scoreLowT — fertility-stop wins over psa-ipss-concern + ADAM', () => {
    it('fertility-stop wins over psa-ipss-concern', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            fertilityPlan: 'currently-trying-or-12mo',
            psaTier: 'gt-10.0'
        });
        expect(result.internalTier).toBe('fertility-stop');
    });

    it('fertility-stop wins over ADAM positive', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            fertilityPlan: 'currently-trying-or-12mo',
            adam: adamWith([ADAM_LIBIDO_INDEX])
        });
        expect(result.internalTier).toBe('fertility-stop');
    });

    it("fertility-stop NOT triggered by 'planning-eventually'", () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            fertilityPlan: 'planning-eventually',
            adam: adamWith([ADAM_LIBIDO_INDEX])
        });
        expect(result.internalTier).toBe('eligibility-present');
    });
});

describe('scoreLowT — psa-ipss-concern routing', () => {
    it('psa>4.0 alone routes to psa-ipss-concern even with ADAM positive', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            psaTier: '4.0-10.0',
            adam: adamWith([ADAM_LIBIDO_INDEX])
        });
        expect(result.internalTier).toBe('psa-ipss-concern');
    });

    it('ipss sum >7 alone routes to psa-ipss-concern', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            ipss: [5, 5, 5],   // 15 > 7
            adam: adamWith([ADAM_LIBIDO_INDEX])
        });
        expect(result.internalTier).toBe('psa-ipss-concern');
    });

    it('psa-ipss does NOT trigger when below thresholds', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            psaTier: '2.5-4.0',
            ipss: [2, 2, 2],   // sum 6, ≤7
            adam: adamWith([ADAM_LIBIDO_INDEX])
        });
        expect(result.internalTier).toBe('eligibility-present');
    });
});

describe('scoreLowT — eligibility-mixed (ADAM+ with confounder)', () => {
    it('ADAM+ with OSA → eligibility-mixed', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: adamWith([ADAM_LIBIDO_INDEX]),
            loudSnoringOrApneas: true
        });
        expect(result.internalTier).toBe('eligibility-mixed');
    });

    it('ADAM+ with opioids → eligibility-mixed', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: adamWith([ADAM_LIBIDO_INDEX]),
            medications: ['opioids']
        });
        expect(result.internalTier).toBe('eligibility-mixed');
    });

    it('ADAM+ with SSRI/SNRI → eligibility-mixed (Q7 path)', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: adamWith([ADAM_ERECTIONS_INDEX]),
            medications: ['ssri-snri']
        });
        expect(result.internalTier).toBe('eligibility-mixed');
    });

    it('ADAM+ no confounder → eligibility-present (NOT mixed)', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: adamWith([ADAM_LIBIDO_INDEX])
        });
        expect(result.internalTier).toBe('eligibility-present');
    });
});

describe('scoreLowT — eligibility-present (ADAM+ no confounder, all clean)', () => {
    it('ADAM+ via Q1 → eligibility-present', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: adamWith([ADAM_LIBIDO_INDEX])
        });
        expect(result.internalTier).toBe('eligibility-present');
    });

    it('ADAM+ via Q7 → eligibility-present', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: adamWith([ADAM_ERECTIONS_INDEX])
        });
        expect(result.internalTier).toBe('eligibility-present');
    });

    it('ADAM+ via 3 others (Q3,Q4,Q5) → eligibility-present', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: adamWith([2, 3, 4])
        });
        expect(result.internalTier).toBe('eligibility-present');
    });
});

describe('scoreLowT — eligibility-not-met (ADAM−)', () => {
    it('all ADAM no → eligibility-not-met', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: ADAM_FALSE
        });
        expect(result.internalTier).toBe('eligibility-not-met');
    });

    it('1 other yes (Q3 only) → eligibility-not-met', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: adamWith([2])
        });
        expect(result.internalTier).toBe('eligibility-not-met');
    });

    it('2 others yes (Q3, Q4) → eligibility-not-met', () => {
        const result = scoreLowT({
            ...CLEAN_DEFAULTS,
            adam: adamWith([2, 3])
        });
        expect(result.internalTier).toBe('eligibility-not-met');
    });
});

describe('scoreLowT — defensive against bad inputs', () => {
    it('scoreLowT(null) returns valid object with eligibility-not-met', () => {
        const result = scoreLowT(null);
        expect(result).toBeDefined();
        expect(result.internalTier).toBe('eligibility-not-met');
        expect(result.adamPositive).toBe(false);
        expect(result.adamYesCount).toBe(0);
        expect(result.bmi).toBeNull();
        expect(result.ipssSum).toBe(0);
        expect(result.outOfState).toBe(true);
    });

    it('scoreLowT({}) returns valid object with eligibility-not-met', () => {
        const result = scoreLowT({});
        expect(result).toBeDefined();
        expect(result.internalTier).toBe('eligibility-not-met');
        expect(result.adamPositive).toBe(false);
        expect(result.outOfState).toBe(true);
    });
});

// ─── outOfState ─────────────────────────────────────────────────────

describe('scoreLowT — outOfState routing', () => {
    it("stateCode='IL' → outOfState=false", () => {
        const result = scoreLowT({ ...CLEAN_DEFAULTS, stateCode: 'IL' });
        expect(result.outOfState).toBe(false);
    });

    it("stateCode='il' (lowercase) → outOfState=false (case-insensitive)", () => {
        const result = scoreLowT({ ...CLEAN_DEFAULTS, stateCode: 'il' });
        expect(result.outOfState).toBe(false);
    });

    it("stateCode='CA' → outOfState=true", () => {
        const result = scoreLowT({ ...CLEAN_DEFAULTS, stateCode: 'CA' });
        expect(result.outOfState).toBe(true);
    });

    it('stateCode missing/empty → outOfState=true', () => {
        const r1 = scoreLowT({ ...CLEAN_DEFAULTS, stateCode: '' });
        expect(r1.outOfState).toBe(true);
        const r2 = scoreLowT({ ...CLEAN_DEFAULTS, stateCode: undefined });
        expect(r2.outOfState).toBe(true);
    });

    it('stateCode null/undefined → outOfState=true', () => {
        const r1 = scoreLowT({ ...CLEAN_DEFAULTS, stateCode: null });
        expect(r1.outOfState).toBe(true);
        const r2 = scoreLowT({ ...CLEAN_DEFAULTS, stateCode: undefined });
        expect(r2.outOfState).toBe(true);
    });
});

// ─── Catalog/label sanity ────────────────────────────────────────────

describe('Catalog/label sanity', () => {
    it('INTERNAL_TIER_LABELS has 6 entries matching INTERNAL_TIER_VALUES', () => {
        const labelKeys = Object.keys(INTERNAL_TIER_LABELS).sort();
        const valueKeys = [...INTERNAL_TIER_VALUES].sort();
        expect(labelKeys).toEqual(valueKeys);
        expect(labelKeys.length).toBe(6);
    });

    it('RESULT_SLUGS has 6 entries with same keys as INTERNAL_TIER_LABELS', () => {
        const slugKeys = Object.keys(RESULT_SLUGS).sort();
        const labelKeys = Object.keys(INTERNAL_TIER_LABELS).sort();
        expect(slugKeys).toEqual(labelKeys);
        expect(slugKeys.length).toBe(6);
    });

    it('every INTERNAL_TIER_LABELS value is one of the four guardrail-allowed strings', () => {
        const allowed = new Set([
            'Contraindication identified',
            'Eligibility factors present',
            'Eligibility factors mixed',
            'Eligibility factors not met'
        ]);
        for (const [key, label] of Object.entries(INTERNAL_TIER_LABELS)) {
            expect(allowed.has(label), `${key} label "${label}" not in allowed set`).toBe(true);
        }
    });

    it('HARD_STOP_MEDICAL has exactly 3 entries', () => {
        expect(HARD_STOP_MEDICAL.size).toBe(3);
    });

    it('FLAG_MEDICAL has exactly 5 entries', () => {
        expect(FLAG_MEDICAL.size).toBe(5);
    });

    it('HARD_STOP and FLAG sets are disjoint', () => {
        for (const key of HARD_STOP_MEDICAL) {
            expect(FLAG_MEDICAL.has(key), `${key} found in both HARD_STOP and FLAG`).toBe(false);
        }
        for (const key of FLAG_MEDICAL) {
            expect(HARD_STOP_MEDICAL.has(key), `${key} found in both FLAG and HARD_STOP`).toBe(false);
        }
    });

    it("MEDS_KEYS has exactly 7 entries including 'none'", () => {
        expect(MEDS_KEYS.size).toBe(7);
        expect(MEDS_KEYS.has('none')).toBe(true);
    });

    it("CONFOUNDER_MEDS = {opioids, ssri-snri}", () => {
        expect(CONFOUNDER_MEDS.size).toBe(2);
        expect(CONFOUNDER_MEDS.has('opioids')).toBe(true);
        expect(CONFOUNDER_MEDS.has('ssri-snri')).toBe(true);
    });

    it('ADAM constants: ITEM_COUNT=10, LIBIDO=0, ERECTIONS=6, OTHERS_THRESHOLD=3', () => {
        expect(ADAM_ITEM_COUNT).toBe(10);
        expect(ADAM_LIBIDO_INDEX).toBe(0);
        expect(ADAM_ERECTIONS_INDEX).toBe(6);
        expect(ADAM_OTHERS_THRESHOLD).toBe(3);
    });

    it('IPSS constants: ITEM_COUNT=3, MIN=0, MAX=5, CONCERN_THRESHOLD=7', () => {
        expect(IPSS_ITEM_COUNT).toBe(3);
        expect(IPSS_VALUE_MIN).toBe(0);
        expect(IPSS_VALUE_MAX).toBe(5);
        expect(IPSS_CONCERN_THRESHOLD).toBe(7);
    });
});

// ─── Forbidden-content guardrails — INLINE constants ─────────────────
// The low-T result body must NEVER name a specific drug or recommend a
// specific protocol. The v1 line "alternatives (Clomid, HCG-based
// protocols, lifestyle optimization) that preserve fertility" is
// permanently retired (see scoring.js header comment).

const BANNED_DRUG_NAMES = [
    'clomid', 'hcg', 'human chorionic gonadotropin',
    'enclomiphene', 'clomiphene',
    'cypionate', 'enanthate', 'propionate', 'undecanoate',
    'anastrozole', 'arimidex',
    'androgel', 'testim', 'axiron', 'striant', 'fortesta',
    'natesto', 'vogelxo', 'aveed', 'xyosted',
    'dhea'
];
const BANNED_PHRASES = [
    'you have low testosterone',
    'you should start trt',
    'strong candidate',
    'possible candidate',
    'likely candidate',
    'clomid, hcg-based protocols',
    'preserve fertility (clomid'   // catch the v1 line in any form
];

// ─── Source-file scan setup (engine + submit handler) ────────────────
// The scoring module is pure and ESM-importable, but the engine
// (`quiz-engine.js`, browser IIFE) and the netlify submit handler are
// not — so we read them as text and grep. We use existsSync guards so
// that if a sibling task hasn't yet written the engine or submit file,
// the rest of the suite still runs cleanly. The source-scan it()s will
// fail with a clear "file does not exist" message rather than crashing
// the whole suite at import time.

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..');

const ENGINE_PATH  = join(REPO_ROOT, 'quiz/low-t/quiz-engine.js');
const SUBMIT_PATH  = join(REPO_ROOT, 'netlify/functions/low-t-quiz-submit.js');
const SCORING_PATH = join(REPO_ROOT, 'quiz/low-t/scoring.js');
const PAGE_PATH    = join(REPO_ROOT, 'quiz/low-t/index.html');

const ENGINE_SRC  = existsSync(ENGINE_PATH)  ? readFileSync(ENGINE_PATH,  'utf8') : '';
const SUBMIT_SRC  = existsSync(SUBMIT_PATH)  ? readFileSync(SUBMIT_PATH,  'utf8') : '';
const SCORING_SRC = existsSync(SCORING_PATH) ? readFileSync(SCORING_PATH, 'utf8') : '';
const PAGE_HTML   = existsSync(PAGE_PATH)    ? readFileSync(PAGE_PATH,    'utf8') : '';

/**
 * Strip JS comment lines so guardrail-reminder comments don't trip the
 * banned-content scan. Filters lines whose trimmed form starts with
 * `*`, `//`, or `/*`.
 */
function stripCommentLines(src) {
    return src
        .split('\n')
        .filter((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('*'))  return false;
            if (trimmed.startsWith('//')) return false;
            if (trimmed.startsWith('/*')) return false;
            return true;
        })
        .join('\n');
}

const ENGINE_CODE  = stripCommentLines(ENGINE_SRC).toLowerCase();
const SUBMIT_CODE  = stripCommentLines(SUBMIT_SRC).toLowerCase();
const SCORING_CODE = stripCommentLines(SCORING_SRC).toLowerCase();

// ─── Forbidden content — engine source file ──────────────────────────

describe('Forbidden content — engine source file', () => {
    it('engine source file exists at quiz/low-t/quiz-engine.js', () => {
        expect(existsSync(ENGINE_PATH), `expected ${ENGINE_PATH} to exist`).toBe(true);
    });

    it.each(BANNED_DRUG_NAMES)('engine source does not contain drug name: %s', (drug) => {
        expect(ENGINE_CODE).not.toContain(drug);
    });

    it.each(BANNED_PHRASES)('engine source does not contain banned phrase: %s', (phrase) => {
        expect(ENGINE_CODE).not.toContain(phrase);
    });
});

// ─── Forbidden content — submit handler source file ──────────────────

describe('Forbidden content — submit handler source file', () => {
    it('submit handler exists at netlify/functions/low-t-quiz-submit.js', () => {
        expect(existsSync(SUBMIT_PATH), `expected ${SUBMIT_PATH} to exist`).toBe(true);
    });

    it.each(BANNED_DRUG_NAMES)('submit handler source does not contain drug name: %s', (drug) => {
        expect(SUBMIT_CODE).not.toContain(drug);
    });

    it.each(BANNED_PHRASES)('submit handler source does not contain banned phrase: %s', (phrase) => {
        expect(SUBMIT_CODE).not.toContain(phrase);
    });
});

// ─── Forbidden content — scoring source file ─────────────────────────

describe('Forbidden content — scoring source file', () => {
    it('scoring source file exists at quiz/low-t/scoring.js', () => {
        expect(existsSync(SCORING_PATH), `expected ${SCORING_PATH} to exist`).toBe(true);
    });

    it.each(BANNED_DRUG_NAMES)('scoring source does not contain drug name: %s', (drug) => {
        expect(SCORING_CODE).not.toContain(drug);
    });

    it.each(BANNED_PHRASES)('scoring source does not contain banned phrase: %s', (phrase) => {
        expect(SCORING_CODE).not.toContain(phrase);
    });
});

// ─── Required verbatim phrasing — engine source ──────────────────────
// These three strings are the patient-facing tier bodies. We pin them in
// the engine source so a silent edit fails the test rather than slipping
// into production with diluted or off-message clinical copy.

describe('Required verbatim phrasing — engine source', () => {
    it('engine source contains the verbatim eligibility-present text', () => {
        expect(ENGINE_SRC).toContain('approximately 88% sensitivity and 60% specificity');
    });

    it('engine source contains the verbatim fertility-stop text', () => {
        expect(ENGINE_SRC).toContain('Several non-testosterone-based approaches exist that may preserve fertility');
    });

    it('engine source contains the verbatim psa-ipss text', () => {
        expect(ENGINE_SRC).toContain('warrant evaluation by a urologist or primary care physician');
    });
});

// ─── Required verbatim phrasing — submit handler + static page ───────

describe('Required verbatim phrasing — submit handler + static page', () => {
    it('submit handler source contains the verbatim author attribution', () => {
        expect(SUBMIT_SRC).toContain('Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC');
    });

    it('static page (index.html) includes universal footer disclaimer', () => {
        expect(PAGE_HTML).toContain('Screening tools have known false-positive and false-negative rates');
    });

    it("engine + submit handler do NOT contain 'in collaboration with' (Missy has FPA — placeholder retired)", () => {
        expect(ENGINE_CODE).not.toContain('in collaboration with');
        expect(SUBMIT_CODE).not.toContain('in collaboration with');
    });
});

// ─── REGRESSION: pin the v1 wrongness ────────────────────────────────
// The v1 result body said "alternatives (Clomid, HCG-based protocols,
// lifestyle optimization) that preserve fertility". This is permanently
// retired — replaced with the generic "Several non-testosterone-based
// approaches exist..." line. The regex catches any "Clomid...HCG"
// proximity, and the literal substring catches the exact v1 phrasing.

describe('REGRESSION: v1 fertility line is permanently retired', () => {
    // Scan against ENGINE_CODE / SUBMIT_CODE (comment-stripped, lowercased)
    // so that the guardrail-rule comments at the top of each file (which
    // legitimately list "do NOT name Clomid or HCG") don't false-positive.
    // The whole point of stripCommentLines() is to allow comments to
    // reference banned terms while keeping executable strings clean.
    it('engine source does not contain Clomid/HCG proximity', () => {
        expect(ENGINE_CODE).not.toMatch(/clomid.{0,40}hcg/);
    });

    it('submit handler source does not contain Clomid/HCG proximity', () => {
        expect(SUBMIT_CODE).not.toMatch(/clomid.{0,40}hcg/);
    });

    it('engine source does not contain "alternatives (Clomid"', () => {
        expect(ENGINE_CODE).not.toContain('alternatives (clomid');
    });

    it('submit handler source does not contain "alternatives (Clomid"', () => {
        expect(SUBMIT_CODE).not.toContain('alternatives (clomid');
    });
});
