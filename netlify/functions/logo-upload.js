import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

function getCookie(header = '', name) {
  const match = header.match(new RegExp(name + '=([^;]+)'))
  return match?.[1]
}

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

function parseBlob(x) {
  if (!x) return null
  if (typeof x === 'string') { try { return JSON.parse(x) } catch { return null } }
  return x
}

function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '')
  if (!m) return null
  return { mime: m[1], b64: m[2] }
}

export async function handler(event) {
  try {
    const sessionId = getCookie(event.headers.cookie, 'ms_partner_session')
    if (!sessionId) return json(401, { error: 'Not signed in' })

    const sessions = store('auth_sessions')
    const session = parseBlob(await sessions.get(sessionId))
    if (!session || !session.expiresAt || session.expiresAt < Date.now()) return json(401, { error: 'Session expired' })

    const body = JSON.parse(event.body || '{}')
    const parsed = parseDataUrl(body.dataUrl)
    if (!parsed) return json(400, { error: 'Invalid image data' })

    // Cap raw base64 to ~6MB to prevent abuse (still supports big images)
    if (parsed.b64.length > 8_000_000) {
      return json(413, { error: 'Logo too large. Please use a smaller image.' })
    }

    // Store as deterministic key per slug (no extension needed)
    const key = `logos/${session.slug}`
    const logos = store('logos')

    await logos.set(key, JSON.stringify({
      mime: parsed.mime,
      b64: parsed.b64,
      updatedAt: Date.now()
    }))

    return json(200, { ok: true, logoKey: key, logoVersion: Date.now() })
  } catch (err) {
    console.error('[logo-upload] failed', err?.message)
    return json(500, { error: 'Server error' })
  }
}
