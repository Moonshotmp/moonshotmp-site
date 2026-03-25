import { sendEmail } from './send-email.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let data;
  try {
    data = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { name, email, source, protocol } = data;

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400 });
  }

  const firstName = name ? name.split(' ')[0] : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const sourceLabel = source || 'direct';

  // ── Peptide catalog ───────────────────────────────────────────────
  const peptides = {
    'BPC-157':       { price: 250, category: 'Healing & Repair',          desc: 'Accelerates tendon, ligament, muscle, and gut healing by upregulating growth factors at the injury site.', dosing: 'Daily injection', cycle: '4-12 weeks' },
    'TB-500':        { price: 250, category: 'Recovery & Mobility',       desc: 'Reduces systemic inflammation, improves flexibility, and accelerates soft tissue recovery.', dosing: '2x/week injection', cycle: '6-12 weeks' },
    'Wolverine Blend': { price: 350, category: 'Healing + Recovery',      desc: 'BPC-157 + TB-500 combined for maximum regenerative effect \u2014 localized repair plus systemic recovery.', dosing: 'Daily/EOD injection', cycle: '4-12 weeks' },
    'GHK-Cu':        { price: 175, category: 'Skin & Anti-Aging',        desc: 'Copper peptide that stimulates collagen and elastin production for improved skin firmness, texture, and wound healing.', dosing: 'Daily injection', cycle: '3-6 months' },
    'Glow Stack':    { price: 350, category: 'Skin + Hair + Nails',      desc: 'GHK-Cu plus complementary peptides targeting collagen, follicular health, and skin radiance.', dosing: 'Daily/EOD injection', cycle: '3-6 months' },
    'Sermorelin':    { price: 250, category: 'Growth Hormone Optimization', desc: 'Stimulates your pituitary to produce its own growth hormone \u2014 better sleep, body composition, recovery, and energy.', dosing: 'Daily injection (bedtime)', cycle: 'Ongoing' },
    'PT-141':        { price: 250, category: 'Sexual Health',             desc: 'Works through the brain to increase sexual desire and arousal. Effective for both men and women.', dosing: 'As needed', cycle: 'As needed' },
  };

  // ── Protocol summary (if from calculator) ─────────────────────────
  let protocolHtml = '';
  let protocolTotal = 0;
  let protocolNames = [];

  if (protocol && Array.isArray(protocol) && protocol.length > 0) {
    let rows = '';
    for (const p of protocol) {
      const info = peptides[p] || {};
      const price = info.price || 0;
      protocolTotal += price;
      protocolNames.push(p);
      rows += `
        <tr>
          <td style="padding: 10px 12px; color: #F0EEE9; font-weight: 600; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05);">${p}</td>
          <td style="padding: 10px 12px; color: #B2BFBE; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05);">${info.dosing || '\u2014'}</td>
          <td style="padding: 10px 12px; color: #F0EEE9; font-weight: 600; font-size: 14px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.05);">$${price}/mo</td>
        </tr>`;
    }

    protocolHtml = `
      <div style="background: rgba(74, 222, 128, 0.08); border: 1px solid rgba(74,222,128,0.2); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #4ade80; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">Your Personalized Protocol</p>
        <p style="color: #B2BFBE; font-size: 14px; line-height: 1.5; margin: 0 0 16px;">Based on your selections, here\u2019s your recommended protocol:</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${rows}
          <tr>
            <td colspan="2" style="padding: 12px 12px 0; color: #F0EEE9; font-weight: 700; font-size: 14px;">Estimated Monthly Total</td>
            <td style="padding: 12px 12px 0; color: #4ade80; font-weight: 700; font-size: 18px; text-align: right;">$${protocolTotal}/mo</td>
          </tr>
        </table>
      </div>`;
  }

  // ── Full peptide menu rows ────────────────────────────────────────
  let menuHtml = '';
  for (const [pName, info] of Object.entries(peptides)) {
    menuHtml += `
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: #F0EEE9; font-weight: 700; font-size: 16px;">${pName}</span>
          <span style="color: #F0EEE9; font-weight: 600; font-size: 14px;">$${info.price}/mo</span>
        </div>
        <p style="color: #B2BFBE; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px;">${info.category}</p>
        <p style="color: #B2BFBE; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">${info.desc}</p>
        <p style="color: #888; font-size: 12px; margin: 0;">${info.dosing} &middot; ${info.cycle}</p>
      </div>`;
  }

  // ── Comparison table ──────────────────────────────────────────────
  const comparisonHtml = `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 24px 0;">
      <thead>
        <tr>
          <th style="background: rgba(255,255,255,0.1); padding: 8px 6px; text-align: left; color: #B2BFBE; font-weight: 600; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1);"></th>
          <th style="background: rgba(255,255,255,0.1); padding: 8px 6px; text-align: center; color: #B2BFBE; font-weight: 600; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1);">BPC-157</th>
          <th style="background: rgba(255,255,255,0.1); padding: 8px 6px; text-align: center; color: #B2BFBE; font-weight: 600; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1);">TB-500</th>
          <th style="background: rgba(255,255,255,0.1); padding: 8px 6px; text-align: center; color: #B2BFBE; font-weight: 600; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1);">Wolverine</th>
          <th style="background: rgba(255,255,255,0.1); padding: 8px 6px; text-align: center; color: #B2BFBE; font-weight: 600; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1);">GHK-Cu</th>
          <th style="background: rgba(255,255,255,0.1); padding: 8px 6px; text-align: center; color: #B2BFBE; font-weight: 600; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1);">Glow</th>
          <th style="background: rgba(255,255,255,0.1); padding: 8px 6px; text-align: center; color: #B2BFBE; font-weight: 600; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1);">Sermorelin</th>
          <th style="background: rgba(255,255,255,0.1); padding: 8px 6px; text-align: center; color: #B2BFBE; font-weight: 600; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.1);">PT-141</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 6px; color: #B2BFBE; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05);">Price</td>
          <td style="padding: 6px; text-align: center; color: #F0EEE9; border-bottom: 1px solid rgba(255,255,255,0.05);">$250</td>
          <td style="padding: 6px; text-align: center; color: #F0EEE9; border-bottom: 1px solid rgba(255,255,255,0.05);">$250</td>
          <td style="padding: 6px; text-align: center; color: #F0EEE9; border-bottom: 1px solid rgba(255,255,255,0.05);">$350</td>
          <td style="padding: 6px; text-align: center; color: #F0EEE9; border-bottom: 1px solid rgba(255,255,255,0.05);">$175</td>
          <td style="padding: 6px; text-align: center; color: #F0EEE9; border-bottom: 1px solid rgba(255,255,255,0.05);">$350</td>
          <td style="padding: 6px; text-align: center; color: #F0EEE9; border-bottom: 1px solid rgba(255,255,255,0.05);">$250</td>
          <td style="padding: 6px; text-align: center; color: #F0EEE9; border-bottom: 1px solid rgba(255,255,255,0.05);">$250</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #B2BFBE; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05);">Best For</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Healing</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Recovery</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Both</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Skin</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">All 3</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Optimize</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Sexual</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #B2BFBE; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.05);">Injection</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Daily</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">2x/wk</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Daily/EOD</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Daily</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Daily/EOD</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">Daily</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);">As needed</td>
        </tr>
        <tr>
          <td style="padding: 6px; color: #B2BFBE; font-weight: 600;">Cycle</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px;">4-12 wk</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px;">6-12 wk</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px;">4-12 wk</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px;">3-6 mo</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px;">3-6 mo</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px;">Ongoing</td>
          <td style="padding: 6px; text-align: center; color: #B2BFBE; font-size: 11px;">As needed</td>
        </tr>
      </tbody>
    </table>`;

  // ── User Email ────────────────────────────────────────────────────

  const userHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">

      <h1 style="color: #F0EEE9; margin: 0 0 4px; font-size: 22px;">Your Peptide Therapy Guide</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Moonshot Medical and Performance</p>

      <p style="color: #B2BFBE; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${greeting}</p>
      <p style="color: #B2BFBE; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Here\u2019s your complete peptide therapy guide from Moonshot Medical. Everything you need to know about our peptide protocols \u2014 what they do, what they cost, and how to get started.</p>

      ${protocolHtml}

      <!-- Full Menu -->
      <p style="color: #F0EEE9; font-weight: 700; font-size: 16px; margin: 24px 0 16px;">Our Peptide Menu</p>
      ${menuHtml}

      <!-- Comparison Table -->
      <p style="color: #F0EEE9; font-weight: 700; font-size: 16px; margin: 24px 0 12px;">Quick Comparison</p>
      ${comparisonHtml}

      <!-- What's Included -->
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 12px;">What\u2019s Included With Every Protocol</p>
        <ul style="color: #B2BFBE; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Pharmaceutical-grade compound from a licensed 503A pharmacy</li>
          <li>Medical evaluation and personalized dosing protocol</li>
          <li>Injection supplies and in-person injection training</li>
          <li>Ongoing medical oversight and protocol adjustments</li>
        </ul>
      </div>

      <!-- How to Get Started -->
      <p style="color: #F0EEE9; font-weight: 700; font-size: 16px; margin: 24px 0 12px;">How to Get Started</p>
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 8px;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 4px;">1. Book a Consultation</p>
        <p style="color: #B2BFBE; font-size: 13px; margin: 0;">Free consultation at our Park Ridge clinic or via telehealth.</p>
      </div>
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 8px;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 4px;">2. Medical Evaluation</p>
        <p style="color: #B2BFBE; font-size: 13px; margin: 0;">Your provider determines the optimal peptide and dosing protocol for your goals.</p>
      </div>
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 4px;">3. Begin Therapy</p>
        <p style="color: #B2BFBE; font-size: 13px; margin: 0;">Receive your compound, complete injection training, and start your protocol.</p>
      </div>

      <!-- CTA -->
      <div style="text-align: center; padding: 24px 0;">
        <a href="https://moonshotmp.com/booking/" style="display: inline-block; background: #B2BFBE; color: #101921; padding: 14px 32px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 4px;">Book Your Peptide Consultation</a>
        <p style="color: #B2BFBE; font-size: 13px; margin: 16px 0 8px;">
          <a href="https://moonshotmp.com/guides/peptide-guide/" style="color: #B2BFBE;">View the full guide online</a>
        </p>
        <p style="color: #B2BFBE; font-size: 13px; margin: 0;">Questions? Call <a href="tel:2244354280" style="color: #B2BFBE;">(224) 435-4280</a></p>
      </div>

    </div>

    <p style="color: #666; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
      This guide is for educational purposes only and does not constitute medical advice.<br>
      Peptide therapy requires a medical evaluation and prescription from a licensed provider.<br>
      Moonshot Medical and Performance &middot; 542 Busse Hwy, Park Ridge, IL 60068
    </p>
  </div>
