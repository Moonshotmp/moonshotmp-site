/*
 * Moonshot Hormone Health Quiz Engine v2
 * =======================================
 * 18-screen flow with interstitials, severity scoring, and calculating animation.
 * Vanilla JS IIFE — no dependencies.
 */
(function() {
    'use strict';

    // ── Screen Constants ───────────────────────────────────────────────
    var SCREEN = {
        WELCOME: 0,
        GENDER: 1,
        AGE: 2,
        PRIMARY_CONCERN: 3,
        INTERSTITIAL_1: 4,
        SYMPTOM_1: 5,
        SYMPTOM_2: 6,
        INTERSTITIAL_2: 7,
        SYMPTOM_3: 8,
        DURATION: 9,
        INTERSTITIAL_3: 10,
        LIFESTYLE: 11,
        READINESS: 12,
        EMAIL: 13,
        CALCULATING: 14,
        RESULTS: 15
    };

    var TOTAL_SCREENS = 16;
    var PROGRESS_MAX = 14; // welcome through email capture for progress calculation

    // ── Symptom Data (gender-specific) ─────────────────────────────────

    var symptomData = {
        male: {
            energy_physical: [
                'Persistent fatigue that coffee can\'t fix',
                'Losing muscle or gaining fat despite effort',
                'Slower recovery from workouts or illness'
            ],
            mental_mood: [
                'Brain fog or difficulty concentrating',
                'Low motivation or feeling flat',
                'Irritability or mood swings that don\'t match the situation'
            ],
            sleep_sexual: [
                'Trouble sleeping or waking unrefreshed',
                'Decreased libido or sexual performance',
                'Night sweats or temperature issues'
            ]
        },
        female: {
            energy_physical: [
                'Fatigue that rest doesn\'t fix',
                'Unexplained weight gain, especially around the middle',
                'Slower recovery or persistent aches'
            ],
            mental_mood: [
                'Brain fog or difficulty finding words',
                'Anxiety, irritability, or mood swings',
                'Feeling emotionally flat or unlike yourself'
            ],
            sleep_sexual: [
                'Disrupted sleep, waking at 2-3 AM',
                'Low libido or discomfort during intimacy',
                'Hot flashes, night sweats, or temperature swings'
            ]
        }
    };

    var severityOptions = [
        { value: 0, label: 'Not me' },
        { value: 1, label: 'Mild' },
        { value: 2, label: 'Moderate' },
        { value: 3, label: 'Significant' }
    ];

    var ageRanges = [
        { label: 'Under 30', key: 'under-30' },
        { label: '30\u201339', key: '30-39' },
        { label: '40\u201349', key: '40-49' },
        { label: '50\u201359', key: '50-59' },
        { label: '60+', key: '60+' }
    ];

    var primaryConcerns = [
        { label: 'Energy & Vitality', key: 'energy' },
        { label: 'Body Composition', key: 'body' },
        { label: 'Sleep & Recovery', key: 'sleep' },
        { label: 'Mood & Mental Clarity', key: 'mood' },
        { label: 'Sexual Health', key: 'sexual' },
        { label: 'All of the above', key: 'all' }
    ];

    var durationOptions = [
        { label: 'A few weeks', key: 'weeks' },
        { label: 'A few months', key: 'months' },
        { label: '1\u20132 years', key: '1-2years' },
        { label: '3+ years', key: '3+years' }
    ];

    var readinessOptions = [
        { label: 'Very likely', key: 'very' },
        { label: 'Somewhat likely', key: 'somewhat' },
        { label: 'Just curious', key: 'curious' }
    ];

    var durationMultipliers = {
        'weeks': 1.0,
        'months': 1.1,
        '1-2years': 1.2,
        '3+years': 1.3
    };

    // ── Category Labels & Insights ─────────────────────────────────────

    var categoryLabels = {
        energy_physical: 'Energy & Physical',
        mental_mood: 'Mental & Mood',
        sleep_sexual: 'Sleep & Sexual Health'
    };

    var categoryInsights = {
        male: {
            energy_physical: 'Energy and physical performance are among the most testosterone-sensitive functions. When T drops, your mitochondria produce less ATP and recovery slows.',
            mental_mood: 'Testosterone directly supports neurotransmitter function and cerebral blood flow. Brain fog and mood changes are well-documented effects of low T.',
            sleep_sexual: 'Low T disrupts sleep architecture, and poor sleep further suppresses testosterone \u2014 creating a cycle that\'s hard to break without addressing the hormonal component.'
        },
        female: {
            energy_physical: 'Fatigue and physical changes are often the first signs of hormonal shifts. Estrogen, progesterone, and thyroid all directly regulate energy production.',
            mental_mood: 'Estrogen and progesterone influence serotonin, GABA, and dopamine pathways. Hormonal shifts can cause mood changes that feel completely out of character.',
            sleep_sexual: 'Sleep disruption and intimacy changes are strongly linked to declining estrogen and progesterone. These hormones have natural calming, sleep-supporting properties.'
        }
    };

    var gapStats = {
        male: [
            '47% improvement in sustained energy',
            '3x faster workout recovery',
            'Significant improvement in sleep quality within 4-6 weeks'
        ],
        female: [
            'Significant improvement in energy and mood within 4-6 weeks',
            'Better sleep quality and fewer night-time disruptions',
            'Improved mental clarity and emotional balance'
        ]
    };

    var interstitials = {
        screen4: {
            male: '1 in 4 men over 30 has testosterone below the optimal range. Most don\'t know it.',
            female: 'Hormonal shifts can start 10 years before menopause. Most women are told it\'s \u201Cjust stress.\u201D'
        },
        screen7: '\u201CNormal\u201D lab ranges miss up to 73% of hormonal imbalances. We look at where your body functions best, not just where it avoids disease.',
        screen10: 'Patients with similar profiles who got tested discovered an average of 4 actionable findings. Most had been told their labs were \u201Cnormal.\u201D'
    };

    var calculatingMarkers = ['Energy', 'Body Composition', 'Sleep', 'Mood', 'Mental Clarity', 'Sexual Health', 'Recovery', 'Overall'];

    // ── Score Classification ──────────────────────────────────────────

    function classify(score) {
        if (score <= 25) return { level: 'Low', summary: 'Minimal hormonal impact detected' };
        if (score <= 50) return { level: 'Moderate', summary: 'Some areas worth investigating' };
        if (score <= 75) return { level: 'Elevated', summary: 'Multiple markers suggest optimization opportunity' };
        return { level: 'High', summary: 'Significant indicators across several areas' };
    }

    // ── State ────────────────────────────────────────────────────────────

    var state = {
        currentScreen: 0,
        gender: null,
        age: null,
        primaryConcern: null,
        answers: {},            // { 'energy_physical_0': 2, ... }
        duration: null,
        readiness: null,
        lifestyle: { exercise: false, sleep: false, tested: false },
        name: '',
        email: ''
    };

    var root = document.getElementById('quiz-root');
    var progressBar = document.getElementById('quiz-progress-bar');

    // ── State Persistence ──────────────────────────────────────────────

    var STORAGE_KEY = 'mmp_quiz_v2_state';
    var STORAGE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                currentScreen: state.currentScreen,
                gender: state.gender,
                age: state.age,
                primaryConcern: state.primaryConcern,
                answers: state.answers,
                duration: state.duration,
                readiness: state.readiness,
                lifestyle: state.lifestyle,
                name: state.name,
                email: state.email,
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

    // ── Helpers ──────────────────────────────────────────────────────────

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
    }

    function screenWrap(index, inner) {
        return '<div class="quiz-screen flex items-center justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + index + '">' +
            '<div class="max-w-2xl w-full">' + inner + '</div></div>';
    }

    function getSymptoms(groupKey) {
        if (!state.gender) return [];
        return symptomData[state.gender][groupKey] || [];
    }

    function allGroupAnswered(groupKey) {
        var items = getSymptoms(groupKey);
        for (var i = 0; i < items.length; i++) {
            if (state.answers[groupKey + '_' + i] === undefined) return false;
        }
        return true;
    }

    function computeScores() {
        var categories = ['energy_physical', 'mental_mood', 'sleep_sexual'];
        var catScores = [];
        var rawTotal = 0;

        for (var c = 0; c < categories.length; c++) {
            var key = categories[c];
            var catTotal = 0;
            for (var i = 0; i < 3; i++) {
                var val = state.answers[key + '_' + i] || 0;
                catTotal += val;
                rawTotal += val;
            }
            catScores.push({ key: key, label: categoryLabels[key], score: catTotal, max: 9 });
        }

        var multiplier = durationMultipliers[state.duration] || 1.0;
        var normalized = Math.min(100, Math.round((rawTotal / 27) * 100 * multiplier));

        return {
            rawScore: rawTotal,
            maxRawScore: 27,
            score: normalized,
            classification: classify(normalized),
            categories: catScores
        };
    }

    // ── Screen Builders ─────────────────────────────────────────────────

    function buildWelcome() {
        return screenWrap(SCREEN.WELCOME,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-6">Free 2-Minute Science-Backed Assessment</p>' +
                '<h1 class="text-4xl md:text-5xl font-bold text-brand-light mb-6 font-heading">How Are Your Hormones<br>Really Doing?</h1>' +
                '<p class="text-brand-gray text-lg font-light mb-10 max-w-lg mx-auto">Answer a few quick questions and get personalized insights about what your symptoms might mean.</p>' +
                '<button type="button" id="quiz-start-btn" class="btn-primary text-lg px-10 py-4">Start My Assessment</button>' +
                '<p class="text-brand-gray/50 text-xs mt-6">Not a medical diagnosis. For educational purposes only.</p>' +
            '</div>'
        );
    }

    function buildGender() {
        return screenWrap(SCREEN.GENDER,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">I AM</h2>' +
                '<p class="text-brand-gray font-light mb-10">This determines which symptom questions you\'ll see.</p>' +
                '<div class="grid grid-cols-2 gap-4 max-w-md mx-auto">' +
                    '<button type="button" class="quiz-card border border-white/10 rounded-sm p-8 text-center" data-gender="male">' +
                        '<span class="block text-4xl mb-3">&#9794;</span>' +
                        '<span class="text-brand-light font-bold text-lg">Male</span>' +
                    '</button>' +
                    '<button type="button" class="quiz-card border border-white/10 rounded-sm p-8 text-center" data-gender="female">' +
                        '<span class="block text-4xl mb-3">&#9792;</span>' +
                        '<span class="text-brand-light font-bold text-lg">Female</span>' +
                    '</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildAge() {
        var btns = '';
        for (var i = 0; i < ageRanges.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium hover:border-brand-gray/40" data-age="' + ageRanges[i].key + '">' + ageRanges[i].label + '</button>';
        }
        return screenWrap(SCREEN.AGE,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">AGE RANGE</h2>' +
                '<p class="text-brand-gray font-light mb-10">Helps us personalize your results.</p>' +
                '<div class="flex flex-wrap justify-center gap-3">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildPrimaryConcern() {
        var btns = '';
        for (var i = 0; i < primaryConcerns.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-concern="' + primaryConcerns[i].key + '">' + primaryConcerns[i].label + '</button>';
        }
        return screenWrap(SCREEN.PRIMARY_CONCERN,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">What would you most like to improve?</h2>' +
                '<p class="text-brand-gray font-light mb-10">Select the area that matters most to you right now.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildInterstitial1() {
        // Gender-specific — content filled after gender is known
        return screenWrap(SCREEN.INTERSTITIAL_1,
            '<div class="text-center">' +
                '<div class="interstitial-stat">' +
                    '<p id="interstitial-1-text" class="text-brand-light text-xl md:text-2xl font-light leading-relaxed max-w-lg mx-auto mb-10"></p>' +
                '</div>' +
                '<button type="button" class="btn-primary px-8 py-3 quiz-continue-btn" data-to="' + SCREEN.SYMPTOM_1 + '">Continue \u2192</button>' +
            '</div>'
        );
    }

    function buildSymptomGroup(screenIdx, groupKey, groupNumber) {
        var groupLabels = {
            energy_physical: 'Energy & Physical',
            mental_mood: 'Mental & Mood',
            sleep_sexual: 'Sleep & Sexual Health'
        };
        var label = groupLabels[groupKey] || groupKey;

        // Items are populated dynamically after gender is selected
        return screenWrap(screenIdx,
            '<div>' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-2">Symptom Group ' + groupNumber + ' of 3</p>' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">' + label.toUpperCase() + '</h2>' +
                '<p class="text-brand-gray font-light mb-8">Rate each symptom based on your experience.</p>' +
                '<div id="symptom-group-' + groupKey + '"></div>' +
                '<div class="flex justify-between items-center mt-8">' +
                    '<button type="button" class="text-brand-gray text-sm hover:text-brand-light transition quiz-back-btn" data-to="' + (screenIdx - 1) + '">\u2190 Back</button>' +
                    '<button type="button" class="btn-primary quiz-symptom-next opacity-40 pointer-events-none" data-group="' + groupKey + '" data-to="' + (screenIdx + 1) + '" disabled>Next \u2192</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildInterstitial2() {
        return screenWrap(SCREEN.INTERSTITIAL_2,
            '<div class="text-center">' +
                '<div class="interstitial-stat">' +
                    '<p class="text-brand-light text-xl md:text-2xl font-light leading-relaxed max-w-lg mx-auto mb-10">' + interstitials.screen7 + '</p>' +
                '</div>' +
                '<button type="button" class="btn-primary px-8 py-3 quiz-continue-btn" data-to="' + SCREEN.SYMPTOM_3 + '">Continue \u2192</button>' +
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
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">How long have you been experiencing these symptoms?</h2>' +
                '<p class="text-brand-gray font-light mb-10">This helps us understand your situation better.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildInterstitial3() {
        return screenWrap(SCREEN.INTERSTITIAL_3,
            '<div class="text-center">' +
                '<div class="interstitial-stat">' +
                    '<p class="text-brand-light text-xl md:text-2xl font-light leading-relaxed max-w-lg mx-auto mb-10">' + interstitials.screen10 + '</p>' +
                '</div>' +
                '<button type="button" class="btn-primary px-8 py-3 quiz-continue-btn" data-to="' + SCREEN.LIFESTYLE + '">Continue \u2192</button>' +
            '</div>'
        );
    }

    function buildLifestyle() {
        function toggle(id, label) {
            return '<div class="flex items-center justify-between py-4 border-b border-white/10">' +
                '<span class="text-brand-light text-sm font-medium">' + label + '</span>' +
                '<div class="toggle-track" data-toggle="' + id + '"><div class="toggle-knob"></div></div>' +
            '</div>';
        }
        return screenWrap(SCREEN.LIFESTYLE,
            '<div>' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Almost Done</p>' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">LIFESTYLE SNAPSHOT</h2>' +
                '<p class="text-brand-gray font-light mb-8">A few quick context questions.</p>' +
                '<div class="bg-white/5 rounded-sm p-6">' +
                    toggle('exercise', 'I exercise at least 3x per week') +
                    toggle('sleep', 'I typically sleep 7+ hours') +
                    toggle('tested', 'I\'ve had my hormones tested before') +
                '</div>' +
                '<div class="flex justify-between items-center mt-8">' +
                    '<button type="button" class="text-brand-gray text-sm hover:text-brand-light transition quiz-back-btn" data-to="' + SCREEN.INTERSTITIAL_3 + '">\u2190 Back</button>' +
                    '<button type="button" class="btn-primary quiz-lifestyle-next" data-to="' + SCREEN.READINESS + '">Next \u2192</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildReadiness() {
        var btns = '';
        for (var i = 0; i < readinessOptions.length; i++) {
            btns += '<button type="button" class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium text-left w-full hover:border-brand-gray/40" data-readiness="' + readinessOptions[i].key + '">' + readinessOptions[i].label + '</button>';
        }
        return screenWrap(SCREEN.READINESS,
            '<div class="text-center">' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">If testing showed something actionable, how likely are you to address it?</h2>' +
                '<p class="text-brand-gray font-light mb-10">No wrong answer here.</p>' +
                '<div class="flex flex-col gap-3 max-w-md mx-auto">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildEmailCapture() {
        return screenWrap(SCREEN.EMAIL,
            '<div class="text-center">' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">Your personalized results are ready.</h2>' +
                '<p class="text-brand-gray font-light mb-8">We\'ll send your results to this email. No spam. Unsubscribe anytime.</p>' +
                '<div class="max-w-sm mx-auto space-y-4">' +
                    '<input type="text" id="quiz-name" placeholder="First name (optional)" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<input type="email" id="quiz-email" placeholder="Email address" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<p id="quiz-email-error" class="text-red-500 text-xs text-left hidden">Please enter a valid email address.</p>' +
                    '<button type="button" id="quiz-submit-email" class="btn-primary w-full py-3">See My Results</button>' +
                '</div>' +
                '<div class="flex justify-start mt-6">' +
                    '<button type="button" class="text-brand-gray text-sm hover:text-brand-light transition quiz-back-btn" data-to="' + SCREEN.READINESS + '">\u2190 Back</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildCalculating() {
        var markers = '';
        for (var i = 0; i < calculatingMarkers.length; i++) {
            markers += '<div class="calculating-marker flex items-center gap-3 py-2 opacity-0" data-marker-idx="' + i + '">' +
                '<div class="calculating-check w-6 h-6 rounded-full border-2 border-brand-gray/30 flex items-center justify-center flex-shrink-0">' +
                    '<svg class="w-4 h-4 text-brand-gray opacity-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' +
                '</div>' +
                '<span class="text-brand-gray text-sm font-medium">' + calculatingMarkers[i] + '</span>' +
            '</div>';
        }
        return screenWrap(SCREEN.CALCULATING,
            '<div class="text-center">' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">Analyzing Your Responses</h2>' +
                '<p class="text-brand-gray font-light mb-10">Evaluating across 8 hormone health markers...</p>' +
                '<div class="max-w-sm mx-auto text-left">' + markers + '</div>' +
            '</div>'
        );
    }

    function buildResultsShell() {
        return '<div class="quiz-screen flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + SCREEN.RESULTS + '">' +
            '<div class="max-w-2xl w-full" id="quiz-results-inner"></div></div>';
    }

    // ── Populate Gender-Specific Symptom Items ──────────────────────────

    function populateSymptomItems(groupKey) {
        var container = document.getElementById('symptom-group-' + groupKey);
        if (!container) return;

        var items = getSymptoms(groupKey);
        var rows = '';

        for (var i = 0; i < items.length; i++) {
            var pills = '';
            for (var s = 0; s < severityOptions.length; s++) {
                var opt = severityOptions[s];
                var selected = state.answers[groupKey + '_' + i] === opt.value;
                pills += '<button type="button" class="severity-pill border border-white/20 rounded-sm px-3 py-2 text-xs text-brand-gray font-medium" ' +
                    'data-group="' + groupKey + '" data-item="' + i + '" data-level="' + opt.value + '" data-selected="' + selected + '">' +
                    opt.label + '</button>';
            }
            rows += '<div class="mb-6">' +
                '<p class="text-brand-light text-sm font-medium mb-3">' + items[i] + '</p>' +
                '<div class="grid grid-cols-4 gap-2">' + pills + '</div>' +
            '</div>';
        }

        container.innerHTML = rows;
    }

    function updateInterstitial1() {
        var el = document.getElementById('interstitial-1-text');
        if (el && state.gender) {
            el.textContent = interstitials.screen4[state.gender];
        }
    }

    // ── Results Renderer ───────────────────────────────────────────────

    function renderResults() {
        var scores = computeScores();
        var result = scores.classification;
        var gender = state.gender || 'male';

        // Level color
        var levelColor = '#B2BFBE';
        if (result.level === 'Moderate') levelColor = '#ca8a04';
        else if (result.level === 'Elevated') levelColor = '#ea580c';
        else if (result.level === 'High') levelColor = '#dc2626';

        // Find top category
        var sorted = scores.categories.slice().sort(function(a, b) { return b.score - a.score; });
        var topCategory = sorted[0];

        var html = '';

        // ── Overall Score ──────────────────────────────────────────────
        html += '<div class="text-center mb-10">' +
            '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Your Results</p>' +
            '<h2 class="text-4xl font-bold text-brand-light mb-6 font-heading">HORMONE HEALTH SCORE</h2>' +
            '<div class="result-score-ring mx-auto mb-6">' +
                '<svg viewBox="0 0 120 120" width="160" height="160">' +
                    '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"></circle>' +
                    '<circle cx="60" cy="60" r="52" fill="none" stroke="' + levelColor + '" stroke-width="8" ' +
                        'stroke-dasharray="' + Math.round(326.7 * scores.score / 100) + ' 326.7" ' +
                        'stroke-linecap="round" transform="rotate(-90 60 60)" class="score-ring-fill"></circle>' +
                    '<text x="60" y="55" text-anchor="middle" fill="' + levelColor + '" font-size="32" font-weight="bold">' + scores.score + '</text>' +
                    '<text x="60" y="72" text-anchor="middle" fill="#B2BFBE" font-size="12">/100</text>' +
                '</svg>' +
            '</div>' +
            '<span class="inline-block px-4 py-1 rounded-sm text-sm font-bold" style="background:' + levelColor + '; color:#101921">' + result.level.toUpperCase() + '</span>' +
        '</div>';

        // ── Personalized Summary ───────────────────────────────────────
        html += '<div class="bg-white/5 rounded-sm p-6 mb-8 text-center">' +
            '<p class="text-brand-gray font-light">Your responses suggest multiple areas where hormone optimization could make a meaningful difference \u2014 especially in <strong class="text-brand-light">' + topCategory.label + '</strong>.</p>' +
        '</div>';

        // ── Top 3 Areas ────────────────────────────────────────────────
        html += '<div class="mb-8">' +
            '<h3 class="text-brand-light font-bold mb-4">YOUR TOP AREAS</h3>';
        for (var t = 0; t < sorted.length; t++) {
            var cat = sorted[t];
            var pct = cat.max > 0 ? Math.round((cat.score / cat.max) * 100) : 0;
            var barColor = pct <= 33 ? '#4b5563' : pct <= 66 ? '#ca8a04' : '#dc2626';
            var insight = categoryInsights[gender][cat.key] || '';
            html += '<div class="bg-white/5 rounded-sm p-6 mb-3">' +
                '<div class="flex justify-between text-sm mb-2">' +
                    '<span class="text-brand-light font-bold">' + cat.label + '</span>' +
                    '<span class="text-brand-light font-medium">' + pct + '%</span>' +
                '</div>' +
                '<div class="w-full bg-white/10 rounded-sm overflow-hidden mb-3" style="height:8px">' +
                    '<div class="result-bar" style="width:' + pct + '%; background:' + barColor + '"></div>' +
                '</div>' +
                '<p class="text-brand-gray font-light text-sm">' + insight + '</p>' +
            '</div>';
        }
        html += '</div>';

        // ── THE GAP Section ────────────────────────────────────────────
        var gapIntro = gender === 'male'
            ? 'Men with your profile who addressed their hormone levels reported:'
            : 'Women with your profile who optimized their hormones reported:';
        var gapItems = gapStats[gender];

        html += '<div class="bg-white/5 rounded-sm p-6 mb-8">' +
            '<h3 class="text-brand-light font-bold mb-4">THE GAP</h3>' +
            '<p class="text-brand-gray font-light text-sm mb-4">' + gapIntro + '</p>';
        for (var g = 0; g < gapItems.length; g++) {
            html += '<div class="gap-check flex items-start gap-3 mb-3">' +
                '<svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' +
                '<span class="text-brand-gray text-sm font-light">' + gapItems[g] + '</span>' +
            '</div>';
        }
        html += '</div>';

        // ── WHAT'S NEXT ────────────────────────────────────────────────
        html += '<div class="bg-brand-slate rounded-sm p-8 mb-8 text-center">' +
            '<h3 class="text-brand-light font-bold mb-4">WHAT\'S NEXT</h3>' +
            '<p class="text-brand-gray font-light mb-2">A quiz can only tell you so much. Blood work tells the whole story.</p>' +
            '<p class="text-brand-gray font-light text-sm mb-8">Your quiz results will be reviewed by our clinical team before your first visit.</p>' +
            '<a href="/medical/" class="btn-primary text-lg px-10 py-4 inline-block quiz-cta" data-cta="book_consultation">BOOK YOUR FREE CONSULTATION</a>' +
            '<p class="text-brand-gray/60 text-xs mt-4">We have limited consultation slots available this week.</p>' +
        '</div>';

        // ── Keep Learning ──────────────────────────────────────────────
        var learnLinks = '';
        if (gender === 'male') {
            learnLinks = '<a href="/learn/low-testosterone-symptoms/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Low T Symptoms \u2192</a>' +
                '<a href="/learn/sleep-optimization/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Sleep Optimization \u2192</a>' +
                '<a href="/medical/mens-hormones/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Men\'s Hormone Program \u2192</a>';
        } else {
            learnLinks = '<a href="/learn/menopause-perimenopause/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Menopause Guide \u2192</a>' +
                '<a href="/learn/progesterone/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Progesterone \u2192</a>' +
                '<a href="/learn/testosterone-for-women/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Testosterone for Women \u2192</a>';
        }
        html += '<div class="text-center mb-8">' +
            '<p class="text-brand-gray text-xs uppercase tracking-widest mb-3">Keep Learning</p>' +
            '<div class="flex flex-wrap justify-center gap-2">' + learnLinks + '</div>' +
        '</div>';

        document.getElementById('quiz-results-inner').innerHTML = html;

        // Animate bars after render
        setTimeout(function() {
            var bars = document.querySelectorAll('.result-bar');
            for (var i = 0; i < bars.length; i++) {
                bars[i].style.width = bars[i].style.width;
            }
        }, 100);
    }

    // ── Calculating Animation ───────────────────────────────────────────

    function runCalculatingAnimation(callback) {
        var markers = root.querySelectorAll('.calculating-marker');
        var delay = 400; // ms between each marker
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

    // ── Build & Bind ──────────────────────────────────────────────────

    function buildAllScreens() {
        var html = '';
        html += buildWelcome();
        html += buildGender();
        html += buildAge();
        html += buildPrimaryConcern();
        html += buildInterstitial1();
        html += buildSymptomGroup(SCREEN.SYMPTOM_1, 'energy_physical', 1);
        html += buildSymptomGroup(SCREEN.SYMPTOM_2, 'mental_mood', 2);
        html += buildInterstitial2();
        html += buildSymptomGroup(SCREEN.SYMPTOM_3, 'sleep_sexual', 3);
        html += buildDuration();
        html += buildInterstitial3();
        html += buildLifestyle();
        html += buildReadiness();
        html += buildEmailCapture();
        html += buildCalculating();
        html += buildResultsShell();

        root.innerHTML = html;
    }

    function bindAll() {
        // Welcome
        var startBtn = document.getElementById('quiz-start-btn');
        if (startBtn) startBtn.addEventListener('click', function() {
            ga('quiz_start', { page: '/quiz/' });
            show(SCREEN.GENDER);
        });

        // Use delegated event handling on root for most interactions
        root.addEventListener('click', function(e) {
            var target = e.target;

            // Gender cards (auto-advance)
            var genderCard = target.closest('[data-gender]');
            if (genderCard) {
                state.gender = genderCard.getAttribute('data-gender');
                var allG = root.querySelectorAll('[data-gender]');
                for (var j = 0; j < allG.length; j++) allG[j].classList.remove('selected');
                genderCard.classList.add('selected');
                ga('quiz_gender', { value: state.gender });
                // Populate gender-specific content
                updateInterstitial1();
                populateSymptomItems('energy_physical');
                populateSymptomItems('mental_mood');
                populateSymptomItems('sleep_sexual');
                // Re-bind severity pills after populating
                bindSeverityPills();
                setTimeout(function() { show(SCREEN.AGE); }, 400);
                return;
            }

            // Age cards (auto-advance)
            var ageCard = target.closest('[data-age]');
            if (ageCard) {
                state.age = ageCard.getAttribute('data-age');
                var allA = root.querySelectorAll('[data-age]');
                for (var k = 0; k < allA.length; k++) allA[k].classList.remove('selected');
                ageCard.classList.add('selected');
                ga('quiz_age', { value: state.age });
                setTimeout(function() { show(SCREEN.PRIMARY_CONCERN); }, 400);
                return;
            }

            // Primary concern (auto-advance)
            var concernCard = target.closest('[data-concern]');
            if (concernCard) {
                state.primaryConcern = concernCard.getAttribute('data-concern');
                var allC = root.querySelectorAll('[data-concern]');
                for (var m = 0; m < allC.length; m++) allC[m].classList.remove('selected');
                concernCard.classList.add('selected');
                ga('quiz_primary_concern', { value: state.primaryConcern });
                setTimeout(function() { show(SCREEN.INTERSTITIAL_1); }, 400);
                return;
            }

            // Duration (auto-advance)
            var durationCard = target.closest('[data-duration]');
            if (durationCard) {
                state.duration = durationCard.getAttribute('data-duration');
                var allD = root.querySelectorAll('[data-duration]');
                for (var d = 0; d < allD.length; d++) allD[d].classList.remove('selected');
                durationCard.classList.add('selected');
                ga('quiz_duration', { value: state.duration });
                setTimeout(function() { show(SCREEN.INTERSTITIAL_3); }, 400);
                return;
            }

            // Readiness (auto-advance)
            var readinessCard = target.closest('[data-readiness]');
            if (readinessCard) {
                state.readiness = readinessCard.getAttribute('data-readiness');
                var allR = root.querySelectorAll('[data-readiness]');
                for (var r = 0; r < allR.length; r++) allR[r].classList.remove('selected');
                readinessCard.classList.add('selected');
                ga('quiz_readiness', { value: state.readiness });
                setTimeout(function() { show(SCREEN.EMAIL); }, 400);
                return;
            }

            // Continue buttons (interstitials)
            var continueBtn = target.closest('.quiz-continue-btn');
            if (continueBtn) {
                var toScreen = parseInt(continueBtn.getAttribute('data-to'), 10);
                show(toScreen);
                return;
            }

            // Symptom Next buttons
            var symptomNext = target.closest('.quiz-symptom-next');
            if (symptomNext && !symptomNext.disabled) {
                var groupKey = symptomNext.getAttribute('data-group');
                var toIdx = parseInt(symptomNext.getAttribute('data-to'), 10);
                ga('quiz_symptom_complete', { group: groupKey });
                show(toIdx);
                return;
            }

            // Back buttons
            var backBtn = target.closest('.quiz-back-btn');
            if (backBtn) {
                var backTo = parseInt(backBtn.getAttribute('data-to'), 10);
                show(backTo);
                return;
            }

            // Toggle switches
            var track = target.closest('.toggle-track');
            if (track) {
                var toggleKey = track.getAttribute('data-toggle');
                state.lifestyle[toggleKey] = !state.lifestyle[toggleKey];
                track.classList.toggle('on', state.lifestyle[toggleKey]);
                return;
            }

            // Lifestyle next
            var lifestyleNext = target.closest('.quiz-lifestyle-next');
            if (lifestyleNext) {
                ga('quiz_step', { step: 'lifestyle' });
                show(SCREEN.READINESS);
                return;
            }

            // Results CTAs
            var cta = target.closest('.quiz-cta');
            if (cta) {
                var ctaName = cta.getAttribute('data-cta');
                ga('quiz_cta_click', { cta_name: ctaName, page: '/quiz/' });
                return;
            }
        });

        // Email submit
        var submitBtn = document.getElementById('quiz-submit-email');
        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                var nameInput = document.getElementById('quiz-name');
                var emailInput = document.getElementById('quiz-email');
                var errorEl = document.getElementById('quiz-email-error');
                state.name = (nameInput.value || '').trim();
                state.email = (emailInput.value || '').trim();

                // Validate email
                if (!state.email || state.email.indexOf('@') === -1 || state.email.indexOf('.') === -1) {
                    emailInput.style.borderColor = '#dc2626';
                    if (errorEl) errorEl.classList.remove('hidden');
                    emailInput.focus();
                    return;
                }

                // Clear error state
                emailInput.style.borderColor = '';
                if (errorEl) errorEl.classList.add('hidden');

                ga('quiz_email_submit', { page: '/quiz/' });

                // Fire-and-forget: submit data then show calculating
                sendResults();
                showCalculating();
            });
        }
    }

    function bindSeverityPills() {
        // Use delegated handler — already bound on root, but we need specific pill logic
        // This is handled via the root click listener below
    }

    // Severity pill handler — needs to be in the root delegated listener
    // We add it separately since pills are populated dynamically
    function handleSeverityPill(pill) {
        var groupKey = pill.getAttribute('data-group');
        var item = pill.getAttribute('data-item');
        var level = parseInt(pill.getAttribute('data-level'), 10);

        state.answers[groupKey + '_' + item] = level;

        // Update UI: deselect siblings, select this
        var row = pill.parentElement;
        var siblings = row.querySelectorAll('.severity-pill');
        for (var s = 0; s < siblings.length; s++) {
            siblings[s].setAttribute('data-selected', 'false');
        }
        pill.setAttribute('data-selected', 'true');

        // Check if all items in this group are answered to enable Next
        var screen = pill.closest('.quiz-screen');
        var nextBtn = screen.querySelector('.quiz-symptom-next');
        if (nextBtn) {
            var gk = nextBtn.getAttribute('data-group');
            if (allGroupAnswered(gk)) {
                nextBtn.classList.remove('opacity-40', 'pointer-events-none');
                nextBtn.disabled = false;
            }
        }

        saveState();
    }

    // Add severity pill click handler to root
    function bindSeverityPillDelegation() {
        root.addEventListener('click', function(e) {
            var pill = e.target.closest('.severity-pill');
            if (pill) {
                handleSeverityPill(pill);
            }
        });
    }

    // ── Calculating & Results Flow ─────────────────────────────────────

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
            ga('quiz_results_view', {
                gender: state.gender,
                age: state.age,
                score: computeScores().score,
                classification: computeScores().classification.level
            });
            show(SCREEN.RESULTS);
            progressBar.style.width = '100%';
            clearSavedState();
        });
    }

    // ── Email Submission ────────────────────────────────────────────────

    function sendResults() {
        var scores = computeScores();

        var payload = {
            name: state.name || null,
            email: state.email,
            gender: state.gender,
            age: state.age,
            primaryConcern: state.primaryConcern,
            score: scores.score,
            rawScore: scores.rawScore,
            maxRawScore: scores.maxRawScore,
            classification: scores.classification.level,
            categories: scores.categories,
            duration: state.duration,
            readiness: state.readiness,
            lifestyle: state.lifestyle
        };

        fetch('/.netlify/functions/quiz-submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(function() {
            // Fire-and-forget: don't block on failure
        });
    }

    // ── Restore from Saved State ─────────────────────────────────────

    function restoreQuiz() {
        var saved = loadSavedState();

        buildAllScreens();
        bindAll();
        bindSeverityPillDelegation();

        if (!saved || !saved.gender) {
            show(SCREEN.WELCOME);
            return;
        }

        // Restore state
        state.gender = saved.gender;
        state.age = saved.age;
        state.primaryConcern = saved.primaryConcern;
        state.answers = saved.answers || {};
        state.duration = saved.duration;
        state.readiness = saved.readiness;
        state.lifestyle = saved.lifestyle || { exercise: false, sleep: false, tested: false };
        state.name = saved.name || '';
        state.email = saved.email || '';

        // Populate gender-specific content
        updateInterstitial1();
        populateSymptomItems('energy_physical');
        populateSymptomItems('mental_mood');
        populateSymptomItems('sleep_sexual');

        // Rehydrate UI: gender
        var genderCard = root.querySelector('[data-gender="' + state.gender + '"]');
        if (genderCard) genderCard.classList.add('selected');

        // Rehydrate UI: age
        if (state.age) {
            var ageCard = root.querySelector('[data-age="' + state.age + '"]');
            if (ageCard) ageCard.classList.add('selected');
        }

        // Rehydrate UI: primary concern
        if (state.primaryConcern) {
            var concernCard = root.querySelector('[data-concern="' + state.primaryConcern + '"]');
            if (concernCard) concernCard.classList.add('selected');
        }

        // Rehydrate UI: duration
        if (state.duration) {
            var durationCard = root.querySelector('[data-duration="' + state.duration + '"]');
            if (durationCard) durationCard.classList.add('selected');
        }

        // Rehydrate UI: readiness
        if (state.readiness) {
            var readinessCard = root.querySelector('[data-readiness="' + state.readiness + '"]');
            if (readinessCard) readinessCard.classList.add('selected');
        }

        // Rehydrate symptom severity pills (already populated with correct state above)

        // Enable next buttons for completed symptom groups
        var groups = ['energy_physical', 'mental_mood', 'sleep_sexual'];
        for (var c = 0; c < groups.length; c++) {
            if (allGroupAnswered(groups[c])) {
                var nextBtn = root.querySelector('.quiz-symptom-next[data-group="' + groups[c] + '"]');
                if (nextBtn) {
                    nextBtn.classList.remove('opacity-40', 'pointer-events-none');
                    nextBtn.disabled = false;
                }
            }
        }

        // Rehydrate lifestyle toggles
        for (var lk in state.lifestyle) {
            if (state.lifestyle[lk]) {
                var track = root.querySelector('.toggle-track[data-toggle="' + lk + '"]');
                if (track) track.classList.add('on');
            }
        }

        // Rehydrate name/email
        if (state.name) {
            var nameInput = document.getElementById('quiz-name');
            if (nameInput) nameInput.value = state.name;
        }
        if (state.email) {
            var emailInput = document.getElementById('quiz-email');
            if (emailInput) emailInput.value = state.email;
        }

        // Determine which screen to show
        var targetScreen = saved.currentScreen || 0;

        // Don't restore to calculating or results — go to email instead
        if (targetScreen >= SCREEN.CALCULATING) {
            targetScreen = SCREEN.EMAIL;
        }

        show(targetScreen);
    }

    // ── Init ─────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreQuiz);
    } else {
        restoreQuiz();
    }

})();
