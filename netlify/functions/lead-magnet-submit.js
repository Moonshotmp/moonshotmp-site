import { sendEmail } from './send-email.js';

// ─── 7 Lead Magnet Email Templates ──────────────────────────────────

const MAGNETS = {
  mens_hormone: generateMensHormone,
  womens_hormone: generateWomensHormone,
  weight_loss: generateWeightLoss,
  body_comp: generateBodyComp,
  diagnostics: generateDiagnostics,
  rehab: generateRehab,
  general: generateGeneral,
};

const BASE = 'https://moonshotmp.com';

function emailWrap(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      ${bodyHtml}
    </div>
    <div style="text-align: center; margin-top: 24px;">
      <p style="color: #666; font-size: 11px; line-height: 1.5;">
        Moonshot Medical and Performance &middot; 542 Busse Hwy, Park Ridge, IL 60068
      </p>
    </div>
  </div>
</body>
</html>`;
}

function ctaBtn(text, href) {
  return `<div style="text-align: center; padding: 24px 0;">
    <a href="${href}" style="display: inline-block; background: #B2BFBE; color: #101921; padding: 14px 32px; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 4px;">${text}</a>
  </div>`;
}

function sectionBox(title, items) {
  let html = `<div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 12px;">
    <p style="color: #F0EEE9; font-weight: 600; font-size: 14px; margin: 0 0 10px;">${title}</p>
    <ul style="color: #B2BFBE; font-size: 13px; line-height: 1.7; margin: 0; padding-left: 18px;">`;
  for (const item of items) {
    html += `<li style="margin-bottom: 4px;">${item}</li>`;
  }
  html += `</ul></div>`;
  return html;
}

function checklistItem(text) {
  return `<div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px 16px; margin-bottom: 8px;">
    <span style="color: #B2BFBE; font-size: 14px; line-height: 1.5;">&#9744; ${text}</span>
  </div>`;
}

function heading(text) {
  return `<h1 style="color: #F0EEE9; margin: 0 0 4px; font-size: 22px;">${text}</h1>
    <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Moonshot Medical and Performance</p>`;
}

function para(text) {
  return `<p style="color: #B2BFBE; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${text}</p>`;
}

function subhead(text) {
  return `<p style="color: #F0EEE9; font-weight: 600; font-size: 15px; margin: 20px 0 10px;">${text}</p>`;
}

// ─── 1. Men's Hormone: Low T Warning Signs Checklist ─────────────

function generateMensHormone(name) {
  const fn = name ? name.split(' ')[0] : '';
  const g = fn ? `Hi ${fn},` : 'Hi,';
  const subject = 'Your Low T Warning Signs Checklist';
  const html = emailWrap(`
    ${heading('Low T Warning Signs Checklist')}
    ${para(`${g}`)}
    ${para('Thanks for downloading the checklist. Here are the 10 most common signs of low testosterone that men tend to write off as "just getting older" — along with the lab markers you should actually be checking.')}

    ${subhead('The Warning Signs')}
    ${checklistItem('<strong>Fatigue by mid-afternoon</strong> — not from poor sleep, but despite sleeping 7+ hours')}
    ${checklistItem('<strong>Brain fog and poor focus</strong> — difficulty concentrating, forgetting words mid-sentence')}
    ${checklistItem('<strong>Stubborn belly fat</strong> — gaining visceral fat despite consistent training and diet')}
    ${checklistItem('<strong>Declining libido</strong> — noticeable drop in sex drive compared to 2-5 years ago')}
    ${checklistItem('<strong>Mood changes</strong> — increased irritability, anxiety, or low-grade depression')}
    ${checklistItem('<strong>Loss of morning erections</strong> — a reliable biomarker of hormonal status')}
    ${checklistItem('<strong>Poor recovery from workouts</strong> — excessive soreness, longer recovery times')}
    ${checklistItem('<strong>Sleep disruption</strong> — waking at 3-4am, difficulty staying asleep')}
    ${checklistItem('<strong>Loss of muscle mass</strong> — feeling weaker despite maintaining training volume')}
    ${checklistItem('<strong>Joint pain or stiffness</strong> — T supports collagen synthesis and joint health')}

    ${subhead('What Your Labs Should Include')}
    ${sectionBox('Minimum Panel', [
      '<strong>Total Testosterone</strong> — the headline number (optimal: 600-900 ng/dL, not just "in range")',
      '<strong>Free Testosterone</strong> — what your body can actually use',
      '<strong>SHBG</strong> — sex hormone binding globulin (high SHBG = less bioavailable T)',
      '<strong>Estradiol (E2)</strong> — elevated estrogen causes fat gain, water retention, mood issues',
      '<strong>LH & FSH</strong> — distinguish between primary and secondary hypogonadism',
    ])}
    ${sectionBox('Also Worth Checking', [
      'Thyroid panel (TSH, Free T3, Free T4)',
      'Metabolic panel + HbA1c (insulin resistance tanks T)',
      'DHEA-S, Cortisol (AM)',
      'CBC + lipid panel',
    ])}

    ${para('<strong>Key insight:</strong> "Normal" lab ranges include sick and symptomatic people. A total T of 300 ng/dL is technically "in range" but it\'s the bottom 5% — levels typically seen in men 20-30 years older. Optimal is not the same as normal.')}

    ${ctaBtn('Book Blood Work', `${BASE}/medical/blood-panels/`)}

    ${para('If 3+ items on this checklist hit home, it\'s worth getting tested. Not to confirm a diagnosis — to get data.')}
  `);
  return { subject, html };
}

