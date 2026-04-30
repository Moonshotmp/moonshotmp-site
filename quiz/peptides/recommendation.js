/*
 * Moonshot Peptide Recommendation Engine — Pure Logic Module
 * ==========================================================
 *
 * This is the canonical, tested implementation of the peptide quiz
 * recommendation engine. It is a pure module: input → output, no DOM,
 * no side effects, no globals.
 *
 * The browser-side quiz at /quiz/peptides/quiz-engine.js maintains its
 * own private copy of this logic inside an IIFE for runtime simplicity
 * (no build step, single script tag). That copy MUST be kept in sync
 * with this file. The Vitest suite at tests/peptide-recommendation.test.js
 * pins the expected behavior — if this file or quiz-engine.js drifts,
 * tests break.
 *
 * Why a parallel copy instead of an import?
 *   The peptide quiz at /quiz/peptides/ is a non-module script tag
 *   (no build step, no bundler). Switching it to an ES module would
 *   require either a build step or a second <script> tag, both of which
 *   add risk to a 10.3% CTR conversion surface. The pure module here
 *   exists so future quizzes (menopause, andropause, sleep apnea,
 *   bone density) can consume it directly via ESM imports — and so
 *   the existing peptide engine logic is testable in CI without
 *   touching the live runtime.
 *
 * Inputs:  state object with keys { goal, concern, severity, duration,
 *          experience, therapy, convenience, budget }
 * Output:  { primaryKey, primary, secondaryKey, secondary }
 *          where primary / secondary are entries from PEPTIDES
 *          (or null for secondary if no good match).
 */

export const PEPTIDES = {
    bpc157: {
        name: 'BPC-157',
        fullName: 'Body Protection Compound-157',
        category: 'Healing & Recovery',
        price: 250,
        tagline: 'The body\'s natural healing signal, amplified.'
    },
    tb500: {
        name: 'TB-500',
        fullName: 'Thymosin Beta-4',
        category: 'Recovery & Repair',
        price: 250,
        tagline: 'Mobilize your body\'s repair system.'
    },
    wolverine: {
        name: 'Wolverine Blend',
        fullName: 'BPC-157 + TB-500 Combination',
        category: 'Premium Recovery',
        price: 375,
        tagline: 'Two healing pathways. One injection.'
    },
    'ghk-cu': {
        name: 'GHK-Cu',
        fullName: 'Copper Peptide Therapy',
        category: 'Skin & Anti-Aging',
        price: 175,
        tagline: 'Turn back the clock at the cellular level.'
    },
    'glow-stack': {
        name: 'Glow Stack',
        fullName: 'GHK-Cu + BPC-157 + TB-500',
        category: 'Premium Beauty + Healing',
        price: 400,
        tagline: 'Skin repair, tissue healing, and recovery in one.'
    },
    sermorelin: {
        name: 'Sermorelin',
        fullName: 'Growth Hormone Releasing Peptide',
        category: 'Optimization',
        price: 250,
        tagline: 'Optimize your growth hormone naturally.'
    },
    pt141: {
        name: 'PT-141',
        fullName: 'Bremelanotide',
        category: 'Sexual Health',
        price: 250,
        tagline: 'Desire starts in the brain, not the bloodstream.'
    },
    'nad': {
        name: 'NAD+',
        fullName: 'Nicotinamide Adenine Dinucleotide',
        category: 'Cellular Energy & Recovery',
        price: 60,
        tagline: 'Restore the fuel your cells run on.'
    }
};

export const secondaryMap = {
    bpc157: { injury: 'tb500', gut: 'sermorelin', athletic: 'nad' },
    tb500: { injury: 'bpc157', athletic: 'nad' },
    wolverine: { injury: 'sermorelin', athletic: 'nad' },
    'ghk-cu': { skin: 'nad', general: 'nad' },
    'glow-stack': { skin: 'sermorelin' },
    sermorelin: { general: 'nad' },
    pt141: { sexual: 'sermorelin' },
    'nad': { general: 'sermorelin', athletic: 'bpc157', skin: 'ghk-cu' }
};

