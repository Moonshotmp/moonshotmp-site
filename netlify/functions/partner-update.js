import { getStore } from '@netlify/blobs'

export async function handler(event) {
  const sessionId = getCookie(event.headers.cookie, 'ms_partner_session')
  if (!sessionId) return json(401, { error: 'Not signed in' })

  const sessions = getStore('auth_sessions')
  const session = await sessions.get(sessionId)
  if (!session || session.expiresAt < Date.now()) {
    return json(401, { error: 'Session expired' })
  }

  const updates = JSON.parse(event.body || '{}')

  const partners = getStore('partners')
  const existing = await partners.get(session.slug)
  if (!existing) return json(404, { error: 'Partner not found' })

  const merged = {
    ...existing,
    name: typeof updates.name === 'string' ? updates.name : existing.name,
    email: typeof updates.email === 'string' ? updates.email : existing.email,
    branding: {
      ...(existing.branding || {}),
      ...(updates.branding || {})
    }
  }

  await partners.set(session.slug, merged)
  return json(200, { ok: true })
}

function getCookie(header = '', name) {
  const match = header.match(new RegExp(name + '=([^;]+)'))
  return match?.[1]
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }
}