// ─── 2. Women's Hormone: Hormone Balance Guide ──────────────────

function generateWomensHormone(name) {
  const fn = name ? name.split(' ')[0] : '';
  const g = fn ? `Hi ${fn},` : 'Hi,';
  const subject = 'Your Hormone Balance Guide for Women';
  const html = emailWrap(`
    ${heading('Hormone Balance Guide for Women')}
    ${para(`${g}`)}
    ${para('Thanks for requesting the guide. Here\'s a practical breakdown of the three hormones that define how you feel day-to-day — and what to do when they\'re off.')}

    ${subhead('The Three Hormones That Matter Most')}

    ${sectionBox('Estrogen (Estradiol)', [
      'Regulates mood, sleep, skin elasticity, bone density, and cognitive function',
      'Decline begins in perimenopause — often 8-10 years before actual menopause',
      'Symptoms of low estrogen: hot flashes, night sweats, brain fog, vaginal dryness, mood swings',
      'Symptoms of excess estrogen: weight gain (hips/thighs), heavy periods, breast tenderness, anxiety',
    ])}
    ${sectionBox('Progesterone', [
      'Your calming hormone — enhances GABA (your brain\'s natural anti-anxiety molecule)',
      'First hormone to decline in perimenopause, often by age 35-40',
      'Low progesterone: insomnia, anxiety, irregular periods, PMS, spotting between periods',
      'Often overlooked because it\'s rarely tested in standard panels',
    ])}
    ${sectionBox('Testosterone', [
      'Not just a "male hormone" — women need it for energy, libido, muscle maintenance, and mood',
      'Declines ~50% between ages 20 and 40',
      'Low T in women: fatigue, low motivation, reduced libido, difficulty building muscle',
      'Almost never tested by conventional providers',
    ])}

    ${subhead('When to Get Tested')}
    ${para('If you\'re experiencing 2+ of the following, testing is warranted:')}
    ${sectionBox('Common Triggers', [
      'Fatigue that doesn\'t resolve with more sleep',
      'Mood changes that feel out of character',
      'Weight gain concentrated in the midsection',
      'Sleep disruption (especially waking between 2-4am)',
      'Irregular or changing periods',
      'Brain fog or word-finding difficulty',
      'Decreased interest in sex',
    ])}

    ${subhead('What to Test')}
    ${para('A meaningful hormone panel for women should include: Estradiol, Progesterone, Total and Free Testosterone, DHEA-S, Thyroid (TSH, Free T3, Free T4), Cortisol (AM), SHBG, and a metabolic panel with HbA1c.')}

    ${ctaBtn('Book a Hormone Panel', `${BASE}/medical/blood-panels/`)}

    ${para('Hormones are interconnected — you can\'t understand one without looking at the whole picture. That\'s why we run comprehensive panels, not single-marker tests.')}
  `);
  return { subject, html };
}

// ─── 3. Weight Loss: GLP-1 Decision Guide ───────────────────────

