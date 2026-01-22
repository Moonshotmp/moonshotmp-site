import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

function normalizeRecord(x) {
  if (typeof x === 'string') { try { return JSON.parse(x) } catch { return null } }
  if (x && typeof x === 'object' && x.partner && typeof x.partner === 'object') return x.partner
  return x
}

async function loadPartnerCanonical(partnersStore, slug) {
  const canonicalKey = `partners/${slug}`

  // 1) Canonical first
  const canonical = normalizeRecord(await partnersStore.get(canonicalKey))
  if (canonical) return { partner: canonical, keyUsed: canonicalKey, migrated: false }

  // 2) Legacy fallback: direct key
  const legacy = normalizeRecord(await partnersStore.get(slug))
  if (!legacy) return { partner: null, keyUsed: null, migrated: false }

  // Migrate legacy -> canonical (one-time)
  const merged = { ...legacy, slug: legacy.slug || slug }
  await partnersStore.set(canonicalKey, merged)
  return { partner: merged, keyUsed: canonicalKey, migrated: true }
}

function getCookie(header = '', name) {
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return match?.[1]
}

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

export async function handler(event) {
  try {
    const sessionId = getCookie(event.headers.cookie, 'ms_partner_session')
    if (!sessionId) return json(401, { error: 'Not signed in' })

    const sessions = store('auth_sessions')
    const session = await sessions.get(sessionId)
    if (!session || session.expiresAt < Date.now()) return json(401, { error: 'Session expired' })

    const slug = String(session.slug || '').trim().toLowerCase()
    if (!slug) return json(401, { error: 'Session missing slug' })

    const partners = store('partners')
    const { partner } = await loadPartnerCanonical(partners, slug)
    if (!partner) return json(404, { error: 'Partner not found' })

    partner.slug = partner.slug || slug
    return json(200, { ok: true, partner })
  } catch (err) {
    console.error('[partner-me] failed', err)
    return json(500, { error: 'Server error' })
  }
}