</body>
</html>`.trim();

  const userSubject = 'Your Peptide Therapy Guide \u2014 Moonshot Medical';

  // ── Internal Notification Email ───────────────────────────────────

  const protocolList = protocolNames.length > 0 ? protocolNames.join(', ') : 'None (browsing)';
  const protocolTotalStr = protocolTotal > 0 ? `$${protocolTotal}/mo` : '\u2014';

  const sourceLabels = {
    'exit-intent': 'Exit Intent Popup',
    'calculator': 'Peptide Calculator',
    'direct': 'Direct Request'
  };

  let leadScore = '\uD83D\uDFE2 NEW';
  if (sourceLabel === 'calculator' && protocolNames.length > 0) {
    leadScore = '\uD83D\uDD25 HOT';
  } else if (sourceLabel === 'exit-intent') {
    leadScore = '\uD83D\uDFE1 WARM';
  }

  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">\uD83D\uDCCB Peptide Guide Request</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Lead Score: ${leadScore}</p>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Contact</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Name: ${name || 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Email: ${email}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Source</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Channel: ${sourceLabels[sourceLabel] || sourceLabel}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Source key: ${sourceLabel}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Protocol Interest</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Peptides: ${protocolList}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Estimated total: ${protocolTotalStr}</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const internalSubject = `\uD83D\uDCCB Peptide Guide Request: ${name || email} (${sourceLabel})`;

  // ── Send Both Emails ──────────────────────────────────────────────

  try {
    await Promise.all([
      sendEmail({ to: email, subject: userSubject, html: userHtml }),
      sendEmail({ to: 'hello@moonshotmp.com', subject: internalSubject, html: internalHtml })
    ]);

    // ── Webhook sync (non-blocking) ─────────────────────────────────
    const clinicApi = process.env.CLINIC_API_BASE || 'https://api.moonshotclinic.com';
    const webhookHeaders = {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': 'moonshot',
      'X-Webhook-Key': process.env.CLINIC_LEAD_WEBHOOK_KEY || ''
    };

    fetch(clinicApi + '/api/leads/webhook', {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        name: name || '',
        email,
        source: `peptide-guide-${sourceLabel}`,
        notes: `Requested peptide guide.${protocolNames.length > 0 ? ` Protocol: ${protocolNames.join(', ')}` : ''}`
      })
    }).catch(err => console.error('[peptide-guide-send] Clinic lead sync error:', err.message));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[peptide-guide-send] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
