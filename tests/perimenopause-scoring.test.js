import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    sumMrs,
    mrsTier,
    hasRedFlag,
    hasHrtContraindication,
    scorePerimenopause,
    MRS_INDEX,
    MRS_ITEM_COUNT,
    MRS_VALUE_MIN,
    MRS_VALUE_MAX,
    MENSTRUAL_STATUS_VALUES,
    INTERNAL_TIER_VALUES,
    INTERNAL_TIER_LABELS,
    RESULT_SLUGS,
    MRS_TIER_CUTOFFS,
    RED_FLAG_MIN
} from '../quiz/perimenopause/scoring.js';

/*
 * Perimenopause Screener — Regression Suite
 * =========================================
 *
 * Legal/clinical pin for the perimenopause-quiz tiering logic. The browser
 * engine inlines the same rules as an IIFE; the canonical source of truth is
 * `quiz/perimenopause/scoring.js`. If either drifts, these tests break.
 *
 * Branches covered (every conditional in scoring.js):
 *   sumMrs:                 non-array input, empty array, max-clamp, min-clamp,
 *                           ignore-past-11, missing slots, NaN/non-numeric.
 *   mrsTier:                every documented boundary (0/4/5/8/9/16/17/44),
 *                           negative score, non-numeric.
 *   hasRedFlag:             palpitation × anxiety truth table, defensive.
 *   hasHrtContraindication: empty/single/multiple/non-array.
 *   scorePerimenopause:     contraindication wins always, severe→present,
 *                           moderate→present, mild→mixed, none→not-met,
 *                           red-flag independent of internalTier,
 *                           outOfState casing + missing/empty defensive,
 *                           label/slug catalog match, defensive null/empty.
 *
 * Forbidden-content scan (engine + submit handler source files) catches
 * banned drug names, candidacy language, and "you have low estrogen" style
 * patient-facing diagnoses that the unit tests can't reach because they
 * live inside browser IIFEs and netlify handlers.
 */

// ─── sumMrs ──────────────────────────────────────────────────────────

