import crypto from 'crypto'
import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

function redirect(location) {
  return { statusCode: 302, headers: { Location: location } }
}

export async function handler(event) {
  try {
    const tokenParam = event.queryStringParameters?.token
    if (!tokenParam) return redirect('/partners/login.html?error=missing_token')

    const tokens = store('auth_tokens')
    const record = await tokens.get(tokenParam)

    if (!record || record.expiresAt < Date.now()) {
      return redirect('/partners/login.html?error=expired')
    }

    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex')
    const sessions = store('auth_sessions')

    await sessions.set(sessionId, {
      slug: record.slug,
      email: record.email,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    })

    // Invalidate token (delete if supported; otherwise mark used)
    try {
      await tokens.delete(tokenParam)
    } catch {
      await tokens.set(tokenParam, { ...record, usedAt: Date.now() })
    }

    // Redirect to admin page with a one-time toast
    const dest = `/partners/manage.html?verified=1&slug=${encodeURIComponent(record.slug)}`

    return {
      statusCode: 302,
      headers: {
        'Set-Cookie': `ms_partner_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
        'Location': dest
      }
    }
  } catch (err) {
    console.error('[auth-verify] failed', err?.message)
    return redirect('/partners/login.html?error=server')
  }
}
