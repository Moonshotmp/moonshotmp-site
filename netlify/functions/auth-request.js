import crypto from 'crypto'
import fetch from 'node-fetch'
import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

async function sendMail(to, link) {
  const tenant = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET
  const from = process.env.MAIL_SENDER

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  })

  const tokenJson = await tokenRes.json()
  const accessToken = tokenJson.access_token

  await fetch('https://graph.microsoft.com/v1.0/users/' + from + '/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        subject: 'Your Moonshot Partner sign-in link',
        body: {
          contentType: 'HTML',
          content: `
            <p>Click the link below to manage your store:</p>
            <p><a href="${link}">${link}</a></p>
            <p>This link expires in 15 minutes.</p>
          `
        },
        toRecipients: [{ emailAddress: { address: to } }]
      }
    })
  })
}

export async function handler(event) {
  try {
    const { slug, email } = JSON.parse(event.body || '{}')
    if (!slug || !email) return json(200, { ok: true })

    const partners = store('partners')
    const partner =
      (await partners.get(slug)) ||
      (await partners.get(`partners/${slug}`))

    if (!partner) return json(200, { ok: true })
    if ((partner.email || '').toLowerCase() !== email.toLowerCase()) {
      return json(200, { ok: true }) // silent fail
    }

    const token = crypto.randomBytes(24).toString('hex')
    const tokens = store('auth_tokens')

    await tokens.set(token, {
      slug,
      email,
      expiresAt: Date.now() + 15 * 60 * 1000
    })

    const link = `${process.env.SITE_URL}/.netlify/functions/auth-verify?token=${token}`
    await sendMail(email, link)

    return json(200, { ok: true })
  } catch (err) {
    console.error('[auth-request] failed', err)
    return json(500, { error: 'Server error' })
  }
}
