/*
 * Moonshot Body Comp IQ Quiz Engine
 * ==================================
 * Knowledge-based quiz (right/wrong answers).
 * Vanilla JS IIFE — same architecture as hormone quiz.
 */
(function() {
    'use strict';

    // ── Question Data ───────────────────────────────────────────────────

    var questions = [
        {
            question: 'Which body composition measurement method is considered the gold standard for accuracy?',
            options: ['BMI calculator', 'DEXA scan', 'InBody / BIA scale', 'Skin fold calipers'],
            correct: 1,
            explanation: 'DEXA (Dual-Energy X-ray Absorptiometry) is the gold standard — it directly measures fat, lean mass, and bone density with medical-grade precision.'
        },
        {
            question: 'BMI (Body Mass Index) accounts for which of the following?',
            options: ['Height and weight only', 'Body fat percentage', 'Muscle mass vs fat mass', 'Bone density'],
            correct: 0,
            explanation: 'BMI is simply weight divided by height squared. It cannot distinguish between muscle and fat — a lean, muscular person can have the same BMI as someone who is obese.'
        },
        {
            question: 'What is visceral fat?',
            options: ['Fat stored under the skin', 'Fat around internal organs', 'Fat in your legs and arms', 'Essential fat for brain function'],
            correct: 1,
            explanation: 'Visceral fat surrounds your organs in the abdominal cavity. It\'s the most metabolically dangerous type of fat and is strongly linked to heart disease, diabetes, and inflammation. You can\'t see or feel it — you can only measure it.'
        },
        {
            question: 'Two people weigh the same on a scale. What can you conclude about their body composition?',
            options: ['They have similar body fat %', 'They have similar muscle mass', 'Nothing — scale weight doesn\'t reveal composition', 'The taller person has less body fat'],
            correct: 2,
            explanation: 'Scale weight tells you nothing about composition. One person could be 18% body fat with high muscle mass, while the other could be 35% body fat with low muscle mass — at the exact same weight.'
        },
        {
            question: 'What is the main limitation of bioelectrical impedance (InBody, smart scales)?',
            options: ['It can\'t measure body fat at all', 'Results vary significantly with hydration, food, and time of day', 'It uses dangerous radiation', 'It only works for men'],
            correct: 1,
            explanation: 'BIA sends an electrical current through your body and estimates composition based on resistance. Hydration levels, recent meals, exercise, and even time of day can swing results by 3-5% body fat — making it unreliable for precise tracking.'
        },
        {
            question: 'After age 30, how much muscle mass does the average person lose per decade without resistance training?',
            options: ['Less than 1%', '3-8%', '15-20%', 'Muscle loss doesn\'t start until age 50'],
            correct: 1,
            explanation: 'Sarcopenia (age-related muscle loss) begins around age 30. Without active resistance training, you lose 3-8% of muscle mass per decade — and the rate accelerates after 60. This is one of the strongest predictors of frailty and mortality.'
        },
        {
            question: 'Which metric is a better predictor of metabolic health than total body fat percentage?',
            options: ['Total body weight', 'Visceral fat level', 'Arm circumference', 'Resting heart rate'],
            correct: 1,
            explanation: 'Visceral fat is a far better predictor of metabolic disease than overall body fat percentage. Someone with a "normal" body fat percentage can still have dangerous levels of visceral fat — a condition sometimes called "skinny fat."'
        },
        {
            question: 'You lose 5 lbs on the scale in a week. What most likely happened?',
            options: ['You lost 5 lbs of pure fat', 'You lost mostly water weight', 'You lost equal parts fat and muscle', 'Your metabolism permanently increased'],
            correct: 1,
            explanation: 'Losing 5 lbs in a single week is almost entirely water weight. Fat loss of 1-2 lbs per week is a realistic, sustainable rate. Rapid scale drops from aggressive dieting often include muscle loss alongside water — which is counterproductive.'
        },
        {
            question: 'What does a DEXA scan measure that most other methods cannot?',
            options: ['Total body weight', 'Regional body composition (left arm vs right arm, trunk, legs)', 'Cardiovascular fitness', 'Blood pressure'],
            correct: 1,
            explanation: 'DEXA provides a regional breakdown showing fat and lean mass in each body segment — arms, legs, trunk, and android/gynoid regions. This reveals asymmetries, injury risk, and visceral fat distribution that no other common method can detect.'
        },
        {
            question: 'Which of these statements about body fat percentage is FALSE?',
            options: ['Women naturally carry more body fat than men', 'Essential body fat is needed for normal biological function', 'A lower body fat percentage is always healthier', 'Body fat plays a role in hormone production'],
            correct: 2,
            explanation: 'Lower body fat is NOT always healthier. Essential fat is required for organ protection, hormone production, and metabolic function. Extremely low body fat (below ~5% for men, ~12% for women) can cause hormonal disruption, immune suppression, and bone loss.'
        },
        {
            question: 'What is the android/gynoid ratio, and why does it matter?',
            options: [
                'Ratio of upper body to lower body strength',
                'Ratio of abdominal fat to hip/thigh fat — predicts metabolic risk',
                'Ratio of muscle to bone mass',
                'Ratio of visceral to subcutaneous fat'
            ],
            correct: 1,
            explanation: 'The android/gynoid ratio compares fat stored in your midsection (android) to fat in your hips and thighs (gynoid). A higher ratio means more abdominal fat storage, which strongly correlates with insulin resistance, inflammation, and cardiovascular disease.'
        },
        {
            question: 'Why is bone mineral density important to measure, especially after age 40?',
            options: [
                'It determines how tall you are',
                'Low bone density (osteoporosis) can lead to fractures and is preventable if caught early',
                'Bone density has no health implications',
                'It only matters for professional athletes'
            ],
            correct: 1,
            explanation: 'Osteoporosis affects 1 in 3 women and 1 in 5 men over 50, often with zero symptoms until a fracture occurs. DEXA is the gold standard for bone density measurement — catching decline early allows intervention through nutrition, exercise, and sometimes medication.'
        }
    ];

    // ── State ────────────────────────────────────────────────────────────

    var state = {
        currentScreen: 0,
        answers: {},  // { 0: selectedIndex, 1: selectedIndex, ... }
        name: '',
        email: ''
    };

    // Total screens: welcome(1) + 12 questions + email(1) + results(1) = 15
    var TOTAL_QUESTIONS = questions.length;
    var TOTAL_SCREENS = 1 + TOTAL_QUESTIONS + 1 + 1; // welcome + questions + email + results

    var root = document.getElementById('quiz-root');
    var progressBar = document.getElementById('quiz-progress-bar');

    // ── State Persistence ──────────────────────────────────────────────

    var STORAGE_KEY = 'mmp_bodycomp_state';
    var STORAGE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                currentScreen: state.currentScreen,
                answers: state.answers,
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
        var pct = Math.min(100, Math.round((state.currentScreen / (TOTAL_SCREENS - 1)) * 100));
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
            if (target) target.classList.add('active');
        }, 30);
    }

    function screenWrap(index, inner) {
        return '<div class="quiz-screen flex items-center justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + index + '">' +
            '<div class="max-w-2xl w-full">' + inner + '</div></div>';
    }

    function computeScore() {
        var correct = 0;
        for (var i = 0; i < TOTAL_QUESTIONS; i++) {
            if (state.answers[i] === questions[i].correct) correct++;
        }
        return correct;
    }

    // ── Screen Builders ─────────────────────────────────────────────────

    function buildWelcome() {
        return screenWrap(0,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-6">Free 3-Minute Quiz</p>' +
                '<h1 class="text-4xl md:text-5xl font-bold text-brand-light mb-6 font-heading">BODY COMP IQ</h1>' +
                '<p class="text-brand-gray text-lg font-light mb-10 max-w-lg mx-auto">How much do you really know about body composition? Test your knowledge with 12 quick questions.</p>' +
                '<button type="button" id="quiz-start-btn" class="btn-primary text-lg px-10 py-4">Let\u2019s Go</button>' +
                '<p class="text-brand-gray/50 text-xs mt-6">For educational purposes only.</p>' +
            '</div>'
        );
    }

    function buildQuestion(qIndex) {
        var q = questions[qIndex];
        var screenIdx = 1 + qIndex;
        var prevScreen = screenIdx - 1;
        var nextScreen = screenIdx + 1;

        var optionsHtml = '';
        var optionLetters = ['A', 'B', 'C', 'D'];
        for (var i = 0; i < q.options.length; i++) {
            optionsHtml += '<button type="button" class="quiz-card border border-white/10 rounded-sm p-4 text-left w-full flex items-start gap-3" ' +
                'data-question="' + qIndex + '" data-option="' + i + '">' +
                '<span class="text-brand-gray font-bold text-sm mt-0.5 shrink-0">' + optionLetters[i] + '</span>' +
                '<span class="text-brand-light text-sm">' + q.options[i] + '</span>' +
            '</button>';
        }

        return screenWrap(screenIdx,
            '<div>' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-2">Question ' + (qIndex + 1) + ' of ' + TOTAL_QUESTIONS + '</p>' +
                '<h2 class="text-xl md:text-2xl font-bold text-brand-light mb-8 font-heading">' + q.question + '</h2>' +
                '<div class="space-y-3" id="q-options-' + qIndex + '">' + optionsHtml + '</div>' +
                '<div id="q-feedback-' + qIndex + '" style="display:none" class="mt-6 bg-white/5 rounded-sm p-5">' +
                    '<p id="q-feedback-label-' + qIndex + '" class="font-bold text-sm mb-2"></p>' +
                    '<p class="text-brand-gray text-sm">' + q.explanation + '</p>' +
                '</div>' +
                '<div class="flex justify-between items-center mt-8">' +
                    '<button type="button" class="text-brand-gray text-sm hover:text-brand-light transition quiz-back-btn" data-to="' + prevScreen + '">\u2190 Back</button>' +
                    '<button type="button" class="btn-primary quiz-advance-btn opacity-40 pointer-events-none" data-to="' + nextScreen + '" disabled>Next \u2192</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildEmailCapture() {
        var screenIdx = 1 + TOTAL_QUESTIONS;
        return screenWrap(screenIdx,
            '<div class="text-center">' +
                '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Get Your Results</p>' +
                '<h2 class="text-2xl font-bold text-brand-light mb-2 font-heading">SEE HOW YOU DID</h2>' +
                '<p class="text-brand-gray font-light mb-8">Enter your email to get your score, a detailed breakdown, and tips to improve your body comp knowledge.</p>' +
                '<div class="max-w-sm mx-auto space-y-4">' +
                    '<input type="text" id="quiz-name" placeholder="First name" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<input type="email" id="quiz-email" placeholder="Email address" class="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/50 text-sm">' +
                    '<button type="button" id="quiz-submit-email" class="btn-primary w-full py-3">See My Score</button>' +
                '</div>' +
                '<div class="flex justify-start mt-6">' +
                    '<button type="button" class="text-brand-gray text-sm hover:text-brand-light transition quiz-back-btn" data-to="' + (screenIdx - 1) + '">\u2190 Back</button>' +
                '</div>' +
            '</div>'
        );
    }

    function buildResults() {
        var screenIdx = 2 + TOTAL_QUESTIONS;
        return '<div class="quiz-screen flex items-start justify-center min-h-[calc(100vh-5rem)] px-4 py-12" data-screen="' + screenIdx + '">' +
            '<div class="max-w-2xl w-full" id="quiz-results-inner"></div></div>';
    }

    // ── Results Renderer ─────────────────────────────────────────────────

    function renderResults() {
        var score = computeScore();
        var pct = Math.round((score / TOTAL_QUESTIONS) * 100);

        var gradeLabel, gradeColor;
        if (pct >= 80) { gradeLabel = 'Excellent'; gradeColor = '#4ade80'; }
        else if (pct >= 60) { gradeLabel = 'Good'; gradeColor = '#B2BFBE'; }
        else if (pct >= 40) { gradeLabel = 'Fair'; gradeColor = '#ca8a04'; }
        else { gradeLabel = 'Needs Work'; gradeColor = '#dc2626'; }

        var html = '';

        // Score header
        html += '<div class="text-center mb-10">' +
            '<p class="text-brand-gray text-xs uppercase tracking-widest mb-4">Your Results</p>' +
            '<h2 class="text-4xl font-bold text-brand-light mb-2 font-heading">BODY COMP IQ</h2>' +
            '<div class="mt-6 mb-4">' +
                '<span class="text-6xl font-bold" style="color:' + gradeColor + '">' + score + '</span>' +
                '<span class="text-brand-gray text-xl">/' + TOTAL_QUESTIONS + '</span>' +
            '</div>' +
            '<span class="inline-block px-4 py-1 rounded-sm text-sm font-bold" style="background:' + gradeColor + '; color:#101921">' + gradeLabel.toUpperCase() + '</span>' +
            '<p class="text-brand-gray font-light mt-6 max-w-lg mx-auto">' + getGradeSummary(pct) + '</p>' +
        '</div>';

        // Question-by-question breakdown
        html += '<div class="mb-8">' +
            '<h3 class="text-brand-light font-bold mb-4">QUESTION BREAKDOWN</h3>';

        for (var i = 0; i < TOTAL_QUESTIONS; i++) {
            var q = questions[i];
            var userAnswer = state.answers[i];
            var isCorrect = userAnswer === q.correct;
            var icon = isCorrect ? '\u2713' : '\u2717';
            var color = isCorrect ? '#4ade80' : '#dc2626';

            html += '<div class="bg-white/5 rounded-sm p-4 mb-3">' +
                '<div class="flex items-start gap-3">' +
                    '<span class="font-bold text-lg mt-0.5 shrink-0" style="color:' + color + '">' + icon + '</span>' +
                    '<div>' +
                        '<p class="text-brand-light text-sm font-medium mb-1">Q' + (i + 1) + ': ' + q.question + '</p>' +
                        '<p class="text-brand-gray text-xs">' +
                            (isCorrect ? 'Correct!' : 'You answered: ' + q.options[userAnswer] + ' — Correct answer: ' + q.options[q.correct]) +
                        '</p>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }
        html += '</div>';

        // Key takeaways
        html += '<div class="bg-white/5 rounded-sm p-6 mb-8">' +
            '<h3 class="text-brand-light font-bold mb-4">KEY TAKEAWAYS</h3>' +
            '<div class="space-y-3 text-brand-gray text-sm">' +
                '<p><strong class="text-brand-light">Scale weight is misleading.</strong> It can\'t distinguish fat from muscle. Two people at the same weight can have completely different health profiles.</p>' +
                '<p><strong class="text-brand-light">DEXA is the gold standard.</strong> It\'s the only widely available method that measures fat, lean mass, bone density, and visceral fat with medical-grade accuracy.</p>' +
                '<p><strong class="text-brand-light">Visceral fat matters most.</strong> The fat you can\'t see — around your organs — is the strongest predictor of metabolic disease. Only DEXA quantifies it reliably.</p>' +
                '<p><strong class="text-brand-light">Muscle is longevity.</strong> After 30, you lose muscle every decade without resistance training. Lean mass is the #1 predictor of healthspan.</p>' +
            '</div>' +
        '</div>';

        // CTA
        html += '<div class="bg-brand-slate rounded-sm p-8 mb-8">' +
            '<h3 class="text-brand-light font-bold mb-4">SEE YOUR REAL NUMBERS</h3>' +
            '<p class="text-brand-gray text-sm mb-6">A single DEXA scan gives you body fat %, lean mass, bone density, visceral fat, and regional breakdown — in about 10 minutes.</p>' +
            '<div class="text-center">' +
                '<a href="/medical/dexa-body-composition/" class="btn-primary text-lg px-8 py-4 inline-block quiz-cta" data-cta="book_dexa">Book a DEXA Scan</a>' +
            '</div>' +
        '</div>';

        // Keep learning
        html += '<div class="text-center mb-8">' +
            '<p class="text-brand-gray text-xs uppercase tracking-widest mb-3">Keep Learning</p>' +
            '<div class="flex flex-wrap justify-center gap-2">' +
                '<a href="/quiz/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Hormone Health Quiz \u2192</a>' +
                '<a href="/medical/blood-panels/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">Blood Panels \u2192</a>' +
                '<a href="/medical/" class="bg-brand-dark px-4 py-2 text-brand-light text-xs hover:bg-white/10 transition rounded-sm">All Services \u2192</a>' +
            '</div>' +
        '</div>';

        document.getElementById('quiz-results-inner').innerHTML = html;
    }

    function getGradeSummary(pct) {
        if (pct >= 80) return 'Strong body composition knowledge. You understand what matters beyond the scale — now make sure you have the data to match.';
        if (pct >= 60) return 'Solid foundation, but some common misconceptions are still in play. The emails we send over the next couple weeks will fill in the gaps.';
        if (pct >= 40) return 'You\'re not alone — most people have significant blind spots about body composition. We\'ll break down what actually matters over the next couple weeks.';
        return 'A lot of what most people believe about body composition is wrong. The good news: we\'ll cover everything you need to know in your inbox over the next couple weeks.';
    }

    // ── Build All Screens ───────────────────────────────────────────────

    function buildQuiz() {
        var html = buildWelcome();
        for (var i = 0; i < TOTAL_QUESTIONS; i++) {
            html += buildQuestion(i);
        }
        html += buildEmailCapture();
        html += buildResults();

        root.innerHTML = html;
        bindAll();
        show(0);
    }

    // ── Event Binding ───────────────────────────────────────────────────

    function bindAll() {
        // Start button
        var startBtn = document.getElementById('quiz-start-btn');
        if (startBtn) startBtn.addEventListener('click', function() {
            ga('quiz_start', { page: '/quiz/body-comp/' });
            show(1);
        });

        // Option selection for each question
        root.addEventListener('click', function(e) {
            var card = e.target.closest('[data-question]');
            if (!card) return;

            var qIdx = parseInt(card.getAttribute('data-question'), 10);
            var optIdx = parseInt(card.getAttribute('data-option'), 10);

            // Don't allow re-selection
            if (state.answers[qIdx] !== undefined) return;

            state.answers[qIdx] = optIdx;

            // Visual feedback
            var q = questions[qIdx];
            var allCards = root.querySelectorAll('[data-question="' + qIdx + '"]');
            for (var i = 0; i < allCards.length; i++) {
                var cardOpt = parseInt(allCards[i].getAttribute('data-option'), 10);
                if (cardOpt === q.correct) {
                    allCards[i].classList.add('correct');
                } else if (cardOpt === optIdx && optIdx !== q.correct) {
                    allCards[i].classList.add('incorrect');
                }
                allCards[i].style.pointerEvents = 'none';
            }

            // Show feedback
            var feedbackEl = document.getElementById('q-feedback-' + qIdx);
            var feedbackLabel = document.getElementById('q-feedback-label-' + qIdx);
            if (feedbackEl && feedbackLabel) {
                feedbackLabel.textContent = optIdx === q.correct ? 'Correct!' : 'Not quite.';
                feedbackLabel.style.color = optIdx === q.correct ? '#4ade80' : '#dc2626';
                feedbackEl.style.display = 'block';
            }

            // Enable advance button
            var screen = card.closest('.quiz-screen');
            var advanceBtn = screen.querySelector('.quiz-advance-btn');
            if (advanceBtn) {
                advanceBtn.classList.remove('opacity-40', 'pointer-events-none');
                advanceBtn.disabled = false;
            }

            ga('quiz_step', { step: 'q' + (qIdx + 1), correct: optIdx === q.correct });
        });

        // Advance buttons
        root.addEventListener('click', function(e) {
            var btn = e.target.closest('.quiz-advance-btn');
            if (!btn || btn.disabled) return;
            var to = parseInt(btn.getAttribute('data-to'), 10);
            show(to);
        });

        // Back buttons
        root.addEventListener('click', function(e) {
            var btn = e.target.closest('.quiz-back-btn');
            if (!btn) return;
            var to = parseInt(btn.getAttribute('data-to'), 10);
            show(to);
        });

        // Email submit
        var submitBtn = document.getElementById('quiz-submit-email');
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

                ga('quiz_email_capture', { page: '/quiz/body-comp/' });
                submitBtn.textContent = 'Sending\u2026';
                submitBtn.disabled = true;

                sendResults(function() {
                    showFinalResults();
                });
            });
        }

        // CTA tracking
        root.addEventListener('click', function(e) {
            var cta = e.target.closest('.quiz-cta');
            if (!cta) return;
            ga('quiz_cta_click', { cta_name: cta.getAttribute('data-cta'), page: '/quiz/body-comp/' });
        });
    }

    function showFinalResults() {
        renderResults();
        var resultsScreen = 2 + TOTAL_QUESTIONS;
        ga('quiz_complete', {
            score: computeScore(),
            max_score: TOTAL_QUESTIONS,
            page: '/quiz/body-comp/'
        });
        show(resultsScreen);
        progressBar.style.width = '100%';
    }

    // ── Email Submission ────────────────────────────────────────────────

    function sendResults(callback) {
        var score = computeScore();

        // Build per-question results for the email
        var questionResults = [];
        for (var i = 0; i < TOTAL_QUESTIONS; i++) {
            questionResults.push({
                question: questions[i].question,
                userAnswer: questions[i].options[state.answers[i]] || 'Skipped',
                correctAnswer: questions[i].options[questions[i].correct],
                correct: state.answers[i] === questions[i].correct,
                explanation: questions[i].explanation
            });
        }

        var payload = {
            name: state.name,
            email: state.email,
            score: score,
            maxScore: TOTAL_QUESTIONS,
            questionResults: questionResults
        };

        fetch('/.netlify/functions/bodycomp-submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function() {
            clearSavedState();
            if (callback) callback();
        }).catch(function() {
            clearSavedState();
            if (callback) callback();
        });
    }

    // ── Restore from saved state ─────────────────────────────────────────

    function restoreQuiz() {
        var saved = loadSavedState();
        if (!saved || Object.keys(saved.answers || {}).length === 0) {
            buildQuiz();
            return;
        }

        // Restore state
        state.answers = saved.answers || {};
        state.name = saved.name || '';
        state.email = saved.email || '';

        // Build full quiz
        buildQuiz();

        // Rehydrate answered questions
        for (var qIdx in state.answers) {
            if (!state.answers.hasOwnProperty(qIdx)) continue;
            var qi = parseInt(qIdx, 10);
            var optIdx = state.answers[qi];
            var q = questions[qi];

            // Mark cards
            var allCards = root.querySelectorAll('[data-question="' + qi + '"]');
            for (var i = 0; i < allCards.length; i++) {
                var cardOpt = parseInt(allCards[i].getAttribute('data-option'), 10);
                if (cardOpt === q.correct) {
                    allCards[i].classList.add('correct');
                } else if (cardOpt === optIdx && optIdx !== q.correct) {
                    allCards[i].classList.add('incorrect');
                }
                allCards[i].style.pointerEvents = 'none';
            }

            // Show feedback
            var feedbackEl = document.getElementById('q-feedback-' + qi);
            var feedbackLabel = document.getElementById('q-feedback-label-' + qi);
            if (feedbackEl && feedbackLabel) {
                feedbackLabel.textContent = optIdx === q.correct ? 'Correct!' : 'Not quite.';
                feedbackLabel.style.color = optIdx === q.correct ? '#4ade80' : '#dc2626';
                feedbackEl.style.display = 'block';
            }

            // Enable advance button
            var screenIdx = 1 + qi;
            var screen = root.querySelector('[data-screen="' + screenIdx + '"]');
            if (screen) {
                var advanceBtn = screen.querySelector('.quiz-advance-btn');
                if (advanceBtn) {
                    advanceBtn.classList.remove('opacity-40', 'pointer-events-none');
                    advanceBtn.disabled = false;
                }
            }
        }

        // Rehydrate inputs
        if (state.name) {
            var nameInput = document.getElementById('quiz-name');
            if (nameInput) nameInput.value = state.name;
        }
        if (state.email) {
            var emailInput = document.getElementById('quiz-email');
            if (emailInput) emailInput.value = state.email;
        }

        // Restore to results if on results screen
        var targetScreen = saved.currentScreen || 0;
        var resultsScreen = 2 + TOTAL_QUESTIONS;
        if (targetScreen === resultsScreen) {
            renderResults();
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
