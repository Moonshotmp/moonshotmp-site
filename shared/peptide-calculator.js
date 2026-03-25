(function () {
  'use strict';

  /* ========================================
     Brand Tokens (match styles.css / tailwind-config)
     ======================================== */
  var BRAND = {
    dark: '#101921',
    light: '#F0EEE9',
    gray: '#B2BFBE',
    slate: '#2C353E',
    green: '#4ade80',
    greenDim: 'rgba(74,222,128,0.10)',
    greenBorder: 'rgba(74,222,128,0.40)',
    white5: 'rgba(255,255,255,0.05)',
    white10: 'rgba(255,255,255,0.10)',
    white50: 'rgba(255,255,255,0.50)'
  };

  /* ========================================
     Peptide Catalog
     ======================================== */
  var PEPTIDES = {
    'bpc157':      { name: 'BPC-157',         price: 250, desc: 'Promotes healing of tendons, ligaments, gut lining, and muscle tissue.' },
    'ghkcu':       { name: 'GHK-Cu',          price: 175, desc: 'Copper peptide that stimulates collagen, skin elasticity, and hair growth.' },
    'wolverine':   { name: 'Wolverine Blend',  price: 350, desc: 'BPC-157 + TB-500 dual-pathway healing in one injection.' },
    'pt141':       { name: 'PT-141',           price: 250, desc: 'Works on the nervous system to improve sexual desire and arousal.' },
    'sermorelin':  { name: 'Sermorelin',       price: 250, desc: 'Stimulates natural growth hormone production for recovery, sleep, and vitality.' },
    'glowstack':   { name: 'Glow Stack',       price: 350, desc: 'GHK-Cu + BPC-157 + TB-500 triple-peptide for skin, healing, and recovery.' }
  };

  /* ========================================
     Goal Definitions
     ======================================== */
  var GOALS = [
    { id: 'injury',   emoji: '\uD83D\uDD27', label: 'Injury & Pain Recovery' },
    { id: 'gut',      emoji: '\uD83E\uDEC1', label: 'Gut Healing' },
    { id: 'skin',     emoji: '\u2728',        label: 'Skin & Anti-Aging' },
    { id: 'athletic', emoji: '\uD83D\uDCAA',  label: 'Athletic Recovery' },
    { id: 'sexual',   emoji: '\u2764\uFE0F',  label: 'Sexual Health' },
    { id: 'general',  emoji: '\uD83E\uDDEC',  label: 'General Optimization' }
  ];

  /* ========================================
     Recommendation Engine
     ======================================== */
  function recommend(selected) {
    if (!selected.length) return [];

    var has = {};
    selected.forEach(function (g) { has[g] = true; });
    var items = [];

    // --- Combo / stack detection ---
    var injuryCovered  = false;
    var skinCovered    = false;
    var athleticCovered = false;
    var gutCovered     = false;

    // Glow Stack covers skin + injury + athletic + gut (BPC + TB + GHK-Cu)
    var wantSkin     = has.skin;
    var wantInjury   = has.injury;
    var wantAthletic = has.athletic;
    var wantGut      = has.gut;

    // Determine best combo
    // Glow Stack: covers skin + injury + athletic + gut
    // Wolverine: covers injury + athletic + gut (no skin)
    // Evaluate whether Glow Stack is warranted
    var useGlowStack = false;
    var useWolverine = false;

    if (wantSkin && (wantInjury || wantAthletic)) {
      // Skin + any recovery goal -> Glow Stack
      useGlowStack = true;
    } else if (wantInjury && wantAthletic) {
      // Both recovery goals, no skin -> Wolverine
      useWolverine = true;
    }

    if (useGlowStack) {
      items.push({
        key: 'glowstack',
        why: 'Covers ' + buildCoversList(['skin', 'injury', 'athletic', 'gut'], has) + ' in one injection — saves money vs. buying separately'
      });
      skinCovered = true;
      injuryCovered = true;
      athleticCovered = true;
      gutCovered = true;
    } else if (useWolverine) {
      items.push({
        key: 'wolverine',
        why: 'Covers ' + buildCoversList(['injury', 'athletic', 'gut'], has) + ' with dual-pathway healing in one injection'
      });
      injuryCovered = true;
      athleticCovered = true;
      gutCovered = true;
    }

    // Individual fallbacks for goals not yet covered
    if (wantInjury && !injuryCovered) {
      items.push({ key: 'bpc157', why: 'BPC-157 accelerates tendon, ligament, and tissue healing' });
      injuryCovered = true;
      gutCovered = true; // BPC also covers gut
    }

    if (wantGut && !gutCovered) {
      items.push({ key: 'bpc157', why: 'BPC-157 supports gut lining repair and reduces inflammation' });
      gutCovered = true;
    }

    if (wantSkin && !skinCovered) {
      items.push({ key: 'ghkcu', why: 'GHK-Cu stimulates collagen synthesis and skin rejuvenation' });
      skinCovered = true;
    }

    if (wantAthletic && !athleticCovered) {
      items.push({ key: 'wolverine', why: 'Wolverine Blend provides premium dual-pathway athletic recovery' });
      athleticCovered = true;
    }

    if (has.sexual) {
      items.push({ key: 'pt141', why: 'PT-141 targets the nervous system for improved desire and arousal' });
    }

    if (has.general) {
      items.push({ key: 'sermorelin', why: 'Sermorelin optimizes growth hormone for sleep, recovery, and vitality' });
    }

    // Deduplicate (e.g. BPC could appear twice)
    var seen = {};
    var unique = [];
    items.forEach(function (item) {
      if (!seen[item.key]) {
        seen[item.key] = true;
        unique.push(item);
      }
    });

    return unique;
  }

  function buildCoversList(goalIds, has) {
    var LABELS = {
      injury: 'injury recovery',
      skin: 'skin & anti-aging',
      athletic: 'athletic recovery',
      gut: 'gut healing'
    };
    var matched = goalIds.filter(function (g) { return has[g]; });
    return matched.map(function (g) { return LABELS[g]; }).join(' + ');
  }

  /* ========================================
     Included-benefits copy
     ======================================== */
  function includedBullets() {
    return [
      'Pharmaceutical-grade compounds from licensed 503A pharmacies',
      'Medical oversight and dosing protocol',
      'Injection training and technique guidance',
      'Ongoing monitoring and protocol adjustments',
      'Direct access to your provider via patient portal'
    ];
  }

  /* ========================================
     Inject Styles
     ======================================== */
  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '.pcc-wrap { font-family: "Poppins", sans-serif; }',
      '.pcc-heading { font-family: "Oswald", sans-serif; text-transform: uppercase; letter-spacing: 0.05em; }',
      '.pcc-goal-btn { background:' + BRAND.white5 + '; border:1px solid ' + BRAND.white10 + '; color:' + BRAND.light + '; padding:14px 20px; cursor:pointer; transition:all .25s ease; display:flex; align-items:center; gap:12px; font-family:"Poppins",sans-serif; font-size:15px; font-weight:400; width:100%; text-align:left; }',
      '.pcc-goal-btn:hover { border-color:' + BRAND.gray + '; }',
      '.pcc-goal-btn.selected { border-color:' + BRAND.green + '; background:' + BRAND.greenDim + '; }',
      '.pcc-goal-btn .pcc-check { width:20px; height:20px; border:2px solid ' + BRAND.white10 + '; border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .25s ease; }',
      '.pcc-goal-btn.selected .pcc-check { border-color:' + BRAND.green + '; background:' + BRAND.green + '; }',
      '.pcc-goal-btn.selected .pcc-check svg { opacity:1; }',
      '.pcc-goal-btn .pcc-check svg { opacity:0; transition:opacity .2s ease; }',
      '.pcc-card { background:' + BRAND.white5 + '; padding:24px; opacity:0; transform:translateY(12px); animation:pccSlideIn .35s ease forwards; }',
      '@keyframes pccSlideIn { to { opacity:1; transform:translateY(0); } }',
      '.pcc-input { background:' + BRAND.white5 + '; border:1px solid ' + BRAND.white10 + '; color:' + BRAND.light + '; padding:12px 16px; font-family:"Poppins",sans-serif; font-size:15px; width:100%; transition:border-color .3s ease; box-sizing:border-box; }',
      '.pcc-input:focus { outline:none; border-color:' + BRAND.gray + '; }',
      '.pcc-input::placeholder { color:' + BRAND.white50 + '; }',
      '.pcc-btn { background:' + BRAND.gray + '; color:' + BRAND.dark + '; font-family:"Oswald",sans-serif; text-transform:uppercase; font-weight:600; padding:14px 32px; border:none; cursor:pointer; transition:all .3s ease; font-size:16px; letter-spacing:0.05em; width:100%; }',
      '.pcc-btn:hover { background:' + BRAND.light + '; transform:translateY(-2px); }',
      '.pcc-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none; }',
      '.pcc-summary { background:' + BRAND.slate + '; padding:32px; }',
      '.pcc-fade-enter { animation:pccFadeIn .4s ease forwards; }',
      '@keyframes pccFadeIn { from { opacity:0; } to { opacity:1; } }',
      '.pcc-emoji { font-size:20px; line-height:1; }',
      '.pcc-divider { height:1px; background:' + BRAND.white10 + '; margin:16px 0; }',
      '.pcc-success { color:' + BRAND.green + '; }',
      '.pcc-error { color:#f87171; font-size:14px; margin-top:8px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ========================================
     Render Engine
     ======================================== */
  function init() {
    var root = document.getElementById('peptide-calculator');
    if (!root) return;

    injectStyles();

    var state = { selected: [], submitting: false, submitted: false, error: '' };

    function render() {
      var recs = recommend(state.selected);
      var total = 0;
      recs.forEach(function (r) { total += PEPTIDES[r.key].price; });

      var html = '';

      // Heading
      html += '<div class="pcc-wrap">';
      html += '<h2 class="pcc-heading" style="font-size:28px;color:' + BRAND.light + ';margin:0 0 8px 0;text-align:center;">Build Your Peptide Protocol</h2>';
      html += '<p style="color:' + BRAND.gray + ';font-size:15px;font-weight:300;text-align:center;margin:0 0 32px 0;">Select your goals and see a personalized recommendation with pricing.</p>';

      // Step 1: Goals
      html += '<p style="color:' + BRAND.gray + ';font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px 0;font-weight:500;">Step 1: Select your goals</p>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-bottom:40px;">';
      GOALS.forEach(function (g) {
        var sel = state.selected.indexOf(g.id) !== -1;
        html += '<button type="button" class="pcc-goal-btn' + (sel ? ' selected' : '') + '" data-goal="' + g.id + '">';
        html += '<span class="pcc-check"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="' + BRAND.dark + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
        html += '<span class="pcc-emoji">' + g.emoji + '</span>';
        html += '<span>' + g.label + '</span>';
        html += '</button>';
      });
      html += '</div>';

      // Recommendations
      if (recs.length) {
        html += '<p style="color:' + BRAND.gray + ';font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 16px 0;font-weight:500;">Your Recommended Peptides</p>';
        html += '<div style="display:grid;gap:12px;margin-bottom:32px;">';
        recs.forEach(function (r, i) {
          var p = PEPTIDES[r.key];
          html += '<div class="pcc-card" style="animation-delay:' + (i * 0.08) + 's;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">';
          html += '<div style="flex:1;min-width:200px;">';
          html += '<h3 class="pcc-heading" style="font-size:20px;color:' + BRAND.light + ';margin:0 0 4px 0;">' + p.name + '</h3>';
          html += '<p style="color:' + BRAND.gray + ';font-size:14px;font-weight:300;margin:0 0 8px 0;">' + p.desc + '</p>';
          html += '<p style="color:' + BRAND.green + ';font-size:13px;font-weight:400;margin:0;">' + r.why + '</p>';
          html += '</div>';
          html += '<div style="text-align:right;flex-shrink:0;">';
          html += '<p style="font-size:28px;font-weight:700;color:' + BRAND.light + ';margin:0;line-height:1;">$' + p.price + '</p>';
          html += '<p style="color:' + BRAND.gray + ';font-size:13px;font-weight:300;margin:4px 0 0 0;">/month</p>';
          html += '</div>';
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';

        // Summary
        html += '<div class="pcc-summary">';
        html += '<h3 class="pcc-heading" style="font-size:22px;color:' + BRAND.light + ';margin:0 0 16px 0;">Your Monthly Protocol</h3>';

        recs.forEach(function (r) {
          var p = PEPTIDES[r.key];
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">';
          html += '<span style="color:' + BRAND.gray + ';font-size:15px;font-weight:300;">' + p.name + '</span>';
          html += '<span style="color:' + BRAND.light + ';font-size:15px;font-weight:500;">$' + p.price + '</span>';
          html += '</div>';
        });

        html += '<div class="pcc-divider"></div>';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">';
        html += '<span style="color:' + BRAND.light + ';font-size:16px;font-weight:600;">Total</span>';
        html += '<span style="font-size:32px;font-weight:700;color:' + BRAND.green + ';">$' + total + '<span style="font-size:15px;font-weight:300;color:' + BRAND.gray + ';">/mo</span></span>';
        html += '</div>';

        // What's included
        html += '<div style="margin-top:20px;">';
        html += '<p style="color:' + BRAND.gray + ';font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px 0;font-weight:500;">What\'s included</p>';
        includedBullets().forEach(function (b) {
          html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;">';
          html += '<span style="color:' + BRAND.green + ';font-weight:700;line-height:1.5;">&#10003;</span>';
          html += '<span style="color:' + BRAND.gray + ';font-size:14px;font-weight:300;line-height:1.5;">' + b + '</span>';
          html += '</div>';
        });
        html += '</div>';
        html += '</div>';

        // Email capture
        html += '<div style="margin-top:32px;">';
        if (state.submitted) {
          html += '<div class="pcc-fade-enter" style="text-align:center;padding:24px 0;">';
          html += '<p class="pcc-success" style="font-size:18px;font-weight:600;margin:0 0 8px 0;">Check your inbox!</p>';
          html += '<p style="color:' + BRAND.gray + ';font-size:15px;font-weight:300;margin:0;">We sent your personalized peptide protocol.</p>';
          html += '</div>';
        } else {
          html += '<p class="pcc-heading" style="font-size:18px;color:' + BRAND.light + ';margin:0 0 16px 0;text-align:center;">Send This Protocol to Your Inbox</p>';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;" class="pcc-form-grid">';
          html += '<input type="text" class="pcc-input" id="pcc-name" placeholder="First name" autocomplete="given-name">';
          html += '<input type="email" class="pcc-input" id="pcc-email" placeholder="Email address" autocomplete="email">';
          html += '</div>';
          html += '<button type="button" class="pcc-btn" id="pcc-submit"' + (state.submitting ? ' disabled' : '') + '>';
          html += state.submitting ? 'Sending...' : 'Send My Protocol';
          html += '</button>';
          if (state.error) {
            html += '<p class="pcc-error">' + state.error + '</p>';
          }
        }
        html += '</div>';
      }

      html += '</div>';

      root.innerHTML = html;
      bindEvents();
    }

    function bindEvents() {
      // Goal toggle buttons
      var btns = root.querySelectorAll('.pcc-goal-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function () {
          var goalId = this.getAttribute('data-goal');
          var idx = state.selected.indexOf(goalId);
          if (idx === -1) {
            state.selected.push(goalId);
          } else {
            state.selected.splice(idx, 1);
          }
          state.submitted = false;
          state.error = '';
          render();
        });
      }

      // Submit button
      var submitBtn = root.querySelector('#pcc-submit');
      if (submitBtn) {
        submitBtn.addEventListener('click', handleSubmit);
      }

      // Enter key on email field
      var emailInput = root.querySelector('#pcc-email');
      if (emailInput) {
        emailInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') handleSubmit();
        });
      }
    }

    function handleSubmit() {
      var nameEl = root.querySelector('#pcc-name');
      var emailEl = root.querySelector('#pcc-email');
      if (!nameEl || !emailEl) return;

      var name = nameEl.value.trim();
      var email = emailEl.value.trim();

      if (!name) {
        state.error = 'Please enter your first name.';
        render();
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        state.error = 'Please enter a valid email address.';
        render();
        return;
      }

      var recs = recommend(state.selected);
      var total = 0;
      var protocolItems = recs.map(function (r) {
        var p = PEPTIDES[r.key];
        total += p.price;
        return { name: p.name, price: p.price, why: r.why };
      });

      state.submitting = true;
      state.error = '';
      render();

      var payload = {
        name: name,
        email: email,
        goals: state.selected,
        protocol: protocolItems,
        totalMonthly: total
      };

      fetch('/.netlify/functions/peptide-guide-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed');
          state.submitting = false;
          state.submitted = true;
          render();
        })
        .catch(function () {
          state.submitting = false;
          state.error = 'Something went wrong. Please try again.';
          render();
        });
    }

    render();
  }

  /* ========================================
     Boot
     ======================================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
