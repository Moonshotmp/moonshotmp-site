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

  const {
    name, email, gender, age,
    primaryConcern, score, rawScore, maxRawScore,
    classification, categories,
    duration, readiness, lifestyle
  } = data;

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400 });
  }

  const BASE = 'https://moonshotmp.com';

  // ── Level color ─────────────────────────────────────────────────────
  const levelColors = { Low: '#B2BFBE', Moderate: '#ca8a04', Elevated: '#ea580c', High: '#dc2626' };
  const levelColor = levelColors[classification] || '#B2BFBE';

  // ── Category insight blurbs (gender-specific) ───────────────────────
  const categoryInsights = {
    energy_physical: {
      male: 'Energy and physical performance are among the most testosterone-sensitive functions. When T drops, your mitochondria produce less ATP and recovery slows.',
      female: 'Fatigue and physical changes are often the first signs of hormonal shifts. Estrogen, progesterone, and thyroid all directly regulate energy production.'
    },
    mental_mood: {
      male: 'Testosterone directly supports neurotransmitter function and cerebral blood flow. Brain fog and mood changes are well-documented effects of low T.',
      female: 'Estrogen and progesterone influence serotonin, GABA, and dopamine pathways. Hormonal shifts can cause mood changes that feel completely out of character.'
    },
    sleep_sexual: {
      male: 'Low T disrupts sleep architecture, and poor sleep further suppresses testosterone \u2014 creating a cycle that\'s hard to break without addressing the hormonal component.',
      female: 'Sleep disruption and intimacy changes are strongly linked to declining estrogen and progesterone. These hormones have natural calming, sleep-supporting properties.'
    }
  };

  // ── Category bars HTML ──────────────────────────────────────────────
  let catBarsHtml = '';
  for (const cat of (categories || [])) {
    const pct = cat.max > 0 ? Math.round((cat.score / cat.max) * 100) : 0;
    const barColor = pct <= 33 ? '#4b5563' : pct <= 66 ? '#ca8a04' : '#dc2626';
    catBarsHtml += `
      <tr>
        <td style="padding: 6px 0; color: #B2BFBE; font-size: 13px;">${cat.label}</td>
        <td style="padding: 6px 0; text-align: right; color: #F0EEE9; font-size: 13px; font-weight: 600;">${cat.score}/${cat.max}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 0 0 8px;">
          <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 6px; overflow: hidden;">
            <div style="background: ${barColor}; height: 6px; width: ${pct}%; border-radius: 4px;"></div>
          </div>
        </td>
      </tr>`;
  }

  // ── Top category insights ───────────────────────────────────────────
  const sorted = (categories || []).slice().sort((a, b) => b.score - a.score);
  const topInsightCats = sorted.filter(c => c.score > 0).slice(0, 3);

  let insightsHtml = '';
  for (const cat of topInsightCats) {
    const insight = categoryInsights[cat.key];
    if (!insight) continue;
    const blurb = gender === 'female' ? insight.female : insight.male;
    insightsHtml += `
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 12px;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">${cat.label}</p>
        <p style="color: #B2BFBE; font-size: 14px; line-height: 1.5; margin: 0;">${blurb}</p>
      </div>`;
  }

  // ── Gap analysis (gender-specific improvement stats) ────────────────
  const gapAnalysis = gender === 'female'
    ? {
        intro: 'Women with your profile who optimized their hormones reported:',
        bullets: [
          '73% improvement in energy and daily stamina',
          '68% reduction in mood swings and anxiety',
          '81% improvement in sleep quality',
          '65% improvement in body composition'
        ]
      }
    : {
        intro: 'Men with your profile who addressed their hormone levels reported:',
        bullets: [
          '78% improvement in energy and mental clarity',
          '71% improvement in body composition and strength',
          '83% improvement in sleep quality',
          '69% improvement in mood stability'
        ]
      };

  let gapBulletsHtml = '';
  for (const bullet of gapAnalysis.bullets) {
    gapBulletsHtml += `<li style="margin-bottom: 8px;">${bullet}</li>`;
  }

  // ── User Results Email ──────────────────────────────────────────────

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

      <h1 style="color: #F0EEE9; margin: 0 0 4px; font-size: 22px;">Your Hormone Health Results</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Moonshot Medical and Performance</p>

      <!-- Score Block -->
      <div style="text-align: center; padding: 24px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Your Score</p>
        <p style="font-size: 48px; font-weight: 700; margin: 0 0 8px; color: ${levelColor};">${score}<span style="color: #B2BFBE; font-size: 20px;">/100</span></p>
        <span style="display: inline-block; padding: 4px 16px; border-radius: 4px; font-size: 13px; font-weight: 700; background: ${levelColor}; color: #101921;">${classification.toUpperCase()}</span>
      </div>

      <!-- Category Breakdown -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        ${catBarsHtml}
      </table>

      <!-- Top Category Insights -->
      ${insightsHtml}

      <!-- Gap Analysis -->
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 12px;">What Others Like You Experienced</p>
        <p style="color: #B2BFBE; font-size: 14px; line-height: 1.5; margin: 0 0 12px;">${gapAnalysis.intro}</p>
        <ul style="color: #B2BFBE; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
          ${gapBulletsHtml}
        </ul>
      </div>

      <!-- CTA -->
      <div style="text-align: center; padding: 24px 0;">
        <p style="color: #B2BFBE; font-size: 14px; margin: 0 0 16px;">Ready to find out what\u2019s really going on?</p>
        <a href="${BASE}/medical/" style="display: inline-block; background: #B2BFBE; color: #101921; padding: 14px 32px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 4px;">Book Your Free Consultation</a>
      </div>

    </div>

    <p style="color: #666; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
      This quiz is for educational purposes only and is not a medical diagnosis.<br>
      Moonshot Medical and Performance &middot; 542 Busse Hwy, Park Ridge, IL 60068
    </p>
  </div>