function generateWeightLoss(name) {
  const fn = name ? name.split(' ')[0] : '';
  const g = fn ? `Hi ${fn},` : 'Hi,';
  const subject = 'Your GLP-1 Decision Guide';
  const html = emailWrap(`
    ${heading('GLP-1 Decision Guide')}
    ${para(`${g}`)}
    ${para('Thanks for requesting the guide. GLP-1 medications (semaglutide and tirzepatide) are the most significant advancement in weight management in decades — but they\'re not for everyone. Here\'s what you need to know to make an informed decision.')}

    ${subhead('Semaglutide vs. Tirzepatide')}
    ${sectionBox('Semaglutide (Ozempic / Wegovy)', [
      'GLP-1 receptor agonist (single mechanism)',
      'Average weight loss: 15-17% of body weight over 68 weeks',
      'Weekly injection, dose titrated over 16-20 weeks',
      'Most common side effects: nausea (usually temporary), constipation',
      'Longest safety track record of the two',
    ])}
    ${sectionBox('Tirzepatide (Mounjaro / Zepbound)', [
      'Dual GIP/GLP-1 receptor agonist (two mechanisms)',
      'Average weight loss: 20-22% of body weight over 72 weeks',
      'Weekly injection, dose titrated over 20+ weeks',
      'Similar side effect profile, may cause more GI effects initially',
      'Newer to market but strong clinical data',
    ])}

    ${subhead('Who\'s a Good Candidate?')}
    ${sectionBox('Likely a Fit', [
      'BMI 30+ (or 27+ with metabolic risk factors)',
      'History of yo-yo dieting or weight regain',
      'Insulin resistance or prediabetes',
      'Tried sustained lifestyle changes without adequate results',
      'Willing to commit to lifestyle changes alongside medication',
    ])}
    ${sectionBox('May Not Be the Right Fit', [
      'History of medullary thyroid cancer or MEN2 syndrome',
      'Active pancreatitis or severe GI conditions',
      'Looking for a "quick fix" without lifestyle changes',
      'Pregnant or planning to become pregnant soon',
    ])}

    ${subhead('What We Do Differently at Moonshot')}
    ${para('We don\'t just prescribe and disappear. Every GLP-1 patient gets baseline blood work, body composition testing (DEXA), and regular check-ins to monitor progress, adjust dosing, and protect lean muscle mass — which is the #1 concern with rapid weight loss.')}

    ${ctaBtn('Book a Consultation', `${BASE}/medical/weight-loss/`)}
  `);
  return { subject, html };
}

// ─── 4. Body Comp: Body Composition Testing Guide ───────────────

function generateBodyComp(name) {
  const fn = name ? name.split(' ')[0] : '';
  const g = fn ? `Hi ${fn},` : 'Hi,';
  const subject = 'Your Body Composition Testing Guide';
  const html = emailWrap(`
    ${heading('Body Composition Testing Guide')}
    ${para(`${g}`)}
    ${para('Thanks for requesting the guide. If you\'re serious about tracking your health, body composition data is more valuable than almost any other metric — including scale weight. Here\'s what you need to know.')}

    ${subhead('Testing Methods Compared')}
    ${sectionBox('DEXA Scan — Gold Standard', [
      'Medical-grade dual-energy X-ray absorptiometry',
      'Measures fat mass, lean mass, and bone density <strong>by body region</strong>',
      'Shows visceral fat (the dangerous fat around organs)',
      'Accuracy: &plusmn;1-2% body fat',
      'Reproducible — reliably tracks changes over time',
      'Takes about 10 minutes, minimal radiation (less than a cross-country flight)',
    ])}
    ${sectionBox('InBody / BIA (Bioelectrical Impedance)', [
      'Sends electrical current through the body, estimates composition',
      'Accuracy: &plusmn;3-5% body fat (affected by hydration, meals, time of day)',
      'No regional breakdown, no visceral fat measurement',
      'Useful for rough trends but not precise enough for clinical decisions',
    ])}
    ${sectionBox('Calipers (Skinfold Testing)', [
      'Manual pinch measurements at 3-7 body sites',
      'Highly operator-dependent — different testers get different results',
      'Accuracy: &plusmn;3-4% at best',
      'No bone density, no visceral fat, no regional detail',
    ])}

    ${subhead('The 5 Numbers That Matter')}
    ${sectionBox('What a DEXA Report Reveals', [
      '<strong>Body fat %</strong> — total and by region (arms, legs, trunk)',
      '<strong>Lean mass index</strong> — muscle mass relative to height (the strongest predictor of longevity)',
      '<strong>Visceral fat</strong> — the #1 body comp predictor of metabolic disease',
      '<strong>Bone mineral density</strong> — early osteoporosis detection, especially important for women 40+',
      '<strong>Android/gynoid ratio</strong> — abdominal vs. hip fat distribution (correlates with insulin resistance)',
    ])}

    ${para('The bottom line: if you\'re making decisions about training, nutrition, or health based on body composition — you want the most accurate data available.')}

    ${ctaBtn('Book a DEXA Scan', `${BASE}/medical/dexa-body-composition/`)}
  `);
  return { subject, html };
}

