import crypto from 'crypto'
import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

export async function handler(event) {
  try {
    const tokenParam = event.queryStringParameters?.token
    if (!tokenParam) return redirect('/partners/manage.html?error=missing')

    const tokens = store('auth_tokens')
    const record = await tokens.get(tokenParam)

    if (!record || record.usedAt || record.expiresAt < Date.now()) {
      return redirect('/partners/manage.html?error=expired')
    }

    await tokens.set(tokenParam, { ...record, usedAt: Date.now() })

    const sessionId = crypto.randomBytes(32).toString('hex')
    await store('auth_sessions').set(sessionId, {
      slug: record.slug,
      email: record.email,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    })

    return {
      statusCode: 302,
      headers: {
        'Set-Cookie': `ms_partner_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
        Location: '/partners/manage.html?verified=1'
      }
    }
  } catch (err) {
    console.error('[auth-verify] failed', err?.message)
    return redirect('/partners/manage.html?error=server')
  }
}

function redirect(path) {
  return { statusCode: 302, headers: { Location: path } }
}
