import { describe, it, expect, vi, beforeEach } from 'vitest';

// send-email.js reads the key at import time, so set it before the import.
vi.hoisted(() => {
  process.env.RESEND_API_KEY = 're_test_booking_callback';
  process.env.CLINIC_LEAD_WEBHOOK_KEY = 'whk_test_booking_callback';
});

import bookingCallback, { normalizePhone } from '../netlify/functions/booking-callback.js';

const human = { website: '', elapsed_ms: 14000 };
const context = { geo: { subdivision: { code: 'IL' }, country: { code: 'US' } } };

function post(body) {
  return new Request('https://moonshotmp.com/.netlify/functions/booking-callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function routedFetch({ resendStatus = 200, webhookStatus = 201 } = {}) {
  return vi.fn(async (url) => {
    if (url === 'https://api.resend.com/emails') {
      return new Response(JSON.stringify({ id: 'email_8f2c' }), { status: resendStatus });
    }
    if (String(url).endsWith('/api/leads/webhook')) {
      return new Response(JSON.stringify({ ok: true }), { status: webhookStatus });
    }
    throw new Error('unexpected fetch ' + url);
  });
}

describe('normalizePhone', () => {
  it('keeps 10 digits and 11 digits with a leading 1', () => {
    expect(normalizePhone('(847) 555-0142')).toBe('8475550142');
    expect(normalizePhone('+1 847.555.0142')).toBe('18475550142');
  });

  it('rejects short, long and non-US numbers', () => {
    expect(normalizePhone('555-0142')).toBe('');
    expect(normalizePhone('44 20 7946 0958 12')).toBe('');
    expect(normalizePhone('28475550142')).toBe('');
    expect(normalizePhone(8475550142)).toBe('');
  });
});

describe('booking-callback', () => {
  let fetchMock;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('emails the front desk and files the lead with the clinic', async () => {
    fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const res = await bookingCallback(post({
      ...human,
      name: 'Daniel Kowalczyk',
      phone: '(847) 555-0142',
      email: 'dkowalczyk@comcast.net',
      source: 'low-t-quiz',
      result: 'tier-2',
      page_url: 'https://moonshotmp.com/booking/?source=low-t-quiz&result=tier-2'
    }), context);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const emailCall = fetchMock.mock.calls.find((c) => c[0] === 'https://api.resend.com/emails');
    const email = JSON.parse(emailCall[1].body);
    expect(email.to).toEqual(['hello@moonshotmp.com']);
    expect(email.subject).toBe('Callback request: Daniel Kowalczyk 847-555-0142');
    expect(email.html).toContain('low-t-quiz');
    expect(email.html).toContain('tier-2');
    expect(email.html).toContain('https://moonshotmp.com/booking/');
    expect(email.html).toContain('IL, US');

    const leadCall = fetchMock.mock.calls.find((c) => c[0] === 'https://api.moonshotclinic.com/api/leads/webhook');
    expect(leadCall[1].headers['X-Tenant-Slug']).toBe('moonshot');
    expect(leadCall[1].headers['X-Webhook-Key']).toBe('whk_test_booking_callback');
    const lead = JSON.parse(leadCall[1].body);
    expect(lead).toMatchObject({
      name: 'Daniel Kowalczyk',
      email: 'dkowalczyk@comcast.net',
      phone: '8475550142',
      source: 'website_form',
      quiz_type: 'callback_request',
      geo_state: 'IL',
      geo_country: 'US'
    });
  });

  it('phone-only request: emails the front desk and skips the CRM, which requires an email', async () => {
    fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const res = await bookingCallback(post({ ...human, name: 'Priya Raman', phone: '224-555-0187', email: 'not-an-email' }), context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(['https://api.resend.com/emails']);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).html).toContain('Email: not given');
  });

  it('still answers ok when the clinic sync fails after the email went out', async () => {
    fetchMock = routedFetch({ webhookStatus: 400 });
    vi.stubGlobal('fetch', fetchMock);

    const res = await bookingCallback(post({ ...human, name: 'Priya Raman', phone: '224-555-0187', email: 'priya.raman@outlook.com' }), context);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/api/leads/webhook'))).toBe(true);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('answers 502 when the email cannot be sent, so the page does not show a receipt', async () => {
    fetchMock = routedFetch({ resendStatus: 500 });
    vi.stubGlobal('fetch', fetchMock);

    const res = await bookingCallback(post({ ...human, name: 'Priya Raman', phone: '224-555-0187' }), context);
    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBe(false);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/api/leads/webhook'))).toBe(false);
  });

  it('rejects a missing name or an invalid phone without sending anything', async () => {
    fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const noName = await bookingCallback(post({ ...human, name: '   ', phone: '847-555-0142' }), context);
    expect(noName.status).toBe(400);
    const badPhone = await bookingCallback(post({ ...human, name: 'Priya Raman', phone: '555-0187' }), context);
    expect(badPhone.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('quietly drops a bot submission (honeypot filled) with ok:true and no sends', async () => {
    fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const res = await bookingCallback(post({
      website: 'http://spam.example',
      elapsed_ms: 14000,
      name: 'Daniel Kowalczyk',
      phone: '847-555-0142'
    }), context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers a timing failure with an error so a real person is not shown a false receipt', async () => {
    fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const stale = await bookingCallback(post({ website: '', elapsed_ms: 7 * 60 * 60 * 1000, name: 'Priya Raman', phone: '224-555-0187' }), context);
    expect(stale.status).toBe(422);
    expect((await stale.json()).ok).toBe(false);
    const fast = await bookingCallback(post({ website: '', elapsed_ms: 900, name: 'Priya Raman', phone: '224-555-0187' }), context);
    expect(fast.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a request whose optional email is a heavily dotted Gmail address', async () => {
    fetchMock = routedFetch();
    vi.stubGlobal('fetch', fetchMock);

    const res = await bookingCallback(post({ ...human, name: 'Alex Smith', phone: '773-555-0119', email: 'a.l.e.x.smith@gmail.com' }), context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock.mock.calls.some((c) => c[0] === 'https://api.resend.com/emails')).toBe(true);
  });

  it('refuses GET', async () => {
    const res = await bookingCallback(new Request('https://moonshotmp.com/.netlify/functions/booking-callback'), context);
    expect(res.status).toBe(405);
  });
});
