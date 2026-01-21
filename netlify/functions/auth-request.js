import { getStore } from '@netlify/blobs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

export async function handler(event) {
  try {
    const { slug, email } = JSON.parse(event.body || '{}')
    if (!slug || !email) return json(400, { error: 'Missing store ID or email' })

    const partners = getStore('partners')
    const partner = await partners.get(slug)

    const storedEmail = (partner?.email || '').trim().toLowerCase()
    const reqEmail = String(email).trim().toLowerCase()

    // If partner doesn't exist or email doesn't match:
    // - In production: return ok:true (do NOT reveal mismatch)
    // - In dev: return explicit error to help you debug setup
    const emailMatches = !!storedEmail && storedEmail === reqEmail
    if (!emailMatches) {
      if (process.env.NODE_ENV !== 'production') {
        return json(403, { error: 'Email does not match store owner email' })
      }
      return json(200, { ok: true })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 15 * 60 * 1000

    const tokens = getStore('auth_tokens')
    await tokens.set(token, { slug, email: reqEmail, expiresAt, usedAt: null })

    const link = `https://moonshotmp.com/.netlify/functions/auth-verify?token=${token}`

    // Dev: show link directly to make testing easy
    if (process.env.NODE_ENV !== 'production') {
      return json(200, { ok: true, link })
    }

    const {
      SMTP_HOST = 'smtp.office365.com',
      SMTP_PORT = '587',
      SMTP_USER,
      SMTP_PASS,
      SMTP_FROM
    } = process.env

    if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      console.error('Missing SMTP env vars: SMTP_USER / SMTP_PASS / SMTP_FROM')
      // still return ok so we don't leak anything
      return json(200, { ok: true })
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    })

    await transporter.sendMail({
      from: SMTP_FROM,
      to: reqEmail,
      subject: 'Your Moonshot partner sign-in link',
      text:
`Use this link to sign in and manage your store:

${link}

This link expires in 15 minutes. If you didn’t request it, you can ignore this email.`
    })

    return json(200, { ok: true })
  } catch (err) {
    console.error(err)
    // never leak details
    return json(200, { ok: true })
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }
}