describe('sumMrs', () => {
    it.each([
        ['null',              null],
        ['undefined',         undefined],
        ['string',            'array-like'],
        ['number',            5],
        ['object',            {}]
    ])('returns 0 for non-array input (%s)', (_label, input) => {
        expect(sumMrs(input)).toBe(0);
    });

    it('returns 0 for an empty array', () => {
        expect(sumMrs([])).toBe(0);
    });

    it('sums an all-fours valid 11-item array to 44 (theoretical max)', () => {
        expect(sumMrs([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4])).toBe(44);
    });

    it('returns 0 for an all-zero valid 11-item array (theoretical min)', () => {
        expect(sumMrs([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    });

    it('sums a mixed-value array correctly: [0,1,2,3,4,0,1,2,3,4,0] → 20', () => {
        expect(sumMrs([0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0])).toBe(20);
    });

    it('clamps out-of-range high values to MRS_VALUE_MAX (4)', () => {
        // 10 → 4, 5 → 4, etc.
        expect(sumMrs([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10])).toBe(44);
        expect(sumMrs([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5])).toBe(44);
    });

    it('clamps out-of-range negative values to MRS_VALUE_MIN (0)', () => {
        expect(sumMrs([-1, -100, -1, -1, -1, -1, -1, -1, -1, -1, -1])).toBe(0);
    });

    it('clamps mixed in/out of range correctly: [10, 5, -1, 4, 4, 0, 0, 0, 0, 0, 0] → 4+4+0+4+4 = 16', () => {
        expect(sumMrs([10, 5, -1, 4, 4, 0, 0, 0, 0, 0, 0])).toBe(16);
    });

    it('ignores entries beyond index 10 — 15-item array sums only first 11', () => {
        // First 11 are all 0 → 0. Trailing values would be 4*4=16 if included.
        expect(sumMrs([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4])).toBe(0);
    });

    it('treats missing entries (fewer than 11) as 0 — 5-item array works', () => {
        // [4, 4, 4, 4, 4] = 20 of contributing entries; rest are undefined → 0
        expect(sumMrs([4, 4, 4, 4, 4])).toBe(20);
    });

    it('treats non-numeric / NaN / undefined / null entries as 0', () => {
        // 'x' (string), NaN, undefined, null → 0; the 2 and 3 contribute
        expect(sumMrs(['x', 2, NaN, undefined, null, 3, 'y', {}, [], 0, 0])).toBe(5);
    });
});

// ─── mrsTier ─────────────────────────────────────────────────────────
// Pin every boundary in the validated Heinemann et al. cutoffs.

describe('mrsTier — boundary pinning', () => {
    it.each([
        // [score, expectedTier, why]
        [0,  'none',     'min'],
        [4,  'none',     'NONE_MAX boundary inclusive'],
        [5,  'mild',     'just past NONE_MAX'],
        [8,  'mild',     'MILD_MAX boundary inclusive'],
        [9,  'moderate', 'just past MILD_MAX'],
        [16, 'moderate', 'MODERATE_MAX boundary inclusive'],
        [17, 'severe',   'just past MODERATE_MAX (CORRECTED — v1 said 16+ which was wrong)'],
        [44, 'severe',   'theoretical max']
    ])('mrsTier(%i) === %s (%s)', (score, expected) => {
        expect(mrsTier(score)).toBe(expected);
    });

    it("returns 'none' for negative scores (defensive — never let bad math escalate)", () => {
        expect(mrsTier(-1)).toBe('none');
        expect(mrsTier(-44)).toBe('none');
    });

    it.each([
        ['undefined', undefined],
        ['null',      null],
        ['string',    '17'],
        ['object',    {}]
    ])("returns 'none' for non-numeric input (%s)", (_label, input) => {
        expect(mrsTier(input)).toBe('none');
    });

    // NaN guard: `typeof NaN === 'number'` is true, so a plain typeof
    // check would let NaN bypass every comparison and return 'severe' —
    // the worst possible failure mode for a clinical screener (corrupted
    // state escalates the patient to the highest-tier output). The
    // module uses Number.isFinite, which rejects NaN AND ±Infinity.
    it.each([NaN, Infinity, -Infinity])(
        'rejects non-finite numeric input %p as none',
        (input) => {
            expect(mrsTier(input)).toBe('none');
        }
    );

    // Pin the corrected v1-was-wrong cutoff.
    // v1 said "16+ severe" which was a misread of Heinemann et al. ≥17 is correct.
    it('REGRESSION: ≥17 is severe (v1 said 16+ which was wrong)', () => {
        expect(mrsTier(16)).toBe('moderate');  // pin: 16 must NOT be severe
        expect(mrsTier(17)).toBe('severe');    // pin: 17 IS severe
    });
});

// ─── hasRedFlag — palpitation × anxiety truth table ──────────────────
// Helper: build an mrs array with palpitations at index 1 and anxiety at
// index 5; everything else 0. Mirrors MRS_INDEX.Q4_PALPITATIONS=1 and
// MRS_INDEX.Q8_ANXIETY=5.

function mrsWith({ palp = 0, anx = 0 } = {}) {
    const mrs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    mrs[MRS_INDEX.Q4_PALPITATIONS] = palp;
    mrs[MRS_INDEX.Q8_ANXIETY]      = anx;
    return mrs;
}

describe('hasRedFlag — palpitation × anxiety truth table', () => {
    // Truth table: red flag iff palp ≥ 3 AND anx ≥ 3.
    // We exercise the full 5×5 Q4 × Q8 matrix to catch any regression in
    // index lookup or threshold direction.
    const cells = [];
    for (let palp = 0; palp <= 4; palp++) {
        for (let anx = 0; anx <= 4; anx++) {
            const expected = palp >= 3 && anx >= 3;
            cells.push([palp, anx, expected]);
        }
    }

    it.each(cells)('palp=%i anx=%i → %s', (palp, anx, expected) => {
        expect(hasRedFlag(mrsWith({ palp, anx }))).toBe(expected);
    });

    // Spot-check the four critical cells called out in the brief, with
    // descriptive names that read clinically in the report.
    it('palp=3 anx=3 → true (both at threshold)', () => {
        expect(hasRedFlag(mrsWith({ palp: 3, anx: 3 }))).toBe(true);
    });

    it('palp=3 anx=2 → false (anxiety below threshold)', () => {
        expect(hasRedFlag(mrsWith({ palp: 3, anx: 2 }))).toBe(false);
    });

    it('palp=2 anx=3 → false (palpitations below threshold)', () => {
        expect(hasRedFlag(mrsWith({ palp: 2, anx: 3 }))).toBe(false);
    });

    it('palp=2 anx=2 → false (neither at threshold)', () => {
        expect(hasRedFlag(mrsWith({ palp: 2, anx: 2 }))).toBe(false);
    });

    it('palp=4 anx=3 → true', () => {
        expect(hasRedFlag(mrsWith({ palp: 4, anx: 3 }))).toBe(true);
    });

    it('palp=3 anx=4 → true', () => {
        expect(hasRedFlag(mrsWith({ palp: 3, anx: 4 }))).toBe(true);
    });

    it('palp=4 anx=4 → true', () => {
        expect(hasRedFlag(mrsWith({ palp: 4, anx: 4 }))).toBe(true);
    });

    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['string',    'arr'],
        ['number',    7],
        ['object',    {}]
    ])('returns false for non-array input (%s)', (_label, input) => {
        expect(hasRedFlag(input)).toBe(false);
    });

    it('returns false for an empty array (defensive — undefined indices clamp to 0)', () => {
        expect(hasRedFlag([])).toBe(false);
    });

    it('returns false when out-of-range values appear (out-of-range clamped before threshold check)', () => {
        // palp = 99 clamps to 4; anx = 0 → red flag still false because anx < 3
        const mrs = mrsWith({ palp: 99, anx: 0 });
        expect(hasRedFlag(mrs)).toBe(false);
    });
});

// ─── hasHrtContraindication ──────────────────────────────────────────

describe('hasHrtContraindication', () => {
    it('returns false for empty array', () => {
        expect(hasHrtContraindication([])).toBe(false);
    });

    it('returns true for a single contraindication', () => {
        expect(hasHrtContraindication(['cancer'])).toBe(true);
    });

    it('returns true for multiple contraindications', () => {
        expect(hasHrtContraindication(['cancer', 'clots', 'liver'])).toBe(true);
    });

    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['string',    'cancer'],
        ['number',    1],
        ['object',    { cancer: true }]
    ])('returns false for non-array input (%s)', (_label, input) => {
        expect(hasHrtContraindication(input)).toBe(false);
    });
});

