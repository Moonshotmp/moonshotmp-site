import { describe, it, expect, vi, beforeEach } from 'vitest';

// send-email.js reads the key at import time, so set it before the import.
vi.hoisted(() => {
  process.env.RESEND_API_KEY = 're_test_peptide_quiz';
  process.env.CLINIC_LEAD_WEBHOOK_KEY = 'whk_test_peptide_quiz';
});

import peptideQuizSubmit from '../netlify/functions/peptide-quiz-submit.js';

const context = { geo: { subdivision: { code: 'IL' }, country: { code: 'US' } } };

// The exact shape quiz/peptides/quiz-engine.js sendResults() posts.
const engineBody = {
  name: 'Dana Whitfield',
  email: 'dana.whitfield@example.com',
  phone: null,
  sms_consent: false,
  goal: 'injury', concern: 'tendon', severity: 'moderate', duration: '3-6mo',
  experience: 'none', therapy: 'no', convenience: 'somewhat', budget: '400+',
  recommendation: { primary: 'wolverine', primaryName: 'Wolverine Blend', secondary: 'nad', secondaryName: 'NAD+' }
};

function post(body) {
  return new Request('https://moonshotmp.com/.netlify/functions/peptide-quiz-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

let sent;
function routedFetch({ resendStatus = 200 } = {}) {
  sent = [];
  return vi.fn(async (url, init) => {
    if (url === 'https://api.resend.com/emails') {
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: 'email_51c0' }), { status: resendStatus });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
}

const userEmail = () => sent.find((m) => [].concat(m.to).includes('dana.whitfield@example.com'));

describe('peptide-quiz-submit', () => {
  beforeEach(() => { vi.stubGlobal('fetch', routedFetch()); });

  it('renders the engine payload from the server catalog at catalog prices', async () => {
    const res = await peptideQuizSubmit(post(engineBody), context);
    expect(res.status).toBe(200);
    const html = userEmail().html;
    expect(html).toContain('Wolverine Blend');
    expect(html).toContain('$425/month');
    expect(html).toContain('NAD+');
    expect(html).toContain('$205/month');
  });

  it('ignores client-supplied names and escapes free text', async () => {
    const body = {
      ...engineBody,
      name: '<a href="https://evil.example/login">Verify account</a>',
      goalLabel: '<img src=x onerror=alert(1)>',
      recommendation: { primary: '<script>', secondary: 'constructor' },
      primaryRecommendation: { name: '<a href="https://evil.example">Claim</a>', price: 1 }
    };
    const res = await peptideQuizSubmit(post(body), context);
    expect(res.status).toBe(200);
    for (const m of sent) {
      expect(m.html).not.toContain('<a href="https://evil.example');
      expect(m.html).not.toContain('<img src=x');
      expect(m.html).not.toContain('<script>');
    }
    expect(userEmail().html).toContain('&lt;a href=');
  });

  it('reports failure when the results email is rejected', async () => {
    vi.stubGlobal('fetch', routedFetch({ resendStatus: 503 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await peptideQuizSubmit(post(engineBody), context);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false });
  });
});
