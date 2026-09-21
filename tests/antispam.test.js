import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../netlify/functions/send-email.js', () => ({
  sendEmail: vi.fn(async () => ({ ok: true }))
}));

import { sendEmail } from '../netlify/functions/send-email.js';
import { checkSubmission, safeName } from '../netlify/functions/shared/antispam.js';
import leadMagnetSubmit from '../netlify/functions/lead-magnet-submit.js';
import peptideGuideSend from '../netlify/functions/peptide-guide-send.js';

const human = { website: '', elapsed_ms: 9000 };

function post(body) {
  return new Request('https://moonshotmp.com/.netlify/functions/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('checkSubmission', () => {
  it('passes a normal human submission', () => {
    expect(checkSubmission({ ...human, email: 'kelly.chartrand@hotmail.com' })).toEqual({ ok: true, reason: null });
  });

  it('passes a Gmail address with an ordinary number of dots', () => {
    expect(checkSubmission({ ...human, email: 'mary.jo.van.dyke@gmail.com' }).ok).toBe(true);
  });

  // The payload the 2026-09-15 bot replayed: no guard fields at all.
  it('blocks a payload with no guard fields', () => {
    expect(checkSubmission({ email: 'a@b.com', name: 'Hueqert' }).reason).toBe('no_guard_fields');
  });

  it('blocks a filled honeypot', () => {
    expect(checkSubmission({ ...human, website: 'http://spam.example', email: 'a@b.com' }).reason).toBe('honeypot');
  });

  it('blocks a submit faster than a person can type', () => {
    expect(checkSubmission({ website: '', elapsed_ms: 400, email: 'a@b.com' }).reason).toBe('too_fast');
  });

  it('blocks a non-numeric or stale elapsed_ms', () => {
    expect(checkSubmission({ website: '', elapsed_ms: '9000', email: 'a@b.com' }).reason).toBe('no_guard_fields');
    expect(checkSubmission({ website: '', elapsed_ms: 7 * 60 * 60 * 1000, email: 'a@b.com' }).reason).toBe('stale');
  });

  it('blocks dot-scattered Gmail variants seen in the incident', () => {
    for (const email of ['d.ebora.h.k..n.i.c.o.de.m.us@gmail.com', 'R.ob.er.t.p.a.b.o.n.3@GMAIL.com', 'jac.ka.sh.at.t.uc.k@googlemail.com']) {
      expect(checkSubmission({ ...human, email }).reason).toBe('gmail_dots');
    }
  });

  it('does not apply the dot rule to other domains', () => {
    expect(checkSubmission({ ...human, email: 'a.b.c.d.e.f@flagg-law.com' }).ok).toBe(true);
  });

  it('tolerates a missing body', () => {
    expect(checkSubmission(null).ok).toBe(false);
  });
});

describe('safeName', () => {
  it('escapes markup and clamps length', () => {
    expect(safeName('<a href="x">Jo</a>')).toBe('&lt;a href=&quot;x&quot;&gt;Jo&lt;/a&gt;');
    expect(safeName('x'.repeat(500))).toHaveLength(80);
    expect(safeName(undefined)).toBe('');
  });
});

describe('handlers', () => {
  let fetchMock;

  beforeEach(() => {
    sendEmail.mockClear();
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('lead-magnet-submit: bot payload gets 200 ok but sends nothing and syncs nothing', async () => {
    const res = await leadMagnetSubmit(post({
      name: 'Hueqert', email: 'jeni.s.se.mader.a@gmail.com', magnet_key: 'general',
      article_slug: 'first-visit', article_url: 'https://moonshotmp.com/learn/first-visit/'
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lead-magnet-submit: human payload sends both emails and both clinic syncs', async () => {
    const res = await leadMagnetSubmit(post({
      ...human, name: 'Kelly', email: 'kelly@example.com', magnet_key: 'general',
      article_slug: 'first-visit', article_url: 'https://moonshotmp.com/learn/first-visit/'
    }));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[0][0].to).toBe('kelly@example.com');
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.endsWith('/api/leads/webhook'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/api/marketing/quiz-complete'))).toBe(true);
  });

  it('lead-magnet-submit: markup in the name never reaches the email HTML', async () => {
    await leadMagnetSubmit(post({
      ...human, name: '<img/src=x>', email: 'kelly@example.com', magnet_key: 'general'
    }));
    for (const call of sendEmail.mock.calls) {
      expect(call[0].html).not.toContain('<img/src=x>');
    }
  });

  it('peptide-guide-send: honeypot payload sends nothing', async () => {
    const res = await peptideGuideSend(post({
      name: 'Vuas', email: 'admin@example.com', website: 'x', elapsed_ms: 9000
    }));
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('peptide-guide-send: calculator protocol renders catalog names only', async () => {
    const res = await peptideGuideSend(post({
      ...human, name: 'Kelly', email: 'kelly@example.com',
      protocol: [{ name: 'BPC-157', price: 250, why: 'x' }, { name: '<b>evil</b>' }, 'Sermorelin']
    }));
    expect(res.status).toBe(200);
    const userHtml = sendEmail.mock.calls.find((c) => c[0].to === 'kelly@example.com')[0].html;
    expect(userHtml).toContain('Your Personalized Protocol');
    expect(userHtml).toContain('$500/mo');
    expect(userHtml).not.toContain('<b>evil</b>');
    expect(userHtml).not.toContain('[object Object]');
  });
});
