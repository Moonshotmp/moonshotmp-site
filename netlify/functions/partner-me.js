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

async function loadPartner(partnersStore, slug) {
  // Try both key patterns
  const direct = normalizeRecord(await partnersStore.get(slug))
  if (direct) return { partner: direct, keyUsed: slug }

  const prefixedKey = `partners/${slug}`
  const prefixed = normalizeRecord(await partnersStore.get(prefixedKey))
  if (prefixed) return { partner: prefixed, keyUsed: prefixedKey }

  return { partner: null, keyUsed: null }
}

function getCookie(header = '', name) {
  const match = header.match(new RegExp(name + '=([^;]+)'))
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

    const partners = store('partners')
    const { partner } = await loadPartner(partners, session.slug)
    if (!partner) return json(404, { error: 'Partner not found' })

    // Ensure slug always present for UI
    partner.slug = partner.slug || session.slug

    return json(200, { ok: true, partner })
  } catch (err) {
    console.error('[partner-me] failed', err?.message)
    return json(500, { error: 'Server error' })
  }
}