/**
 * Convert budget option key to a numeric anchor used by the engine.
 * Mapping (must match quiz-engine.js):
 *   'under-200'  → 150
 *   '200-300'    → 200
 *   '300-400'    → 300
 *   '400+'       → 300
 * Anything else → 150 (defensive default)
 */
export function budgetValue(budgetKey) {
    if (budgetKey === '300-400' || budgetKey === '400+') return 300;
    if (budgetKey === '200-300') return 200;
    return 150;
}

/**
 * Pure recommendation function. Takes the same state shape that
 * quiz-engine.js maintains internally and returns a primary +
 * (optional) secondary peptide recommendation.
 *
 * @param {object} state
 * @param {string} state.goal       e.g. 'injury' | 'gut' | 'skin' | 'athletic' | 'sexual' | 'general'
 * @param {string} [state.concern]  goal-specific concern key
 * @param {string} [state.convenience] 'very' | 'somewhat' | 'not-important'
 * @param {string} [state.budget]   budget option key (see budgetValue above)
 * @returns {{ primaryKey: string, primary: object, secondaryKey: (string|null), secondary: (object|null) }}
 */
export function getRecommendation(state) {
    const goal = state.goal;
    const concern = state.concern;
    const convenience = state.convenience;
    const budget = budgetValue(state.budget);
    let primaryKey = null;
    let secondaryKey = null;

    // INJURY RECOVERY
    if (goal === 'injury') {
        if (budget >= 300 || convenience === 'very') {
            primaryKey = 'wolverine';
        } else if (concern === 'muscle' || concern === 'post-surgical') {
            primaryKey = 'tb500';
        } else {
            primaryKey = 'bpc157';
        }
    }

    // GUT HEALING
    if (goal === 'gut') {
        primaryKey = 'bpc157';
    }

    // SKIN & ANTI-AGING
    if (goal === 'skin') {
        if (budget >= 300 || concern === 'wound-healing') {
            primaryKey = 'glow-stack';
        } else {
            primaryKey = 'ghk-cu';
        }
    }

    // ATHLETIC PERFORMANCE
    if (goal === 'athletic') {
        if (budget >= 300 || convenience === 'very') {
            primaryKey = 'wolverine';
        } else if (concern === 'injuries') {
            primaryKey = 'bpc157';
        } else {
            primaryKey = 'tb500';
        }
    }

    // SEXUAL HEALTH
    if (goal === 'sexual') {
        primaryKey = 'pt141';
    }

    // GENERAL OPTIMIZATION
    if (goal === 'general') {
        if (concern === 'energy') {
            primaryKey = 'nad';
        } else if (concern === 'sleep' || concern === 'body-comp') {
            primaryKey = 'sermorelin';
        } else if (concern === 'aging') {
            primaryKey = 'ghk-cu';
        } else {
            primaryKey = 'sermorelin';
        }
    }

    // Fallback
    if (!primaryKey) primaryKey = 'bpc157';

    // Secondary recommendation
    const secondaries = secondaryMap[primaryKey];
    if (secondaries) {
        secondaryKey = secondaries[goal] || null;
    }
    // Budget guard: if secondary is a premium blend and budget is low, downgrade
    if (secondaryKey && PEPTIDES[secondaryKey] && PEPTIDES[secondaryKey].price > budget) {
        if (secondaryKey === 'wolverine' || secondaryKey === 'glow-stack') {
            secondaryKey = 'bpc157';
        }
    }
    // Don't recommend same peptide twice
    if (secondaryKey === primaryKey) secondaryKey = null;

    return {
        primaryKey: primaryKey,
        primary: PEPTIDES[primaryKey],
        secondaryKey: secondaryKey,
        secondary: secondaryKey ? PEPTIDES[secondaryKey] : null
    };
}
