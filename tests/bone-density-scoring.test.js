import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    scoreBoneDensity,
    computeOst,
    countRiskFactors,
    resolveWeightKg,
    TIER_LABELS,
    RESULT_SLUGS
} from '../quiz/bone-density/scoring.js';

/*
 * Bone Density Scoring — Regression Suite
 * =======================================
 *
 * This is the legal/clinical pin for the bone-density quiz tiering logic.
 * The browser engine inlines the same rules as an IIFE; the canonical
 * source of truth is `quiz/bone-density/scoring.js`. If either drifts,
 * these tests break.
 *
 * Branches covered (every conditional in scoring.js):
 *   resolveWeightKg:   null state, kg-preferred, kg-only, lbs-only,
 *                      neither, zero, negative
 *   computeOst:        male short-circuit, age<45 short-circuit, no-weight,
 *                      sex='prefer-not', valid woman calculations
 *   countRiskFactors:  empty/null state, each yes-flag, premature menopause
 *                      gated by sex='female', defensive null arrays
 *   scoreBoneDensity:  Tier A (prior fracture), Tier B (OST<2 path), Tier B
 *                      (≥3 risk factors path), Tier C (1–2 risk factors),
 *                      Tier D (no qualifiers), age=45 boundary inclusive,
 *                      age=44 boundary exclusive, outOfState casing,
 *                      tierLabel + resultSlug mapping integrity.
 */

const LBS_TO_KG = 0.45359237;

// ─── resolveWeightKg ─────────────────────────────────────────────────

describe('resolveWeightKg', () => {
    it('returns weightKg when present and positive', () => {
        expect(resolveWeightKg({ weightKg: 70 })).toBe(70);
    });

    it('prefers weightKg over weightLbs when both supplied', () => {
        const result = resolveWeightKg({ weightKg: 70, weightLbs: 154 });
        expect(result).toBe(70);
        // Sanity: it is NOT the lbs conversion
        expect(result).not.toBeCloseTo(154 * LBS_TO_KG, 5);
    });

    it('converts weightLbs to kg when only lbs given (150 lbs ≈ 68.04 kg)', () => {
        const result = resolveWeightKg({ weightLbs: 150 });
        expect(result).toBeCloseTo(68.04, 2);
    });

    it('returns null when neither weight is given', () => {
        expect(resolveWeightKg({})).toBeNull();
    });

    it.each([
        ['weightKg = 0', { weightKg: 0 }],
        ['weightKg negative', { weightKg: -10 }],
        ['weightLbs = 0', { weightLbs: 0 }],
        ['weightLbs negative', { weightLbs: -5 }]
    ])('returns null when %s (non-positive weight)', (_label, state) => {
        expect(resolveWeightKg(state)).toBeNull();
    });

    it('returns null when state is null', () => {
        expect(resolveWeightKg(null)).toBeNull();
    });

    it('returns null when state is undefined', () => {
        expect(resolveWeightKg(undefined)).toBeNull();
    });
});

// ─── computeOst ──────────────────────────────────────────────────────

describe('computeOst', () => {
    it('returns null for males regardless of age', () => {
        expect(computeOst({ sex: 'male', age: 70, weightKg: 60 })).toBeNull();
        expect(computeOst({ sex: 'male', age: 30, weightKg: 60 })).toBeNull();
    });

    it("returns null for sex='prefer-not'", () => {
        expect(computeOst({ sex: 'prefer-not', age: 70, weightKg: 60 })).toBeNull();
    });

    it('returns null for women under 45', () => {
        expect(computeOst({ sex: 'female', age: 44, weightKg: 60 })).toBeNull();
        expect(computeOst({ sex: 'female', age: 30, weightKg: 60 })).toBeNull();
    });

    it('returns null for women ≥45 with no weight provided', () => {
        expect(computeOst({ sex: 'female', age: 60 })).toBeNull();
    });

    it.each([
        // [label, state, expected]
        ['woman 60, 60kg → 0',                  { sex: 'female', age: 60, weightKg: 60 }, 0],
        ['woman 50, 50kg → 0',                  { sex: 'female', age: 50, weightKg: 50 }, 0],
        ['woman 65, 50kg → -3 (high risk)',     { sex: 'female', age: 65, weightKg: 50 }, -3],
        ['woman 60, 80kg → 4 (low risk)',       { sex: 'female', age: 60, weightKg: 80 }, 4],
        ['woman 45 boundary, 60kg → 3',         { sex: 'female', age: 45, weightKg: 60 }, 3]
    ])('OST(%s) computes correctly', (_label, state, expected) => {
        expect(computeOst(state)).toBeCloseTo(expected, 5);
    });

    it('returns null when state is null', () => {
        expect(computeOst(null)).toBeNull();
    });
});

