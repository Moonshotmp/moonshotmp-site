import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

export async function handler(event) {
  try {
    const token = event.queryStringParameters?.token
    if (!token) return { statusCode: 400, body: 'Missing token' }

    const tokens = store('auth_tokens')
    const record = await tokens.get(token)
    if (!record || record.expiresAt < Date.now()) {
      return { statusCode: 401, body: 'Invalid or expired link' }
    }

    const sessions = store('auth_sessions')
    const sessionId = crypto.randomUUID()

    await sessions.set(sessionId, {
      slug: record.slug,
      email: record.email,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    })

    await tokens.delete(token)

    return {
      statusCode: 302,
      headers: {
        'Set-Cookie': `ms_partner_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
        'Location': `/partners/manage.html?verified=1&slug=${encodeURIComponent(record.slug)}`
      }
    }
  } catch (err) {
    console.error('[auth-verify] failed', err)
    return { statusCode: 500, body: 'Server error' }
  }
}
