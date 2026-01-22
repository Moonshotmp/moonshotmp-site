import crypto from 'crypto'
import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

async function sendMailGraph({ to, subject, text }) {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MAIL_SENDER } = process.env
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET || !MAIL_SENDER) {
    throw new Error('Missing MS_* env vars or MAIL_SENDER')
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    }
  )

  const tokenJson = await tokenRes.json()
  if (!tokenRes.ok) throw new Error(`Token error: ${tokenJson.error_description || JSON.stringify(tokenJson)}`)

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MAIL_SENDER)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: text },
          toRecipients: [{ emailAddress: { address: to } }]
        },
        saveToSentItems: false
      })
    }
  )

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`sendMail failed: ${t}`)
  }
}

function normalizeRecord(x) {
  if (typeof x === 'string') { try { return JSON.parse(x) } catch { return null } }
  if (x && typeof x === 'object' && x.partner && typeof x.partner === 'object') return x.partner
  return x
}

async function loadPartner(partnersStore, slug) {
  const direct = normalizeRecord(await partnersStore.get(slug))
  if (direct) return direct
  const prefixed = normalizeRecord(await partnersStore.get(`partners/${slug}`))
  if (prefixed) return prefixed
  return null
}

export async function handler(event) {
  try {
    const { slug, email } = JSON.parse(event.body || '{}')
    if (!slug || !email) return ok()

    const partner = await loadPartner(store('partners'), slug)
    if (!partner) return ok()

    const storedEmail = String(partner.email || '').trim().toLowerCase()
    const reqEmail = String(email).trim().toLowerCase()
    if (!storedEmail || storedEmail !== reqEmail) return ok()

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 15 * 60 * 1000

    await store('auth_tokens').set(token, { slug, email: reqEmail, expiresAt, usedAt: null })

    const link = `https://moonshotmp.com/.netlify/functions/auth-verify?token=${token}`

    await sendMailGraph({
      to: reqEmail,
      subject: 'Your Moonshot partner sign-in link',
      text:
`Use this link to sign in and manage your store:

${link}

This link expires in 15 minutes. If you didn’t request it, you can ignore this email.`
    })

    console.log('[auth-request] graph sendMail ok', { slug })
    return ok()
  } catch (err) {
    console.error('[auth-request] graph failed', err?.message)
    return ok()
  }
}

function ok() {
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) }
}
