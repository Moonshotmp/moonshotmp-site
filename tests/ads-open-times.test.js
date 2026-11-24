// shared/ads-open-times.js: the /ads/dexa/ hero chips (Tom 2026-11-23).
// Runs the real script in a VM with a small fake DOM and a fake fetch, and
// reads what a visitor would get: chip labels in clinic time, chip links that
// carry the ad click ids, and an invisible (not removed) block on any failure.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../shared/ads-open-times.js', import.meta.url), 'utf8');
const TYPE_ID = '61452a65-d353-44f3-a55c-4e2ced60e852';
const CTA = 'https://moonshot.moonshotehr.com/book/dexa?gclid=Cj0KCQiA_dexa47120&utm_source=google&utm_medium=cpc&utm_campaign=dexa-search';

function el(attrs = {}) {
  const a = { ...attrs };
  return {
    attrs: a,
    getAttribute: (k) => (k in a ? a[k] : null),
    setAttribute: (k, v) => { a[k] = String(v); },
  };
}

function makePage({ typeId = TYPE_ID } = {}) {
  const inserted = [];
  const skeletons = [0, 1, 2, 3, 4, 5].map(() => ({ parentNode: null }));
  const allLink = el({ href: 'https://moonshot.moonshotehr.com/book/dexa' });
  const list = {
    querySelectorAll: (sel) => (sel === '.ads-time-chip-skel' ? skeletons.filter((s) => s.parentNode) : []),
    removeChild: (n) => { n.parentNode = null; },
    insertAdjacentHTML: (_pos, html) => inserted.push(html),
  };
  skeletons.forEach((s) => { s.parentNode = list; });
  allLink.parentNode = list;
  allLink.insertAdjacentHTML = (_pos, html) => inserted.push(html);
  const box = el({
    id: 'adsOpenTimes',
    'data-api': 'https://api.moonshotehr.com',
    'data-tenant': 'moonshot',
    'data-link': 'dexa',
    'data-cta': 'bookCtaTop',
    ...(typeId ? { 'data-type-id': typeId } : {}),
  });
  box.querySelector = (sel) => (sel === '[data-open-times-list]' ? list : sel === '[data-open-times-all]' ? allLink : null);
  box.querySelectorAll = (sel) => (sel === 'a' ? [allLink] : []);
  const cta = el({ id: 'bookCtaTop', href: CTA });
  const document = { getElementById: (id) => (id === 'adsOpenTimes' ? box : id === 'bookCtaTop' ? cta : null) };
  return { box, list, allLink, inserted, document, skeletons };
}

// The booker's public reads, as the API answers them for the moonshot tenant.
function api({ summary, slotsByDay = {}, fail = null, delayMs = 0 }) {
  const calls = [];
  const fetch = vi.fn((url, opts) => {
    calls.push({ url, opts });
    if (fail && fail.test(url)) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    const u = new URL(url);
    let body;
    if (u.pathname.startsWith('/api/book/config-by-slug/')) body = { config: { appointment_type_id: TYPE_ID } };
    else if (u.pathname === '/api/book/availability-summary') body = { summary };
    else if (u.pathname === '/api/book/slots') body = { slots: slotsByDay[u.searchParams.get('date')] || [] };
    const res = { ok: true, status: 200, json: async () => body };
    return delayMs ? new Promise((r) => setTimeout(() => r(res), delayMs)) : Promise.resolve(res);
  });
  return { fetch, calls };
}

async function run(page, net) {
  const decorate = vi.fn();
  const ctx = vm.createContext({
    document: page.document,
    window: { fetch: net.fetch, Promise, MMPAdsForward: { decorate } },
    fetch: net.fetch,
    Promise,
    URL,
    Intl,
    Date,
    setTimeout,
    clearTimeout,
    AbortController,
  });
  ctx.window.fetch = net.fetch;
  vm.runInContext(SRC, ctx);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
  return { decorate };
}

const slot = (time, provider = 'Nichole Jakupovic') => ({ time, end_time: time, provider_id: '6b1f0c52-6f0e-4a55-9d8e-2a51e2b1c001', provider_name: provider });

afterEach(() => vi.useRealTimers());

