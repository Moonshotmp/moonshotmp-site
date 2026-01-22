import { getStore } from '@netlify/blobs'

function getCookie(header = '', name) {
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return match?.[1]
}

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

async function getJson(store, key) {
  // Prefer JSON retrieval; fall back to parsing string if needed.
  const v = await store.get(key, { type: 'json' })
  if (v && typeof v === 'object') return v
  if (typeof v === 'string') {
    try { return JSON.parse(v) } catch { return null }
  }
  return null
}

async function loadPartnerCanonical(partnersStore, slug) {
  const canonicalKey = `partners/${slug}`

  // 1) Canonical location first
  const canonical = await getJson(partnersStore, canonicalKey)
  if (canonical) return { partner: canonical, keyUsed: canonicalKey, migrated: false }

  // 2) Legacy fallback: direct key (old systems)
  const legacy = await getJson(partnersStore, slug)
  if (!legacy) return { partner: null, keyUsed: null, migrated: false }

  // Migrate legacy -> canonical (one-time)
  const merged = { ...legacy, slug: legacy.slug || slug }
  if (typeof partnersStore.setJSON === 'function') {
    await partnersStore.setJSON(canonicalKey, merged)
  } else {
    await partnersStore.set(canonicalKey, JSON.stringify(merged))
  }

  return { partner: merged, keyUsed: canonicalKey, migrated: true }
}

export async function handler(event) {
  try {
    const sessionId = getCookie(event.headers.cookie, 'ms_partner_session')
    if (!sessionId) return json(401, { error: 'Not signed in' })

    const sessions = getStore('auth_sessions')
    const session = await getJson(sessions, sessionId)
    if (!session || !session.expiresAt || session.expiresAt < Date.now()) {
      return json(401, { error: 'Session expired' })
    }

    const slug = String(session.slug || '').trim().toLowerCase()
    if (!slug) return json(401, { error: 'Session missing slug' })

    const partners = getStore('partners')
    const { partner } = await loadPartnerCanonical(partners, slug)
    if (!partner) return json(404, { error: 'Partner not found' })

    partner.slug = partner.slug || slug
    return json(200, { ok: true, partner })
  } catch (err) {
    console.error('[partner-me] failed', err)
    return json(500, { error: 'Server error' })
  }
}