// ─── scorePerimenopause — every branch in the tier ladder ────────────

describe('scorePerimenopause — internalTier decision ladder', () => {
    it('no contraindication + severe MRS → eligibility-factors-present + mrsTier "severe"', () => {
        // Score = 17 (just past moderate boundary), no Q4/Q8 red flag.
        const mrs = [4, 0, 4, 4, 1, 0, 4, 0, 0, 0, 0]; // 4+0+4+4+1+0+4 = 17
        const result = scorePerimenopause({
            mrs,
            contraindications: [],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(17);
        expect(result.mrsTier).toBe('severe');
        expect(result.internalTier).toBe('eligibility-factors-present');
    });

    it('no contraindication + moderate MRS (score 9, just-past-mild boundary) → eligibility-factors-present', () => {
        const mrs = [4, 0, 4, 1, 0, 0, 0, 0, 0, 0, 0]; // 4+0+4+1 = 9
        const result = scorePerimenopause({
            mrs,
            contraindications: [],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(9);
        expect(result.mrsTier).toBe('moderate');
        expect(result.internalTier).toBe('eligibility-factors-present');
    });

    it('no contraindication + moderate MRS (score 16, top-of-moderate boundary) → eligibility-factors-present', () => {
        const mrs = [4, 0, 4, 4, 4, 0, 0, 0, 0, 0, 0]; // 4+0+4+4+4 = 16
        const result = scorePerimenopause({
            mrs,
            contraindications: [],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(16);
        expect(result.mrsTier).toBe('moderate');
        expect(result.internalTier).toBe('eligibility-factors-present');
    });

    it('no contraindication + mild MRS (score 5, just-past-none boundary) → eligibility-factors-mixed', () => {
        const mrs = [2, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0]; // 5
        const result = scorePerimenopause({
            mrs,
            contraindications: [],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(5);
        expect(result.mrsTier).toBe('mild');
        expect(result.internalTier).toBe('eligibility-factors-mixed');
    });

    it('no contraindication + mild MRS (score 8, top-of-mild boundary) → eligibility-factors-mixed', () => {
        const mrs = [2, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0]; // 8
        const result = scorePerimenopause({
            mrs,
            contraindications: [],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(8);
        expect(result.mrsTier).toBe('mild');
        expect(result.internalTier).toBe('eligibility-factors-mixed');
    });

    it('no contraindication + none MRS (score 0) → eligibility-factors-not-met', () => {
        const result = scorePerimenopause({
            mrs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            contraindications: [],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(0);
        expect(result.mrsTier).toBe('none');
        expect(result.internalTier).toBe('eligibility-factors-not-met');
    });

    it('no contraindication + none MRS (score 4, top-of-none boundary) → eligibility-factors-not-met', () => {
        const mrs = [2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]; // 4
        const result = scorePerimenopause({
            mrs,
            contraindications: [],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(4);
        expect(result.mrsTier).toBe('none');
        expect(result.internalTier).toBe('eligibility-factors-not-met');
    });

    // SAFETY-PRIORITY PIN: contraindication wins regardless of MRS score.
    // A patient with maxed-out symptoms AND a contraindication must be
    // routed to the contraindication-identified path — that's the safer
    // clinical default.
    it('SAFETY: contraindication wins regardless of MRS — score 44 + cancer → contraindication-identified', () => {
        const mrs = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]; // max possible
        const result = scorePerimenopause({
            mrs,
            contraindications: ['cancer'],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(44);
        expect(result.mrsTier).toBe('severe');
        expect(result.hasHrtContraindication).toBe(true);
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it('contraindication + score 0 → contraindication-identified (still wins)', () => {
        const result = scorePerimenopause({
            mrs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            contraindications: ['clots'],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(0);
        expect(result.mrsTier).toBe('none');
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it('red flag does NOT change internalTier — score 17 + Q4=4 + Q8=4 + no contraindication → eligibility-factors-present (severe) + hasRedFlag=true', () => {
        // Q4=4 (palp), Q8=4 (anx), plus other items totaling 17
        const mrs = [4, 4, 4, 1, 0, 4, 0, 0, 0, 0, 0]; // 4+4+4+1+0+4 = 17
        const result = scorePerimenopause({
            mrs,
            contraindications: [],
            stateCode: 'IL'
        });
        expect(result.mrsScore).toBe(17);
        expect(result.mrsTier).toBe('severe');
        expect(result.internalTier).toBe('eligibility-factors-present');
        expect(result.hasRedFlag).toBe(true);
    });

    it('red flag + contraindication: contraindication-identified wins, hasRedFlag=true (both flags travel)', () => {
        const mrs = mrsWith({ palp: 4, anx: 4 });
        const result = scorePerimenopause({
            mrs,
            contraindications: ['cancer'],
            stateCode: 'IL'
        });
        expect(result.internalTier).toBe('contraindication-identified');
        expect(result.hasRedFlag).toBe(true);
        expect(result.hasHrtContraindication).toBe(true);
    });
});

// ─── scorePerimenopause — outOfState routing ─────────────────────────

describe('scorePerimenopause — outOfState flag', () => {
    it("outOfState=true when stateCode='CA'", () => {
        const result = scorePerimenopause({ stateCode: 'CA' });
        expect(result.outOfState).toBe(true);
    });

    it("outOfState=false when stateCode='IL'", () => {
        const result = scorePerimenopause({ stateCode: 'IL' });
        expect(result.outOfState).toBe(false);
    });

    it("outOfState case-insensitive: stateCode='il' (lowercase) → outOfState=false", () => {
        const result = scorePerimenopause({ stateCode: 'il' });
        expect(result.outOfState).toBe(false);
    });

    it('outOfState=true when stateCode is missing', () => {
        const result = scorePerimenopause({});
        expect(result.outOfState).toBe(true);
    });

    it('outOfState=true when stateCode is empty string', () => {
        const result = scorePerimenopause({ stateCode: '' });
        expect(result.outOfState).toBe(true);
    });

    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['number',    17]
    ])('outOfState=true when stateCode is non-string (%s)', (_label, value) => {
        const result = scorePerimenopause({ stateCode: value });
        expect(result.outOfState).toBe(true);
    });
});

// ─── scorePerimenopause — label/slug catalog match ───────────────────

describe('scorePerimenopause — internalTierLabel + resultSlug match catalog', () => {
    const cases = [
        // [label, state, expectedInternalTier]
        ['contraindication-identified',
            { contraindications: ['cancer'] },
            'contraindication-identified'],
        ['eligibility-factors-present (severe)',
            { mrs: [4, 0, 4, 4, 1, 0, 4, 0, 0, 0, 0] }, // 17
            'eligibility-factors-present'],
        ['eligibility-factors-mixed (mild)',
            { mrs: [2, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0] }, // 5
            'eligibility-factors-mixed'],
        ['eligibility-factors-not-met (none)',
            { mrs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, // 0
            'eligibility-factors-not-met']
    ];

    it.each(cases)('%s → label and slug match catalog maps', (_label, state, expectedTier) => {
        const result = scorePerimenopause(state);
        expect(result.internalTier).toBe(expectedTier);
        expect(result.internalTierLabel).toBe(INTERNAL_TIER_LABELS[expectedTier]);
        expect(result.resultSlug).toBe(RESULT_SLUGS[expectedTier]);
    });
});

// ─── scorePerimenopause — defensive against bad inputs ───────────────

describe('scorePerimenopause — defensive', () => {
    it('does not throw for state=null and returns valid not-met result', () => {
        const result = scorePerimenopause(null);
        expect(result).toBeDefined();
        expect(result.mrsScore).toBe(0);
        expect(result.mrsTier).toBe('none');
        expect(result.internalTier).toBe('eligibility-factors-not-met');
        expect(result.hasHrtContraindication).toBe(false);
        expect(result.hasRedFlag).toBe(false);
        expect(result.outOfState).toBe(true);
    });

    it('does not throw for state=undefined and returns valid not-met result', () => {
        const result = scorePerimenopause(undefined);
        expect(result.internalTier).toBe('eligibility-factors-not-met');
    });

    it('does not throw for state={} and returns valid not-met result', () => {
        const result = scorePerimenopause({});
        expect(result).toBeDefined();
        expect(result.mrsScore).toBe(0);
        expect(result.internalTier).toBe('eligibility-factors-not-met');
    });
});

// ─── Catalog integrity ───────────────────────────────────────────────

describe('Catalog integrity (sanity checks)', () => {
    it('INTERNAL_TIER_LABELS has exactly 4 entries matching INTERNAL_TIER_VALUES', () => {
        const labelKeys = Object.keys(INTERNAL_TIER_LABELS).sort();
        const valueKeys = [...INTERNAL_TIER_VALUES].sort();
        expect(labelKeys).toEqual(valueKeys);
        expect(labelKeys.length).toBe(4);
    });

    it('RESULT_SLUGS has exactly 4 entries with the same keys as INTERNAL_TIER_LABELS', () => {
        const slugKeys = Object.keys(RESULT_SLUGS).sort();
        const labelKeys = Object.keys(INTERNAL_TIER_LABELS).sort();
        expect(slugKeys).toEqual(labelKeys);
        expect(slugKeys.length).toBe(4);
    });

    it('every INTERNAL_TIER_LABELS value is one of the four guardrail-allowed strings', () => {
        const allowed = new Set([
            'Eligibility factors present',
            'Eligibility factors mixed',
            'Eligibility factors not met',
            'Contraindication identified'
        ]);
        for (const [key, label] of Object.entries(INTERNAL_TIER_LABELS)) {
            expect(allowed.has(label), `${key} label "${label}" not in allowed set`).toBe(true);
        }
    });

    it('MRS_TIER_CUTOFFS has the documented numeric values (NONE_MAX=4, MILD_MAX=8, MODERATE_MAX=16)', () => {
        expect(MRS_TIER_CUTOFFS.NONE_MAX).toBe(4);
        expect(MRS_TIER_CUTOFFS.MILD_MAX).toBe(8);
        expect(MRS_TIER_CUTOFFS.MODERATE_MAX).toBe(16);
    });

    it('RED_FLAG_MIN === 3', () => {
        expect(RED_FLAG_MIN).toBe(3);
    });

    it('MRS_ITEM_COUNT === 11', () => {
        expect(MRS_ITEM_COUNT).toBe(11);
    });

    it('MRS_VALUE_MIN === 0', () => {
        expect(MRS_VALUE_MIN).toBe(0);
    });

    it('MRS_VALUE_MAX === 4', () => {
        expect(MRS_VALUE_MAX).toBe(4);
    });

    it('MRS_INDEX has exactly 11 entries with values 0..10 (no gaps, no duplicates)', () => {
        const values = Object.values(MRS_INDEX).sort((a, b) => a - b);
        expect(values).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(values.length).toBe(11);
    });

    it('MENSTRUAL_STATUS_VALUES contains the 7 documented enum values', () => {
        // Sanity check: this set is referenced by upstream form validators.
        expect(MENSTRUAL_STATUS_VALUES.has('regular')).toBe(true);
        expect(MENSTRUAL_STATUS_VALUES.has('irregular')).toBe(true);
        expect(MENSTRUAL_STATUS_VALUES.has('less-than-12-months-since-lmp')).toBe(true);
        expect(MENSTRUAL_STATUS_VALUES.has('12-or-more-months-since-lmp')).toBe(true);
        expect(MENSTRUAL_STATUS_VALUES.has('hyst-with-ovaries')).toBe(true);
        expect(MENSTRUAL_STATUS_VALUES.has('hyst-with-oophorectomy')).toBe(true);
        expect(MENSTRUAL_STATUS_VALUES.has('on-hormonal-contraception-or-hrt')).toBe(true);
        expect(MENSTRUAL_STATUS_VALUES.size).toBe(7);
    });
});

// ─── Forbidden content — banned constants ────────────────────────────
// `progesterone` and `estrogen` MAY appear in the static page (index.html)
// once in clinical-fact framing per the brief. The forbidden-content scan
// targets the engine + submit handler — both of which render user-facing
// tier output and must NEVER name a specific drug or hormone in the result.

const BANNED_DRUG_NAMES = [
    'estradiol', 'estrace', 'premarin', 'estring', 'climara', 'vagifem',
    'activella', 'angeliq', 'evamist', 'mimvey', 'estradot',
    'progesterone', 'prometrium', 'medroxyprogesterone', 'provera',
    'norethindrone', 'levonorgestrel'
];

const BANNED_PHRASES = [
    'you should start hrt',
    'strong candidate',
    'possible candidate',
    'likely candidate',
    'you have estrogen dominance',
    'you have low estrogen',
    'your testosterone is low'
];

// ─── Source-file scan setup (engine + submit handler) ────────────────
// The scoring module is pure and ESM-importable, but the engine and the
// netlify submit handler are not — so we read them as text and grep.
//
// Comment-line filter: scoring.js's header includes a "compliance rails"
// comment that lists the forbidden phrases as reminders ("Never tell the
// user they should start HRT"). Those reminders are the whole point and
// should not break the scan. We strip lines that, after trim, start with
// `*`, `//`, or `/*`.

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..');

const ENGINE_PATH = join(REPO_ROOT, 'quiz/perimenopause/quiz-engine.js');
const SUBMIT_PATH = join(REPO_ROOT, 'netlify/functions/perimenopause-quiz-submit.js');
const PAGE_PATH   = join(REPO_ROOT, 'quiz/perimenopause/index.html');

// Read defensively. If a sibling task hasn't created the engine or submit
// handler yet, we still want the scoring tests above to run — but the
// source-scan tests below will fail with a clear "file does not exist"
// message rather than crashing the whole suite at import time.
const ENGINE_SRC = existsSync(ENGINE_PATH) ? readFileSync(ENGINE_PATH, 'utf8') : '';
const SUBMIT_SRC = existsSync(SUBMIT_PATH) ? readFileSync(SUBMIT_PATH, 'utf8') : '';
const PAGE_HTML  = existsSync(PAGE_PATH)   ? readFileSync(PAGE_PATH,   'utf8') : '';

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

const ENGINE_CODE = stripCommentLines(ENGINE_SRC).toLowerCase();
const SUBMIT_CODE = stripCommentLines(SUBMIT_SRC).toLowerCase();

describe('Forbidden content — engine source file', () => {
    it('engine source file exists at quiz/perimenopause/quiz-engine.js', () => {
        expect(existsSync(ENGINE_PATH), `expected ${ENGINE_PATH} to exist`).toBe(true);
    });

    it.each(BANNED_DRUG_NAMES)('engine source does not contain drug name: %s', (drug) => {
        expect(ENGINE_CODE).not.toContain(drug);
    });

    it.each(BANNED_PHRASES)('engine source does not contain banned phrase: %s', (phrase) => {
        expect(ENGINE_CODE).not.toContain(phrase);
    });
});

describe('Forbidden content — submit handler source file', () => {
    it('submit handler exists at netlify/functions/perimenopause-quiz-submit.js', () => {
        expect(existsSync(SUBMIT_PATH), `expected ${SUBMIT_PATH} to exist`).toBe(true);
    });

    it.each(BANNED_DRUG_NAMES)('submit handler source does not contain drug name: %s', (drug) => {
        expect(SUBMIT_CODE).not.toContain(drug);
    });

    it.each(BANNED_PHRASES)('submit handler source does not contain banned phrase: %s', (phrase) => {
        expect(SUBMIT_CODE).not.toContain(phrase);
    });
});

// ─── Required verbatim phrasing (regulatory pin) ─────────────────────
// These strings define the patient-facing tier bodies. We pin them in the
// engine source so a silent edit fails the test rather than slipping into
// production with diluted or off-message clinical copy.

describe('Required verbatim phrasing — engine source', () => {
    it('engine source contains the verbatim Tier-severe phrasing', () => {
        expect(ENGINE_SRC).toContain('Your responses indicate significant symptom burden in patterns associated with hormonal change');
    });

    it('engine source contains the verbatim Tier-moderate phrasing', () => {
        expect(ENGINE_SRC).toContain('Your responses indicate moderate symptom burden');
    });

    it('engine source contains the verbatim red-flag interstitial text', () => {
        expect(ENGINE_SRC).toContain('palpitations combined with anxiety can have causes beyond hormonal change');
    });
});

// ─── Required verbatim phrasing — submit handler + static page ───────

describe('Required verbatim phrasing — submit handler', () => {
    it('submit handler source contains the verbatim author attribution', () => {
        expect(SUBMIT_SRC).toContain('Clinical content directed by Missy Zammichieli, DNP, APRN, FNP-BC');
    });

    it('submit handler source includes the universal footer disclaimer text', () => {
        expect(SUBMIT_SRC).toContain('Screening tools have known false-positive and false-negative rates');
    });
});

describe('Required verbatim phrasing — static page', () => {
    it('static HTML page (index.html) includes the universal footer disclaimer text', () => {
        // Canonical location: rendered always-visible below the quiz mount,
        // mirrors bone-density's Wave 4 fix.
        expect(PAGE_HTML).toContain('Screening tools have known false-positive and false-negative rates');
    });
});
