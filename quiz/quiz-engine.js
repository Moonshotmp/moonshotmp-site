/*
 * Moonshot Hormone Health Quiz Engine
 * ====================================
 * Typeform-style one-question-at-a-time flow.
 * Vanilla JS IIFE — no dependencies.
 */
(function() {
    'use strict';

    // ── Question Data ───────────────────────────────────────────────────

    var maleCategories = [
        {
            key: 'energy',
            label: 'Energy & Fatigue',
            intro: 'Not just tiredness \u2014 the kind where coffee stopped working.',
            items: [
                'Persistent fatigue despite sleep',
                'Low motivation or drive',
                'Afternoon energy crashes'
            ]
        },
        {
            key: 'mental',
            label: 'Mental Clarity',
            intro: 'Your brain used to be sharper. Sound familiar?',
            items: [
                'Brain fog or difficulty concentrating',
                'Forgetfulness / poor short-term memory',
                'Difficulty making decisions'
            ]
        },
        {
            key: 'mood',
            label: 'Mood',
            intro: 'Mood shifts that don\u2019t match what\u2019s actually happening.',
            items: [
                'Irritability or short temper',
                'Feeling down, flat, or unmotivated',
                'Increased anxiety or restlessness'
            ]
        },
        {
            key: 'sleep',
            label: 'Sleep',
            intro: 'Sleep is supposed to recharge you. Is it?',
            items: [
                'Difficulty falling asleep',
                'Waking during the night',
                'Waking up feeling unrefreshed'
            ]
        },
        {
            key: 'body',
            label: 'Body Composition',
            intro: 'Your body is changing in ways that don\u2019t match your effort.',
            items: [
                'Gaining fat despite exercise/diet',
                'Difficulty building/maintaining muscle',
                'Decreased stamina or endurance'
            ]
        },
        {
            key: 'sexual',
            label: 'Sexual Health',
            intro: 'This one matters more than most guys admit.',
            items: [
                'Decreased libido',
                'Erectile difficulty or reduced quality',
                'Reduced satisfaction or performance'
            ]
        },
        {
            key: 'physical',
            label: 'Physical',
            intro: 'Some of these get blamed on \u201Caging.\u201D They shouldn\u2019t be.',
            items: [
                'Joint pain or stiffness',
                'Temperature issues / sweating',
                'Hair thinning or loss'
            ]
        },
        {
            key: 'recovery',
            label: 'Recovery',
            intro: 'How well does your body bounce back?',
            items: [
                'Slow recovery from workouts',
                'Getting sick more often',
                'Slow wound/injury healing'
            ]
        }
    ];

    var femaleCategories = [
        {
            key: 'energy',
            label: 'Energy & Fatigue',
            intro: 'Not just tired \u2014 the bone-deep exhaustion that sleep doesn\u2019t fix.',
            items: [
                'Persistent fatigue or exhaustion',
                'Low motivation or feeling flat',
                'Physical or mental burnout'
            ]
        },
        {
            key: 'temperature',
            label: 'Hot Flashes & Temperature',
            intro: 'Your internal thermostat has a mind of its own.',
            items: [
                'Hot flashes or sudden warmth',
                'Night sweats',
                'Chills or temperature sensitivity'
            ]
        },
        {
            key: 'sleep',
            label: 'Sleep',
            intro: 'When sleep stops being restful, everything else suffers.',
            items: [
                'Difficulty falling asleep',
                'Waking at 2\u20134 AM',
                'Waking up exhausted'
            ]
        },
        {
            key: 'mood',
            label: 'Mood',
            intro: 'Mood swings, anxiety, feeling unlike yourself.',
            items: [
                'Mood swings / emotional volatility',
                'Anxiety or inner restlessness',
                'Feeling depressed or tearful',
                'Irritability or short fuse'
            ]
        },
        {
            key: 'mental',
            label: 'Mental Clarity',
            intro: 'The word is right there and you just can\u2019t find it.',
            items: [
                'Brain fog',
                'Forgetfulness / losing train of thought',
                'Difficulty with word recall'
            ]
        },
        {
            key: 'sexual',
            label: 'Sexual Health',
            intro: 'These changes are common but not something you have to accept.',
            items: [
                'Decreased libido',
                'Vaginal dryness or discomfort',
                'Pain during intercourse'
            ]
        },
        {
            key: 'body',
            label: 'Body & Physical',
            intro: 'When your body stops responding the way it used to.',
            items: [
                'Weight gain (especially midsection)',
                'Difficulty losing weight despite effort',
                'Joint pain/stiffness/muscle aches',
                'Hair thinning or skin changes'
            ]
        },
        {
            key: 'bladder',
            label: 'Bladder & Other',
            intro: 'Small things that add up to a big quality-of-life hit.',
            items: [
                'Urinary urgency or frequency',
                'Bladder leakage',
                'Heart palpitations or racing heart'
            ]
        }
    ];

    var severityOptions = [
        { value: 0, label: 'Not me' },
        { value: 1, label: 'Mild' },
        { value: 2, label: 'Moderate' },
        { value: 3, label: 'Severe' }
    ];

    var ageRanges = ['Under 30', '30\u201339', '40\u201349', '50\u201359', '60+'];

    // Results blurbs
    var maleBlurbs = {
        energy:   { text: 'Persistent fatigue is one of the most common signs of low testosterone. T plays a direct role in mitochondrial energy production and red blood cell formation.', link: '/learn/low-testosterone-symptoms/' },
        mental:   { text: 'Brain fog and poor memory are well-documented effects of low T. Testosterone supports neurotransmitter function and cerebral blood flow.', link: '/learn/low-testosterone-symptoms/' },
        mood:     { text: 'Testosterone directly influences serotonin and dopamine pathways. Low levels are associated with irritability, depression, and anxiety. Not a character flaw \u2014 biochemistry.', link: '/learn/low-testosterone-symptoms/' },
        sleep:    { text: 'Low T disrupts sleep architecture, and poor sleep further suppresses T. Breaking this cycle often requires addressing the hormonal component.', link: '/learn/sleep-optimization/' },
        body:     { text: 'Testosterone is your body\u2019s primary muscle-building and fat-regulating hormone. When levels decline, you store more fat and lose muscle regardless of effort.', link: '/medical/mens-hormones/' },
        sexual:   { text: 'Libido and erectile function are among the most testosterone-sensitive functions. Often the first noticeable sign of declining hormone levels.', link: '/medical/mens-hormones/' },
        physical: { text: 'Joint pain, temperature dysregulation, and hair changes can all have hormonal roots. T supports collagen synthesis and thermoregulation.', link: '/medical/mens-hormones/' },
        recovery: { text: 'Testosterone is essential for tissue repair, immune function, and workout recovery. Slow healing can indicate hormonal deficiency.', link: '/medical/mens-hormones/' }
    };

    var femaleBlurbs = {
        energy:      { text: 'Fatigue in women is frequently tied to declining estrogen, progesterone, or thyroid. These hormones directly regulate cellular energy production.', link: '/learn/menopause-perimenopause/' },
        temperature: { text: 'Hot flashes and night sweats are the hallmark of estrogen decline \u2014 caused by disruption of your hypothalamic thermostat. BHRT is the most effective treatment.', link: '/learn/menopause-perimenopause/' },
        sleep:       { text: 'Sleep disruption in women is strongly linked to progesterone decline. Progesterone has natural calming, GABA-enhancing properties.', link: '/learn/progesterone/' },
        mood:        { text: 'Estrogen and progesterone both influence serotonin, GABA, and dopamine. Hormonal shifts can cause mood swings and anxiety that feel completely out of character.', link: '/learn/menopause-perimenopause/' },
        mental:      { text: 'Estrogen supports acetylcholine and cerebral blood flow. When it declines, brain fog and word-finding difficulty follow. Often a treatable hormonal issue \u2014 not early dementia.', link: '/learn/estrogen-dominance/' },
        sexual:      { text: 'Vaginal dryness, low libido, and painful intercourse are caused by declining estrogen and testosterone. Both are critical for female sexual health and are treatable.', link: '/learn/testosterone-for-women/' },
        body:        { text: 'Estrogen regulates where your body stores fat. As it declines, fat shifts to the midsection. Add declining testosterone and muscle loss accelerates.', link: '/learn/testosterone-for-women/' },
        bladder:     { text: 'Estrogen maintains urinary tract tissues and pelvic floor. Declining levels lead to urgency, frequency, and incontinence. Heart palpitations can also be estrogen-mediated.', link: '/learn/menopause-perimenopause/' }
    };

    // Result page mapping
    var maleResultPages = {
        energy: '/quiz/results/low-testosterone-fatigue/',
        recovery: '/quiz/results/low-testosterone-fatigue/',
        mental: '/quiz/results/low-testosterone-brain-fog/',
        mood: '/quiz/results/low-testosterone-brain-fog/',
        sleep: '/quiz/results/testosterone-sleep-problems/',
        body: '/quiz/results/low-testosterone-body-changes/',
        physical: '/quiz/results/low-testosterone-body-changes/',
        sexual: '/quiz/results/low-testosterone-sexual-health/'
    };

    var femaleResultPages = {
        energy: '/quiz/results/hormone-imbalance-fatigue-women/',
        temperature: '/quiz/results/menopause-hot-flashes/',
        sleep: '/quiz/results/hormone-sleep-mood-women/',
        mood: '/quiz/results/hormone-sleep-mood-women/',
        mental: '/quiz/results/hormone-brain-fog-women/',
        body: '/quiz/results/hormone-body-changes-women/',
        sexual: '/quiz/results/hormone-body-changes-women/',
        bladder: '/quiz/results/hormone-body-changes-women/'
    };

    // Score classifications
    function classify(score) {
        if (score <= 10) return { level: 'Low', summary: 'Minimal hormonal impact. Baseline testing is still valuable for prevention and establishing your personal benchmarks.' };
        if (score <= 25) return { level: 'Moderate', summary: 'Your hormones may not be performing at their best. Blood work would clarify what\u2019s going on and whether optimization could help.' };
        if (score <= 45) return { level: 'Elevated', summary: 'Multiple categories are lining up \u2014 this strongly suggests a hormonal component. The good news: these patterns are highly treatable once we know your numbers.' };
        return { level: 'High', summary: 'Significant impact across multiple areas. This is consistent with meaningful hormonal decline \u2014 and highly treatable once we get your blood work.' };
    }

    // ── State ────────────────────────────────────────────────────────────

    var state = {
        currentScreen: 0,
        gender: null,       // 'male' | 'female'
        age: null,
        answers: {},        // { 'energy_0': 2, 'energy_1': 1, ... }
        lifestyle: { exercise: false, sleep: false, tested: false },
        name: '',
        email: '',
        totalScreens: 0
    };

    // Total screens: welcome(1) + gender(1) + age(1) + 8 symptom + lifestyle(1) + email(1) + results(1) = 14
    // Progress only counts up through email capture (screen 12 of 13 zero-indexed), results is final

    var root = document.getElementById('quiz-root');
    var progressBar = document.getElementById('quiz-progress-bar');

    // ── Helpers ──────────────────────────────────────────────────────────

    function ga(event, params) {
        if (window.gtag) window.gtag('event', event, params || {});
    }

    function getCategories() {
        return state.gender === 'female' ? femaleCategories : maleCategories;
    }

    function getBlurbs() {
        return state.gender === 'female' ? femaleBlurbs : maleBlurbs;
    }

    function updateProgress() {
        // 13 screens before results: 0=welcome, 1=gender, 2=age, 3-10=symptoms, 11=lifestyle, 12=email
        var total = 13;
        var pct = Math.min(100, Math.round((state.currentScreen / total) * 100));
        progressBar.style.width = pct + '%';
    }

    function show(screenIndex) {
        state.currentScreen = screenIndex;
        updateProgress();
        var screens = root.querySelectorAll('.quiz-screen');
        for (var i = 0; i < screens.length; i++) {
            screens[i].classList.remove('active');
        }
        // Small delay for transition effect
        setTimeout(function() {
            var target = root.querySelector('[data-screen="' + screenIndex + '"]');
            if (target) target.classList.add('active');
        }, 30);
    }

    function screenWrap(index, inner) {
        return '<div class="quiz-screen flex items-center justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + index + '">' +
            '<div class="max-w-2xl w-full">' + inner + '</div></div>';
    }

    function allItemsAnswered(catIndex) {
        var cats = getCategories();
        var cat = cats[catIndex];
        for (var i = 0; i < cat.items.length; i++) {
            if (state.answers[cat.key + '_' + i] === undefined) return false;
        }
        return true;
    }

    // ── Screen Builders ─────────────────────────────────────────────────

    function buildWelcome() {
        return screenWrap(0,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-6">Free 2-Minute Assessment</p>' +
                '<h1 class="text-4xl md:text-5xl font-bold text-brand-light mb-6 font-heading">HOW ARE YOUR<br>HORMONES?</h1>' +
                '<p class="text-brand-gray text-lg font-light mb-10 max-w-lg mx-auto">Answer a few quick questions and get personalized insights about what your symptoms might mean.</p>' +
                '<button id="quiz-start-btn" class="btn-primary text-lg px-10 py-4">Let\u2019s Go</button>' +
                '<p class="text-brand-gray/50 text-xs mt-6">Not a medical diagnosis. For educational purposes only.</p>' +
            '</div>'
        );
    }

    function buildGender() {
        return screenWrap(1,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Step 1</p>' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">I AM</h2>' +
                '<p class="text-brand-gray font-light mb-10">This determines which symptom questions you\u2019ll see.</p>' +
                '<div class="grid grid-cols-2 gap-4 max-w-md mx-auto">' +
                    '<button class="quiz-card border border-white/10 rounded-sm p-8 text-center" data-gender="male">' +
                        '<span class="block text-4xl mb-3">&#9794;</span>' +
                        '<span class="text-brand-light font-bold text-lg">Male</span>' +
                    '</button>' +
                    '<button class="quiz-card border border-white/10 rounded-sm p-8 text-center" data-gender="female">' +
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
            btns += '<button class="quiz-card border border-white/10 rounded-sm px-6 py-4 text-brand-light font-medium hover:border-brand-gray/40" data-age="' + ageRanges[i] + '">' + ageRanges[i] + '</button>';
        }
        return screenWrap(2,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Step 2</p>' +
                '<h2 class="text-3xl font-bold text-brand-light mb-2 font-heading">AGE RANGE</h2>' +
                '<p class="text-brand-gray font-light mb-10">Helps us personalize your results.</p>' +
                '<div class="flex flex-wrap justify-center gap-3">' + btns + '</div>' +
            '</div>'
        );
    }

    function buildSymptomScreen(catIndex) {
        var cats = getCategories();
        var cat = cats[catIndex];
        var screenIdx = 3 + catIndex;
        var rows = '';

        for (var i = 0; i < cat.items.length; i++) {
            var pills = '';
            for (var s = 0; s < severityOptions.length; s++) {
                var opt = severityOptions[s];
                pills += '<button class="severity-pill border border-white/20 rounded-sm px-3 py-2 text-xs text-brand-gray font-medium" ' +
                    'data-cat="' + cat.key + '" data-item="' + i + '" data-level="' + opt.value + '" data-selected="false">' +
                    opt.label + '</button>';
            }
            rows += '<div class="mb-6">' +
                '<p class="text-brand-light text-sm font-medium mb-3">' + cat.items[i] + '</p>' +
                '<div class="grid grid-cols-4 gap-2">' + pills + '</div>' +
            '</div>';
        }

        return screenWrap(screenIdx,
            '<div>' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-2">Category ' + (catIndex + 1) + ' of 8</p>' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">' + cat.label.toUpperCase() + '</h2>' +
                '<p class="text-brand-gray font-light mb-8 italic">\u201C' + cat.intro + '\u201D</p>' +
                rows +
                '<div class="flex justify-between items-center mt-8">' +
                    '<button class="text-brand-gray text-sm hover:text-brand-light transition quiz-back-btn" data-to="' + (screenIdx - 1) + '">\u2190 Back</button>' +
                    '<button class="btn-primary quiz-next-btn opacity-40 pointer-events-none" data-from-cat="' + catIndex + '" data-to="' + (screenIdx + 1) + '" disabled>Next \u2192</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildLifestyle() {
        var screenIdx = 11;
        function toggle(id, label) {
            return '<div class="flex items-center justify-between py-4 border-b border-white/10">' +
                '<span class="text-brand-light text-sm font-medium">' + label + '</span>' +
                '<div class="toggle-track" data-toggle="' + id + '"><div class="toggle-knob"></div></div>' +
            '</div>';
        }
        return screenWrap(screenIdx,
            '<div>' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Almost Done</p>' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">LIFESTYLE</h2>' +
                '<p class="text-brand-gray font-light mb-8">A few quick context questions.</p>' +
                '<div class="bg-white/5 rounded-sm p-6">' +
                    toggle('exercise', 'I exercise at least 3x per week') +
                    toggle('sleep', 'I typically get 7+ hours of sleep') +
                    toggle('tested', 'I\u2019ve had my hormones tested before') +
                '</div>' +
                '<div class="flex justify-between items-center mt-8">' +
                    '<button class="text-brand-gray text-sm hover:text-brand-light transition quiz-back-btn" data-to="10">\u2190 Back</button>' +
                    '<button class="btn-primary quiz-lifestyle-next" data-to="12">Next \u2192</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildEmailCapture() {
        return screenWrap(12,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Optional</p>' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">GET YOUR RESULTS BY EMAIL</h2>' +
                '<p class="text-brand-gray font-light mb-8">We\u2019ll send a detailed breakdown with actionable tips. No spam.</p>' +
                '<div class="max-w-sm mx-auto space-y-4">' +
                    '<input type="text" id="quiz-name" placeholder="First name" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<input type="email" id="quiz-email" placeholder="Email address" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<button id="quiz-submit-email" class="btn-primary w-full py-3">See My Results</button>' +
                '</div>' +
                '<button id="quiz-skip-email" class="text-brand-gray/60 text-sm mt-4 hover:text-brand-gray transition inline-block">Skip & See Results</button>' +
                '<div class="flex justify-start mt-6">' +
                    '<button class="text-brand-gray text-sm hover:text-brand-light transition quiz-back-btn" data-to="11">\u2190 Back</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildResults() {
        // Placeholder — filled dynamically when shown
        return '<div class="quiz-screen flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="13">' +
            '<div class="max-w-2xl w-full" id="quiz-results-inner"></div></div>';
    }

    // ── Results Renderer ─────────────────────────────────────────────────

    function renderResults() {
        var cats = getCategories();
        var blurbs = getBlurbs();

        // Calculate category scores
        var catScores = [];
        var totalScore = 0;
        for (var c = 0; c < cats.length; c++) {
            var cat = cats[c];
            var catTotal = 0;
            var catMax = cat.items.length * 3;
            for (var i = 0; i < cat.items.length; i++) {
                var val = state.answers[cat.key + '_' + i] || 0;
                catTotal += val;
                totalScore += val;
            }
            catScores.push({ key: cat.key, label: cat.label, score: catTotal, max: catMax });
        }

        var result = classify(totalScore);
        var maxScore = state.gender === 'female' ? 72 : 66;

        // Sort categories by score descending for top 3
        var sorted = catScores.slice().sort(function(a, b) { return b.score - a.score; });
        var top3 = sorted.filter(function(c) { return c.score > 0; }).slice(0, 3);

        // Level color for results
        var levelColor = '#B2BFBE';
        if (result.level === 'Moderate') levelColor = '#ca8a04';
        else if (result.level === 'Elevated') levelColor = '#ea580c';
        else if (result.level === 'High') levelColor = '#dc2626';

        // Build HTML
        var html = '';

        // Score header
        html += '<div class="text-center mb-10">' +
            '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Your Results</p>' +
            '<h2 class="text-4xl font-bold text-brand-light mb-2 font-heading">HORMONE HEALTH SCORE</h2>' +
            '<div class="mt-6 mb-4">' +
                '<span class="text-6xl font-bold" style="color:' + levelColor + '">' + totalScore + '</span>' +
                '<span class="text-brand-gray text-xl">/' + maxScore + '</span>' +
            '</div>' +
            '<span class="inline-block px-4 py-1 rounded-sm text-sm font-bold" style="background:' + levelColor + '; color:#101921">' + result.level.toUpperCase() + '</span>' +
            '<p class="text-brand-gray font-light mt-6 max-w-lg mx-auto">' + result.summary + '</p>' +
        '</div>';

        // Category breakdown bars
        html += '<div class="bg-white/5 rounded-sm p-6 mb-8">' +
            '<h3 class="text-brand-light font-bold mb-4">CATEGORY BREAKDOWN</h3>';
        for (var b = 0; b < catScores.length; b++) {
            var cs = catScores[b];
            var pct = cs.max > 0 ? Math.round((cs.score / cs.max) * 100) : 0;
            var barColor = pct <= 33 ? '#4b5563' : pct <= 66 ? '#ca8a04' : '#dc2626';
            html += '<div class="mb-3">' +
                '<div class="flex justify-between text-sm mb-1">' +
                    '<span class="text-brand-gray">' + cs.label + '</span>' +
                    '<span class="text-brand-light font-medium">' + cs.score + '/' + cs.max + '</span>' +
                '</div>' +
                '<div class="w-full bg-white/10 rounded-sm overflow-hidden" style="height:8px">' +
                    '<div class="result-bar" style="width:' + pct + '%; background:' + barColor + '"></div>' +
                '</div>' +
            '</div>';
        }
        html += '</div>';

        // Result page link based on top category
        if (sorted.length > 0) {
            var resultPages = state.gender === 'female' ? femaleResultPages : maleResultPages;
            var topKey = sorted[0].key;
            var resultPageUrl = resultPages[topKey];
            if (resultPageUrl) {
                html += '<div class="mb-8 text-center">' +
                    '<a href="' + resultPageUrl + '" class="inline-block bg-brand-slate px-6 py-3 rounded-sm text-brand-light text-sm font-medium hover:bg-white/10 transition quiz-cta" data-cta="result_page">' +
                    'See your full results breakdown \u2192</a>' +
                '</div>';
            }
        }

        // Top category insights
        if (top3.length > 0) {
            html += '<div class="mb-8">' +
                '<h3 class="text-brand-light font-bold mb-4">YOUR TOP AREAS</h3>';
            for (var t = 0; t < top3.length; t++) {
                var cat = top3[t];
                var blurb = blurbs[cat.key];
                if (!blurb) continue;
                html += '<div class="bg-white/5 rounded-sm p-6 mb-3">' +
                    '<h4 class="text-brand-light font-bold text-sm uppercase tracking-wide mb-2">' + cat.label + '</h4>' +
                    '<p class="text-brand-gray font-light text-sm mb-3">' + blurb.text + '</p>' +
                    '<a href="' + blurb.link + '" class="text-brand-gray text-xs hover:text-brand-light transition">Learn more \u2192</a>' +
                '</div>';
            }
            html += '</div>';
        }

        // Next steps
        html += '<div class="bg-brand-slate rounded-sm p-8 mb-8">' +
            '<h3 class="text-brand-light font-bold mb-4">RECOMMENDED NEXT STEPS</h3>' +
            '<div class="space-y-4">' +
                '<a href="/medical/blood-panels/" class="block bg-brand-dark p-4 rounded-sm hover:bg-white/5 transition quiz-cta" data-cta="blood_panels">' +
                    '<span class="text-brand-light font-bold text-sm block">1. Get Comprehensive Blood Work</span>' +
                    '<span class="text-brand-gray text-xs">60+ biomarkers including full hormone, thyroid, metabolic, and nutrient panels.</span>' +
                '</a>' +
                '<a href="/booking/" class="block bg-brand-dark p-4 rounded-sm hover:bg-white/5 transition quiz-cta" data-cta="book_consultation">' +
                    '<span class="text-brand-light font-bold text-sm block">2. Book a Consultation</span>' +
                    '<span class="text-brand-gray text-xs">Review your results with our team and get a personalized plan.</span>' +
                '</a>' +
            '</div>' +
        '</div>';

        // Keep learning links
        var learnLinks = '';
        if (state.gender === 'male') {
            learnLinks = '<a href="/learn/low-testosterone-symptoms/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Low T Symptoms \u2192</a>' +
                '<a href="/learn/sleep-optimization/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Sleep Optimization \u2192</a>' +
                '<a href="/medical/mens-hormones/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Men\u2019s Hormone Program \u2192</a>';
        } else {
            learnLinks = '<a href="/learn/menopause-perimenopause/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Menopause Guide \u2192</a>' +
                '<a href="/learn/progesterone/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Progesterone \u2192</a>' +
                '<a href="/learn/testosterone-for-women/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Testosterone for Women \u2192</a>';
        }
        html += '<div class="text-center mb-8">' +
            '<p class="text-brand-gray text-xs uppercase tracking-widest mb-3">Keep Learning</p>' +
            '<div class="flex flex-wrap justify-center gap-2">' + learnLinks + '</div>' +
        '</div>';

        // Final CTA
        html += '<div class="text-center py-8 border-t border-white/10">' +
            '<p class="text-brand-gray font-light text-sm mb-4">Ready to find out what\u2019s really going on?</p>' +
            '<a href="/booking/" class="btn-primary text-lg px-8 py-4 quiz-cta" data-cta="book_final">Book Blood Work</a>' +
        '</div>';

        document.getElementById('quiz-results-inner').innerHTML = html;

        // Animate bars after render
        setTimeout(function() {
            var bars = document.querySelectorAll('.result-bar');
            for (var i = 0; i < bars.length; i++) {
                bars[i].style.width = bars[i].style.width; // trigger reflow
            }
        }, 100);
    }

    // ── Build All Screens ───────────────────────────────────────────────

    function buildQuiz() {
        // We build welcome, gender, age first. Symptom screens built after gender is selected.
        root.innerHTML = buildWelcome() + buildGender() + buildAge();
        bindWelcome();
        bindGender();
        bindAge();
        show(0);
    }

    function buildSymptomAndRemainingScreens() {
        // Remove any existing symptom/lifestyle/email/result screens
        var existing = root.querySelectorAll('[data-screen]');
        for (var i = 0; i < existing.length; i++) {
            var idx = parseInt(existing[i].getAttribute('data-screen'), 10);
            if (idx >= 3) existing[i].remove();
        }

        var cats = getCategories();
        var html = '';
        for (var c = 0; c < cats.length; c++) {
            html += buildSymptomScreen(c);
        }
        html += buildLifestyle();
        html += buildEmailCapture();
        html += buildResults();

        root.insertAdjacentHTML('beforeend', html);

        // Bind all new screens
        bindSymptomScreens();
        bindLifestyle();
        bindEmailCapture();
        bindResultsCTAs();
    }

    // ── Event Binding ───────────────────────────────────────────────────

    function bindWelcome() {
        var btn = document.getElementById('quiz-start-btn');
        if (btn) btn.addEventListener('click', function() {
            ga('quiz_start', { page: '/quiz/' });
            show(1);
        });
    }

    function bindGender() {
        var cards = root.querySelectorAll('[data-gender]');
        for (var i = 0; i < cards.length; i++) {
            cards[i].addEventListener('click', function() {
                state.gender = this.getAttribute('data-gender');
                // Visual feedback
                var all = root.querySelectorAll('[data-gender]');
                for (var j = 0; j < all.length; j++) all[j].classList.remove('selected');
                this.classList.add('selected');
                ga('quiz_step', { step: 'gender', value: state.gender });
                // Build remaining screens now that we know the path
                buildSymptomAndRemainingScreens();
                setTimeout(function() { show(2); }, 200);
            });
        }
    }

    function bindAge() {
        root.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-age]');
            if (!btn) return;
            state.age = btn.getAttribute('data-age');
            var all = root.querySelectorAll('[data-age]');
            for (var j = 0; j < all.length; j++) all[j].classList.remove('selected');
            btn.classList.add('selected');
            ga('quiz_step', { step: 'age', value: state.age });
            setTimeout(function() { show(3); }, 200);
        });
    }

    function bindSymptomScreens() {
        // Severity pills
        var pills = root.querySelectorAll('.severity-pill');
        for (var i = 0; i < pills.length; i++) {
            pills[i].addEventListener('click', function() {
                var cat = this.getAttribute('data-cat');
                var item = this.getAttribute('data-item');
                var level = parseInt(this.getAttribute('data-level'), 10);

                // Store answer
                state.answers[cat + '_' + item] = level;

                // Update UI: deselect siblings, select this
                var row = this.parentElement;
                var siblings = row.querySelectorAll('.severity-pill');
                for (var s = 0; s < siblings.length; s++) {
                    siblings[s].setAttribute('data-selected', 'false');
                }
                this.setAttribute('data-selected', 'true');

                // Check if all items in this category are answered to enable Next
                var screen = this.closest('.quiz-screen');
                var nextBtn = screen.querySelector('.quiz-next-btn');
                if (nextBtn) {
                    var catIdx = parseInt(nextBtn.getAttribute('data-from-cat'), 10);
                    if (allItemsAnswered(catIdx)) {
                        nextBtn.classList.remove('opacity-40', 'pointer-events-none');
                        nextBtn.disabled = false;
                    }
                }
            });
        }

        // Next buttons on symptom screens
        var nextBtns = root.querySelectorAll('.quiz-next-btn');
        for (var n = 0; n < nextBtns.length; n++) {
            nextBtns[n].addEventListener('click', function() {
                if (this.disabled) return;
                var to = parseInt(this.getAttribute('data-to'), 10);
                var catIdx = parseInt(this.getAttribute('data-from-cat'), 10);
                ga('quiz_step', { step: 'category_' + (catIdx + 1), category: getCategories()[catIdx].label });
                show(to);
            });
        }

        // Back buttons
        var backBtns = root.querySelectorAll('.quiz-back-btn');
        for (var b = 0; b < backBtns.length; b++) {
            backBtns[b].addEventListener('click', function() {
                var to = parseInt(this.getAttribute('data-to'), 10);
                show(to);
            });
        }
    }

    function bindLifestyle() {
        // Toggle switches
        root.addEventListener('click', function(e) {
            var track = e.target.closest('.toggle-track');
            if (!track) return;
            var key = track.getAttribute('data-toggle');
            state.lifestyle[key] = !state.lifestyle[key];
            track.classList.toggle('on', state.lifestyle[key]);
        });

        // Next button
        var nextBtn = root.querySelector('.quiz-lifestyle-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                ga('quiz_step', { step: 'lifestyle' });
                show(12);
            });
        }
    }

    function bindEmailCapture() {
        var submitBtn = document.getElementById('quiz-submit-email');
        var skipBtn = document.getElementById('quiz-skip-email');

        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                var nameInput = document.getElementById('quiz-name');
                var emailInput = document.getElementById('quiz-email');
                state.name = (nameInput.value || '').trim();
                state.email = (emailInput.value || '').trim();

                if (!state.email || state.email.indexOf('@') === -1) {
                    emailInput.style.borderColor = '#dc2626';
                    emailInput.focus();
                    return;
                }

                ga('quiz_email_capture', { page: '/quiz/' });
                submitBtn.textContent = 'Sending\u2026';
                submitBtn.disabled = true;

                sendResults(function() {
                    showResults();
                });
            });
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', function() {
                showResults();
            });
        }
    }

    function bindResultsCTAs() {
        root.addEventListener('click', function(e) {
            var cta = e.target.closest('.quiz-cta');
            if (!cta) return;
            var ctaName = cta.getAttribute('data-cta');
            ga('quiz_cta_click', { cta_name: ctaName, page: '/quiz/' });
        });
    }

    function showResults() {
        renderResults();
        ga('quiz_complete', {
            gender: state.gender,
            age: state.age,
            score: computeTotalScore(),
            classification: classify(computeTotalScore()).level
        });
        show(13);
        // Hide progress bar on results
        progressBar.style.width = '100%';
    }

    function computeTotalScore() {
        var total = 0;
        for (var key in state.answers) {
            if (state.answers.hasOwnProperty(key)) {
                total += state.answers[key];
            }
        }
        return total;
    }

    // ── Email Submission ────────────────────────────────────────────────

    function sendResults(callback) {
        var cats = getCategories();
        var catScores = [];
        var totalScore = 0;

        for (var c = 0; c < cats.length; c++) {
            var cat = cats[c];
            var catTotal = 0;
            for (var i = 0; i < cat.items.length; i++) {
                catTotal += state.answers[cat.key + '_' + i] || 0;
            }
            totalScore += catTotal;
            catScores.push({ key: cat.key, label: cat.label, score: catTotal, max: cat.items.length * 3 });
        }

        var payload = {
            name: state.name,
            email: state.email,
            gender: state.gender,
            age: state.age,
            totalScore: totalScore,
            maxScore: state.gender === 'female' ? 72 : 66,
            classification: classify(totalScore).level,
            categories: catScores,
            lifestyle: state.lifestyle
        };

        fetch('/.netlify/functions/quiz-submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function() {
            if (callback) callback();
        }).catch(function() {
            // Still show results even if email fails
            if (callback) callback();
        });
    }

    // ── Init ─────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildQuiz);
    } else {
        buildQuiz();
    }

})();
