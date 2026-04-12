/*
 * Contextual Lead Magnets for Learn Articles
 * ============================================
 * Loaded on /learn/[slug]/ pages. Detects article category,
 * replaces the generic mid-article CTA with a category-matched
 * resource offer + inline email capture form.
 */
(function () {
  if (!/^\/learn\/[^/]+\//.test(location.pathname)) return;

  // ─── Lead magnet config ────────────────────────────────────────
  var MAGNETS = {
    mens_hormone: {
      title: 'Low T Warning Signs Checklist',
      desc: '10 symptoms most men ignore — and what your labs should actually show.',
      cta: 'Get the Checklist'
    },
    womens_hormone: {
      title: 'Hormone Balance Guide for Women',
      desc: 'Perimenopause, estrogen, progesterone — what to test and when to act.',
      cta: 'Get the Guide'
    },
    weight_loss: {
      title: 'GLP-1 Decision Guide',
      desc: 'Semaglutide vs. tirzepatide — candidacy, costs, and what to expect.',
      cta: 'Get the Guide'
    },
    body_comp: {
      title: 'Body Composition Testing Guide',
      desc: 'DEXA vs. InBody vs. calipers — what actually matters and why.',
      cta: 'Get the Guide'
    },
    diagnostics: {
      title: 'Lab Values Quick Reference',
      desc: '"Normal" vs. optimal ranges for the markers that matter most.',
      cta: 'Get the Reference'
    },
    rehab: {
      title: 'Rehab Treatment Comparison',
      desc: 'Chiropractic vs. dry needling vs. shockwave — when to use what.',
      cta: 'Get the Comparison'
    },
    general: {
      title: 'Your First Visit Guide',
      desc: 'What to expect, what we test, and how Moonshot is different.',
      cta: 'Get the Guide'
    }
  };

  // ─── Category tag → magnet key mapping ─────────────────────────
  var CATEGORY_MAP = {
    "men's health":             'mens_hormone',
    "women's health":           'womens_hormone',
    "weight loss":              'weight_loss',
    "weight management":        'weight_loss',
    "body composition guide":   'body_comp',
    "diagnostics":              'diagnostics',
    "diagnostics & testing":    'diagnostics',
    "diagnostics & optimization": 'diagnostics',
    "rehab & recovery":         'rehab',
    "performance & recovery":   'general',
    "peptides & performance":   'general',
    "hormone therapy":          'general',
    "metabolic health":         'general',
    "thyroid & autoimmune":     'general',
    "hormones & optimization":  'general',
    "medical":                  'general'
  };

  // ─── URL slug fallback for articles without tags / local articles
  var SLUG_PATTERNS = [
    { re: /testosterone|trt|low-t|mens-hormone/, key: 'mens_hormone' },
    { re: /menopause|estrogen|progesterone|womens|pcos|whi-study/, key: 'womens_hormone' },
    { re: /glp|semaglutide|tirzepatide|weight-loss/, key: 'weight_loss' },
    { re: /dexa|body-comp|bod-pod/, key: 'body_comp' },
    { re: /blood|lab|results|insidetracker|function-health|understanding|optimal|vitamin/, key: 'diagnostics' },
    { re: /chiro|needling|shockwave|trigger|rehab/, key: 'rehab' }
  ];

  // ─── Detect magnet key ─────────────────────────────────────────
  function detectMagnetKey() {
    // 1. Try category tag in hero
    var tagEls = document.querySelectorAll('p.text-xs.uppercase.tracking-widest, p[class*="text-xs"][class*="uppercase"][class*="tracking-widest"]');
    for (var i = 0; i < tagEls.length; i++) {
      var text = (tagEls[i].textContent || '').trim().toLowerCase();
      if (!text || text.indexOf('back to') !== -1 || text.indexOf('related') !== -1 || text.indexOf('reference') !== -1) continue;
      // Skip local guide tags — fall through to slug matching
      if (text.indexOf('local guide') !== -1) break;
      if (CATEGORY_MAP[text]) return CATEGORY_MAP[text];
    }

    // 2. URL slug fallback
    var slug = location.pathname.replace(/^\/learn\//, '').replace(/\/$/, '');
    for (var j = 0; j < SLUG_PATTERNS.length; j++) {
      if (SLUG_PATTERNS[j].re.test(slug)) return SLUG_PATTERNS[j].key;
    }

    // 3. Default
    return 'general';
  }

  var magnetKey = detectMagnetKey();
  var magnet = MAGNETS[magnetKey];
  if (!magnet) return;

  // ─── Check localStorage for prior claim ────────────────────────
  var storageKey = 'ms-magnet-' + magnetKey;
  var alreadyClaimed = false;
  try { alreadyClaimed = !!localStorage.getItem(storageKey); } catch (e) {}

  // ─── Build CTA block ──────────────────────────────────────────
  var cta = document.createElement('div');
  cta.id = 'lead-magnet-cta';
  cta.className = 'my-12 bg-brand-slate text-brand-light p-6 md:p-8 text-center';

  function renderForm() {
    cta.innerHTML =
      '<p class="font-heading font-bold text-lg uppercase tracking-wide mb-2">FREE: ' + magnet.title + '</p>' +
      '<p class="text-brand-gray text-sm font-light mb-5">' + magnet.desc + '</p>' +
      '<form id="lead-magnet-form" class="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">' +
        '<input type="text" name="name" placeholder="First name" class="w-full sm:w-auto flex-1 px-4 py-3 bg-brand-dark border border-white/15 rounded-sm text-brand-light text-sm placeholder:text-brand-gray/60 focus:outline-none focus:border-brand-gray/50" />' +
        '<input type="email" name="email" placeholder="Email address" required class="w-full sm:w-auto flex-1 px-4 py-3 bg-brand-dark border border-white/15 rounded-sm text-brand-light text-sm placeholder:text-brand-gray/60 focus:outline-none focus:border-brand-gray/50" />' +
        '<button type="submit" class="btn-primary text-xs tracking-widest whitespace-nowrap px-6 py-3">' + magnet.cta + '</button>' +
      '</form>' +
      '<p class="text-brand-gray text-xs mt-3">Sent straight to your inbox. No spam.</p>';
  }

  function renderSuccess() {
    cta.innerHTML =
      '<p class="font-heading font-bold text-lg uppercase tracking-wide mb-2">&#10003; Guide sent to your inbox.</p>' +
      '<p class="text-brand-gray text-sm font-light mb-4">While you wait, here are more ways to get started:</p>' +
      '<div class="flex flex-col sm:flex-row items-center justify-center gap-3">' +
        '<a href="#" onclick="event.preventDefault(); openBookingModal();" class="btn-primary text-xs tracking-widest">Book a Free Consultation</a>' +
        '<a href="/quiz/" class="text-brand-light text-xs border border-white/15 rounded-sm px-5 py-2 hover:bg-white/5 transition">Hormone Health Quiz</a>' +
        '<a href="/quiz/body-comp/" class="text-brand-light text-xs border border-white/15 rounded-sm px-5 py-2 hover:bg-white/5 transition">Body Comp IQ Quiz</a>' +
      '</div>';
  }

  if (alreadyClaimed) {
    renderSuccess();
  } else {
    renderForm();
  }

  // ─── Inject after 4th <h2> (same position as old CTA) ─────────
  var articleH2s = document.querySelectorAll('article h2');
  if (articleH2s.length >= 4) {
    var target = articleH2s[3];
    var section = target.closest('section') || target.parentElement;
    section.parentNode.insertBefore(cta, section);
  } else if (articleH2s.length >= 2) {
    // Shorter articles: after 2nd h2
    var target2 = articleH2s[1];
    var section2 = target2.closest('section') || target2.parentElement;
    section2.parentNode.insertBefore(cta, section2.nextSibling);
  }

  // ─── Form submit handler ──────────────────────────────────────
  cta.addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    if (form.tagName !== 'FORM') return;

    var nameVal = (form.elements.name.value || '').trim();
    var emailVal = (form.elements.email.value || '').trim();

    var emailInput = form.elements.email;
    var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
    if (!emailValid) {
      emailInput.style.borderColor = '#ef4444';
      emailInput.setAttribute('aria-invalid', 'true');
      var existingErr = form.querySelector('.lm-email-error');
      if (!existingErr) {
        var errMsg = document.createElement('p');
        errMsg.className = 'lm-email-error';
        errMsg.style.cssText = 'color:#ef4444;font-size:.75rem;margin:0;text-align:left;';
        errMsg.textContent = 'Please enter a valid email address';
        emailInput.parentNode.insertBefore(errMsg, emailInput.nextSibling);
        emailInput.addEventListener('input', function () {
          emailInput.style.borderColor = '';
          emailInput.removeAttribute('aria-invalid');
          var e = form.querySelector('.lm-email-error');
          if (e) e.remove();
        });
      }
      emailInput.focus();
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending...';

    fetch('/.netlify/functions/lead-magnet-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nameVal,
        email: emailVal,
        magnet_key: magnetKey,
        article_slug: location.pathname.replace(/^\/learn\//, '').replace(/\/$/, ''),
        article_url: location.href
      })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.ok) {
        // Mark claimed
        try { localStorage.setItem(storageKey, '1'); } catch (e) {}

        // Suppress scroll quiz prompt
        try { sessionStorage.setItem('quiz_prompt_shown', '1'); } catch (e) {}

        // GA4 event
        if (typeof gtag === 'function') {
          gtag('event', 'lead_magnet_capture', {
            magnet_key: magnetKey,
            page: location.pathname
          });
        }

        renderSuccess();
      } else {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    })
    .catch(function () {
      btn.disabled = false;
      btn.textContent = originalText;
    });
  });
})();