// ─── 5. Diagnostics: Lab Values Quick Reference ─────────────────

function generateDiagnostics(name) {
  const fn = name ? name.split(' ')[0] : '';
  const g = fn ? `Hi ${fn},` : 'Hi,';
  const subject = 'Your Lab Values Quick Reference';
  const html = emailWrap(`
    ${heading('Lab Values Quick Reference')}
    ${para(`${g}`)}
    ${para('Thanks for requesting the reference. This is the cheat sheet we wish everyone had before their next doctor\'s visit. "Normal" ranges tell you you\'re not dying — <strong>optimal ranges</strong> tell you how to actually feel your best.')}

    ${subhead('Hormones')}
    ${sectionBox('Key Markers', [
      '<strong>Total Testosterone (Men)</strong> — Normal: 264-916 ng/dL | Optimal: 600-900 ng/dL',
      '<strong>Free Testosterone (Men)</strong> — Normal: 5-21 ng/dL | Optimal: 15-20 ng/dL',
      '<strong>Estradiol (Men)</strong> — Normal: 10-40 pg/mL | Optimal: 20-30 pg/mL',
      '<strong>Estradiol (Women, pre-meno)</strong> — Varies by cycle | Optimal: interpreted in context',
      '<strong>Progesterone (Women, luteal)</strong> — Normal: 2-25 ng/mL | Optimal: 10-20 ng/mL',
      '<strong>DHEA-S</strong> — Varies by age | Optimal: upper half of age-adjusted range',
    ])}

    ${subhead('Thyroid')}
    ${sectionBox('Key Markers', [
      '<strong>TSH</strong> — Normal: 0.4-4.5 mIU/L | Optimal: 1.0-2.0 mIU/L',
      '<strong>Free T3</strong> — Normal: 2.3-4.2 pg/mL | Optimal: 3.0-4.0 pg/mL',
      '<strong>Free T4</strong> — Normal: 0.8-1.8 ng/dL | Optimal: 1.1-1.5 ng/dL',
      '<strong>Key insight:</strong> A TSH of 4.0 is "normal" but often symptomatic. Many providers won\'t act until TSH is >10. That\'s too late.',
    ])}

    ${subhead('Metabolic')}
    ${sectionBox('Key Markers', [
      '<strong>Fasting Glucose</strong> — Normal: 65-99 mg/dL | Optimal: 75-90 mg/dL',
      '<strong>HbA1c</strong> — Normal: <5.7% | Optimal: <5.3%',
      '<strong>Fasting Insulin</strong> — Normal: 2-25 uIU/mL | Optimal: 3-8 uIU/mL',
      '<strong>Key insight:</strong> Insulin resistance develops years before blood sugar goes "abnormal." Fasting insulin is the early warning — and most doctors don\'t order it.',
    ])}

    ${subhead('Inflammation & Lipids')}
    ${sectionBox('Key Markers', [
      '<strong>hs-CRP</strong> — Normal: <3.0 mg/L | Optimal: <1.0 mg/L',
      '<strong>LDL-C</strong> — Context-dependent; particle count (LDL-P) is more predictive than concentration',
      '<strong>Triglycerides</strong> — Normal: <150 mg/dL | Optimal: <100 mg/dL',
      '<strong>ApoB</strong> — The single best lipid marker for cardiovascular risk. Optimal: <90 mg/dL',
    ])}

    ${para('<strong>Remember:</strong> Lab results without context are just numbers. What matters is the pattern — how markers relate to each other, your symptoms, and your goals.')}

    ${ctaBtn('Get Comprehensive Blood Work', `${BASE}/medical/blood-panels/`)}
  `);
  return { subject, html };
}

