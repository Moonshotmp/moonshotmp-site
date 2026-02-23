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

  const { name, email, score, maxScore, questionResults } = data;

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400 });
  }

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  let gradeLabel, gradeColor;
  if (pct >= 80) { gradeLabel = 'Excellent'; gradeColor = '#4ade80'; }
  else if (pct >= 60) { gradeLabel = 'Good'; gradeColor = '#B2BFBE'; }
  else if (pct >= 40) { gradeLabel = 'Fair'; gradeColor = '#ca8a04'; }
  else { gradeLabel = 'Needs Work'; gradeColor = '#dc2626'; }

  // Build question breakdown for email
  let breakdownHtml = '';
  for (const q of (questionResults || [])) {
    const icon = q.correct ? '&#10003;' : '&#10007;';
    const color = q.correct ? '#4ade80' : '#dc2626';
    breakdownHtml += `
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px 16px; margin-bottom: 8px;">
        <p style="margin: 0 0 4px;">
          <span style="color: ${color}; font-weight: 700;">${icon}</span>
          <span style="color: #F0EEE9; font-size: 13px; font-weight: 600;"> ${q.question}</span>
        </p>
        ${!q.correct ? `<p style="color: #B2BFBE; font-size: 12px; margin: 0 0 4px;">Your answer: ${q.userAnswer} &mdash; Correct: ${q.correctAnswer}</p>` : ''}
        <p style="color: #B2BFBE; font-size: 12px; margin: 0; font-style: italic;">${q.explanation}</p>
      </div>`;
  }

  const BASE = 'https://moonshotmp.com';

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

      <h1 style="color: #F0EEE9; margin: 0 0 4px; font-size: 22px;">Your Body Comp IQ Results</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Moonshot Medical and Performance</p>

      <!-- Score -->
      <div style="text-align: center; padding: 24px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #B2BFBE; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Your Score</p>
        <p style="font-size: 48px; font-weight: 700; margin: 0 0 8px; color: ${gradeColor};">${score}<span style="color: #B2BFBE; font-size: 20px;">/${maxScore}</span></p>
        <span style="display: inline-block; padding: 4px 16px; border-radius: 4px; font-size: 13px; font-weight: 700; background: ${gradeColor}; color: #101921;">${gradeLabel.toUpperCase()}</span>
      </div>

      <!-- Breakdown -->
      <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 12px;">Question Breakdown</p>
      ${breakdownHtml}

      <!-- Key Takeaways -->
      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 20px; margin: 24px 0;">
        <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 12px;">Key Takeaways</p>
        <ul style="color: #B2BFBE; font-size: 13px; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 6px;"><strong>DEXA is the gold standard</strong> for measuring body fat, lean mass, bone density, and visceral fat.</li>
          <li style="margin-bottom: 6px;"><strong>Scale weight is misleading</strong> &mdash; it can't distinguish fat from muscle.</li>
          <li style="margin-bottom: 6px;"><strong>Visceral fat</strong> is the #1 predictor of metabolic disease and is invisible without proper measurement.</li>
          <li><strong>Muscle mass</strong> is the strongest predictor of longevity and quality of life as you age.</li>
        </ul>
      </div>

      <!-- CTA -->
      <div style="text-align: center; padding: 24px 0;">
        <p style="color: #B2BFBE; font-size: 14px; margin: 0 0 16px;">Ready to see your real numbers?</p>
        <a href="${BASE}/medical/dexa-body-composition/" style="display: inline-block; background: #B2BFBE; color: #101921; padding: 14px 32px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 4px;">Book a DEXA Scan</a>
      </div>

    </div>

    <p style="color: #666; font-size: 11px; text-align: center; margin-top: 24px; line-height: 1.5;">
      This quiz is for educational purposes only.<br>
      Moonshot Medical and Performance &middot; 542 Busse Hwy, Park Ridge, IL 60068
    </p>
  </div>
</body>
</html>`.trim();

  const userSubject = `Your Body Comp IQ: ${score}/${maxScore} (${gradeLabel})`;

  // ── Internal Lead Notification ──────────────────────────────────────
  const correctCount = (questionResults || []).filter(q => q.correct).length;
  const incorrectCount = (questionResults || []).filter(q => !q.correct).length;

  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">New Body Comp Quiz Lead</h1>
      <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Body Comp IQ Quiz Submission</p>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Contact</p>
        <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Name: ${name || 'Not provided'}</p>
        <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Email: ${email}</p>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
        <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Score</p>
        <p style="color: ${gradeColor}; font-size: 28px; font-weight: 700; margin: 0 0 4px;">${score}/${maxScore}</p>
        <p style="color: #B2BFBE; font-size: 14px; margin: 0;">${gradeLabel} &middot; ${correctCount} correct, ${incorrectCount} incorrect</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  const internalSubject = `Body Comp Quiz Lead: ${name || email} — ${score}/${maxScore}`;

  // ── Send Both Emails ────────────────────────────────────────────────

  try {
    await Promise.all([
      sendEmail({ to: email, subject: userSubject, html: userHtml }),
      sendEmail({ to: 'hello@moonshotmp.com', subject: internalSubject, html: internalHtml })
    ]);

    // Sync to clinic marketing drip (non-blocking)
    try {
      const clinicApi = process.env.CLINIC_API_BASE || 'https://api.moonshotclinic.com';
      const webhookHeaders = {
        'Content-Type': 'application/json',
        'X-Tenant-Slug': 'moonshot',
        'X-Webhook-Key': process.env.CLINIC_LEAD_WEBHOOK_KEY || ''
      };

      // Lead webhook
      await fetch(clinicApi + '/api/leads/webhook', {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
          name,
          email,
          source: 'body_comp_quiz',
          totalScore: score,
          maxScore,
          classification: gradeLabel
        })
      });

      // Marketing drip webhook
      await fetch(clinicApi + '/api/marketing/quiz-complete', {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
          email,
          name,
          quiz_type: 'body_comp',
          score,
          max_score: maxScore,
          classification: gradeLabel,
          categories: [],
          quiz_data: { score, maxScore, gradeLabel, questionResults }
        })
      });
    } catch (err) {
      console.error('[bodycomp-submit] Clinic sync error:', err.message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[bodycomp-submit] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
