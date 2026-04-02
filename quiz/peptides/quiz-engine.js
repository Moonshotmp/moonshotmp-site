/*
 * Moonshot Peptide Quiz Engine v2
 * ================================
 * 13-screen flow with recommendation engine, calculating animation, and personalized results.
 * Vanilla JS IIFE — no dependencies.
 */
(function() {
    'use strict';

    // ── Screen Constants ───────────────────────────────────────────────
    var SCREEN = {
        WELCOME: 0,
        PRIMARY_GOAL: 1,
        SPECIFIC_CONCERN: 2,
        SEVERITY: 3,
        DURATION: 4,
        PEPTIDE_EXPERIENCE: 5,
        CURRENT_THERAPY: 6,
        CONVENIENCE: 7,
        BUDGET: 8,
        SOCIAL_PROOF: 9,
        INFO_CAPTURE: 10,
        CALCULATING: 11,
        RESULTS: 12
    };

    var TOTAL_SCREENS = 13;
    var PROGRESS_MAX = 12; // welcome through info capture for progress calculation

    // ── Option Data ──────────────────────────────────────────────────

    var goalOptions = [
        { label: '\ud83d\udd27 Injury & Pain Recovery', sublabel: 'Tendon, ligament, joint, muscle', key: 'injury' },
        { label: '\ud83e\udec1 Gut Healing', sublabel: 'IBS, leaky gut, inflammation', key: 'gut' },
        { label: '\u2728 Skin & Anti-Aging', sublabel: 'Collagen, elasticity, hair', key: 'skin' },
        { label: '\ud83d\udcaa Athletic Performance & Recovery', sublabel: '', key: 'athletic' },
        { label: '\u2764\ufe0f Sexual Health', sublabel: 'Libido, arousal', key: 'sexual' },
        { label: '\ud83e\uddec General Optimization', sublabel: 'Sleep, vitality, longevity', key: 'general' }
    ];

    var concernOptions = {
        injury: {
            question: 'What best describes your situation?',
            options: [
                { label: 'Chronic tendon or ligament issue (tennis elbow, plantar fasciitis, rotator cuff)', key: 'tendon' },
                { label: 'Muscle strain or tear recovery', key: 'muscle' },
                { label: 'Joint pain or cartilage issues', key: 'joint' },
                { label: 'Post-surgical healing', key: 'post-surgical' }
            ]
        },
        gut: {
            question: 'What gut issues are you dealing with?',
            options: [
                { label: 'IBS or chronic digestive issues', key: 'ibs' },
                { label: 'Suspected leaky gut or food sensitivities', key: 'leaky-gut' },
                { label: 'NSAID-related stomach damage', key: 'nsaid' },
                { label: 'General gut inflammation', key: 'gut-inflammation' }
            ]
        },
        skin: {
            question: 'What\'s your top skin/aesthetic concern?',
            options: [
                { label: 'Fine lines, wrinkles, or loss of elasticity', key: 'wrinkles' },
                { label: 'Hair thinning or early hair loss', key: 'hair-loss' },
                { label: 'Slow wound healing or scarring', key: 'wound-healing' },
                { label: 'Overall skin quality and aging', key: 'skin-quality' }
            ]
        },
        athletic: {
            question: 'What\'s holding you back?',
            options: [
                { label: 'Slow recovery between sessions', key: 'slow-recovery' },
                { label: 'Nagging injuries that won\'t resolve', key: 'injuries' },
                { label: 'Inflammation and joint wear', key: 'inflammation' },
                { label: 'Overall performance plateau', key: 'plateau' }
            ]
        },
        sexual: {
            question: 'What best describes your concern?',
            options: [
                { label: 'Low libido or reduced desire', key: 'low-libido' },
                { label: 'Arousal or response issues', key: 'arousal' },
                { label: 'Want to improve sexual wellness overall', key: 'overall-sexual' }
            ]
        },
        general: {
            question: 'What would make the biggest difference?',
            options: [
                { label: 'Better sleep quality', key: 'sleep' },
                { label: 'More energy and vitality', key: 'energy' },
                { label: 'Body composition (lean mass, fat loss)', key: 'body-comp' },
                { label: 'Slow down aging', key: 'aging' }
            ]
        }
    };

    var severityOptions = [
        { label: 'Mild \u2014 Noticeable but manageable', key: 'mild' },
        { label: 'Moderate \u2014 Affecting quality of life', key: 'moderate' },
        { label: 'Significant \u2014 Major daily impact', key: 'significant' },
        { label: 'Severe \u2014 Limiting what I can do', key: 'severe' }
    ];

    var durationOptions = [
        { label: 'A few weeks', key: 'weeks' },
        { label: 'Several months', key: 'months' },
        { label: '1\u20132 years', key: '1-2years' },
        { label: '3+ years', key: '3+years' }
    ];

    var experienceOptions = [
        { label: 'Never \u2014 this is all new to me', key: 'never' },
        { label: 'I\'ve researched but never tried', key: 'researched' },
        { label: 'I\'ve used peptides from an online source', key: 'online' },
        { label: 'I\'ve used peptides through a medical provider', key: 'medical' }
    ];

    var therapyOptions = [
        { label: 'Yes, I\'m a Moonshot patient', key: 'moonshot' },
        { label: 'Yes, at another provider', key: 'other-provider' },
        { label: 'No, but I\'m interested', key: 'interested' },
        { label: 'No, just interested in peptides', key: 'peptides-only' }
    ];

    var convenienceOptions = [
        { label: 'Very \u2014 I want the fewest injections possible', key: 'very' },
        { label: 'Somewhat \u2014 I\'m flexible', key: 'somewhat' },
        { label: 'Not important \u2014 I\'ll do what works best', key: 'not-important' }
    ];

    var budgetOptions = [
        { label: 'Under $200/month', key: 'under-200' },
        { label: '$200\u2013300/month', key: '200-300' },
        { label: '$300\u2013400/month', key: '300-400' },
        { label: '$400+/month', key: '400+' }
    ];

    var calculatingSteps = [
        'Analyzing your goals...',
        'Matching peptide mechanisms...',
        'Evaluating recovery protocols...',
        'Checking clinical evidence...',
        'Optimizing dosing recommendations...',
        'Building your protocol...'
    ];

    // ── Peptide Data ─────────────────────────────────────────────────

    var PEPTIDES = {
        bpc157: {
            name: 'BPC-157',
            fullName: 'Body Protection Compound-157',
            category: 'Healing & Recovery',
            price: 250,
            tagline: 'The body\'s natural healing signal, amplified.',
            description: 'BPC-157 promotes healing of tendons, ligaments, gut lining, and muscle tissue by upregulating growth factors and promoting new blood vessel formation at injury sites.',
            timeline: 'Many patients notice improvement within 1\u20132 weeks. Full benefits typically develop over 4\u201312 weeks.',
            dosing: '250\u2013500mcg daily, subcutaneous injection',
            cycle: '4\u201312 weeks depending on condition',
            frequency: 'Daily injection',
            learnUrl: '/learn/bpc-157/',
            matchText: {
                injury: 'BPC-157 is the most studied peptide for tendon, ligament, and joint healing \u2014 with over 100 published studies showing accelerated repair.',
                gut: 'BPC-157 was originally derived from a protective protein in gastric juice. It\'s the most researched peptide for gut healing \u2014 protecting and repairing the GI lining.',
                athletic: 'BPC-157 targets the specific tissue types that athletes damage most \u2014 tendons, ligaments, and muscle. It creates new blood vessels at injury sites to accelerate repair.'
            }
        },
        tb500: {
            name: 'TB-500',
            fullName: 'Thymosin Beta-4',
            category: 'Recovery & Repair',
            price: 250,
            tagline: 'Mobilize your body\'s repair system.',
            description: 'TB-500 accelerates tissue repair by upregulating actin \u2014 a protein critical for cell migration to injury sites. Reduces inflammation and supports muscle, tendon, and ligament healing.',
            timeline: 'Initial improvement in 2\u20134 weeks during loading phase. Full benefits over 6\u201312 weeks.',
            dosing: 'Loading: 2.5mg twice/week for 4\u20136 weeks. Maintenance: 2.5mg once/week.',
            cycle: '6\u201312 weeks',
            frequency: '1\u20132 injections per week',
            learnUrl: '/learn/tb-500/',
            matchText: {
                injury: 'TB-500 excels at muscle and tissue repair \u2014 it mobilizes your body\'s repair cells to the injury site while reducing inflammation.',
                athletic: 'TB-500 is popular among athletes for its ability to accelerate recovery between sessions and resolve nagging injuries that won\'t heal on their own.'
            }
        },
        wolverine: {
            name: 'Wolverine Blend',
            fullName: 'BPC-157 + TB-500 Combination',
            category: 'Premium Recovery',
            price: 375,
            tagline: 'Two healing pathways. One injection.',
            description: 'Combines BPC-157 and TB-500 in a single vial for dual-pathway healing. BPC-157 builds the blood supply and growth factors while TB-500 mobilizes repair cells to the site.',
            timeline: 'Many patients notice improvement within 1\u20133 weeks. Full benefits over 6\u201312 weeks.',
            dosing: '0.3\u20130.5ml subcutaneous injection daily or every other day',
            cycle: '4\u201312 weeks',
            frequency: 'Daily or every other day',
            learnUrl: '/learn/wolverine-blend/',
            matchText: {
                injury: 'The Wolverine Blend attacks healing from two directions \u2014 BPC-157 builds new blood supply while TB-500 moves repair cells to the site. It\'s our most comprehensive recovery protocol.',
                athletic: 'Named for its regenerative properties, the Wolverine Blend is our top recommendation for athletes who want maximum recovery in one simple daily injection.'
            }
        },
        'ghk-cu': {
            name: 'GHK-Cu',
            fullName: 'Copper Peptide Therapy',
            category: 'Skin & Anti-Aging',
            price: 175,
            tagline: 'Turn back the clock at the cellular level.',
            description: 'GHK-Cu stimulates collagen synthesis, promotes skin elasticity, supports hair growth, and reduces oxidative damage. Levels decline significantly with age.',
            timeline: 'Skin improvements noticeable in 4\u20138 weeks. Full anti-aging effects over 3\u20136 months.',
            dosing: '200\u2013600mcg daily, subcutaneous injection',
            cycle: '3\u20136 months for visible results',
            frequency: 'Daily injection',
            learnUrl: '/learn/ghk-cu/',
            matchText: {
                skin: 'GHK-Cu is one of the most researched peptides in dermatology \u2014 multiple human studies confirm its effects on skin thickness, elasticity, and collagen density.',
                general: 'GHK-Cu addresses aging at the cellular level \u2014 restoring the collagen and tissue repair capacity that declines naturally after 30.'
            }
        },
        'glow-stack': {
            name: 'Glow Stack',
            fullName: 'GHK-Cu + BPC-157 + TB-500',
            category: 'Premium Beauty + Healing',
            price: 400,
            tagline: 'Skin repair, tissue healing, and recovery in one.',
            description: 'Our most comprehensive peptide protocol combines GHK-Cu for skin and collagen, BPC-157 for tissue healing, and TB-500 for recovery \u2014 all in a single injection.',
            timeline: 'Healing effects in 1\u20133 weeks, skin improvements in 4\u20138 weeks, full results in 3\u20136 months.',
            dosing: '0.3ml subcutaneous injection daily or every other day',
            cycle: '3\u20136 months',
            frequency: 'Daily or every other day',
            learnUrl: '/medical/peptides/',
            matchText: {
                skin: 'The Glow Stack targets skin from multiple angles \u2014 GHK-Cu rebuilds collagen, BPC-157 heals damaged tissue, and TB-500 accelerates cellular repair. Our most comprehensive anti-aging protocol.'
            }
        },
        sermorelin: {
            name: 'Sermorelin',
            fullName: 'Growth Hormone Releasing Peptide',
            category: 'Optimization',
            price: 250,
            tagline: 'Optimize your growth hormone naturally.',
            description: 'Stimulates your body\'s natural growth hormone production. Supports sleep quality, body composition, recovery, and overall vitality.',
            timeline: 'Improved sleep often noticed within 1\u20132 weeks. Body composition changes over 3\u20136 months.',
            dosing: 'Daily subcutaneous injection, typically before bed',
            cycle: 'Ongoing \u2014 benefits continue with consistent use',
            frequency: 'Daily injection (before bed)',
            learnUrl: '/learn/peptides/',
            matchText: {
                general: 'Sermorelin works with your body\'s natural rhythm \u2014 stimulating growth hormone release during deep sleep. It\'s our go-to for patients who want better sleep, recovery, and body composition without synthetic hormones.'
            }
        },
        pt141: {
            name: 'PT-141',
            fullName: 'Bremelanotide',
            category: 'Sexual Health',
            price: 250,
            tagline: 'Desire starts in the brain, not the bloodstream.',
            description: 'PT-141 works on the central nervous system to increase sexual desire and arousal \u2014 a fundamentally different mechanism than Viagra or Cialis. The active compound (bremelanotide) is the same molecule in the FDA-approved medication Vyleesi. The compounded version is not an FDA-approved product. Works for both men and women.',
            timeline: 'Effects typically noticed within 1\u20132 hours of administration.',
            dosing: 'As-needed subcutaneous injection, 1\u20132 hours before desired effect',
            cycle: 'As needed \u2014 not a daily protocol',
            frequency: 'As needed (not daily)',
            learnUrl: '/learn/peptides/',
            matchText: {
                sexual: 'PT-141 works through the brain\'s melanocortin system \u2014 increasing actual desire, not just blood flow. The active compound (bremelanotide) is the same molecule in the FDA-approved medication Vyleesi. The compounded version is not an FDA-approved product. It\'s the only peptide that addresses the neurological root of low libido.'
            }
        },
        'nad': {
            name: 'NAD+',
            fullName: 'Nicotinamide Adenine Dinucleotide',
            category: 'Cellular Energy & Recovery',
            price: 60,
            tagline: 'Restore the fuel your cells run on.',
            description: 'NAD+ is a coenzyme in every living cell, essential for energy production, DNA repair, and anti-aging pathways. Levels decline 50%+ by age 60. Subcutaneous injections bypass gut absorption for near-complete bioavailability at a fraction of IV drip costs.',
            timeline: 'Energy improvements in 1\u20132 weeks. Recovery and cognitive benefits over 3\u20134 weeks. Cumulative results over 2\u20133 months.',
            dosing: '100\u2013250mg subcutaneous injection',
            cycle: 'Loading: 2x/week for 2\u20134 weeks. Maintenance: weekly to monthly.',
            frequency: '1\u20132x per week (loading), then weekly/biweekly/monthly',
            learnUrl: '/medical/nad/',
            matchText: {
                general: 'NAD+ restores the cellular energy production that declines with age. It activates sirtuins \u2014 your body\'s master regulators of aging, metabolism, and repair. At $60/shot, it\'s the highest-value entry point for optimization.',
                athletic: 'NAD+ fuels mitochondrial energy production and recovery pathways. Athletes deplete NAD+ faster through intense training \u2014 replenishing it supports faster recovery, reduced inflammation, and sustained performance.',
                skin: 'NAD+ activates sirtuins that regulate collagen production and DNA repair at the cellular level. It addresses aging from the inside out, complementing topical peptides like GHK-Cu.'
            }
        }
    };

    // ── Secondary Recommendation Map ─────────────────────────────────

    var secondaryMap = {
        bpc157: { injury: 'tb500', gut: 'sermorelin', athletic: 'nad' },
        tb500: { injury: 'bpc157', athletic: 'nad' },
        wolverine: { injury: 'sermorelin', athletic: 'nad' },
        'ghk-cu': { skin: 'nad', general: 'nad' },
        'glow-stack': { skin: 'sermorelin' },
        sermorelin: { general: 'nad' },
        pt141: { sexual: 'sermorelin' },
        'nad': { general: 'sermorelin', athletic: 'bpc157', skin: 'ghk-cu' }
    };

    // ── State ────────────────────────────────────────────────────────

    var state = {
        currentScreen: 0,
        goal: null,
        concern: null,
        severity: null,
        duration: null,
        experience: null,
        therapy: null,
        convenience: null,
        budget: null,
        name: '',
        email: '',
        phone: ''
    };

    var root = document.getElementById('quiz-root');
    var progressBar = document.getElementById('quiz-progress-bar');

    // ── State Persistence ────────────────────────────────────────────

    var STORAGE_KEY = 'mmp_peptide_quiz_state';
    var STORAGE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                currentScreen: state.currentScreen,
                goal: state.goal,
                concern: state.concern,
                severity: state.severity,
                duration: state.duration,
                experience: state.experience,
                therapy: state.therapy,
                convenience: state.convenience,
                budget: state.budget,
                name: state.name,
                email: state.email,
                phone: state.phone,
                savedAt: Date.now()
            }));
        } catch(e) {}
    }

    function clearSavedState() {
        try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
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
        } catch(e) { return null; }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    function ga(event, params) {
        if (window.gtag) window.gtag('event', event, params || {});
    }

    function updateProgress() {
        var pct = Math.min(100, Math.round((state.currentScreen / PROGRESS_MAX) * 100));
        progressBar.style.width = pct + '%';
    }

    function show(screenIndex) {
        state.currentScreen = screenIndex;
        updateProgress();
        saveState();
        var screens = root.querySelectorAll('.quiz-screen');
        for (var i = 0; i < screens.length; i++) {
            screens[i].classList.remove('active');
        }
        setTimeout(function() {
            var target = root.querySelector('[data-screen="' + screenIndex + '"]');
            if (target) {
                target.classList.add('active');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 30);
        // Cancel social proof timer if navigating away
        if (screenIndex !== SCREEN.SOCIAL_PROOF && socialProofTimer) {
            clearTimeout(socialProofTimer);
            socialProofTimer = null;
        }
        // Auto-advance social proof after 3 seconds
        if (screenIndex === SCREEN.SOCIAL_PROOF) {
            startSocialProofTimer();
        }
    }

    function screenWrap(index, inner) {
        var backBtn = '';
        if (index >= SCREEN.PRIMARY_GOAL && index <= SCREEN.INFO_CAPTURE) {
            backBtn = '<button type="button" class="quiz-back-btn text-brand-gray/60 hover:text-brand-light text-sm flex items-center gap-1 mb-6 transition-colors" data-back="true">' +
                '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>' +
                'Back</button>';
        }
        return '<div class="quiz-screen flex items-center justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + index + '">' +
            '<div class="max-w-2xl w-full">' + backBtn + inner + '</div></div>';
    }

    function budgetValue(budgetKey) {
        if (budgetKey === '300-400' || budgetKey === '400+') return 300;
        if (budgetKey === '200-300') return 200;
        return 150;
    }

    // ── Social Proof Timer ───────────────────────────────────────────

    var socialProofTimer = null;

    function startSocialProofTimer() {
        if (socialProofTimer) clearTimeout(socialProofTimer);
        socialProofTimer = setTimeout(function() {
            if (state.currentScreen === SCREEN.SOCIAL_PROOF) {
                show(SCREEN.INFO_CAPTURE);
            }
        }, 3000);
    }

    // ── Recommendation Engine ────────────────────────────────────────

    function getRecommendation() {
        var goal = state.goal;
        var concern = state.concern;
        var convenience = state.convenience;
        var budget = budgetValue(state.budget);
        var primaryKey = null;
        var secondaryKey = null;

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
        var secondaries = secondaryMap[primaryKey];
        if (secondaries) {
            secondaryKey = secondaries[goal] || null;
        }
        // Budget guard: if secondary is a premium blend and budget is low, downgrade
        if (secondaryKey && PEPTIDES[secondaryKey] && PEPTIDES[secondaryKey].price > budget) {
            // find a cheaper alternative
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

    // ── Screen Builders ──────────────────────────────────────────────

    function buildWelcome() {
        return screenWrap(SCREEN.WELCOME,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-6">Personalized in Under 2 Minutes</p>' +
                '<h1 class="text-4xl md:text-5xl font-bold text-brand-light mb-6 font-heading">Which Peptide Will Work for You?</h1>' +
                '<p class="text-brand-gray text-lg font-light mb-10 max-w-lg mx-auto">Tell us what you\'re dealing with. We\'ll show you the exact peptide, dosing protocol, timeline, and cost \u2014 matched to your goals.</p>' +
                '<button type="button" id="quiz-start-btn" class="btn-primary text-lg px-10 py-4">Start My Assessment</button>' +
                '<p class="text-brand-gray/50 text-xs mt-4">No account needed. Results are instant.</p>' +
                '<p class="text-brand-gray/60 text-xs mt-6">Created by the medical team at Moonshot Medical \u2014 a licensed clinic in Park Ridge, IL</p>' +
                '<p class="text-brand-gray/40 text-xs mt-2">For educational purposes only. Not medical advice.</p>' +
            '</div>'
        );
    }

    function buildPrimaryGoal() {
        var btns = '';
        for (var i = 0; i < goalOptions.length; i++) {
            var sub = goalOptions[i].sublabel ? '<span class="block text-brand-gray/70 text-xs font-light mt-1">' + goalOptions[i].sublabel + '</span>' : '';
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-goal="' + goalOptions[i].key + '">' +
                goalOptions[i].label + sub + '</button>';
        }
        return screenWrap(SCREEN.PRIMARY_GOAL,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">What\'s your primary goal?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Select the area that matters most to you right now.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildSpecificConcern() {
        // Dynamic content — populated after goal is selected
        return screenWrap(SCREEN.SPECIFIC_CONCERN,
            '<div class="text-center">' +
                '<h2 id="concern-question" class="text-3xl font-bold text-brand-light mb-2 font-heading"></h2>' +
                '<p class="text-brand-gray font-light mb-10">This helps us narrow down the best peptide for you.</p>' +
                '<div id="concern-options" class="flex flex-col gap-3 max-w-md mx-auto"></div>' +
            '</div>'
        );
    }

    function buildSeverity() {
        var btns = '';
        for (var i = 0; i < severityOptions.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-severity="' + severityOptions[i].key + '">' + severityOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.SEVERITY,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">How much is this affecting your daily life?</h2>' +
                '<p class="text-brand-gray font-light mb-10">No wrong answers \u2014 just helps us understand your situation.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildDuration() {
        var btns = '';
        for (var i = 0; i < durationOptions.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-duration="' + durationOptions[i].key + '">' + durationOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.DURATION,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">How long have you been dealing with this?</h2>' +
                '<p class="text-brand-gray font-light mb-10">This helps us calibrate expectations for your protocol.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildPeptideExperience() {
        var btns = '';
        for (var i = 0; i < experienceOptions.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-experience="' + experienceOptions[i].key + '">' + experienceOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.PEPTIDE_EXPERIENCE,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">Have you used peptides before?</h2>' +
                '<p class="text-brand-gray font-light mb-10">This helps us tailor the level of detail in your results.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildCurrentTherapy() {
        var btns = '';
        for (var i = 0; i < therapyOptions.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-therapy="' + therapyOptions[i].key + '">' + therapyOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.CURRENT_THERAPY,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">Are you currently on any hormone or optimization therapy?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Peptides often complement other protocols.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildConvenience() {
        var btns = '';
        for (var i = 0; i < convenienceOptions.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-convenience="' + convenienceOptions[i].key + '">' + convenienceOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.CONVENIENCE,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">How important is keeping your protocol simple?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Some protocols combine multiple peptides into one injection.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildBudget() {
        var btns = '';
        for (var i = 0; i < budgetOptions.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-budget="' + budgetOptions[i].key + '">' + budgetOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.BUDGET,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">What monthly investment feels right for you?</h2>' +
                '<p class="text-brand-gray font-light mb-10">All prices include pharmaceutical-grade compounds and medical oversight.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildSocialProof() {
        return screenWrap(SCREEN.SOCIAL_PROOF,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-8 font-heading">You\'re in good company.</h2>' +
                '<p class="text-5xl font-bold text-brand-light mb-4">300+</p>' +
                '<p class="text-brand-gray text-lg font-light mb-8">patients have started peptide therapy at Moonshot Medical</p>' +
                '<p class="text-brand-gray/60 text-sm font-light">Medically supervised. Pharmaceutical-grade. Park Ridge, IL.</p>' +
            '</div>'
        );
    }

    function buildInfoCapture() {
        var rec = getRecommendation();
        var primary = rec.primary;

        var previewCard = '<div class="max-w-sm mx-auto mb-8">' +
            '<div class="border border-brand-gray/40 rounded-sm p-6" style="background: rgba(178, 191, 190, 0.05)">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-1">Your Match</p>' +
                '<h3 class="text-2xl font-bold text-brand-light font-heading">' + primary.name + '</h3>' +
                '<p class="text-brand-gray/70 text-sm mb-2">' + primary.category + '</p>' +
                '<p class="text-brand-light font-semibold mb-3">$' + primary.price + '/month</p>' +
                '<p class="text-brand-gray text-sm mb-4">' + primary.tagline + '</p>' +
                '<div style="position: relative; overflow: hidden; border-radius: 4px;">' +
                    '<div style="filter: blur(4px); -webkit-filter: blur(4px); pointer-events: none; user-select: none;">' +
                        '<div class="bg-white/5 rounded-sm p-3 mb-2">' +
                            '<p class="text-brand-gray text-xs">Why this is your match: Personalized analysis based on your goals...</p>' +
                        '</div>' +
                        '<div class="bg-white/5 rounded-sm p-3 mb-2">' +
                            '<p class="text-brand-gray text-xs">Dosing: ' + primary.dosing + '</p>' +
                        '</div>' +
                        '<div class="bg-white/5 rounded-sm p-3">' +
                            '<p class="text-brand-gray text-xs">Timeline: ' + primary.timeline + '</p>' +
                        '</div>' +
                    '</div>' +
                    '<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 4px;">' +
                        '<p class="text-brand-light text-xs text-center px-4 font-medium">Enter your info to unlock your full protocol</p>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

        return screenWrap(SCREEN.INFO_CAPTURE,
            '<div class="text-center">' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">We Matched You with ' + primary.name + '</h2>' +
                '<p class="text-brand-gray font-light mb-8">Enter your info below to see your full protocol \u2014 dosing, timeline, cost breakdown, and personalized recommendations.</p>' +
                previewCard +
                '<div class="max-w-sm mx-auto space-y-4">' +
                    '<input type="text" id="quiz-name" placeholder="First name" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<input type="email" id="quiz-email" placeholder="Email address" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<input type="tel" id="quiz-phone" placeholder="Phone (optional)" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<p id="quiz-name-error" class="text-red-500 text-xs text-left hidden">Please enter your first name.</p>' +
                    '<p id="quiz-email-error" class="text-red-500 text-xs text-left hidden">Please enter a valid email address.</p>' +
                    '<button type="button" id="quiz-submit-info" class="btn-primary w-full py-3">Show My Protocol</button>' +
                '</div>' +
                '<p class="text-brand-gray/50 text-xs mt-4">We\'ll also email you a copy. No spam, no sales calls. Unsubscribe anytime.</p>' +
            '</div>'
        );
    }

    function buildCalculating() {
        var markers = '';
        for (var i = 0; i < calculatingSteps.length; i++) {
            markers += '<div class="calculating-marker flex items-center gap-3 py-2 opacity-0" data-marker-idx="' + i + '">' +
                '<div class="calculating-check w-6 h-6 rounded-full border-2 border-brand-gray/30 flex items-center justify-center flex-shrink-0">' +
                    '<svg class="w-4 h-4 text-brand-gray opacity-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' +
                '</div>' +
                '<span class="text-brand-gray text-sm font-medium">' + calculatingSteps[i] + '</span>' +
            '</div>';
        }
        return screenWrap(SCREEN.CALCULATING,
            '<div class="text-center">' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">Building Your Protocol</h2>' +
                '<p class="text-brand-gray font-light mb-10">Matching peptides to your goals and preferences...</p>' +
                '<div class="max-w-sm mx-auto text-left">' + markers + '</div>' +
            '</div>'
        );
    }

    function buildResultsShell() {
        return '<div class="quiz-screen flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + SCREEN.RESULTS + '">' +
            '<div class="max-w-2xl w-full" id="quiz-results-inner"></div></div>';
    }

    // ── Populate Concern Options (dynamic based on goal) ─────────────

    function populateConcernOptions() {
        var questionEl = document.getElementById('concern-question');
        var optionsEl = document.getElementById('concern-options');
        if (!questionEl || !optionsEl || !state.goal) return;

        var data = concernOptions[state.goal];
        if (!data) return;

        questionEl.textContent = data.question;

        var btns = '';
        for (var i = 0; i < data.options.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-concern="' + data.options[i].key + '">' + data.options[i].label + '</button>';
        }
        optionsEl.innerHTML = btns;
    }

    // ── Results Renderer ─────────────────────────────────────────────

    function renderResults() {
        var rec = getRecommendation();
        var primary = rec.primary;
        var secondary = rec.secondary;
        var goal = state.goal;
        var matchText = (primary.matchText && primary.matchText[goal]) || primary.description;

        var html = '';

        // ── Header ──────────────────────────────────────────────────
        html += '<div class="text-center mb-10">' +
            '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Your Results</p>' +
            '<h2 class="text-4xl font-bold text-brand-light mb-4 font-heading">YOUR PEPTIDE PROTOCOL</h2>' +
            '<p class="text-brand-gray font-light max-w-lg mx-auto">Based on your goals, preferences, and budget, here\'s what we recommend.</p>' +
        '</div>';

        // ── Primary Recommendation Card ─────────────────────────────
        html += '<div class="border border-brand-gray/40 rounded-sm p-8 mb-6" style="background: rgba(178, 191, 190, 0.05)">' +
            '<div class="flex items-start justify-between mb-4 flex-wrap gap-2">' +
                '<div>' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-1">Recommended For You</p>' +
                    '<h3 class="text-2xl font-bold text-brand-light font-heading">' + primary.name + '</h3>' +
                    '<p class="text-brand-gray/70 text-sm">' + primary.fullName + ' \u2014 ' + primary.category + '</p>' +
                '</div>' +
                '<div class="text-right">' +
                    '<span class="text-2xl font-bold text-brand-light">$' + primary.price + '</span>' +
                    '<span class="text-brand-gray text-sm">/mo</span>' +
                '</div>' +
            '</div>' +
            '<p class="text-brand-light font-medium text-lg mb-3" style="font-style: italic">' + primary.tagline + '</p>' +
            '<p class="text-brand-gray font-light mb-6">' + matchText + '</p>';

        // ── Personalized callouts based on state data ────────────────
        if (state.severity === 'significant' || state.severity === 'severe') {
            html += '<div class="bg-white/5 border-l-2 border-brand-gray/50 rounded-sm p-4 mb-4">' +
                '<p class="text-brand-light text-sm font-light">Given the severity of your symptoms, your provider may recommend a more aggressive protocol to start.</p>' +
            '</div>';
        }
        if (state.duration === '3+years') {
            html += '<div class="bg-white/5 border-l-2 border-brand-gray/50 rounded-sm p-4 mb-4">' +
                '<p class="text-brand-light text-sm font-light">You\'ve been dealing with this for over 3 years. Early results are often most noticeable in patients with chronic conditions.</p>' +
            '</div>';
        }
        if (state.experience === 'never') {
            html += '<div class="bg-white/5 border-l-2 border-brand-gray/50 rounded-sm p-4 mb-4">' +
                '<p class="text-brand-light text-sm font-light">New to peptides? Most of our patients are. Your first visit includes hands-on injection training \u2014 you\'ll leave confident.</p>' +
            '</div>';
        }
        if (state.experience === 'online') {
            html += '<div class="bg-white/5 border-l-2 border-brand-gray/50 rounded-sm p-4 mb-4">' +
                '<p class="text-brand-light text-sm font-light">Coming from online peptides? Pharmaceutical-grade compounds from licensed pharmacies are a different experience \u2014 consistent potency, sterility testing, and medical oversight.</p>' +
            '</div>';
        }
        if (state.therapy === 'moonshot') {
            html += '<div class="bg-white/5 border-l-2 border-brand-gray/50 rounded-sm p-4 mb-4">' +
                '<p class="text-brand-light text-sm font-light">As a current Moonshot patient, adding peptides to your protocol is simple \u2014 just book a quick add-on visit.</p>' +
            '</div>';
        }

        html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">' +
                '<div class="bg-white/5 rounded-sm p-4">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-1">How It Works</p>' +
                    '<p class="text-brand-light text-sm font-light">' + primary.description + '</p>' +
                '</div>' +
                '<div class="bg-white/5 rounded-sm p-4">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-1">Expected Timeline</p>' +
                    '<p class="text-brand-light text-sm font-light">' + primary.timeline + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="bg-white/5 rounded-sm p-4">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-1">Typical Dosing</p>' +
                '<p class="text-brand-light text-sm font-light">' + primary.dosing + '</p>' +
            '</div>' +
        '</div>';

        // ── Secondary Recommendation (if applicable) ────────────────
        if (secondary) {
            var secMatchText = (secondary.matchText && secondary.matchText[goal]) || secondary.description;
            html += '<div class="bg-white/5 border border-white/10 rounded-sm p-6 mb-8">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-2">Also Worth Considering</p>' +
                '<div class="flex items-start justify-between mb-3 flex-wrap gap-2">' +
                    '<div>' +
                        '<h4 class="text-lg font-bold text-brand-light">' + secondary.name + '</h4>' +
                        '<p class="text-brand-gray/70 text-sm">' + secondary.category + '</p>' +
                    '</div>' +
                    '<div class="text-right">' +
                        '<span class="text-lg font-bold text-brand-light">$' + secondary.price + '</span>' +
                        '<span class="text-brand-gray text-sm">/mo</span>' +
                    '</div>' +
                '</div>' +
                '<p class="text-brand-gray font-light text-sm">' + secMatchText + '</p>' +
            '</div>';
        }

        // ── Protocol Summary ────────────────────────────────────────
        html += '<div class="bg-white/5 rounded-sm p-6 mb-8">' +
            '<h3 class="text-brand-light font-bold mb-4">YOUR PROTOCOL SUMMARY</h3>' +
            '<div class="space-y-3">' +
                '<div class="flex justify-between border-b border-white/10 pb-3">' +
                    '<span class="text-brand-gray text-sm">Monthly Cost</span>' +
                    '<span class="text-brand-light font-medium">$' + primary.price + '/month</span>' +
                '</div>' +
                '<div class="flex justify-between border-b border-white/10 pb-3">' +
                    '<span class="text-brand-gray text-sm">Injection Frequency</span>' +
                    '<span class="text-brand-light font-medium">' + primary.frequency + '</span>' +
                '</div>' +
                '<div class="flex justify-between border-b border-white/10 pb-3">' +
                    '<span class="text-brand-gray text-sm">Expected Cycle Length</span>' +
                    '<span class="text-brand-light font-medium">' + primary.cycle + '</span>' +
                '</div>' +
                '<div class="pt-2">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-2">What\'s Included</p>' +
                    '<div class="space-y-2">' +
                        '<div class="flex items-start gap-2">' +
                            '<svg class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' +
                            '<span class="text-brand-gray text-sm font-light">Pharmaceutical-grade compound from a licensed 503A pharmacy</span>' +
                        '</div>' +
                        '<div class="flex items-start gap-2">' +
                            '<svg class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' +
                            '<span class="text-brand-gray text-sm font-light">Medical oversight by a licensed provider</span>' +
                        '</div>' +
                        '<div class="flex items-start gap-2">' +
                            '<svg class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' +
                            '<span class="text-brand-gray text-sm font-light">Injection supplies and injection training</span>' +
                        '</div>' +
                        '<div class="flex items-start gap-2">' +
                            '<svg class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' +
                            '<span class="text-brand-gray text-sm font-light">Ongoing monitoring and protocol adjustments</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

        // ── Common Questions ────────────────────────────────────────
        html += '<div class="bg-white/5 rounded-sm p-6 mb-8">' +
            '<h3 class="text-brand-light font-bold mb-6">COMMON QUESTIONS</h3>' +
            '<div class="space-y-6">' +
                '<div>' +
                    '<p class="text-brand-light font-medium text-sm mb-1">Do I really have to inject myself?</p>' +
                    '<p class="text-brand-gray font-light text-sm">Yes, but it\'s a tiny insulin needle \u2014 most patients say they barely feel it. We do hands-on injection training at your first visit.</p>' +
                '</div>' +
                '<div>' +
                    '<p class="text-brand-light font-medium text-sm mb-1">Where do the peptides come from?</p>' +
                    '<p class="text-brand-gray font-light text-sm">Every compound is made at a licensed 503A compounding pharmacy. We don\'t use overseas or gray-market sources.</p>' +
                '</div>' +
                '<div>' +
                    '<p class="text-brand-light font-medium text-sm mb-1">Is this a long-term commitment?</p>' +
                    '<p class="text-brand-gray font-light text-sm">Most protocols run 4\u201312 weeks. No contracts, no commitments.</p>' +
                '</div>' +
            '</div>' +
        '</div>';

        // ── CTA ─────────────────────────────────────────────────────
        html += '<div class="bg-brand-slate rounded-sm p-8 mb-8 text-center">' +
            '<h3 class="text-brand-light font-bold mb-4">YOUR NEXT STEP</h3>' +
            '<p class="text-brand-gray font-light mb-2">Your provider will review your protocol, confirm the right peptide, and walk you through injection training \u2014 usually in a single 15-minute visit.</p>' +
            '<p class="text-brand-gray/70 text-xs mb-6">All peptide therapies require a medical evaluation. This quiz is for educational purposes and does not constitute medical advice.</p>' +
            '<a href="/booking/" class="btn-primary text-lg px-10 py-4 inline-block quiz-cta" data-cta="book_peptide_consultation">Book My Free Consultation</a>' +
            '<p class="text-brand-gray/60 text-sm mt-4"><a href="tel:+12244354280" class="text-brand-light hover:underline">(224) 435-4280</a> if you\'d rather call</p>' +
            '<p class="text-brand-gray/50 text-xs mt-3">Not ready? Reply to the email we just sent \u2014 we answer every one.</p>' +
        '</div>';

        // ── Learn More Links ────────────────────────────────────────
        var learnLinks = '';
        if (primary.learnUrl) {
            learnLinks += '<a href="' + primary.learnUrl + '" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Learn about ' + primary.name + ' \u2192</a>';
        }
        learnLinks += '<a href="/medical/peptides/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Full Peptide Menu \u2192</a>';

        html += '<div class="text-center mb-8">' +
            '<p class="text-brand-gray text-xs uppercase tracking-widest mb-3">Keep Learning</p>' +
            '<div class="flex flex-wrap justify-center gap-2">' + learnLinks + '</div>' +
        '</div>';

        // Retake quiz button
        html += '<div class="text-center mb-8">' +
            '<button type="button" class="text-brand-gray/60 hover:text-brand-light text-sm transition-colors underline underline-offset-2" data-retake="true">Retake Quiz</button>' +
        '</div>';

        document.getElementById('quiz-results-inner').innerHTML = html;

        // Update URL for sharing
        var resultSlug = rec.primaryKey + '-' + (state.goal || 'general');
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '/quiz/peptides/?r=' + resultSlug);
        }

        // Update meta tags for sharing
        var metaTitle = document.querySelector('meta[property="og:title"]');
        var metaDesc = document.querySelector('meta[property="og:description"]');
        if (metaTitle) metaTitle.setAttribute('content', 'My Peptide Match: ' + primary.name + ' | Moonshot Medical');
        if (metaDesc) metaDesc.setAttribute('content', primary.tagline + ' Take the free quiz to find your match.');
    }

    // ── Calculating Animation ────────────────────────────────────────

    function runCalculatingAnimation(callback) {
        var markers = root.querySelectorAll('.calculating-marker');
        var delay = 400;
        var totalTime = 0;

        for (var i = 0; i < markers.length; i++) {
            (function(idx) {
                var t = delay * (idx + 1);
                setTimeout(function() {
                    var marker = markers[idx];
                    if (!marker) return;
                    // Fade in the row
                    marker.style.opacity = '1';
                    marker.style.transition = 'opacity 0.3s ease';
                    // After a beat, show the checkmark
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
                        // Update text color
                        var label = marker.querySelector('span');
                        if (label) label.style.color = '#F0EEE9';
                    }, 150);
                }, t);
                totalTime = t + 300;
            })(i);
        }

        // Auto-advance after all markers complete
        setTimeout(function() {
            if (callback) callback();
        }, totalTime + 600);
    }

    // ── Build & Bind ─────────────────────────────────────────────────

    function buildAllScreens() {
        var html = '';
        html += buildWelcome();
        html += buildPrimaryGoal();
        html += buildSpecificConcern();
        html += buildSeverity();
        html += buildDuration();
        html += buildPeptideExperience();
        html += buildCurrentTherapy();
        html += buildConvenience();
        html += buildBudget();
        html += buildSocialProof();
        html += buildInfoCapture();
        html += buildCalculating();
        html += buildResultsShell();

        root.innerHTML = html;
    }

    function bindAll() {
        // Welcome
        var startBtn = document.getElementById('quiz-start-btn');
        if (startBtn) startBtn.addEventListener('click', function() {
            ga('peptide_quiz_start', { page: '/quiz/peptides/' });
            show(SCREEN.PRIMARY_GOAL);
        });

        // Use delegated event handling on root for most interactions
        root.addEventListener('click', function(e) {
            var target = e.target;

            // Primary Goal (auto-advance)
            var goalCard = target.closest('[data-goal]');
            if (goalCard) {
                state.goal = goalCard.getAttribute('data-goal');
                var allG = root.querySelectorAll('[data-goal]');
                for (var j = 0; j < allG.length; j++) allG[j].classList.remove('selected');
                goalCard.classList.add('selected');
                ga('peptide_quiz_goal', { value: state.goal });
                // Populate concern options for this goal
                populateConcernOptions();
                setTimeout(function() { show(SCREEN.SPECIFIC_CONCERN); }, 400);
                return;
            }

            // Specific Concern (auto-advance)
            var concernCard = target.closest('[data-concern]');
            if (concernCard) {
                state.concern = concernCard.getAttribute('data-concern');
                var allC = root.querySelectorAll('[data-concern]');
                for (var m = 0; m < allC.length; m++) allC[m].classList.remove('selected');
                concernCard.classList.add('selected');
                ga('peptide_quiz_concern', { value: state.concern });
                setTimeout(function() { show(SCREEN.SEVERITY); }, 400);
                return;
            }

            // Severity (auto-advance)
            var severityCard = target.closest('[data-severity]');
            if (severityCard) {
                state.severity = severityCard.getAttribute('data-severity');
                var allS = root.querySelectorAll('[data-severity]');
                for (var s = 0; s < allS.length; s++) allS[s].classList.remove('selected');
                severityCard.classList.add('selected');
                ga('peptide_quiz_severity', { value: state.severity });
                setTimeout(function() { show(SCREEN.DURATION); }, 400);
                return;
            }

            // Duration (auto-advance)
            var durationCard = target.closest('[data-duration]');
            if (durationCard) {
                state.duration = durationCard.getAttribute('data-duration');
                var allD = root.querySelectorAll('[data-duration]');
                for (var d = 0; d < allD.length; d++) allD[d].classList.remove('selected');
                durationCard.classList.add('selected');
                ga('peptide_quiz_duration', { value: state.duration });
                setTimeout(function() { show(SCREEN.PEPTIDE_EXPERIENCE); }, 400);
                return;
            }

            // Peptide Experience (auto-advance)
            var experienceCard = target.closest('[data-experience]');
            if (experienceCard) {
                state.experience = experienceCard.getAttribute('data-experience');
                var allE = root.querySelectorAll('[data-experience]');
                for (var x = 0; x < allE.length; x++) allE[x].classList.remove('selected');
                experienceCard.classList.add('selected');
                ga('peptide_quiz_experience', { value: state.experience });
                setTimeout(function() { show(SCREEN.CURRENT_THERAPY); }, 400);
                return;
            }

            // Current Therapy (auto-advance)
            var therapyCard = target.closest('[data-therapy]');
            if (therapyCard) {
                state.therapy = therapyCard.getAttribute('data-therapy');
                var allT = root.querySelectorAll('[data-therapy]');
                for (var t = 0; t < allT.length; t++) allT[t].classList.remove('selected');
                therapyCard.classList.add('selected');
                ga('peptide_quiz_therapy', { value: state.therapy });
                setTimeout(function() { show(SCREEN.CONVENIENCE); }, 400);
                return;
            }

            // Convenience (auto-advance)
            var convenienceCard = target.closest('[data-convenience]');
            if (convenienceCard) {
                state.convenience = convenienceCard.getAttribute('data-convenience');
                var allV = root.querySelectorAll('[data-convenience]');
                for (var v = 0; v < allV.length; v++) allV[v].classList.remove('selected');
                convenienceCard.classList.add('selected');
                ga('peptide_quiz_convenience', { value: state.convenience });
                setTimeout(function() { show(SCREEN.BUDGET); }, 400);
                return;
            }

            // Budget (auto-advance to social proof)
            var budgetCard = target.closest('[data-budget]');
            if (budgetCard) {
                state.budget = budgetCard.getAttribute('data-budget');
                var allB = root.querySelectorAll('[data-budget]');
                for (var b = 0; b < allB.length; b++) allB[b].classList.remove('selected');
                budgetCard.classList.add('selected');
                ga('peptide_quiz_budget', { value: state.budget });
                setTimeout(function() { show(SCREEN.SOCIAL_PROOF); }, 400);
                return;
            }

            // Back button
            var backBtn = target.closest('[data-back]');
            if (backBtn) {
                var prevScreen = state.currentScreen - 1;
                // Skip social proof interstitial when going back
                if (prevScreen === SCREEN.SOCIAL_PROOF) prevScreen = SCREEN.BUDGET;
                if (prevScreen >= SCREEN.WELCOME) {
                    show(prevScreen);
                }
                return;
            }

            // Retake quiz
            var retakeBtn = target.closest('[data-retake]');
            if (retakeBtn) {
                state.goal = null;
                state.concern = null;
                state.severity = null;
                state.duration = null;
                state.experience = null;
                state.therapy = null;
                state.convenience = null;
                state.budget = null;
                state.name = '';
                state.email = '';
                state.phone = '';
                clearSavedState();
                // Rebuild screens to clear all selected states
                buildAllScreens();
                bindAll();
                ga('peptide_quiz_retake', { page: '/quiz/peptides/' });
                show(SCREEN.PRIMARY_GOAL);
                return;
            }

            // Results CTAs
            var cta = target.closest('.quiz-cta');
            if (cta) {
                var ctaName = cta.getAttribute('data-cta');
                ga('peptide_quiz_cta_click', { cta_name: ctaName, page: '/quiz/peptides/' });
                return;
            }
        });

        // Info submit
        var submitBtn = document.getElementById('quiz-submit-info');
        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                var nameInput = document.getElementById('quiz-name');
                var emailInput = document.getElementById('quiz-email');
                var phoneInput = document.getElementById('quiz-phone');
                var nameError = document.getElementById('quiz-name-error');
                var emailError = document.getElementById('quiz-email-error');

                state.name = (nameInput.value || '').trim();
                state.email = (emailInput.value || '').trim();
                state.phone = (phoneInput.value || '').trim();

                // Reset error states
                nameInput.style.borderColor = '';
                emailInput.style.borderColor = '';
                if (nameError) nameError.classList.add('hidden');
                if (emailError) emailError.classList.add('hidden');

                var hasError = false;

                // Validate name
                if (!state.name) {
                    nameInput.style.borderColor = '#dc2626';
                    if (nameError) nameError.classList.remove('hidden');
                    nameInput.focus();
                    hasError = true;
                }

                // Validate email
                if (!state.email || state.email.indexOf('@') === -1 || state.email.indexOf('.') === -1) {
                    emailInput.style.borderColor = '#dc2626';
                    if (emailError) emailError.classList.remove('hidden');
                    if (!hasError) emailInput.focus();
                    hasError = true;
                }

                if (hasError) return;

                // Clear error state
                nameInput.style.borderColor = '';
                emailInput.style.borderColor = '';

                ga('peptide_quiz_info_submit', { page: '/quiz/peptides/' });

                // Fire-and-forget: submit data then show calculating
                sendResults();
                showCalculating();
            });
        }
    }

    // ── Calculating & Results Flow ──────────────────────────────────

    function showCalculating() {
        show(SCREEN.CALCULATING);
        // Reset marker states
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
        runCalculatingAnimation(function() {
            renderResults();
            var rec = getRecommendation();
            ga('peptide_quiz_results_view', {
                goal: state.goal,
                concern: state.concern,
                recommendation: rec.primaryKey,
                secondary: rec.secondaryKey || 'none'
            });
            show(SCREEN.RESULTS);
            progressBar.style.width = '100%';
            clearSavedState();
        });
    }

    // ── Email Submission ─────────────────────────────────────────────

    function sendResults() {
        var rec = getRecommendation();

        var payload = {
            name: state.name || null,
            email: state.email,
            phone: state.phone || null,
            goal: state.goal,
            concern: state.concern,
            severity: state.severity,
            duration: state.duration,
            experience: state.experience,
            therapy: state.therapy,
            convenience: state.convenience,
            budget: state.budget,
            recommendation: {
                primary: rec.primaryKey,
                primaryName: rec.primary.name,
                secondary: rec.secondaryKey || null,
                secondaryName: rec.secondary ? rec.secondary.name : null
            }
        };

        fetch('/.netlify/functions/peptide-quiz-submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(function() {
            // Fire-and-forget: don't block on failure
        });
    }

    // ── Shared Result View ────────────────────────────────────────────

    function showSharedResult(peptideKey, goalKey) {
        var peptide = PEPTIDES[peptideKey];
        if (!peptide) return;

        var html = '<div class="flex items-center justify-center min-h-[calc(100vh-5rem)] px-4 py-12">' +
            '<div class="max-w-2xl w-full">' +
                '<div class="text-center mb-8">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Shared Quiz Result</p>' +
                    '<h2 class="text-3xl font-bold text-brand-light mb-4 font-heading">Someone Matched With ' + peptide.name + '</h2>' +
                '</div>' +
                '<div class="border border-brand-gray/40 rounded-sm p-8 mb-8" style="background: rgba(178, 191, 190, 0.05)">' +
                    '<p class="text-brand-gray text-xs uppercase tracking-widest mb-1">' + peptide.category + '</p>' +
                    '<h3 class="text-2xl font-bold text-brand-light font-heading mb-2">' + peptide.name + '</h3>' +
                    '<p class="text-brand-light font-semibold mb-3">$' + peptide.price + '/month</p>' +
                    '<p class="text-brand-light font-medium text-lg mb-4" style="font-style: italic">' + peptide.tagline + '</p>' +
                    '<p class="text-brand-gray font-light">' + peptide.description + '</p>' +
                '</div>' +
                '<div class="bg-white/5 border border-white/10 rounded-sm p-6 mb-8 text-center">' +
                    '<p class="text-brand-gray font-light mb-6">This result was personalized for someone else. Take the quiz to get your own match.</p>' +
                    '<button type="button" id="shared-result-cta" class="btn-primary text-lg px-10 py-4">Find My Peptide Match</button>' +
                '</div>' +
            '</div>' +
        '</div>';

        root.innerHTML = html;
        progressBar.style.width = '0%';

        var ctaBtn = document.getElementById('shared-result-cta');
        if (ctaBtn) {
            ctaBtn.addEventListener('click', function() {
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '/quiz/peptides/');
                }
                ga('peptide_quiz_shared_result_cta', { shared_peptide: peptideKey });
                restoreQuiz();
            });
        }
    }

    // ── Restore from Saved State ────────────────────────────────────

    function restoreQuiz() {
        var saved = loadSavedState();

        buildAllScreens();
        bindAll();

        if (!saved || !saved.goal) {
            show(SCREEN.WELCOME);
            return;
        }

        // Restore state
        state.goal = saved.goal;
        state.concern = saved.concern;
        state.severity = saved.severity;
        state.duration = saved.duration;
        state.experience = saved.experience;
        state.therapy = saved.therapy;
        state.convenience = saved.convenience;
        state.budget = saved.budget;
        state.name = saved.name || '';
        state.email = saved.email || '';
        state.phone = saved.phone || '';

        // Populate goal-dependent concern options
        if (state.goal) {
            populateConcernOptions();
        }

        // Rehydrate UI: goal
        if (state.goal) {
            var goalCard = root.querySelector('[data-goal="' + state.goal + '"]');
            if (goalCard) goalCard.classList.add('selected');
        }

        // Rehydrate UI: concern
        if (state.concern) {
            var concernCard = root.querySelector('[data-concern="' + state.concern + '"]');
            if (concernCard) concernCard.classList.add('selected');
        }

        // Rehydrate UI: severity
        if (state.severity) {
            var severityCard = root.querySelector('[data-severity="' + state.severity + '"]');
            if (severityCard) severityCard.classList.add('selected');
        }

        // Rehydrate UI: duration
        if (state.duration) {
            var durationCard = root.querySelector('[data-duration="' + state.duration + '"]');
            if (durationCard) durationCard.classList.add('selected');
        }

        // Rehydrate UI: experience
        if (state.experience) {
            var experienceCard = root.querySelector('[data-experience="' + state.experience + '"]');
            if (experienceCard) experienceCard.classList.add('selected');
        }

        // Rehydrate UI: therapy
        if (state.therapy) {
            var therapyCard = root.querySelector('[data-therapy="' + state.therapy + '"]');
            if (therapyCard) therapyCard.classList.add('selected');
        }

        // Rehydrate UI: convenience
        if (state.convenience) {
            var convenienceCard = root.querySelector('[data-convenience="' + state.convenience + '"]');
            if (convenienceCard) convenienceCard.classList.add('selected');
        }

        // Rehydrate UI: budget
        if (state.budget) {
            var budgetCard = root.querySelector('[data-budget="' + state.budget + '"]');
            if (budgetCard) budgetCard.classList.add('selected');
        }

        // Rehydrate name/email/phone
        if (state.name) {
            var nameInput = document.getElementById('quiz-name');
            if (nameInput) nameInput.value = state.name;
        }
        if (state.email) {
            var emailInput = document.getElementById('quiz-email');
            if (emailInput) emailInput.value = state.email;
        }
        if (state.phone) {
            var phoneInput = document.getElementById('quiz-phone');
            if (phoneInput) phoneInput.value = state.phone;
        }

        // Determine which screen to show
        var targetScreen = saved.currentScreen || 0;

        // Don't restore to calculating or results — go to info capture instead
        if (targetScreen >= SCREEN.CALCULATING) {
            targetScreen = SCREEN.INFO_CAPTURE;
        }

        show(targetScreen);
    }

    // ── Init ──────────────────────────────────────────────────────────

    function init() {
        // Check for shared result URL
        var urlParams = new URLSearchParams(window.location.search);
        var sharedResult = urlParams.get('r');
        if (sharedResult) {
            var parts = sharedResult.split('-');
            var peptideKey = parts.slice(0, -1).join('-') || parts[0];
            var goalKey = parts[parts.length - 1];
            if (PEPTIDES[peptideKey]) {
                showSharedResult(peptideKey, goalKey);
                return; // Skip normal quiz init
            }
        }
        restoreQuiz();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
