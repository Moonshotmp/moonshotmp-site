import { getStore } from '@netlify/blobs'
import crypto from 'crypto'

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

function normalize(x) {
  if (!x) return null
  if (typeof x === 'string') { try { return JSON.parse(x) } catch { return null } }
  if (x && typeof x === 'object' && x.token && typeof x.token === 'object') return x.token
  return x
}

function safeLower(s) {
  return String(s || '').trim().toLowerCase()
}

function redirectWithCookie(location, cookie) {
  return {
    statusCode: 302,
    headers: {
      Location: location,
      'Cache-Control': 'no-store'
    },
    // Netlify is most reliable with Set-Cookie in multiValueHeaders
    multiValueHeaders: {
      'Set-Cookie': [cookie]
    },
    body: ''
  }
}

function redirect(location) {
  return {
    statusCode: 302,
    headers: { Location: location, 'Cache-Control': 'no-store' },
    body: ''
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

export async function handler(event) {
  try {
    const q = event.queryStringParameters || {}
    const tokenId = q.token || q.t || ''
    const slugHint = safeLower(q.slug || '')

    if (!tokenId) {
      const dest = `/partners/login.html${slugHint ? `?slug=${encodeURIComponent(slugHint)}` : ''}`
      return redirect(dest)
    }

    const tokens = store('auth_tokens')
    const tokenRaw = await tokens.get(tokenId)
    const tokenRec = normalize(tokenRaw)

    const slug = safeLower(tokenRec?.slug || slugHint)
    if (!tokenRec || !slug) {
      const dest = `/partners/login.html${slug ? `?slug=${encodeURIComponent(slug)}&error=invalid` : ''}`
      return redirect(dest)
    }

    if (!tokenRec.expiresAt || tokenRec.expiresAt < Date.now()) {
      try { await tokens.delete(tokenId) } catch {}
      const dest = `/partners/login.html?slug=${encodeURIComponent(slug)}&error=expired`
      return redirect(dest)
    }

    // Create session
    const sessionId = crypto.randomBytes(24).toString('hex')
    const sessions = store('auth_sessions')

    const session = {
      slug,
      email: tokenRec.email || '',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
    }

    await sessions.set(sessionId, session)

    // Burn token (one-time)
    try { await tokens.delete(tokenId) } catch {}

    // Cookie must be Path=/ so it’s sent to ALL pages + functions.
    // SameSite=Lax allows link-click landings.
    // Secure requires https (you have it).
    const cookie = [
      `ms_partner_session=${sessionId}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      `Max-Age=${60 * 60 * 24 * 7}`
    ].join('; ')

    const dest = `/partners/manage.html?verified=1&slug=${encodeURIComponent(slug)}`
    return redirectWithCookie(dest, cookie)
  } catch (err) {
    console.error('[auth-verify] failed', err)
    return json(500, { error: 'Server error', detail: String(err?.message || err) })
  }
}
