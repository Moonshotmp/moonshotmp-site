import { getStore } from '@netlify/blobs'

export async function handler(event) {
  const sessionId = getCookie(event.headers.cookie, 'ms_partner_session')
  if (!sessionId) return json(401, { error: 'Not signed in' })

  const sessions = getStore('auth_sessions')
  const session = await sessions.get(sessionId)
  if (!session || session.expiresAt < Date.now()) {
    return json(401, { error: 'Session expired' })
  }

  const partners = getStore('partners')
  const partner = await partners.get(session.slug)

  return json(200, { ok: true, partner })
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
