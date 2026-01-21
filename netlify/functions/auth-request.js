import { getStore } from '@netlify/blobs'
import crypto from 'crypto'

export async function handler(event) {
  try {
    const { slug, email } = JSON.parse(event.body || '{}')
    if (!slug || !email) {
      return json(400, { error: 'Missing store ID or email' })
    }

    const partners = getStore('partners')
    const partner = await partners.get(slug)

    if (!partner || (partner.email || '').toLowerCase() !== email.toLowerCase()) {
      return json(403, { error: 'Invalid store or email' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 15 * 60 * 1000

    const tokens = getStore('auth_tokens')
    await tokens.set(token, {
      slug,
      email,
      expiresAt,
      usedAt: null
    })

    const link =
      `https://moonshotmp.com/.netlify/functions/auth-verify?token=${token}`

    // Dev / preview: return the link directly
    if (process.env.NODE_ENV !== 'production') {
      return json(200, { ok: true, link })
    }

    // TODO: wire SendGrid/Mailgun here
    console.log('Magic link:', link)

    return json(200, { ok: true })
  } catch (err) {
    console.error(err)
    return json(500, { error: 'Server error' })
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }
}
