import { getStore } from '@netlify/blobs'

function store(name) {
  try {
    return getStore(name)
  } catch (e) {
    const siteID = process.env.NETLIFY_SITE_ID
    const token = process.env.NETLIFY_AUTH_TOKEN
    if (!siteID || !token) throw e
    return getStore({ name, siteID, token })
  }
}

function getCookie(header = '', name) {
  const match = String(header || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return match?.[1]
}

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

function normalize(x) {
  if (!x) return null
  if (typeof x === 'string') { try { return JSON.parse(x) } catch { return null } }
  if (x && typeof x === 'object' && x.partner && typeof x.partner === 'object') return x.partner
  return x
}

async function loadPartnerCanonical(partnersStore, slug) {
  const canonicalKey = `partners/${slug}`
  const canonical = normalize(await partnersStore.get(canonicalKey))
  if (canonical) return { partner: canonical, keyUsed: canonicalKey }

  const legacy = normalize(await partnersStore.get(slug))
  if (legacy) {
    const merged = { ...legacy, slug: legacy.slug || slug }
    await partnersStore.set(canonicalKey, merged)
    return { partner: merged, keyUsed: canonicalKey }
  }
  return { partner: null, keyUsed: null }
}

export async function handler(event) {
  try {
    const sessionId = getCookie(event.headers?.cookie, 'ms_partner_session')
    if (!sessionId) return json(401, { error: 'Not signed in' })

    const sessions = store('auth_sessions')
    const session = normalize(await sessions.get(sessionId))

    if (!session || !session.expiresAt || session.expiresAt < Date.now()) {
      return json(401, { error: 'Session expired' })
    }

    const slug = String(session.slug || '').trim().toLowerCase()
    if (!slug) return json(401, { error: 'Session missing slug' })

    let updates = {}
    try { updates = JSON.parse(event.body || '{}') } catch {}

    const partners = store('partners')
    const { partner: existing, keyUsed } = await loadPartnerCanonical(partners, slug)
    if (!existing || !keyUsed) return json(404, { error: 'Partner not found' })

    const merged = {
      ...existing,
      slug,
      name: typeof updates.name === 'string' ? updates.name : existing.name,
      email: typeof updates.email === 'string' ? updates.email : existing.email,
      branding: {
        ...(existing.branding || {}),
        ...(updates.branding || {})
      },
      stripe: existing.stripe, // do not overwrite stripe
      updatedAt: new Date().toISOString()
    }

    if (merged?.branding?.logoDataUrl) delete merged.branding.logoDataUrl

    await partners.set(keyUsed, merged)
    return json(200, { ok: true })
  } catch (err) {
    console.error('[partner-update] failed', err)
    return json(500, { error: 'Server error' })
  }
}
