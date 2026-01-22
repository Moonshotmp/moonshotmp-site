import { getStore } from '@netlify/blobs'

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  return getStore({ name, siteID, token })
}

function normalizeRecord(x) {
  if (typeof x === 'string') { try { return JSON.parse(x) } catch { return null } }
  return x
}

export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {}
    const key = (qs.key || '').trim()
    if (!key) return { statusCode: 400, body: 'Missing key' }

    const logos = store('logos')
    const rec = normalizeRecord(await logos.get(key))
    if (!rec || !rec.b64 || !rec.mime) return { statusCode: 404, body: 'Not found' }

    const buf = Buffer.from(rec.b64, 'base64')

    return {
      statusCode: 200,
      headers: {
        'content-type': rec.mime,
        // Cache hard; we bust with ?v=logoVersion
        'cache-control': 'public, max-age=31536000, immutable'
      },
      body: buf.toString('base64'),
      isBase64Encoded: true
    }
  } catch (err) {
    console.error('[logo-get] failed', err?.message)
    return { statusCode: 500, body: 'Server error' }
  }
}
