/*
 * Peptide Exit-Intent Popup
 * =========================
 * Shows a "Get Our Free Peptide Guide" email capture modal when the
 * visitor shows exit intent (mouse toward top on desktop, 45s timer
 * on mobile). Only fires on peptide-related pages. Dismissed for 30
 * days via cookie, permanently after submission via localStorage.
 *
 * Usage:
 *   <script src="/shared/peptide-exit-intent.js" defer></script>
 */
(function () {
  // ─── Only run on peptide pages ──────────────────────────────────
  var path = window.location.pathname;
  var peptidePages = ['/peptide', '/bpc-157', '/tb-500', '/wolverine-blend', '/ghk-cu', '/glow-stack'];
  if (!peptidePages.some(function (p) { return path.includes(p); })) return;

  // ─── Don't show if already dismissed (cookie) ──────────────────
  if (document.cookie.indexOf('mmp_peptide_exit_dismissed=1') !== -1) return;

  // ─── Don't show if already submitted ───────────────────────────
  try { if (localStorage.getItem('mmp_peptide_guide_sent')) return; } catch (e) {}

  var shown = false;

  // ─── Inject styles ─────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent =
    '#pep-exit-overlay{' +
      'position:fixed;inset:0;z-index:9999;' +
      'background:rgba(0,0,0,.6);' +
      'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);' +
      'display:flex;align-items:center;justify-content:center;' +
      'opacity:0;transition:opacity .3s ease;' +
      'pointer-events:none;' +
    '}' +
    '#pep-exit-overlay.pep-active{opacity:1;pointer-events:auto;}' +
    '#pep-exit-modal{' +
      'background:#101921;' +
      'max-width:28rem;width:calc(100% - 2rem);' +
      'border-radius:.5rem;' +
      'padding:2.5rem 2rem;' +
      'position:relative;' +
      'border:1px solid rgba(255,255,255,.08);' +
      'box-shadow:0 25px 50px -12px rgba(0,0,0,.5);' +
      'transform:translateY(1rem) scale(.97);' +
      'transition:transform .3s ease;' +
    '}' +
    '#pep-exit-overlay.pep-active #pep-exit-modal{transform:translateY(0) scale(1);}' +
    '#pep-exit-close{' +
      'position:absolute;top:.75rem;right:1rem;' +
      'background:none;border:none;cursor:pointer;' +
      'color:#8B8B83;font-size:1.5rem;line-height:1;' +
      'transition:color .2s;padding:.25rem;' +
    '}' +
    '#pep-exit-close:hover{color:#F0EEE9;}' +
    '#pep-exit-modal .pep-emoji{font-size:2rem;margin-bottom:.75rem;}' +
    '#pep-exit-modal .pep-heading{' +
      'color:#F0EEE9;' +
      'font-family:var(--font-heading,ui-sans-serif,system-ui,sans-serif);' +
      'font-weight:700;font-size:1.5rem;' +
      'letter-spacing:.05em;text-transform:uppercase;' +
      'margin-bottom:.75rem;line-height:1.2;' +
    '}' +
    '#pep-exit-modal .pep-body{' +
      'color:#8B8B83;font-size:.95rem;line-height:1.6;' +
      'margin-bottom:1.5rem;' +
    '}' +
    '#pep-exit-form{display:flex;flex-direction:column;gap:.75rem;}' +
    '#pep-exit-form input{' +
      'width:100%;' +
      'padding:.75rem 1rem;' +
      'background:#0a1017;' +
      'border:1px solid rgba(255,255,255,.12);' +
      'border-radius:.25rem;' +
      'color:#F0EEE9;font-size:.875rem;' +
      'outline:none;transition:border-color .2s;' +
    '}' +
    '#pep-exit-form input::placeholder{color:rgba(139,139,131,.6);}' +
    '#pep-exit-form input:focus{border-color:rgba(139,139,131,.5);}' +
    '#pep-exit-form button{' +
      'width:100%;' +
      'padding:.875rem 1.5rem;' +
      'font-size:.75rem;font-weight:700;' +
      'letter-spacing:.15em;text-transform:uppercase;' +
      'cursor:pointer;transition:opacity .2s;' +
    '}' +
    '#pep-exit-form button:disabled{opacity:.6;cursor:not-allowed;}' +
    '#pep-exit-modal .pep-disclaimer{' +
      'color:#8B8B83;font-size:.75rem;' +
      'text-align:center;margin-top:1rem;' +
    '}' +
    '#pep-exit-modal .pep-success{' +
      'color:#F0EEE9;font-size:1rem;text-align:center;line-height:1.6;' +
    '}' +
    '#pep-exit-modal .pep-success strong{display:block;font-size:1.125rem;margin-bottom:.5rem;}';
  document.head.appendChild(style);

  // ─── Build overlay + modal ─────────────────────────────────────
  var overlay = document.createElement('div');
  overlay.id = 'pep-exit-overlay';
  overlay.innerHTML =
    '<div id="pep-exit-modal">' +
      '<button type="button" id="pep-exit-close" aria-label="Close">&times;</button>' +
      '<div class="pep-emoji">&#129516;</div>' +
      '<div class="pep-heading">Before You Go&hellip;</div>' +
      '<p class="pep-body">' +
        'Get our free Peptide Therapy Guide with pricing, dosing protocols, ' +
        'side effects, and everything you need to know &mdash; sent straight to your inbox.' +
      '</p>' +
      '<form id="pep-exit-form">' +
        '<input type="text" name="name" placeholder="First name" autocomplete="given-name" />' +
        '<input type="email" name="email" placeholder="Email address" required autocomplete="email" />' +
        '<button type="submit" class="btn-primary">Send Me the Guide</button>' +
      '</form>' +
      '<p class="pep-disclaimer">No spam. Unsubscribe anytime.</p>' +
      '<p class="pep-disclaimer" style="margin-top:6px;">For educational purposes only. Not medical advice.</p>' +
    '</div>';
  document.body.appendChild(overlay);

  // ─── Show / hide helpers ───────────────────────────────────────
  function showModal() {
    if (shown) return;
    shown = true;
    overlay.classList.add('pep-active');

    // GA4 event
    if (typeof gtag === 'function') {
      gtag('event', 'exit_intent_shown', {
        page: path,
        popup: 'peptide_guide'
      });
    }
  }

  function hideModal() {
    overlay.classList.remove('pep-active');
  }

  function dismiss() {
    hideModal();
    document.cookie = 'mmp_peptide_exit_dismissed=1;max-age=2592000;path=/;SameSite=Lax';
  }

  // ─── Close handlers ────────────────────────────────────────────
  document.getElementById('pep-exit-close').addEventListener('click', dismiss);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) dismiss();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('pep-active')) dismiss();
  });

  // ─── Desktop: mouseout near top of viewport ───────────────────
  document.addEventListener('mouseout', function (e) {
    if (e.clientY < 10 && !shown) {
      showModal();
    }
  });

  // ─── Mobile: timer fallback (45 seconds) ──────────────────────
  if ('ontouchstart' in window) {
    setTimeout(function () {
      if (!shown) showModal();
    }, 45000);
  }

  // ─── Form submit ──────────────────────────────────────────────
  document.getElementById('pep-exit-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var nameVal = (form.elements.name.value || '').trim();
    var emailVal = (form.elements.email.value || '').trim();

    if (!emailVal || emailVal.indexOf('@') === -1) {
      form.elements.email.focus();
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'SENDING...';

    fetch('/.netlify/functions/peptide-guide-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nameVal,
        email: emailVal,
        source_page: path,
        source_url: location.href
      })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.ok) {
        // Persist so it never shows again
        try { localStorage.setItem('mmp_peptide_guide_sent', '1'); } catch (ex) {}
        document.cookie = 'mmp_peptide_exit_dismissed=1;max-age=2592000;path=/;SameSite=Lax';

        // Suppress scroll quiz prompt (avoid double-popup)
        try { sessionStorage.setItem('quiz_prompt_shown', '1'); } catch (ex) {}

        // GA4
        if (typeof gtag === 'function') {
          gtag('event', 'lead_capture', {
            magnet: 'peptide_guide',
            page: path
          });
        }

        // Show success
        var modal = document.getElementById('pep-exit-modal');
        modal.innerHTML =
          '<button type="button" id="pep-exit-close" aria-label="Close">&times;</button>' +
          '<div class="pep-success">' +
            '<div style="font-size:2.5rem;margin-bottom:.75rem;">&#9989;</div>' +
            '<strong>Check your inbox!</strong>' +
            'Your Peptide Therapy Guide is on its way.' +
          '</div>';
        document.getElementById('pep-exit-close').addEventListener('click', hideModal);
      } else {
        btn.disabled = false;
        btn.textContent = 'SEND ME THE GUIDE';
      }
    })
    .catch(function () {
      btn.disabled = false;
      btn.textContent = 'SEND ME THE GUIDE';
    });
  });
})();
