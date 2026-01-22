import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

export async function handler(event) {
  const startedAt = Date.now()

  try {
    const { slug, email } = JSON.parse(event.body || '{}')
    console.log('[auth-request] hit', { slug, emailProvided: !!email })
    if (!slug || !email) return json(400, { error: 'Missing store ID or email' })

    const partners = store('partners')
    const partner = await partners.get(slug)

    const storedEmail = (partner?.email || '').trim().toLowerCase()
    const reqEmail = String(email).trim().toLowerCase()
    const emailMatches = !!storedEmail && storedEmail === reqEmail
    console.log('[auth-request] email check', { slug, emailMatches })

    // Anti-enumeration: always OK in prod
    if (!emailMatches) return json(200, { ok: true })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 15 * 60 * 1000
    await store('auth_tokens').set(token, { slug, email: reqEmail, expiresAt, usedAt: null })

    const link = `https://moonshotmp.com/.netlify/functions/auth-verify?token=${token}`

    const {
      SMTP_HOST = 'smtp.office365.com',
      SMTP_PORT = '587',
      SMTP_USER,
      SMTP_PASS,
      SMTP_FROM
    } = process.env

    console.log('[auth-request] smtp env present', {
      host: SMTP_HOST, port: SMTP_PORT,
      hasUser: !!SMTP_USER, hasPass: !!SMTP_PASS, hasFrom: !!SMTP_FROM
    })

    if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      console.error('[auth-request] missing SMTP env vars')
      return json(200, { ok: true })
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    })

    try {
      const info = await transporter.sendMail({
        from: SMTP_FROM,
        to: reqEmail,
        subject: 'Your Moonshot partner sign-in link',
        text:
`Use this link to sign in and manage your store:

${link}

This link expires in 15 minutes. If you didn’t request it, you can ignore this email.`
      })

      console.log('[auth-request] sendMail ok', {
        messageId: info?.messageId,
        accepted: info?.accepted,
        rejected: info?.rejected,
        ms: Date.now() - startedAt
      })
    } catch (smtpErr) {
      console.error('[auth-request] sendMail FAILED', {
        message: smtpErr?.message,
        code: smtpErr?.code,
        response: smtpErr?.response
      })
      return json(200, { ok: true })
    }

    return json(200, { ok: true })
  } catch (err) {
    console.error('[auth-request] handler FAILED', { message: err?.message })
    return json(200, { ok: true })
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}
