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

  const { name, email, gender, age, totalScore, maxScore, classification, categories, lifestyle } = data;

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400 });
  }

  // Blurbs for email
  const maleBlurbs = {
    energy:   { text: 'Persistent fatigue is one of the most common signs of low testosterone. T plays a direct role in mitochondrial energy production and red blood cell formation.', link: '/learn/low-testosterone-symptoms/' },
    mental:   { text: 'Brain fog and poor memory are well-documented effects of low T. Testosterone supports neurotransmitter function and cerebral blood flow.', link: '/learn/low-testosterone-symptoms/' },
    mood:     { text: 'Testosterone directly influences serotonin and dopamine pathways. Low levels are associated with irritability, depression, and anxiety.', link: '/learn/low-testosterone-symptoms/' },
    sleep:    { text: 'Low T disrupts sleep architecture, and poor sleep further suppresses T. Breaking this cycle often requires addressing the hormonal component.', link: '/learn/sleep-optimization/' },
    body:     { text: 'Testosterone is your body\u2019s primary muscle-building and fat-regulating hormone. When levels decline, you store more fat and lose muscle regardless of effort.', link: '/medical/mens-hormones/' },
    sexual:   { text: 'Libido and erectile function are among the most testosterone-sensitive functions. Often the first noticeable sign of declining hormone levels.', link: '/medical/mens-hormones/' },
    physical: { text: 'Joint pain, temperature dysregulation, and hair changes can all have hormonal roots. T supports collagen synthesis and thermoregulation.', link: '/medical/mens-hormones/' },
    recovery: { text: 'Testosterone is essential for tissue repair, immune function, and workout recovery. Slow healing can indicate hormonal deficiency.', link: '/medical/mens-hormones/' }
  };

  const femaleBlurbs = {
    energy:      { text: 'Fatigue in women is frequently tied to declining estrogen, progesterone, or thyroid. These hormones directly regulate cellular energy production.', link: '/learn/menopause-perimenopause/' },
    temperature: { text: 'Hot flashes and night sweats are the hallmark of estrogen decline \u2014 caused by disruption of your hypothalamic thermostat. BHRT is the most effective treatment.', link: '/learn/menopause-perimenopause/' },
    sleep:       { text: 'Sleep disruption in women is strongly linked to progesterone decline. Progesterone has natural calming, GABA-enhancing properties.', link: '/learn/progesterone/' },
    mood:        { text: 'Estrogen and progesterone both influence serotonin, GABA, and dopamine. Hormonal shifts can cause mood swings and anxiety that feel completely out of character.', link: '/learn/menopause-perimenopause/' },
    mental:      { text: 'Estrogen supports acetylcholine and cerebral blood flow. When it declines, brain fog and word-finding difficulty follow.', link: '/learn/estrogen-dominance/' },
    sexual:      { text: 'Vaginal dryness, low libido, and painful intercourse are caused by declining estrogen and testosterone. Both are critical for female sexual health.', link: '/learn/testosterone-for-women/' },
    body:        { text: 'Estrogen regulates where your body stores fat. As it declines, fat shifts to the midsection. Add declining testosterone and muscle loss accelerates.', link: '/learn/testosterone-for-women/' },
    bladder:     { text: 'Estrogen maintains urinary tract tissues and pelvic floor. Declining levels lead to urgency, frequency, and incontinence.', link: '/learn/menopause-perimenopause/' }
  };

  const blurbs = gender === 'female' ? femaleBlurbs : maleBlurbs;
  const sorted = (categories || []).slice().sort((a, b) => b.score - a.score);
  const top3 = sorted.filter(c => c.score > 0).slice(0, 3);
  const BASE = 'https://moonshotmp.com';

  // Level color for results
  let levelColor = '#B2BFBE';
  if (classification === 'Moderate') levelColor = '#ca8a04';
  else if (classification === 'Elevated') levelColor = '#ea580c';
  else if (classification === 'High') levelColor = '#dc2626';

  // Build category bars HTML for email
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

  // Build top insights
  let insightsHtml = '';
  for (const cat of top3) {
    const b = blurbs[cat.key];
    if (!b) continue;
    insightsHtml += `
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 12px;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">${cat.label}</p>
        <p style="color: #B2BFBE; font-size: 14px; line-height: 1.5; margin: 0 0 8px;">${b.text}</p>
        <a href="${BASE}${b.link}" style="color: #B2BFBE; font-size: 12px;">Learn more &rarr;</a>
      </div>`;
  }

  // Optimization tips
  const tips = gender === 'female'
    ? [
        '<strong>Prioritize sleep hygiene:</strong> Dark, cool room. Consistent bedtime. Limit screens 1 hour before bed.',
        '<strong>Strength training 3x/week:</strong> Resistance training supports bone density, metabolism, and hormone production.',
        '<strong>Manage stress actively:</strong> Chronic stress elevates cortisol, which disrupts estrogen, progesterone, and thyroid.'
      ]
    : [
        '<strong>Prioritize sleep:</strong> 7\u20139 hours in a dark, cool room. Poor sleep directly suppresses testosterone production.',
        '<strong>Lift heavy things:</strong> Compound strength training is one of the most effective natural testosterone boosters.',
        '<strong>Manage stress and body fat:</strong> Excess body fat converts testosterone to estrogen. Cortisol directly suppresses T.'
      ];

  let tipsHtml = '';
  for (const tip of tips) {
    tipsHtml += `<li style="margin-bottom: 8px;">${tip}</li>`;
  }

  // ── User Email ──────────────────────────────────────────────────────

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

      <!-- Score -->
      <div style="text-align: center; padding: 24px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Your Score</p>
        <p style="font-size: 48px; font-weight: 700; margin: 0 0 8px; color: ${levelColor};">${totalScore}<span style="color: #B2BFBE; font-size: 20px;">/${maxScore}</span></p>
        <span style="display: inline-block; padding: 4px 16px; border-radius: 4px; font-size: 13px; font-weight: 700; background: ${levelColor}; color: #101921;">${classification.toUpperCase()}</span>
      </div>

      <!-- Category Breakdown -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        ${catBarsHtml}
      </table>

      <!-- Top Insights -->
      ${insightsHtml}

      <!-- Tips -->
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 12px;">Practical Optimization Tips</p>
        <ul style="color: #B2BFBE; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
          ${tipsHtml}
        </ul>
      </div>

      <!-- CTA -->
      <div style="text-align: center; padding: 24px 0;">
        <p style="color: #B2BFBE; font-size: 14px; margin: 0 0 16px;">Ready to find out what\u2019s really going on?</p>
        <a href="${BASE}/medical/blood-panels/" style="display: inline-block; background: #B2BFBE; color: #101921; padding: 14px 32px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 4px;">Book Blood Work</a>
      </div>

    </div>

    <p style="color: #666; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
      This quiz is for educational purposes only and is not a medical diagnosis.<br>
      Moonshot Medical and Performance &middot; 542 Busse Hwy, Park Ridge, IL 60068
    </p>
  </div>