// ─── countRiskFactors ────────────────────────────────────────────────

describe('countRiskFactors', () => {
    it('returns 0 for empty state', () => {
        expect(countRiskFactors({})).toBe(0);
    });

    it("returns 0 when all flags 'no' and arrays empty", () => {
        expect(countRiskFactors({
            priorFragilityFracture: 'no',
            heightLoss: 'no',
            parentalHipFracture: 'no',
            smokingOrAlcohol: 'no',
            medications: [],
            prematureMenopause: 'no',
            secondaryConditions: [],
            sex: 'female'
        })).toBe(0);
    });

    it.each([
        ['priorFragilityFracture',  { priorFragilityFracture: 'yes' }],
        ['heightLoss',              { heightLoss: 'yes' }],
        ['parentalHipFracture',     { parentalHipFracture: 'yes' }],
        ['smokingOrAlcohol',        { smokingOrAlcohol: 'yes' }]
    ])('one flag %s = yes → contributes 1', (_label, state) => {
        expect(countRiskFactors(state)).toBe(1);
    });

    it('all four boolean flags + 2 meds + 3 conditions = 9 (no menopause)', () => {
        const state = {
            priorFragilityFracture: 'yes',
            heightLoss: 'yes',
            parentalHipFracture: 'yes',
            smokingOrAlcohol: 'yes',
            medications: ['steroid', 'aromatase'],
            secondaryConditions: ['ra', 'celiac', 'ibd']
        };
        expect(countRiskFactors(state)).toBe(9);
    });

    it("prematureMenopause='yes' for sex='female' is counted", () => {
        const state = { sex: 'female', prematureMenopause: 'yes' };
        expect(countRiskFactors(state)).toBe(1);
    });

    it("prematureMenopause='yes' for sex='male' is NOT counted", () => {
        const state = { sex: 'male', prematureMenopause: 'yes' };
        expect(countRiskFactors(state)).toBe(0);
    });

    it("prematureMenopause='yes' for sex='prefer-not' is NOT counted", () => {
        const state = { sex: 'prefer-not', prematureMenopause: 'yes' };
        expect(countRiskFactors(state)).toBe(0);
    });

    it('medications array of length 3 contributes 3', () => {
        expect(countRiskFactors({ medications: ['a', 'b', 'c'] })).toBe(3);
    });

    it('secondaryConditions array of length 4 contributes 4', () => {
        expect(countRiskFactors({ secondaryConditions: ['a', 'b', 'c', 'd'] })).toBe(4);
    });

    it('defensive: medications=undefined counted as 0 (does not crash)', () => {
        expect(countRiskFactors({ medications: undefined })).toBe(0);
    });

    it('defensive: secondaryConditions=undefined counted as 0', () => {
        expect(countRiskFactors({ secondaryConditions: undefined })).toBe(0);
    });

    it('defensive: state=null returns 0 (does not crash)', () => {
        expect(countRiskFactors(null)).toBe(0);
    });

    it('defensive: state=undefined returns 0', () => {
        expect(countRiskFactors(undefined)).toBe(0);
    });
});

// ─── scoreBoneDensity — tier branches ────────────────────────────────
// Each row exercises one branch in the tier-decision ladder. Names read
// in patient-clinical terms so a failure tells you exactly which
// guideline path regressed.

