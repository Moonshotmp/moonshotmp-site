import { getStore } from '@netlify/blobs'

function getCookie(header = '', name) {
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return match?.[1]
}

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

async function getJson(store, key) {
  const v = await store.get(key, { type: 'json' })
  if (v && typeof v === 'object') return v
  if (typeof v === 'string') {
    try { return JSON.parse(v) } catch { return null }
  }
  return null
}

async function loadPartnerCanonical(partnersStore, slug) {
  const canonicalKey = `partners/${slug}`

  const canonical = await getJson(partnersStore, canonicalKey)
  if (canonical) return { partner: canonical, keyUsed: canonicalKey, migrated: false }

  const legacy = await getJson(partnersStore, slug)
  if (!legacy) return { partner: null, keyUsed: null, migrated: false }

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

    let updates = {}
    try { updates = JSON.parse(event.body || '{}') } catch {}

    const partners = getStore('partners')
    const { partner: existing, keyUsed } = await loadPartnerCanonical(partners, slug)
    if (!existing || !keyUsed) return json(404, { error: 'Partner not found' })

    // Only allow safe fields
    const merged = {
      ...existing,
      slug,
      name: typeof updates.name === 'string' ? updates.name : existing.name,
      email: typeof updates.email === 'string' ? updates.email : existing.email,
      branding: {
        ...(existing.branding || {}),
        ...(updates.branding || {})
      },
      stripe: existing.stripe || undefined, // never let partner-update overwrite stripe
      updatedAt: new Date().toISOString()
    }

    // Guard: do not allow inline images anymore
    if (merged?.branding?.logoDataUrl) delete merged.branding.logoDataUrl

    if (typeof partners.setJSON === 'function') {
      await partners.setJSON(keyUsed, merged)
    } else {
      await partners.set(keyUsed, JSON.stringify(merged))
    }

    return json(200, { ok: true })
  } catch (err) {
    console.error('[partner-update] failed', err)
    return json(500, { error: 'Server error' })
  }
}
