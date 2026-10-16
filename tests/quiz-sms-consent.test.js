import { describe, it, expect, vi, beforeEach } from 'vitest';

// send-email.js reads the key at import time, so set it before the imports.
vi.hoisted(() => {
  process.env.RESEND_API_KEY = 're_test_quiz_sms_consent';
  process.env.CLINIC_LEAD_WEBHOOK_KEY = 'whk_test_quiz_sms_consent';
  process.env.CLINIC_API_BASE = 'https://api.moonshotclinic.test';
});

import glp1Submit from '../netlify/functions/glp1-quiz-submit.js';
import lowTSubmit from '../netlify/functions/low-t-quiz-submit.js';
import boneDensitySubmit from '../netlify/functions/bone-density-quiz-submit.js';
import perimenopauseSubmit from '../netlify/functions/perimenopause-quiz-submit.js';
import { SMS_CONSENT_VERSION } from '../netlify/functions/shared/sms-consent.js';

const SMS_URL = 'https://api.moonshotclinic.test/api/webhooks/quiz-sms';
const context = { geo: { subdivision: { code: 'IL' }, country: { code: 'US' } } };

// Every quiz funnel that collects a phone and can trigger the quiz-sms webhook.
const FUNNELS = [
  {
    name: 'glp1-quiz-submit',
    handler: glp1Submit,
    quizType: 'glp1',
    result: { internalTier: 'eligibility-present' },
    profile: { sex: 'female', stateCode: 'IL', age: 46, heightInches: 65, weightLbs: 212 }
  },
  {
    name: 'low-t-quiz-submit',
    handler: lowTSubmit,
    quizType: 'low-t',
    result: { internalTier: 'eligibility-mixed' },
    profile: { stateCode: 'IL', age: 52 }
  },
  {
    name: 'bone-density-quiz-submit',
    handler: boneDensitySubmit,
    quizType: 'bone-density',
    result: { tier: 'B' },
    profile: { sex: 'female', age: 61 }
  },
  {
    name: 'perimenopause-quiz-submit',
    handler: perimenopauseSubmit,
    quizType: 'perimenopause',
    result: { internalTier: 'eligibility-factors-present' },
    profile: { stateCode: 'IL', age: 47 }
  }
];

function post(body) {
  return new Request('https://moonshotmp.com/.netlify/functions/quiz-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function routedFetch() {
  return vi.fn(async (url) => {
    if (url === 'https://api.resend.com/emails') {
      return new Response(JSON.stringify({ id: 'email_3c9a' }), { status: 200 });
    }
    if (String(url).startsWith('https://api.moonshotclinic.test/')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error('unexpected fetch ' + url);
  });
}

function smsCalls(fetchMock) {
  return fetchMock.mock.calls.filter((c) => c[0] === SMS_URL);
}

function internalEmailHtml(fetchMock) {
  const call = fetchMock.mock.calls.find((c) => {
    if (c[0] !== 'https://api.resend.com/emails') return false;
    return JSON.parse(c[1].body).to[0] === 'hello@moonshotmp.com';
  });
  return JSON.parse(call[1].body).html;
}

describe.each(FUNNELS)('$name SMS consent gate', ({ handler, quizType, result, profile }) => {
  let fetchMock;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);
  });

  const base = {
    name: 'Renata Okafor',
    email: 'renata.okafor@outlook.com',
    phone: '(847) 555-0193',
    result,
    profile,
    ackTimestamp: '2026-10-16T14:02:11.000Z'
  };

  it('sends the quiz text with consent proof when sms_consent is true', async () => {
    const before = Date.now();
    const res = await handler(post({ ...base, marketingOptIn: false, sms_consent: true }), context);
    expect(res.status).toBe(200);

    const calls = smsCalls(fetchMock);
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0][1].body);
    expect(body).toMatchObject({
      phone: '(847) 555-0193',
      name: 'Renata Okafor',
      quiz_type: quizType,
      sms_consent: true,
      sms_consent_version: SMS_CONSENT_VERSION
    });
    expect(SMS_CONSENT_VERSION).toBe('sms-consent-v1-2026-10-16');
    const at = Date.parse(body.sms_consent_at);
    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1000);
    expect(internalEmailHtml(fetchMock)).toContain('SMS Consent: Yes');
  });

  it('never texts on the email-updates box alone', async () => {
    const res = await handler(post({ ...base, marketingOptIn: true }), context);
    expect(res.status).toBe(200);
    expect(smsCalls(fetchMock)).toHaveLength(0);
    expect(internalEmailHtml(fetchMock)).toContain('SMS Consent: No');
  });

  it('accepts a phone without consent and sends no text', async () => {
    const res = await handler(post({ ...base, marketingOptIn: false, sms_consent: false }), context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(smsCalls(fetchMock)).toHaveLength(0);
  });

  it('treats a truthy non-boolean sms_consent as no consent', async () => {
    const res = await handler(post({ ...base, sms_consent: 'yes' }), context);
    expect(res.status).toBe(200);
    expect(smsCalls(fetchMock)).toHaveLength(0);
  });

  it('sends no text when consent is ticked but no phone was given', async () => {
    const res = await handler(post({ ...base, phone: '', sms_consent: true }), context);
    expect(res.status).toBe(200);
    expect(smsCalls(fetchMock)).toHaveLength(0);
  });
});

// The consent version string proves which words the person agreed to. Pin the
// label in every engine so a wording change cannot ship without a version bump.
describe('SMS consent label is pinned to its version', () => {
  const LABEL = 'Text me my results and next steps. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. See our <a href="/privacy/"';

  it.each(['glp1', 'low-t', 'bone-density', 'perimenopause'])('%s engine carries the v1 label, unticked', async (quiz) => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../quiz/' + quiz + '/quiz-engine.js', import.meta.url), 'utf8');
    expect(SMS_CONSENT_VERSION).toBe('sms-consent-v1-2026-10-16');
    expect(src).toContain(LABEL);
    expect(src).toContain('<input type="checkbox" id="quiz-sms-consent" name="sms_consent" class="mt-1 flex-shrink-0">');
    expect(src).toContain('Email me occasional updates');
    expect(src).not.toContain('Send me occasional updates');
  });
});