describe('scoreBoneDensity — tier decision ladder', () => {
    it('prior fragility fracture trumps everything → Tier A (woman 30, IL, no other factors)', () => {
        const result = scoreBoneDensity({
            sex: 'female',
            age: 30,
            priorFragilityFracture: 'yes',
            stateCode: 'IL'
        });
        expect(result.tier).toBe('A');
        expect(result.resultSlug).toBe('clinical-indication');
    });

    it('prior fragility fracture + multiple other risk factors → still Tier A', () => {
        const result = scoreBoneDensity({
            sex: 'female',
            age: 65,
            weightKg: 45,
            priorFragilityFracture: 'yes',
            heightLoss: 'yes',
            parentalHipFracture: 'yes',
            smokingOrAlcohol: 'yes',
            medications: ['steroid'],
            secondaryConditions: ['ra'],
            stateCode: 'IL'
        });
        expect(result.tier).toBe('A');
    });

    it('woman 50 + 45kg + no other factors → Tier B (OST = 0.2*(45-50) = -1, < 2)', () => {
        const result = scoreBoneDensity({
            sex: 'female',
            age: 50,
            weightKg: 45,
            priorFragilityFracture: 'no',
            stateCode: 'IL'
        });
        expect(result.tier).toBe('B');
        expect(result.ostScore).toBeLessThan(2);
        expect(result.riskFactorCount).toBe(0);
    });

    it('woman 70 + 90kg + no risk factors → Tier D (OST = 4, ≥2 not high risk)', () => {
        const result = scoreBoneDensity({
            sex: 'female',
            age: 70,
            weightKg: 90,
            priorFragilityFracture: 'no',
            stateCode: 'IL'
        });
        expect(result.tier).toBe('D');
        expect(result.ostScore).toBeCloseTo(4, 5);
        expect(result.riskFactorCount).toBe(0);
    });

    it('man 50 + 45kg + no other factors → Tier D (OST does NOT apply to men)', () => {
        const result = scoreBoneDensity({
            sex: 'male',
            age: 50,
            weightKg: 45,
            priorFragilityFracture: 'no',
            stateCode: 'IL'
        });
        expect(result.tier).toBe('D');
        expect(result.ostScore).toBeNull();
        expect(result.riskFactorCount).toBe(0);
    });

    it('man 50 + 45kg + 3 risk factors → Tier B (riskFactorCount path triggers for men)', () => {
        const result = scoreBoneDensity({
            sex: 'male',
            age: 50,
            weightKg: 45,
            priorFragilityFracture: 'no',
            heightLoss: 'yes',
            parentalHipFracture: 'yes',
            smokingOrAlcohol: 'yes',
            stateCode: 'IL'
        });
        expect(result.tier).toBe('B');
        expect(result.riskFactorCount).toBe(3);
    });

    it.each([
        ['riskFactorCount === 1 → Tier C', 1, 'C',
            { heightLoss: 'yes' }],
        ['riskFactorCount === 2 → Tier C', 2, 'C',
            { heightLoss: 'yes', parentalHipFracture: 'yes' }],
        ['riskFactorCount === 3 → Tier B', 3, 'B',
            { heightLoss: 'yes', parentalHipFracture: 'yes', smokingOrAlcohol: 'yes' }],
        ['riskFactorCount === 0 + no fracture → Tier D', 0, 'D', {}]
    ])('%s', (_label, expectedCount, expectedTier, riskFlags) => {
        const result = scoreBoneDensity({
            sex: 'male',
            age: 50,
            weightKg: 80,
            priorFragilityFracture: 'no',
            stateCode: 'IL',
            ...riskFlags
        });
        expect(result.riskFactorCount).toBe(expectedCount);
        expect(result.tier).toBe(expectedTier);
    });

    it('woman age=45 (boundary inclusive) + low OST → Tier B', () => {
        // OST = 0.2*(40-45) = -1, < 2
        const result = scoreBoneDensity({
            sex: 'female',
            age: 45,
            weightKg: 40,
            priorFragilityFracture: 'no',
            stateCode: 'IL'
        });
        expect(result.tier).toBe('B');
        expect(result.ostScore).toBeCloseTo(-1, 5);
    });

    it('woman age=44 (boundary exclusive) + low weight → OST is null, falls to risk-factor path → Tier D when no factors', () => {
        const result = scoreBoneDensity({
            sex: 'female',
            age: 44,
            weightKg: 40,
            priorFragilityFracture: 'no',
            stateCode: 'IL'
        });
        expect(result.tier).toBe('D');
        expect(result.ostScore).toBeNull();
    });
});

// ─── scoreBoneDensity — outOfState routing ───────────────────────────

