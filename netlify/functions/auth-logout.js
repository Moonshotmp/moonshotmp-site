import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

function getCookie(header = '', name) {
  const m = header.match(new RegExp(name + '=([^;]+)'))
  return m?.[1]
}

export async function handler(event) {
  try {
    const sessionId = getCookie(event.headers.cookie, 'ms_partner_session')
    if (sessionId) {
      const sessions = store('auth_sessions')
      await sessions.delete(sessionId)
    }

    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': 'ms_partner_session=; Path=/; Max-Age=0'
      },
      body: JSON.stringify({ ok: true })
    }
  } catch (err) {
    console.error('[auth-logout] failed', err)
    return { statusCode: 500, body: 'Server error' }
  }
}
