import { getStore } from '@netlify/blobs'
import crypto from 'crypto'

export async function handler(event) {
  const token = event.queryStringParameters?.token
  if (!token) return redirect('/partners/manage.html')

  const tokens = getStore('auth_tokens')
  const record = await tokens.get(token)

  if (!record || record.usedAt || record.expiresAt < Date.now()) {
    return redirect('/partners/manage.html?error=expired')
  }

  await tokens.set(token, { ...record, usedAt: Date.now() })

  const sessionId = crypto.randomBytes(32).toString('hex')
  const sessions = getStore('auth_sessions')

  await sessions.set(sessionId, {
    slug: record.slug,
    email: record.email,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  })

  return {
    statusCode: 302,
    headers: {
      'Set-Cookie':
        `ms_partner_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
      Location: '/partners/manage.html'
    }
  }
}

function redirect(path) {
  return { statusCode: 302, headers: { Location: path } }
}