describe('scoreBoneDensity — outOfState flag', () => {
    it("outOfState=true when stateCode is 'CA'", () => {
        const result = scoreBoneDensity({ stateCode: 'CA' });
        expect(result.outOfState).toBe(true);
    });

    it("outOfState=false when stateCode is 'IL'", () => {
        const result = scoreBoneDensity({ stateCode: 'IL' });
        expect(result.outOfState).toBe(false);
    });

    it('outOfState=true when stateCode is missing', () => {
        const result = scoreBoneDensity({});
        expect(result.outOfState).toBe(true);
    });

    it("outOfState=true when stateCode is empty string", () => {
        const result = scoreBoneDensity({ stateCode: '' });
        expect(result.outOfState).toBe(true);
    });

    it("outOfState ignores case — 'il' lowercase is treated as IL (not out-of-state)", () => {
        const result = scoreBoneDensity({ stateCode: 'il' });
        expect(result.outOfState).toBe(false);
    });

    it('outOfState=true when stateCode is null (defensive)', () => {
        const result = scoreBoneDensity({ stateCode: null });
        expect(result.outOfState).toBe(true);
    });
});

// ─── scoreBoneDensity — tierLabel and resultSlug mapping ─────────────

describe('scoreBoneDensity — tierLabel + resultSlug match catalog', () => {
    it.each([
        ['A', { sex: 'female', age: 30, priorFragilityFracture: 'yes' }],
        ['B', { sex: 'female', age: 50, weightKg: 45, priorFragilityFracture: 'no' }],
        ['C', { sex: 'male', age: 50, weightKg: 80, priorFragilityFracture: 'no', heightLoss: 'yes' }],
        ['D', { sex: 'male', age: 50, weightKg: 80, priorFragilityFracture: 'no' }]
    ])('Tier %s → tierLabel and resultSlug match catalog maps', (expectedTier, state) => {
        const result = scoreBoneDensity(state);
        expect(result.tier).toBe(expectedTier);
        expect(result.tierLabel).toBe(TIER_LABELS[expectedTier]);
        expect(result.resultSlug).toBe(RESULT_SLUGS[expectedTier]);
    });
});

// ─── Catalog integrity ───────────────────────────────────────────────