describe('ads-open-times: hero chips', () => {
  it('renders the next open times in clinic time, labelled Today/Tomorrow, each a decorated booker link', async () => {
    // 2026-11-23 17:00 CST = 23:00 UTC, already the 24th in Tokyo.
    vi.useFakeTimers({ now: new Date('2026-11-23T23:00:00Z'), toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const page = makePage();
    const net = api({
      summary: { '2026-11-22': 4, '2026-11-23': 1, '2026-11-24': 6, '2026-11-25': 3, 'bogus': 9 },
      slotsByDay: {
        '2026-11-23': [slot('17:20')],
        '2026-11-24': [slot('08:00'), slot('07:30'), slot('08:00', 'Sarah Decicco'), slot('10:30'), slot('11:45'), slot('12:00'), slot('13:00')],
      },
    });
    const { decorate } = await run(page, net);

    expect(page.box.getAttribute('data-state')).toBe('ready');
    const html = page.inserted.join('');
    const chips = [...html.matchAll(/href="([^"]+)" aria-label="Book ([^"]+)"/g)].map((m) => [m[2], m[1]]);
    expect(chips.map((c) => c[0])).toEqual([
      'Today 5:20 PM',
      'Tomorrow 7:30 AM',
      'Tomorrow 8:00 AM',
      'Tomorrow 10:30 AM',
      'Tomorrow 11:45 AM',
      'Tomorrow 12:00 PM',
    ]);
    const first = new URL(chips[1][1].replace(/&amp;/g, '&'));
    expect(first.searchParams.get('slot')).toBe('2026-11-24T07:30');
    expect(first.searchParams.get('gclid')).toBe('Cj0KCQiA_dexa47120');
    expect(first.searchParams.get('utm_campaign')).toBe('dexa-search');
    expect(decorate).toHaveBeenCalledTimes(1);
    expect(page.skeletons.every((s) => s.parentNode === null)).toBe(true);
    // No link-config read when the page names the type; no cookies; only the
    // two soonest open days are read; a malformed summary key is never read.
    expect(net.calls.some((c) => c.url.includes('config-by-slug'))).toBe(false);
    expect(net.calls.every((c) => c.opts.credentials === 'omit')).toBe(true);
    expect(net.calls.filter((c) => c.url.includes('/slots?')).map((c) => new URL(c.url).searchParams.get('date'))).toEqual(['2026-11-23', '2026-11-24']);
  });

  it('labels the day after a DST change correctly (Tomorrow is the next calendar day)', async () => {
    // 2027-03-13 23:30 CST; clocks spring forward that night.
    vi.useFakeTimers({ now: new Date('2027-03-14T05:30:00Z'), toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const page = makePage();
    await run(page, api({ summary: { '2027-03-14': 2 }, slotsByDay: { '2027-03-14': [slot('09:00')] } }));
    expect(page.inserted.join('')).toContain('aria-label="Book Tomorrow 9:00 AM"');
  });

  it('falls back to the link config read when the page does not name the type', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-23T15:00:00Z'), toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const page = makePage({ typeId: null });
    const net = api({ summary: { '2026-11-24': 1 }, slotsByDay: { '2026-11-24': [slot('07:30')] } });
    await run(page, net);
    expect(net.calls[0].url).toBe('https://api.moonshotehr.com/api/book/config-by-slug/dexa?probe=1');
    expect(page.box.getAttribute('data-state')).toBe('ready');
  });

  for (const [name, net] of [
    ['an API error', () => api({ summary: {}, fail: /availability-summary/ })],
    ['no open days', () => api({ summary: { '2026-11-24': 0 } })],
    ['open days with no times', () => api({ summary: { '2026-11-24': 2 }, slotsByDay: {} })],
  ]) {
    it(`${name}: the block goes invisible, keeps its space, and its links leave the tab order`, async () => {
      vi.useFakeTimers({ now: new Date('2026-11-23T15:00:00Z'), toFake: ['Date', 'setTimeout', 'clearTimeout'] });
      const page = makePage();
      const { decorate } = await run(page, net());
      expect(page.box.getAttribute('data-state')).toBe('failed');
      expect(page.box.getAttribute('aria-hidden')).toBe('true');
      expect(page.allLink.getAttribute('tabindex')).toBe('-1');
      expect(page.inserted).toEqual([]);
      expect(decorate).not.toHaveBeenCalled();
    });
  }

  it('past the 2.5 s budget it gives up, aborts the reads, and a late answer paints nothing', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-23T15:00:00Z'), toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const page = makePage();
    const net = api({ summary: { '2026-11-24': 1 }, slotsByDay: { '2026-11-24': [slot('07:30')] }, delayMs: 4000 });
    await run(page, net);
    await vi.advanceTimersByTimeAsync(2500);
    expect(page.box.getAttribute('data-state')).toBe('failed');
    expect(net.calls[0].opts.signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(10000);
    expect(page.inserted).toEqual([]);
    expect(page.box.getAttribute('data-state')).toBe('failed');
  });

  it('page CSS keeps the failed block in place at every width', () => {
    const page = readFileSync(new URL('../ads/dexa/index.html', import.meta.url), 'utf8');
    expect(page).toMatch(/#adsOpenTimes\[data-state=failed\]\{visibility:hidden\}/);
    expect(page).not.toMatch(/#adsOpenTimes\[data-state=failed\]\{display:none\}/);
    expect(page).toContain(`data-type-id="${TYPE_ID}"`);
    expect(page).toContain('<script src="/shared/ads-open-times.js" defer></script>');
  });
});