</body>
</html>`.trim();

  const userSubject = `Your Hormone Health Score: ${totalScore}/${maxScore} (${classification})`;

  // ── Internal Lead Notification ──────────────────────────────────────

  let catSummary = '';
  for (const cat of (categories || [])) {
    catSummary += `${cat.label}: ${cat.score}/${cat.max}\n`;
  }

  const lifestyleInfo = [
    `Exercise 3x/week: ${lifestyle?.exercise ? 'Yes' : 'No'}`,
    `7+ hours sleep: ${lifestyle?.sleep ? 'Yes' : 'No'}`,
    `Tested before: ${lifestyle?.tested ? 'Yes' : 'No'}`
  ].join('\n');

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
        <p style="color: ${levelColor}; font-size: 28px; font-weight: 700; margin: 0 0 4px;">${totalScore}/${maxScore}</p>
        <p style="color: #B2BFBE; font-size: 14px; margin: 0;">Classification: ${classification}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Category Breakdown</p>
        <pre style="color: #B2BFBE; font-size: 13px; margin: 0; white-space: pre-wrap; font-family: monospace;">${catSummary}</pre>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Top Categories</p>
        <p style="color: #B2BFBE; font-size: 14px; margin: 0;">${top3.map(c => c.label + ' (' + c.score + ')').join(', ') || 'None'}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Lifestyle</p>
        <pre style="color: #B2BFBE; font-size: 13px; margin: 0; white-space: pre-wrap; font-family: monospace;">${lifestyleInfo}</pre>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const internalSubject = `Quiz Lead: ${name || email} \u2014 ${classification} (${totalScore}/${maxScore})`;

  // ── Send Both Emails ────────────────────────────────────────────────

  try {
    await Promise.all([
      sendEmail({ to: email, subject: userSubject, html: userHtml }),
      sendEmail({ to: 'hello@moonshotmp.com', subject: internalSubject, html: internalHtml })
    ]);

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
