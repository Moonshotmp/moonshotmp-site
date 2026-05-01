import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    computeBmi,
    hasComorbidity,
    hasMedicalHardStop,
    hasPregnancyHardStop,
    hasOtherConditionHardStop,
    hasBariatricModifier,
    priorAttemptYes,
    readinessAdequate,
    bmiMeetsThreshold,
    bmiBorderline,
    bmiBelowThreshold,
    scoreGlp1,
    HARD_STOP_MEDICAL,
    MED_HISTORY_KEYS,
    COMORBIDITY_KEYS,
    PRIOR_ATTEMPT_VALUES,
    SEX_VALUES,
    INTERNAL_TIER_VALUES,
    INTERNAL_TIER_LABELS,
    RESULT_SLUGS,
    BMI_THRESHOLD_OBESITY,
    BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY,
    READINESS_ADEQUATE_MIN
} from '../quiz/glp1/scoring.js';

/*
 * GLP-1 Readiness Screener — Regression Suite
 * ===========================================
 *
 * The legal/regulatory pin for the GLP-1 quiz tiering logic. The browser
 * engine inlines the same rules as an IIFE; the canonical source of truth
 * is `quiz/glp1/scoring.js`. If either drifts, these tests break.
 *
 * This is the highest-regulatory-risk quiz of the four quizzes shipped so
 * far. The forbidden-content scan is correspondingly the strictest:
 *   - All major brand names (Wegovy, Ozempic, Zepbound, Mounjaro, Saxenda,
 *     Victoza, Trulicity, Rybelsus)
 *   - All molecule names (semaglutide, tirzepatide, liraglutide,
 *     dulaglutide, exenatide)
 *   - All other weight-management drugs (phentermine, Qsymia, Contrave,
 *     Plenity, orlistat, Xenical, Alli)
 *   - Compounded-equivalence claims ("compounded semaglutide / tirzepatide")
 *   - Candidacy / qualification language ("you qualify for", "candidate")
 *   - Diagnostic language ("you have obesity", "you are obese")
 *   - Substitution claims ("as a substitute for", "compounded version is
 *     equivalent")
 *
 * Branches covered (every conditional in scoring.js):
 *   computeBmi:                  null state, missing/zero/negative/NaN
 *                                height/weight, sensible BMI ranges,
 *                                boundary edges (sub-30, just-under-30,
 *                                just-over-30, sub-27).
 *   hasComorbidity:              empty array, 'none', each of 7 qualifiers,
 *                                'none' + qualifier (qualifier wins),
 *                                non-array, unknown key.
 *   hasMedicalHardStop:          empty, 'none', each of 8 hard-stops,
 *                                non-array, multiple, unknown key.
 *   hasPregnancyHardStop:        'yes', 'no', missing/non-string.
 *   hasOtherConditionHardStop:   empty, whitespace-only, meaningful text,
 *                                non-string defensive.
 *   hasBariatricModifier:        'yes', 'no', missing.
 *   priorAttemptYes:             'yes', 'no', 'prefer-not'.
 *   readinessAdequate:           1-5 boundaries + 0 + NaN + non-numeric.
 *   bmiMeetsThreshold:           every FDA-labeling branch (≥30 alone, 27
 *                                with comorbidity, 27 without, 28 with/
 *                                without, 30 with/without).
 *   bmiBorderline:               27, 29, 30 (inclusive boundary), 26, with
 *                                comorbidity (false because qualifies via
 *                                threshold).
 *   bmiBelowThreshold:           25, 26.9, 27 (boundary), 30, null.
 *   scoreGlp1:                   full precedence ladder — contraindication
 *                                wins over everything, specialist wins over
 *                                BMI tiers, eligibility-not-met-bmi for
 *                                BMI <27, eligibility-mixed for borderline
 *                                or threshold-met-but-missing-prior-attempt
 *                                or threshold-met-but-readiness-too-low,
 *                                eligibility-present only when BMI threshold
 *                                + prior attempt + readiness ≥3.
 *   outOfState:                  IL/il (case-insensitive), CA, missing,
 *                                non-string defensive.
 *
 * Forbidden-content scan (engine + submit handler + scoring source) catches
 * banned drug names + phrases. Verbatim-disclaimer pin asserts the regulatory
 * "no compounded substitution" line is verbatim in static page + submit
 * handler (regulatory regression test).
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

    it('70 in, 180 lbs → ~25.8 (overweight, sub-30)', () => {
        const bmi = computeBmi({ heightInches: 70, weightLbs: 180 });
        expect(bmi).toBeCloseTo(25.8, 1);
        expect(bmi).toBeLessThan(30);
    });

    it('72 in, 220 lbs → ~29.8 (just under 30 — borderline)', () => {
        const bmi = computeBmi({ heightInches: 72, weightLbs: 220 });
        expect(bmi).toBeCloseTo(29.8, 1);
        expect(bmi).toBeLessThan(30);
    });

    it('70 in, 210 lbs → ~30.1 (just over 30 — qualifies on BMI alone)', () => {
        const bmi = computeBmi({ heightInches: 70, weightLbs: 210 });
        expect(bmi).toBeCloseTo(30.1, 1);
        expect(bmi).toBeGreaterThanOrEqual(30);
    });

    it('60 in, 120 lbs → ~23.4 (sub-27, eligibility-not-met-bmi territory)', () => {
        const bmi = computeBmi({ heightInches: 60, weightLbs: 120 });
        expect(bmi).toBeCloseTo(23.4, 1);
        expect(bmi).toBeLessThan(27);
    });
});

// ─── hasComorbidity — table-driven ───────────────────────────────────

describe('hasComorbidity', () => {
    it('empty array → false', () => {
        expect(hasComorbidity({ comorbidities: [] })).toBe(false);
    });

    it("['none'] → false (explicitly excluded — none does NOT qualify)", () => {
        expect(hasComorbidity({ comorbidities: ['none'] })).toBe(false);
    });

    it.each([
        ['t2d-or-prediabetes',     ['t2d-or-prediabetes']],
        ['high-blood-pressure',    ['high-blood-pressure']],
        ['high-cholesterol',       ['high-cholesterol']],
        ['sleep-apnea',            ['sleep-apnea']],
        ['pcos',                   ['pcos']],
        ['nafld',                  ['nafld']],
        ['cardiovascular-disease', ['cardiovascular-disease']]
    ])('qualifying comorbidity %s alone → true', (_label, comorbidities) => {
        expect(hasComorbidity({ comorbidities })).toBe(true);
    });

    it("['none', 't2d-or-prediabetes'] → true (real comorbidity overrides 'none')", () => {
        expect(hasComorbidity({ comorbidities: ['none', 't2d-or-prediabetes'] })).toBe(true);
    });

    it.each([
        ['null',       null],
        ['undefined',  undefined],
        ['string',     'pcos'],
        ['number',     5],
        ['object',     {}]
    ])('non-array comorbidities (%s) → false', (_label, comorbidities) => {
        expect(hasComorbidity({ comorbidities })).toBe(false);
    });

    it('array with unknown key → false', () => {
        expect(hasComorbidity({ comorbidities: ['unknown-condition'] })).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(hasComorbidity(null)).toBe(false);
    });

    it('undefined state → false (defensive)', () => {
        expect(hasComorbidity(undefined)).toBe(false);
    });
});

// ─── hasMedicalHardStop — every hard-stop key as table-driven ────────

describe('hasMedicalHardStop', () => {
    it('empty array → false', () => {
        expect(hasMedicalHardStop({ medicalHistory: [] })).toBe(false);
    });

    it("['none'] → false (None of these is not a hard-stop)", () => {
        expect(hasMedicalHardStop({ medicalHistory: ['none'] })).toBe(false);
    });

    it.each([
        ['mtc-or-men2'],
        ['pancreatitis'],
        ['severe-gastroparesis'],
        ['t1d'],
        ['eating-disorder'],
        ['suicidal-ideation-or-recent-psych-hospitalization'],
        ['severe-esrd'],
        ['severe-diabetic-retinopathy-on-insulin']
    ])('hard-stop %s alone → true', (key) => {
        expect(hasMedicalHardStop({ medicalHistory: [key] })).toBe(true);
    });

    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['string',    'mtc-or-men2'],
        ['number',    5],
        ['object',    {}]
    ])('non-array medicalHistory (%s) → false', (_label, medicalHistory) => {
        expect(hasMedicalHardStop({ medicalHistory })).toBe(false);
    });

    it('multiple hard-stops → true', () => {
        expect(hasMedicalHardStop({
            medicalHistory: ['mtc-or-men2', 'pancreatitis']
        })).toBe(true);
    });

    it('mix of hard-stop and non-hard-stop → true', () => {
        expect(hasMedicalHardStop({
            medicalHistory: ['none', 't1d']
        })).toBe(true);
    });

    it('unknown key → false', () => {
        expect(hasMedicalHardStop({ medicalHistory: ['unknown-key'] })).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(hasMedicalHardStop(null)).toBe(false);
    });

    it('undefined state → false (defensive)', () => {
        expect(hasMedicalHardStop(undefined)).toBe(false);
    });
});

// ─── hasPregnancyHardStop ────────────────────────────────────────────

describe('hasPregnancyHardStop', () => {
    it("'yes' → true", () => {
        expect(hasPregnancyHardStop({ pregnancyOrPlanning: 'yes' })).toBe(true);
    });

    it("'no' → false", () => {
        expect(hasPregnancyHardStop({ pregnancyOrPlanning: 'no' })).toBe(false);
    });

    it('missing → false', () => {
        expect(hasPregnancyHardStop({})).toBe(false);
    });

    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['number',    1],
        ['boolean',   true],
        ['object',    {}]
    ])('non-string (%s) → false', (_label, pregnancyOrPlanning) => {
        expect(hasPregnancyHardStop({ pregnancyOrPlanning })).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(hasPregnancyHardStop(null)).toBe(false);
    });

    it('undefined state → false (defensive)', () => {
        expect(hasPregnancyHardStop(undefined)).toBe(false);
    });
});

// ─── hasOtherConditionHardStop (Q9 catch-all) ────────────────────────

describe('hasOtherConditionHardStop', () => {
    it("'' (empty string) → false", () => {
        expect(hasOtherConditionHardStop({ otherCondition: '' })).toBe(false);
    });

    it("'   ' (whitespace) → false (after trim)", () => {
        expect(hasOtherConditionHardStop({ otherCondition: '   ' })).toBe(false);
    });

    it("'\\t\\n  ' (tabs and newlines) → false (after trim)", () => {
        expect(hasOtherConditionHardStop({ otherCondition: '\t\n  ' })).toBe(false);
    });

    it("'lupus' → true", () => {
        expect(hasOtherConditionHardStop({ otherCondition: 'lupus' })).toBe(true);
    });

    it('long meaningful string → true', () => {
        expect(hasOtherConditionHardStop({
            otherCondition: 'I have a complex autoimmune condition that has affected medication tolerability'
        })).toBe(true);
    });

    it('single character (after trim) → true', () => {
        expect(hasOtherConditionHardStop({ otherCondition: 'x' })).toBe(true);
    });

    it.each([
        ['null',      null],
        ['undefined', undefined],
        ['number',    5],
        ['boolean',   true],
        ['object',    {}],
        ['array',     []]
    ])('non-string otherCondition (%s) → false (defensive)', (_label, otherCondition) => {
        expect(hasOtherConditionHardStop({ otherCondition })).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(hasOtherConditionHardStop(null)).toBe(false);
    });

    it('undefined state → false (defensive)', () => {
        expect(hasOtherConditionHardStop(undefined)).toBe(false);
    });
});

// ─── hasBariatricModifier ────────────────────────────────────────────

describe('hasBariatricModifier', () => {
    it("'yes' → true", () => {
        expect(hasBariatricModifier({ bariatricHistory: 'yes' })).toBe(true);
    });

    it("'no' → false", () => {
        expect(hasBariatricModifier({ bariatricHistory: 'no' })).toBe(false);
    });

    it('missing → false', () => {
        expect(hasBariatricModifier({})).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(hasBariatricModifier(null)).toBe(false);
    });

    it('undefined state → false (defensive)', () => {
        expect(hasBariatricModifier(undefined)).toBe(false);
    });
});

// ─── priorAttemptYes ─────────────────────────────────────────────────

describe('priorAttemptYes', () => {
    it("'yes' → true", () => {
        expect(priorAttemptYes({ priorAttempt: 'yes' })).toBe(true);
    });

    it("'no' → false", () => {
        expect(priorAttemptYes({ priorAttempt: 'no' })).toBe(false);
    });

    it("'prefer-not' → false (explicitly NOT yes)", () => {
        expect(priorAttemptYes({ priorAttempt: 'prefer-not' })).toBe(false);
    });

    it('missing → false', () => {
        expect(priorAttemptYes({})).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(priorAttemptYes(null)).toBe(false);
    });

    it('undefined state → false (defensive)', () => {
        expect(priorAttemptYes(undefined)).toBe(false);
    });
});

// ─── readinessAdequate — boundary tests ──────────────────────────────

describe('readinessAdequate', () => {
    it('readiness 1 → false', () => {
        expect(readinessAdequate({ readiness: 1 })).toBe(false);
    });

    it('readiness 2 → false', () => {
        expect(readinessAdequate({ readiness: 2 })).toBe(false);
    });

    it('readiness 3 → true (boundary, inclusive)', () => {
        expect(readinessAdequate({ readiness: 3 })).toBe(true);
    });

    it('readiness 4 → true', () => {
        expect(readinessAdequate({ readiness: 4 })).toBe(true);
    });

    it('readiness 5 → true', () => {
        expect(readinessAdequate({ readiness: 5 })).toBe(true);
    });

    it('readiness 0 → false', () => {
        expect(readinessAdequate({ readiness: 0 })).toBe(false);
    });

    it('readiness NaN → false (Number.isFinite guard)', () => {
        expect(readinessAdequate({ readiness: NaN })).toBe(false);
    });

    it('readiness Infinity → false (Number.isFinite guard)', () => {
        // Infinity passes >=3 but Number.isFinite(Infinity) === false
        expect(readinessAdequate({ readiness: Infinity })).toBe(false);
    });

    it.each([
        ['string',      '5'],
        ['null',        null],
        ['undefined',   undefined],
        ['boolean',     true],
        ['object',      {}],
        ['array',       [5]]
    ])('non-numeric readiness (%s) → false', (_label, readiness) => {
        expect(readinessAdequate({ readiness })).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(readinessAdequate(null)).toBe(false);
    });

    it('undefined state → false (defensive)', () => {
        expect(readinessAdequate(undefined)).toBe(false);
    });
});

// ─── bmiMeetsThreshold — every FDA-labeling branch ───────────────────
// Helpers to produce predictable BMI values without arithmetic in tests.
// height inches × 0.0254 = meters; weight lbs × 0.45359237 = kg;
// BMI = kg / m^2. The cases below are picked so the BMI lands clearly
// inside the desired bucket (well clear of floating-point boundaries).

function stateForBmi(targetBmi, opts = {}) {
    // Use 70 in (1.778 m) and back-compute the lbs that yields targetBmi.
    const meters = 70 * 0.0254;
    const kg = targetBmi * meters * meters;
    const lbs = kg / 0.45359237;
    return {
        heightInches: 70,
        weightLbs: lbs,
        ...opts
    };
}

describe('bmiMeetsThreshold — every FDA-labeling branch', () => {
    it('BMI 25, no comorbidity → false (well below 27)', () => {
        expect(bmiMeetsThreshold(stateForBmi(25, { comorbidities: [] }))).toBe(false);
    });

    it('BMI 27, no comorbidity → false (boundary, comorbidity required at 27)', () => {
        // Aim for ~27.1 to be safely past the integer boundary.
        expect(bmiMeetsThreshold(stateForBmi(27.1, { comorbidities: [] }))).toBe(false);
    });

    it('BMI 27, with comorbidity → true', () => {
        expect(bmiMeetsThreshold(stateForBmi(27.1, { comorbidities: ['t2d-or-prediabetes'] }))).toBe(true);
    });

    it('BMI 28, no comorbidity → false', () => {
        expect(bmiMeetsThreshold(stateForBmi(28, { comorbidities: [] }))).toBe(false);
    });

    it('BMI 28, with comorbidity → true', () => {
        expect(bmiMeetsThreshold(stateForBmi(28, { comorbidities: ['pcos'] }))).toBe(true);
    });

    it('BMI 30, no comorbidity → true (≥30 alone qualifies)', () => {
        expect(bmiMeetsThreshold(stateForBmi(30.1, { comorbidities: [] }))).toBe(true);
    });

    it('BMI 30, with comorbidity → true', () => {
        expect(bmiMeetsThreshold(stateForBmi(30.1, { comorbidities: ['high-cholesterol'] }))).toBe(true);
    });

    it('BMI 35, no comorbidity → true', () => {
        expect(bmiMeetsThreshold(stateForBmi(35, { comorbidities: [] }))).toBe(true);
    });

    it('BMI null (no inputs) → false', () => {
        expect(bmiMeetsThreshold({})).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(bmiMeetsThreshold(null)).toBe(false);
    });
});

// ─── bmiBorderline ───────────────────────────────────────────────────

describe('bmiBorderline', () => {
    it('BMI 26, no comorbidity → false (below 27)', () => {
        expect(bmiBorderline(stateForBmi(26, { comorbidities: [] }))).toBe(false);
    });

    it('BMI 27, no comorbidity → true', () => {
        expect(bmiBorderline(stateForBmi(27.1, { comorbidities: [] }))).toBe(true);
    });

    it('BMI 29, no comorbidity → true', () => {
        expect(bmiBorderline(stateForBmi(29, { comorbidities: [] }))).toBe(true);
    });

    it('BMI 30, no comorbidity → false (at-or-above 30 — qualifies on BMI alone)', () => {
        expect(bmiBorderline(stateForBmi(30.1, { comorbidities: [] }))).toBe(false);
    });

    it('BMI 28, with comorbidity → false (qualifies via comorbidity path)', () => {
        expect(bmiBorderline(stateForBmi(28, { comorbidities: ['t2d-or-prediabetes'] }))).toBe(false);
    });

    it('BMI null → false', () => {
        expect(bmiBorderline({})).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(bmiBorderline(null)).toBe(false);
    });
});

// ─── bmiBelowThreshold ───────────────────────────────────────────────

describe('bmiBelowThreshold', () => {
    it('BMI 25 → true', () => {
        expect(bmiBelowThreshold(stateForBmi(25))).toBe(true);
    });

    it('BMI 26.9 → true', () => {
        expect(bmiBelowThreshold(stateForBmi(26.9))).toBe(true);
    });

    it('BMI 27 → false (boundary inclusive of 27)', () => {
        expect(bmiBelowThreshold(stateForBmi(27.1))).toBe(false);
    });

    it('BMI 30 → false', () => {
        expect(bmiBelowThreshold(stateForBmi(30.1))).toBe(false);
    });

    it('BMI null → false', () => {
        expect(bmiBelowThreshold({})).toBe(false);
    });

    it('null state → false (defensive)', () => {
        expect(bmiBelowThreshold(null)).toBe(false);
    });
});

// ─── scoreGlp1 — every tier-precedence branch (CRITICAL) ─────────────
// Helpers to keep test states clean.

const CLEAN_DEFAULTS = {
    age: 40,
    sex: 'female',
    heightInches: 70,
    weightLbs: 245,           // BMI ~35.1 (qualifies on BMI alone)
    comorbidities: [],
    priorAttempt: 'yes',
    medicalHistory: [],
    pregnancyOrPlanning: 'no',
    bariatricHistory: 'no',
    otherCondition: '',
    readiness: 5,
    stateCode: 'IL'
};

function withState(overrides) {
    return { ...CLEAN_DEFAULTS, ...overrides };
}

// ─── contraindication wins over everything ──────────────────────────

describe('scoreGlp1 — contraindication wins over everything', () => {
    it('medical hard-stop wins over BMI present + comorbidity + prior attempt + readiness', () => {
        const result = scoreGlp1(withState({
            medicalHistory: ['mtc-or-men2'],
            comorbidities: ['t2d-or-prediabetes'],
            priorAttempt: 'yes',
            readiness: 5
        }));
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it('pregnancy wins over eligibility-present', () => {
        const result = scoreGlp1(withState({
            pregnancyOrPlanning: 'yes',
            comorbidities: ['t2d-or-prediabetes']
        }));
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it('otherCondition wins over eligibility-present', () => {
        const result = scoreGlp1(withState({
            otherCondition: 'lupus',
            comorbidities: ['t2d-or-prediabetes']
        }));
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it.each([
        ['mtc-or-men2'],
        ['pancreatitis'],
        ['severe-gastroparesis'],
        ['t1d'],
        ['eating-disorder'],
        ['suicidal-ideation-or-recent-psych-hospitalization'],
        ['severe-esrd'],
        ['severe-diabetic-retinopathy-on-insulin']
    ])('hard-stop %s alone routes to contraindication', (key) => {
        const result = scoreGlp1(withState({ medicalHistory: [key] }));
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it('contraindication wins over bariatric modifier', () => {
        const result = scoreGlp1(withState({
            bariatricHistory: 'yes',
            medicalHistory: ['t1d']
        }));
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it('contraindication wins over below-threshold BMI', () => {
        const result = scoreGlp1(withState({
            weightLbs: 120,         // BMI ~17.2
            medicalHistory: ['pancreatitis']
        }));
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it('contraindication: pregnancy + medical hard-stop both fire — still contraindication', () => {
        const result = scoreGlp1(withState({
            pregnancyOrPlanning: 'yes',
            medicalHistory: ['mtc-or-men2']
        }));
        expect(result.internalTier).toBe('contraindication-identified');
    });
});

// ─── specialist wins over BMI tiers (but NOT over contraindication) ──

describe('scoreGlp1 — specialist-evaluation routing', () => {
    it('bariatric + BMI 35 → specialist-evaluation', () => {
        const result = scoreGlp1(withState({
            bariatricHistory: 'yes',
            weightLbs: 245           // BMI ~35.1
        }));
        expect(result.internalTier).toBe('specialist-evaluation');
    });

    it('bariatric + BMI 25 → specialist-evaluation (still specialist regardless of BMI)', () => {
        const result = scoreGlp1(withState({
            bariatricHistory: 'yes',
            weightLbs: 175           // BMI ~25.1
        }));
        expect(result.internalTier).toBe('specialist-evaluation');
    });

    it('bariatric + medical hard-stop → contraindication-identified (hard-stop wins)', () => {
        const result = scoreGlp1(withState({
            bariatricHistory: 'yes',
            medicalHistory: ['mtc-or-men2']
        }));
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it('bariatric + pregnancy → contraindication-identified', () => {
        const result = scoreGlp1(withState({
            bariatricHistory: 'yes',
            pregnancyOrPlanning: 'yes'
        }));
        expect(result.internalTier).toBe('contraindication-identified');
    });

    it('bariatric + otherCondition → contraindication-identified', () => {
        const result = scoreGlp1(withState({
            bariatricHistory: 'yes',
            otherCondition: 'lupus'
        }));
        expect(result.internalTier).toBe('contraindication-identified');
    });
});

// ─── eligibility-not-met-bmi ─────────────────────────────────────────

describe('scoreGlp1 — eligibility-not-met-bmi', () => {
    it('BMI 25, no comorbidity, no hard-stop, no bariatric → eligibility-not-met-bmi', () => {
        const result = scoreGlp1(withState({
            weightLbs: 175,          // BMI ~25.1
            comorbidities: []
        }));
        expect(result.internalTier).toBe('eligibility-not-met-bmi');
    });

    it('BMI 26 → eligibility-not-met-bmi', () => {
        const result = scoreGlp1(withState({
            weightLbs: 180           // BMI ~25.8 — set explicitly via state helper
        }));
        // Use bmi helper to be precise:
        const r2 = scoreGlp1(withState({ ...stateForBmi(26), comorbidities: [] }));
        expect(r2.internalTier).toBe('eligibility-not-met-bmi');
    });

    it('BMI 26.9 → eligibility-not-met-bmi (just below 27)', () => {
        const result = scoreGlp1(withState({ ...stateForBmi(26.9), comorbidities: [] }));
        expect(result.internalTier).toBe('eligibility-not-met-bmi');
    });

    it('BMI <27 with a comorbidity still routes to eligibility-not-met-bmi (comorbidity does NOT rescue)', () => {
        // Per scoring.js: bmiBelowThreshold check happens BEFORE bmiMeetsThreshold,
        // and bmiBelowThreshold ignores comorbidity — so BMI 25 + comorbidity is
        // still "below threshold".
        const result = scoreGlp1(withState({
            ...stateForBmi(25),
            comorbidities: ['t2d-or-prediabetes']
        }));
        expect(result.internalTier).toBe('eligibility-not-met-bmi');
    });
});

// ─── eligibility-mixed (BMI borderline 27-30 without comorbidity) ────

describe('scoreGlp1 — eligibility-mixed (BMI 27-30 without comorbidity)', () => {
    it('BMI 27, no comorbidity → eligibility-mixed', () => {
        const result = scoreGlp1(withState({
            ...stateForBmi(27.1),
            comorbidities: []
        }));
        expect(result.internalTier).toBe('eligibility-mixed');
    });

    it('BMI 28, no comorbidity → eligibility-mixed', () => {
        const result = scoreGlp1(withState({
            ...stateForBmi(28),
            comorbidities: []
        }));
        expect(result.internalTier).toBe('eligibility-mixed');
    });

    it('BMI 29, no comorbidity → eligibility-mixed', () => {
        const result = scoreGlp1(withState({
            ...stateForBmi(29),
            comorbidities: []
        }));
        expect(result.internalTier).toBe('eligibility-mixed');
    });
});

// ─── eligibility-mixed (threshold met but missing prior attempt) ─────

describe('scoreGlp1 — eligibility-mixed (BMI threshold met, prior attempt missing)', () => {
    it("BMI 35, comorbidity, priorAttempt='no', readiness 5 → eligibility-mixed", () => {
        const result = scoreGlp1(withState({
            comorbidities: ['t2d-or-prediabetes'],
            priorAttempt: 'no',
            readiness: 5
        }));
        expect(result.internalTier).toBe('eligibility-mixed');
    });

    it("BMI 28, comorbidity, priorAttempt='prefer-not', readiness 5 → eligibility-mixed", () => {
        // 'prefer-not' is NOT 'yes' → priorAttemptYes returns false
        const result = scoreGlp1(withState({
            ...stateForBmi(28),
            comorbidities: ['t2d-or-prediabetes'],
            priorAttempt: 'prefer-not',
            readiness: 5
        }));
        expect(result.internalTier).toBe('eligibility-mixed');
    });

    it("BMI 30+, no comorbidity, priorAttempt='no' → eligibility-mixed (qualifies on BMI alone)", () => {
        const result = scoreGlp1(withState({
            ...stateForBmi(30.5),
            comorbidities: [],
            priorAttempt: 'no'
        }));
        expect(result.internalTier).toBe('eligibility-mixed');
    });
});

// ─── eligibility-mixed (threshold met but readiness too low) ─────────

describe('scoreGlp1 — eligibility-mixed (BMI threshold met, readiness too low)', () => {
    it("BMI 35, comorbidity, priorAttempt='yes', readiness 1 → eligibility-mixed", () => {
        const result = scoreGlp1(withState({
            comorbidities: ['t2d-or-prediabetes'],
            priorAttempt: 'yes',
            readiness: 1
        }));
        expect(result.internalTier).toBe('eligibility-mixed');
    });

    it("BMI 35, comorbidity, priorAttempt='yes', readiness 2 → eligibility-mixed", () => {
        const result = scoreGlp1(withState({
            comorbidities: ['t2d-or-prediabetes'],
            priorAttempt: 'yes',
            readiness: 2
        }));
        expect(result.internalTier).toBe('eligibility-mixed');
    });

    it("BMI 30+, priorAttempt='yes', readiness 0 → eligibility-mixed", () => {
        const result = scoreGlp1(withState({
            ...stateForBmi(30.5),
            priorAttempt: 'yes',
            readiness: 0
        }));
        expect(result.internalTier).toBe('eligibility-mixed');
    });
});

// ─── eligibility-present ─────────────────────────────────────────────

describe('scoreGlp1 — eligibility-present (all factors aligned)', () => {
    it("BMI 30+, priorAttempt='yes', readiness 3 → eligibility-present (boundary readiness)", () => {
        const result = scoreGlp1(withState({
            ...stateForBmi(30.5),
            priorAttempt: 'yes',
            readiness: 3
        }));
        expect(result.internalTier).toBe('eligibility-present');
    });

    it("BMI 35, priorAttempt='yes', readiness 5 → eligibility-present", () => {
        const result = scoreGlp1(withState({
            comorbidities: [],
            priorAttempt: 'yes',
            readiness: 5
        }));
        expect(result.internalTier).toBe('eligibility-present');
    });

    it("BMI 27, comorbidity 't2d-or-prediabetes', priorAttempt='yes', readiness 4 → eligibility-present", () => {
        const result = scoreGlp1(withState({
            ...stateForBmi(27.1),
            comorbidities: ['t2d-or-prediabetes'],
            priorAttempt: 'yes',
            readiness: 4
        }));
        expect(result.internalTier).toBe('eligibility-present');
    });

    it("BMI 27, comorbidity 'pcos', priorAttempt='yes', readiness 5 → eligibility-present", () => {
        const result = scoreGlp1(withState({
            ...stateForBmi(27.1),
            comorbidities: ['pcos'],
            priorAttempt: 'yes',
            readiness: 5
        }));
        expect(result.internalTier).toBe('eligibility-present');
    });
});

// ─── scoreGlp1 — defensive against bad inputs ────────────────────────

describe('scoreGlp1 — defensive', () => {
    it('scoreGlp1(null) returns valid object with eligibility-mixed', () => {
        const result = scoreGlp1(null);
        expect(result).toBeDefined();
        expect(result.internalTier).toBe('eligibility-mixed');
        expect(result.bmi).toBeNull();
        expect(result.hasComorbidity).toBe(false);
        expect(result.hasMedicalHardStop).toBe(false);
        expect(result.hasPregnancyHardStop).toBe(false);
        expect(result.hasOtherConditionHardStop).toBe(false);
        expect(result.hasBariatricModifier).toBe(false);
        expect(result.bmiMeetsThreshold).toBe(false);
        expect(result.bmiBorderline).toBe(false);
        expect(result.bmiBelowThreshold).toBe(false);
        expect(result.priorAttemptYes).toBe(false);
        expect(result.readinessAdequate).toBe(false);
        expect(result.outOfState).toBe(true);
    });

    it('scoreGlp1({}) returns valid object with eligibility-mixed', () => {
        const result = scoreGlp1({});
        expect(result).toBeDefined();
        expect(result.internalTier).toBe('eligibility-mixed');
        expect(result.bmi).toBeNull();
        expect(result.outOfState).toBe(true);
    });

    it('scoreGlp1 result has all expected keys (shape contract)', () => {
        const result = scoreGlp1(CLEAN_DEFAULTS);
        const expectedKeys = [
            'bmi',
            'hasComorbidity',
            'hasMedicalHardStop',
            'hasPregnancyHardStop',
            'hasOtherConditionHardStop',
            'hasBariatricModifier',
            'bmiMeetsThreshold',
            'bmiBorderline',
            'bmiBelowThreshold',
            'priorAttemptYes',
            'readinessAdequate',
            'internalTier',
            'internalTierLabel',
            'resultSlug',
            'outOfState'
        ];
        for (const key of expectedKeys) {
            expect(Object.prototype.hasOwnProperty.call(result, key), `missing key: ${key}`).toBe(true);
        }
    });

    it('scoreGlp1 result includes the canonical label/slug for the resolved tier', () => {
        const result = scoreGlp1(CLEAN_DEFAULTS);
        expect(result.internalTierLabel).toBe(INTERNAL_TIER_LABELS[result.internalTier]);
        expect(result.resultSlug).toBe(RESULT_SLUGS[result.internalTier]);
    });
});

// ─── outOfState ──────────────────────────────────────────────────────

describe('scoreGlp1 — outOfState routing', () => {
    it("stateCode='IL' → outOfState=false", () => {
        const result = scoreGlp1({ ...CLEAN_DEFAULTS, stateCode: 'IL' });
        expect(result.outOfState).toBe(false);
    });

    it("stateCode='il' (lowercase) → outOfState=false (case-insensitive)", () => {
        const result = scoreGlp1({ ...CLEAN_DEFAULTS, stateCode: 'il' });
        expect(result.outOfState).toBe(false);
    });

    it("stateCode='CA' → outOfState=true", () => {
        const result = scoreGlp1({ ...CLEAN_DEFAULTS, stateCode: 'CA' });
        expect(result.outOfState).toBe(true);
    });

    it('stateCode empty → outOfState=true', () => {
        const result = scoreGlp1({ ...CLEAN_DEFAULTS, stateCode: '' });
        expect(result.outOfState).toBe(true);
    });

    it('stateCode missing → outOfState=true', () => {
        const result = scoreGlp1({ ...CLEAN_DEFAULTS, stateCode: undefined });
        expect(result.outOfState).toBe(true);
    });

    it('stateCode null → outOfState=true (non-string defensive)', () => {
        const result = scoreGlp1({ ...CLEAN_DEFAULTS, stateCode: null });
        expect(result.outOfState).toBe(true);
    });

    it('stateCode number → outOfState=true (non-string defensive)', () => {
        const result = scoreGlp1({ ...CLEAN_DEFAULTS, stateCode: 17 });
        expect(result.outOfState).toBe(true);
    });
});

// ─── Catalog/label sanity ────────────────────────────────────────────

describe('Catalog/label sanity', () => {
    it('INTERNAL_TIER_LABELS has 5 entries matching INTERNAL_TIER_VALUES', () => {
        const labelKeys = Object.keys(INTERNAL_TIER_LABELS).sort();
        const valueKeys = [...INTERNAL_TIER_VALUES].sort();
        expect(labelKeys).toEqual(valueKeys);
        expect(labelKeys.length).toBe(5);
    });

    it('RESULT_SLUGS has 5 entries with same keys as INTERNAL_TIER_LABELS', () => {
        const slugKeys = Object.keys(RESULT_SLUGS).sort();
        const labelKeys = Object.keys(INTERNAL_TIER_LABELS).sort();
        expect(slugKeys).toEqual(labelKeys);
        expect(slugKeys.length).toBe(5);
    });

    it('every INTERNAL_TIER_LABELS value is one of the 5 guardrail-allowed neutral strings', () => {
        // The guardrail spec allows these neutral, candidacy-free labels.
        // Specialist evaluation is the 5th label since GLP-1 uses bariatric
        // history as a specialist-routing modifier (not a contraindication
        // and not an eligibility tier).
        const allowed = new Set([
            'Contraindication identified',
            'Specialist evaluation indicated',
            'Eligibility factors present',
            'Eligibility factors mixed',
            'Eligibility factors not met'
        ]);
        for (const [key, label] of Object.entries(INTERNAL_TIER_LABELS)) {
            expect(allowed.has(label), `${key} label "${label}" not in allowed set`).toBe(true);
        }
    });

    it('HARD_STOP_MEDICAL has exactly 8 entries', () => {
        expect(HARD_STOP_MEDICAL.size).toBe(8);
    });

    it("HARD_STOP_MEDICAL contains the 8 expected keys", () => {
        const expected = [
            'mtc-or-men2',
            'pancreatitis',
            'severe-gastroparesis',
            't1d',
            'eating-disorder',
            'suicidal-ideation-or-recent-psych-hospitalization',
            'severe-esrd',
            'severe-diabetic-retinopathy-on-insulin'
        ];
        for (const key of expected) {
            expect(HARD_STOP_MEDICAL.has(key), `missing hard-stop key ${key}`).toBe(true);
        }
    });

    it("MED_HISTORY_KEYS has 9 entries (8 hard-stops + 'none')", () => {
        expect(MED_HISTORY_KEYS.size).toBe(9);
        expect(MED_HISTORY_KEYS.has('none')).toBe(true);
    });

    it("COMORBIDITY_KEYS has 8 entries (7 qualifying + 'none')", () => {
        expect(COMORBIDITY_KEYS.size).toBe(8);
        expect(COMORBIDITY_KEYS.has('none')).toBe(true);
    });

    it("COMORBIDITY_KEYS contains the 7 expected qualifying keys + 'none'", () => {
        const expected = [
            't2d-or-prediabetes',
            'high-blood-pressure',
            'high-cholesterol',
            'sleep-apnea',
            'pcos',
            'nafld',
            'cardiovascular-disease',
            'none'
        ];
        for (const key of expected) {
            expect(COMORBIDITY_KEYS.has(key), `missing comorbidity key ${key}`).toBe(true);
        }
    });

    it("PRIOR_ATTEMPT_VALUES = {yes, no, prefer-not}", () => {
        expect(PRIOR_ATTEMPT_VALUES.size).toBe(3);
        expect(PRIOR_ATTEMPT_VALUES.has('yes')).toBe(true);
        expect(PRIOR_ATTEMPT_VALUES.has('no')).toBe(true);
        expect(PRIOR_ATTEMPT_VALUES.has('prefer-not')).toBe(true);
    });

    it("SEX_VALUES = {male, female, prefer-not}", () => {
        expect(SEX_VALUES.size).toBe(3);
        expect(SEX_VALUES.has('male')).toBe(true);
        expect(SEX_VALUES.has('female')).toBe(true);
        expect(SEX_VALUES.has('prefer-not')).toBe(true);
    });

    it('BMI_THRESHOLD_OBESITY === 30', () => {
        expect(BMI_THRESHOLD_OBESITY).toBe(30);
    });

    it('BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY === 27', () => {
        expect(BMI_THRESHOLD_OVERWEIGHT_WITH_COMORBIDITY).toBe(27);
    });

    it('READINESS_ADEQUATE_MIN === 3', () => {
        expect(READINESS_ADEQUATE_MIN).toBe(3);
    });

    it('INTERNAL_TIER_VALUES contains all 5 expected tier ids', () => {
        const expected = [
            'contraindication-identified',
            'specialist-evaluation',
            'eligibility-not-met-bmi',
            'eligibility-mixed',
            'eligibility-present'
        ];
        for (const v of expected) {
            expect(INTERNAL_TIER_VALUES.has(v), `missing tier id ${v}`).toBe(true);
        }
        expect(INTERNAL_TIER_VALUES.size).toBe(5);
    });
});

// ─── Forbidden-content guardrails — INLINE constants ─────────────────
// GLP-1 is the highest-regulatory-risk quiz of the four shipped so far.
// The banned-content list is the strictest. NEVER name a specific drug,
// NEVER imply candidacy, NEVER claim compounded versions are equivalent
// or substitutable. The patient-facing tier labels collapse into 5
// neutral guardrail-approved strings; body copy is bound by the same rule.

const BANNED_DRUG_NAMES = [
    // GLP-1 brand names
    'wegovy', 'ozempic', 'zepbound', 'mounjaro', 'saxenda', 'victoza',
    'trulicity', 'rybelsus',
    // GLP-1 generic / molecule names
    'semaglutide', 'tirzepatide', 'liraglutide', 'dulaglutide', 'exenatide',
    // Other weight-management drugs
    'phentermine', 'qsymia', 'contrave', 'plenity', 'orlistat', 'xenical',
    'alli',
    // Compounded-equivalence claims
    'compounded semaglutide', 'compounded tirzepatide'
];

const BANNED_PHRASES = [
    'you qualify for',
    'compounded versions are equivalent',
    'compounded version is equivalent',
    'as a substitute for',
    'strong candidate',
    'possible candidate',
    'likely candidate',
    'you have obesity',
    'you are obese'
];

// ─── Source-file scan setup (engine + submit handler + scoring) ──────
// The scoring module is pure ESM and gets imported above. The engine
// (`quiz-engine.js`) and submit handler are not — read them as text and
// grep. existsSync guards keep the rest of the suite running cleanly when
// sibling tasks haven't yet written those files; the source-scan it()s
// will fail with a clear "file does not exist" message.

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..');

const ENGINE_PATH  = join(REPO_ROOT, 'quiz/glp1/quiz-engine.js');
const SUBMIT_PATH  = join(REPO_ROOT, 'netlify/functions/glp1-quiz-submit.js');
const SCORING_PATH = join(REPO_ROOT, 'quiz/glp1/scoring.js');
const PAGE_PATH    = join(REPO_ROOT, 'quiz/glp1/index.html');

const ENGINE_SRC  = existsSync(ENGINE_PATH)  ? readFileSync(ENGINE_PATH,  'utf8') : '';
const SUBMIT_SRC  = existsSync(SUBMIT_PATH)  ? readFileSync(SUBMIT_PATH,  'utf8') : '';
const SCORING_SRC = existsSync(SCORING_PATH) ? readFileSync(SCORING_PATH, 'utf8') : '';
const PAGE_HTML   = existsSync(PAGE_PATH)    ? readFileSync(PAGE_PATH,    'utf8') : '';

/**
 * Strip JS comment lines so guardrail-reminder comments don't trip the
 * banned-content scan. Filters lines whose trimmed form starts with
 * `*`, `//`, or `/*`. Mirrors the helper in low-t-scoring.test.js.
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
    it('engine source file exists at quiz/glp1/quiz-engine.js', () => {
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
    it('submit handler exists at netlify/functions/glp1-quiz-submit.js', () => {
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
// Apply the lesson learned from the low-t Wave 4: scoring source must
// also be in the scan to prevent future copy-paste regressions.

describe('Forbidden content — scoring source file', () => {
    it('scoring source file exists at quiz/glp1/scoring.js', () => {
        expect(existsSync(SCORING_PATH), `expected ${SCORING_PATH} to exist`).toBe(true);
    });

    it.each(BANNED_DRUG_NAMES)('scoring source does not contain drug name: %s', (drug) => {
        expect(SCORING_CODE).not.toContain(drug);
    });

    it.each(BANNED_PHRASES)('scoring source does not contain banned phrase: %s', (phrase) => {
        expect(SCORING_CODE).not.toContain(phrase);
    });
});

// ─── Critical regulatory regression tests ────────────────────────────
// The verbatim "no compounded substitution" disclaimer is the legal
// firewall between the quiz and FTC/FDA enforcement risk. A silent edit
// removing or weakening this language would fail this test rather than
// slipping into production.

describe('Critical regulatory regression tests', () => {
    it('static page (index.html) contains the verbatim no-compounding disclaimer', () => {
        expect(PAGE_HTML).toContain(
            'We do not market or sell compounded versions of FDA-approved medications as substitutes for those products'
        );
    });

    it('submit handler contains the verbatim no-compounding disclaimer', () => {
        expect(SUBMIT_SRC).toContain(
            'We do not market or sell compounded versions of FDA-approved medications as substitutes for those products'
        );
    });

    it("engine does NOT contain 'in collaboration with' (Missy has FPA — placeholder retired)", () => {
        expect(ENGINE_CODE).not.toContain('in collaboration with');
    });

    it("submit handler does NOT contain 'in collaboration with' (Missy has FPA — placeholder retired)", () => {
        expect(SUBMIT_CODE).not.toContain('in collaboration with');
    });

    it("engine source contains the verbatim 'This is not a determination that you are a candidate' line", () => {
        expect(ENGINE_SRC).toContain('This is not a determination that you are a candidate');
    });

    it("submit handler source contains the verbatim 'This is not a determination that you are a candidate' line", () => {
        expect(SUBMIT_SRC).toContain('This is not a determination that you are a candidate');
    });
});

// ─── Pin the noindex meta (regulatory + commercial) ──────────────────
// GLP-1 quiz must NEVER be indexed by search engines. This is both a
// regulatory protection (no organic drug-seeking traffic landing on a
// "do you qualify" page) and a commercial protection (eligibility flow
// stays gated behind paid acquisition / direct nav). A regression that
// removes either meta would fail this test.

describe('Static page noindex meta tags', () => {
    it('static page contains noindex robots meta', () => {
        expect(PAGE_HTML).toMatch(/<meta\s+name="robots"\s+content="noindex/);
    });

    it('static page contains noindex googlebot meta', () => {
        expect(PAGE_HTML).toMatch(/<meta\s+name="googlebot"\s+content="noindex/);
    });
});