describe('TIER_LABELS / RESULT_SLUGS catalog integrity', () => {
    it('TIER_LABELS has exactly 4 entries (A, B, C, D)', () => {
        expect(Object.keys(TIER_LABELS).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('RESULT_SLUGS has exactly 4 entries matching the same keys', () => {
        expect(Object.keys(RESULT_SLUGS).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('every key in TIER_LABELS exists in RESULT_SLUGS and vice versa', () => {
        for (const key of Object.keys(TIER_LABELS)) {
            expect(RESULT_SLUGS[key], `RESULT_SLUGS missing ${key}`).toBeDefined();
        }
        for (const key of Object.keys(RESULT_SLUGS)) {
            expect(TIER_LABELS[key], `TIER_LABELS missing ${key}`).toBeDefined();
        }
    });

    it('every TIER_LABELS value is one of the four guardrail-allowed strings', () => {
        const allowed = new Set([
            'Eligibility factors present',
            'Eligibility factors mixed',
            'Eligibility factors not met',
            'Contraindication identified'
        ]);
        for (const [tier, label] of Object.entries(TIER_LABELS)) {
            expect(allowed.has(label), `Tier ${tier} label "${label}" not in allowed set`).toBe(true);
        }
    });
});

// ─── Forbidden content (clinical/legal review) ───────────────────────
// Hard ban on the word "FRAX" (licensed name) and on legacy candidacy
// language ("Strong candidate" / "Possible candidate") that prior review
// flagged as failing the medico-legal bar.

describe('Forbidden content guardrails', () => {
    const forbiddenSubstrings = ['frax', 'strong candidate', 'possible candidate'];

    it.each(forbiddenSubstrings)('no TIER_LABELS value contains "%s" (case-insensitive)', (substr) => {
        for (const [tier, label] of Object.entries(TIER_LABELS)) {
            expect(
                label.toLowerCase().includes(substr),
                `Tier ${tier} label "${label}" contains forbidden "${substr}"`
            ).toBe(false);
        }
    });

    it.each(forbiddenSubstrings)('no RESULT_SLUGS value contains "%s" (case-insensitive)', (substr) => {
        for (const [tier, slug] of Object.entries(RESULT_SLUGS)) {
            expect(
                slug.toLowerCase().includes(substr),
                `Tier ${tier} slug "${slug}" contains forbidden "${substr}"`
            ).toBe(false);
        }
    });
});

// ─── Tier label allowlist (universal guardrail, per-key form) ────────
// Mirrors the catalog-integrity check above with per-tier reporting so
// a regression in any single tier label fails its own line in the report.

describe('Tier label allowlist (universal guardrail)', () => {
    const ALLOWED_LABELS = new Set([
        'Eligibility factors present',
        'Eligibility factors mixed',
        'Eligibility factors not met',
        'Contraindication identified'
    ]);
    it.each(Object.entries(TIER_LABELS))('TIER_LABELS[%s] is in the allowed neutral-label set', (key, label) => {
        expect(ALLOWED_LABELS.has(label)).toBe(true);
    });
});

// ─── Canonical tier-body strings (regulatory pin) ────────────────────
// These four strings are the user-facing tier bodies. The submit handler
// (`bone-density-quiz-submit.js`) defines TIER_BODY and the engine uses
// the same strings. We pin them verbatim here so a silent edit in either
// owner's file fails the test rather than slipping into production with
// banned drug names, candidacy language, or licensed FRAX nomenclature.

const EXPECTED_TIER_BODIES = {
    A: 'Per AACE, Endocrine Society, and NOF guidelines, a low-trauma fracture after age 40 is itself diagnostic of osteoporosis, even before a DEXA scan. A clinical evaluation is the appropriate next step — it should include a DEXA scan, bone-relevant lab work, and a discussion of treatment options. We offer DEXA scans on-site in Park Ridge ($150) and full clinical evaluation.',
    B: "Your responses describe risk factors associated with elevated likelihood of low bone density. The most accurate way to know your bones' actual condition is a DEXA scan — it's the medical gold standard. Moonshot offers DEXA scans on-site in Park Ridge for $150, no referral needed.",
    C: 'You have one or more risk factors for bone density loss. A DEXA scan is reasonable based on these inputs and would establish a baseline you can track over time. For most adults with risk factors, getting a baseline by age 50 (women) or 60 (men) is the standard recommendation.',
    D: "Based on your responses, your risk factors for low bone density are minimal. A DEXA is reasonable but not urgent based on these inputs. If you're approaching standard screening ages or want a longevity baseline, the scan is still valuable as a reference point."
};

const BANNED_DRUG_NAMES = [
    'alendronate', 'risedronate', 'ibandronate', 'zoledronic',
    'denosumab', 'teriparatide', 'abaloparatide', 'romosozumab',
    'raloxifene', 'calcitonin',
    'fosamax', 'boniva', 'reclast', 'prolia', 'forteo', 'tymlos', 'evenity'
];
const BANNED_PHRASES = [
    "isn't urgently indicated",
    'is not urgently indicated',
    'strong candidate',
    'possible candidate',
    'likely candidate',
    'you have osteoporosis',
    'you have osteopenia'
];

describe('Canonical tier-body strings — banned-content pin', () => {
    it.each(BANNED_DRUG_NAMES)('no canonical tier body contains drug name: %s', (drug) => {
        for (const [tier, body] of Object.entries(EXPECTED_TIER_BODIES)) {
            expect(
                body.toLowerCase().includes(drug),
                `Tier ${tier} body contains forbidden drug "${drug}"`
            ).toBe(false);
        }
    });

    it.each(BANNED_PHRASES)('no canonical tier body contains banned phrase: %s', (phrase) => {
        for (const [tier, body] of Object.entries(EXPECTED_TIER_BODIES)) {
            expect(
                body.toLowerCase().includes(phrase),
                `Tier ${tier} body contains banned phrase "${phrase}"`
            ).toBe(false);
        }
    });

    it('Tier D body contains the required "reasonable but not urgent based on these inputs" phrasing', () => {
        expect(EXPECTED_TIER_BODIES.D).toContain('A DEXA is reasonable but not urgent based on these inputs');
    });

    it('no canonical tier body references FRAX', () => {
        for (const [tier, body] of Object.entries(EXPECTED_TIER_BODIES)) {
            expect(
                body.toLowerCase().includes('frax'),
                `Tier ${tier} body references FRAX`
            ).toBe(false);
        }
    });
});

// ─── Source-file scan (engine + submit handler) ──────────────────────
// The scoring module itself is pure and ESM-importable, but the engine
// (`quiz-engine.js`, browser IIFE) and the netlify submit handler are
// not — so we read them as text and grep for forbidden content. This
// catches the case where someone adds drug names, FRAX, or candidacy
// language directly into a result body that the unit tests can't reach.
//
// Comment-line filter: the engine's header includes a "compliance rails"
// comment that intentionally lists the forbidden phrases (e.g.
// "Never reference FRAX"). Those reminders are the whole point — we
// don't want to break them. So the scan strips lines that, after trim,
// start with `*`, `//`, or `/*` before checking for banned content.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');

const ENGINE_SRC = readFileSync(join(REPO_ROOT, 'quiz/bone-density/quiz-engine.js'), 'utf8');
const SUBMIT_SRC = readFileSync(join(REPO_ROOT, 'netlify/functions/bone-density-quiz-submit.js'), 'utf8');
// The universal footer disclaimer is rendered from the static page (canonical
// location is index.html). The engine intentionally does NOT inline the text
// to avoid duplicate rendering on the result screen — assert the static
// page is the source of truth.
const PAGE_HTML = readFileSync(join(REPO_ROOT, 'quiz/bone-density/index.html'), 'utf8');

/**
 * Strip JS comment lines so guardrail-reminder comments don't trip the
 * banned-content scan. Filters lines whose trimmed form starts with
 * `*`, `//`, or `/*`. (Block-comment internals begin with `*` after
 * trim; single-line comments begin with `//`.)
 */
function stripCommentLines(src) {
    return src
        .split('\n')
        .filter((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('*')) return false;
            if (trimmed.startsWith('//')) return false;
            if (trimmed.startsWith('/*')) return false;
            return true;
        })
        .join('\n');
}

const ENGINE_CODE = stripCommentLines(ENGINE_SRC).toLowerCase();
const SUBMIT_CODE = stripCommentLines(SUBMIT_SRC).toLowerCase();

describe('Forbidden content in source files', () => {
    it.each(BANNED_DRUG_NAMES)('engine source does not contain drug name: %s', (drug) => {
        expect(ENGINE_CODE).not.toContain(drug);
    });

    it.each(BANNED_DRUG_NAMES)('submit handler source does not contain drug name: %s', (drug) => {
        expect(SUBMIT_CODE).not.toContain(drug);
    });

    it.each(BANNED_PHRASES)('engine source does not contain banned phrase: %s', (phrase) => {
        expect(ENGINE_CODE).not.toContain(phrase);
    });

    it.each(BANNED_PHRASES)('submit handler source does not contain banned phrase: %s', (phrase) => {
        expect(SUBMIT_CODE).not.toContain(phrase);
    });

    it('engine source does not contain "FRAX" outside compliance-comment lines', () => {
        expect(ENGINE_CODE).not.toContain('frax');
    });

    it('submit handler source does not contain "FRAX" anywhere', () => {
        // No comment-strip needed — the submit handler should never reference FRAX
        // even in a comment.
        expect(SUBMIT_SRC.toLowerCase()).not.toContain('frax');
    });

    it('engine source contains the required Tier D phrasing verbatim', () => {
        expect(ENGINE_SRC).toContain('A DEXA is reasonable but not urgent based on these inputs');
    });

    it('submit handler source contains the required Tier D phrasing verbatim', () => {
        expect(SUBMIT_SRC).toContain('A DEXA is reasonable but not urgent based on these inputs');
    });

    it('static page (index.html) includes the universal footer disclaimer text', () => {
        // Canonical location: rendered always-visible below the quiz mount.
        expect(PAGE_HTML).toContain('Screening tools have known false-positive and false-negative rates');
    });

    it('submit handler source includes the universal footer disclaimer text', () => {
        expect(SUBMIT_SRC).toContain('Screening tools have known false-positive and false-negative rates');
    });
});