// ─── 6. Rehab: Treatment Comparison ─────────────────────────────

function generateRehab(name) {
  const fn = name ? name.split(' ')[0] : '';
  const g = fn ? `Hi ${fn},` : 'Hi,';
  const subject = 'Your Rehab Treatment Comparison';
  const html = emailWrap(`
    ${heading('Rehab Treatment Comparison')}
    ${para(`${g}`)}
    ${para('Thanks for requesting the comparison. If you\'re dealing with pain, tightness, or an injury that won\'t resolve, there are multiple evidence-based treatment options — and the right one depends on what\'s actually going on. Here\'s how they compare.')}

    ${subhead('Chiropractic Adjustment')}
    ${sectionBox('Best For', [
      'Joint restrictions and misalignment (spine, ribs, extremities)',
      'Acute back/neck pain or stiffness',
      'Headaches and referred pain from spinal dysfunction',
      'Post-injury joint mobility restoration',
    ])}
    ${para('<strong>How it works:</strong> Targeted joint manipulation restores normal range of motion, reduces nerve irritation, and breaks pain-spasm cycles. Most patients feel immediate improvement in mobility.')}

    ${subhead('Dry Needling')}
    ${sectionBox('Best For', [
      'Muscle knots (trigger points) that won\'t release with stretching',
      'Chronic muscle tightness in the neck, shoulders, hips, or calves',
      'Referred pain patterns (pain in one area caused by a trigger point elsewhere)',
      'Post-workout recovery issues and recurring strains',
    ])}
    ${para('<strong>How it works:</strong> A thin filament needle is inserted into the trigger point, causing a "twitch response" that releases the muscle contraction. It\'s not acupuncture — it targets the neuromuscular mechanism directly.')}

    ${subhead('Shockwave Therapy (ESWT)')}
    ${sectionBox('Best For', [
      'Tendon injuries: plantar fasciitis, Achilles tendinopathy, tennis/golfer\'s elbow',
      'Chronic pain that hasn\'t responded to rest or PT',
      'Calcific tendinitis and scar tissue buildup',
      'Accelerating healing in stubborn, slow-healing tissues',
    ])}
    ${para('<strong>How it works:</strong> Acoustic pressure waves stimulate blood flow, break down calcifications, and trigger the body\'s tissue repair response. Most effective as a series of 3-6 sessions.')}

    ${subhead('Trigger Point Injections')}
    ${sectionBox('Best For', [
      'Severe muscle knots that don\'t respond to dry needling alone',
      'Acute muscle spasms causing significant pain',
      'Chronic myofascial pain syndromes',
    ])}
    ${para('<strong>How it works:</strong> A small amount of lidocaine is injected directly into the trigger point, providing immediate pain relief while the muscle releases. Often combined with manual therapy for best results.')}

    ${subhead('How to Choose')}
    ${para('Most patients benefit from a combination of treatments. Joint restriction? Start with chiropractic. Muscle-related? Dry needling. Tendon issue that won\'t heal? Shockwave. The key is getting an accurate diagnosis first.')}

    ${ctaBtn('Book a Rehab Evaluation', `${BASE}/rehab/`)}
  `);
  return { subject, html };
}

// ─── 7. General: Your First Visit Guide ─────────────────────────

