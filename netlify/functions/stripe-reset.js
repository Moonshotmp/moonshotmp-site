import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

export async function handler(event) {
  try {
    const sessionId = getCookie(event.headers.cookie, 'ms_partner_session')
    if (!sessionId) return json(401, { error: 'Not signed in' })

    const session = await store('auth_sessions').get(sessionId)
    if (!session || session.expiresAt < Date.now()) return json(401, { error: 'Session expired' })

    const partners = store('partners')
    const partner = await partners.get(session.slug)
    if (!partner) return json(404, { error: 'Partner not found' })

    await partners.set(session.slug, {
      ...partner,
      stripe: { ...(partner.stripe || {}), connectedAccountId: null, onboarded: false }
    })

    return json(200, { ok: true })
  } catch (err) {
    console.error('[stripe-reset] failed', err?.message)
    return json(500, { error: 'Server error' })
  }
}

function getCookie(header = '', name) {
  const match = header.match(new RegExp(name + '=([^;]+)'))
  return match?.[1]
}

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}