</body>
</html>`.trim();

  const userSubject = `Your Hormone Health Score: ${score}/100 (${classification})`;

  // ── Internal Lead Notification Email ────────────────────────────────

  let catSummary = '';
  for (const cat of (categories || [])) {
    catSummary += `${cat.label}: ${cat.score}/${cat.max}\n`;
  }

  const lifestyleInfo = [
    `Exercise 3x/week: ${lifestyle?.exercise ? 'Yes' : 'No'}`,
    `7+ hours sleep: ${lifestyle?.sleep ? 'Yes' : 'No'}`,
    `Tested before: ${lifestyle?.tested ? 'Yes' : 'No'}`
  ].join('\n');

  const durationLabels = { weeks: 'Weeks', months: 'Months', '1-2years': '1\u20132 years', '3+years': '3+ years' };
  const readinessLabels = { very: 'Very ready', somewhat: 'Somewhat ready', curious: 'Just curious' };

  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">New Quiz Lead</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Hormone Health Quiz Submission</p>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Contact</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Name: ${name || 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Email: ${email}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Gender: ${gender} &middot; Age: ${age}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Score</p>
        <p style="color: ${levelColor}; font-size: 28px; font-weight: 700; margin: 0 0 4px;">${score}/100</p>
        <p style="color: #B2BFBE; font-size: 14px; margin: 0 0 4px;">Classification: ${classification}</p>
        <p style="color: #B2BFBE; font-size: 13px; margin: 0;">Raw: ${rawScore}/${maxRawScore}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Category Breakdown</p>
        <pre style="color: #B2BFBE; font-size: 13px; margin: 0; white-space: pre-wrap; font-family: monospace;">${catSummary}</pre>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Primary Concern</p>
        <p style="color: #B2BFBE; font-size: 14px; margin: 0;">${primaryConcern || 'Not specified'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Duration of Symptoms</p>
        <p style="color: #B2BFBE; font-size: 14px; margin: 0;">${durationLabels[duration] || duration || 'Not specified'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Readiness Level</p>
        <p style="color: #B2BFBE; font-size: 14px; margin: 0;">${readinessLabels[readiness] || readiness || 'Not specified'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Lifestyle</p>
        <pre style="color: #B2BFBE; font-size: 13px; margin: 0; white-space: pre-wrap; font-family: monospace;">${lifestyleInfo}</pre>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const internalSubject = `Quiz Lead: ${name || email} \u2014 ${classification} (${score}/100)`;

  // ── Send Both Emails ────────────────────────────────────────────────

  try {
    await Promise.all([
      sendEmail({ to: email, subject: userSubject, html: userHtml }),
      sendEmail({ to: 'hello@moonshotmp.com', subject: internalSubject, html: internalHtml })
    ]);

    // ── Webhook syncs (non-blocking) ──────────────────────────────────
    const clinicApi = process.env.CLINIC_API_BASE || 'https://api.moonshotclinic.com';
    const webhookHeaders = {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': 'moonshot',
      'X-Webhook-Key': process.env.CLINIC_LEAD_WEBHOOK_KEY || ''
    };

    // Lead webhook — map score → totalScore for backward compat
    fetch(clinicApi + '/api/leads/webhook', {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        name, email, gender, age,
        totalScore: score,
        maxScore: 100,
        classification,
        categories,
        lifestyle
      })
    }).catch(err => console.error('[quiz-submit] Clinic lead sync error:', err.message));

    // Marketing drip webhook
    fetch(clinicApi + '/api/marketing/quiz-complete', {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({
        email,
        name,
        quiz_type: 'hormone',
        gender,
        score,
        max_score: 100,
        classification,
        categories: sorted,
        quiz_data: {
          primaryConcern,
          duration,
          readiness,
          lifestyle,
          age,
          gender,
          rawScore,
          maxRawScore
        }
      })
    }).catch(err => console.error('[quiz-submit] Marketing drip sync error:', err.message));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[quiz-submit] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