function generateGeneral(name) {
  const fn = name ? name.split(' ')[0] : '';
  const g = fn ? `Hi ${fn},` : 'Hi,';
  const subject = 'Your First Visit Guide — Moonshot Medical';
  const html = emailWrap(`
    ${heading('Your First Visit Guide')}
    ${para(`${g}`)}
    ${para('Thanks for requesting the guide. Whether you\'re coming in for hormone optimization, body composition testing, or performance diagnostics — here\'s exactly what to expect.')}

    ${subhead('Before Your Visit')}
    ${sectionBox('Preparation', [
      '<strong>Blood work:</strong> If you\'re doing labs, fast for 8-12 hours (water and black coffee are fine)',
      '<strong>DEXA scan:</strong> Wear lightweight clothing without metal (gym clothes are ideal)',
      '<strong>Bring:</strong> Any recent lab results, current medications/supplements list, and your health goals',
      '<strong>Time:</strong> Plan for 45-60 minutes for your first visit',
    ])}

    ${subhead('What Happens at Moonshot')}
    ${sectionBox('Step 1: Comprehensive Assessment', [
      'Review of your health history, current symptoms, and goals',
      'Discussion of what "optimal" means for your specific situation',
      'No rush — we actually listen (this is usually the biggest difference people notice)',
    ])}
    ${sectionBox('Step 2: Testing (if applicable)', [
      '<strong>Blood panels:</strong> 40+ markers drawn in-house — results in 3-5 business days',
      '<strong>DEXA scan:</strong> 10-minute scan, results reviewed same day',
      '<strong>Other diagnostics:</strong> Based on your specific needs and goals',
    ])}
    ${sectionBox('Step 3: Your Plan', [
      'Results reviewed 1-on-1 with your provider',
      'Clear explanation of what your numbers mean (optimal vs. normal)',
      'Personalized protocol — lifestyle, supplementation, and/or treatment options',
      'No cookie-cutter approaches. What works for you might not work for someone else.',
    ])}

    ${subhead('How We\'re Different')}
    ${sectionBox('What Sets Moonshot Apart', [
      '<strong>Optimal, not normal:</strong> We don\'t settle for "in range" — we optimize',
      '<strong>Full picture:</strong> Hormones, metabolic health, body composition, and performance in one place',
      '<strong>Transparent pricing:</strong> You know what things cost before you commit',
      '<strong>No gatekeeping:</strong> If you want comprehensive labs, you get comprehensive labs',
    ])}

    ${ctaBtn('Book Your First Visit', `${BASE}/medical/`)}

    ${para('Questions before you come in? Reply to this email or call us at <a href="tel:+12244354280" style="color: #B2BFBE;">224-435-4280</a>.')}
  `);
  return { subject, html };
}

// ─── Handler ────────────────────────────────────────────────────

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

  const { name, email, magnet_key, article_slug, article_url } = data;

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400 });
  }

  const generator = MAGNETS[magnet_key];
  if (!generator) {
    return new Response(JSON.stringify({ error: 'Invalid magnet_key' }), { status: 400 });
  }

  // Generate resource email
  const { subject, html } = generator(name);

  // Internal notification email
  const internalHtml = emailWrap(`
    <h1 style="color: #4ade80; margin: 0 0 4px; font-size: 22px;">New Lead Magnet Capture</h1>
    <p style="color: #B2BFBE; margin: 0 0 24px; font-size: 14px;">Resource: ${magnet_key}</p>

    <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Contact</p>
      <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Name: ${name || 'Not provided'}</p>
      <p style="color: #B2BFBE; margin: 0; font-size: 14px;">Email: ${email}</p>
    </div>

    <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 16px;">
      <p style="color: #F0EEE9; font-weight: 600; margin: 0 0 8px;">Source</p>
      <p style="color: #B2BFBE; margin: 0 0 4px; font-size: 14px;">Article: ${article_slug || 'unknown'}</p>
      <p style="color: #B2BFBE; margin: 0; font-size: 14px;">URL: ${article_url || 'unknown'}</p>
    </div>
  `);

  try {
    // Send resource email + internal notification in parallel
    await Promise.all([
      sendEmail({ to: email, subject, html }),
      sendEmail({ to: 'hello@moonshotmp.com', subject: `Lead Magnet: ${name || email} — ${magnet_key}`, html: internalHtml }),
    ]);

    // Sync to clinic (non-blocking)
    const clinicApi = process.env.CLINIC_API_BASE || 'https://api.moonshotclinic.com';
    const webhookHeaders = {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': 'moonshot',
      'X-Webhook-Key': process.env.CLINIC_LEAD_WEBHOOK_KEY || '',
    };

    // Lead webhook
    try {
      await fetch(clinicApi + '/api/leads/webhook', {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({ name, email, source: 'lead_magnet', magnet_key, article_slug, article_url }),
      });
    } catch (err) {
      console.error('[lead-magnet-submit] Clinic lead sync error:', err.message);
    }

    // Marketing drip webhook
    try {
      await fetch(clinicApi + '/api/marketing/quiz-complete', {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
          email,
          name,
          quiz_type: 'lead_magnet',
          quiz_data: { magnet_key, article_slug, article_url },
        }),
      });
    } catch (err) {
      console.error('[lead-magnet-submit] Marketing drip sync error:', err.message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[lead-magnet-submit] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
