import { getStore } from "@netlify/blobs";
import { sendEmail, partnerWelcomeEmail } from "./send-email.js";

const STORE_NAME = "partners";
const KEY_PREFIX = "partners/";
const SITE_URL = "https://moonshotmp.com";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

const normalizeSlug = (raw) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(s)) return null;
  return s;
};

// Parse data URL for logo
function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

// Max logo size: ~4.5MB (base64 is ~33% larger, so ~6MB in base64)
const MAX_LOGO_BASE64_SIZE = 6_000_000;

export default async (req) => {
  try {
    if (req.method === "OPTIONS") return json(204, {});
    if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

    let payload;
    try {
      payload = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const slug = normalizeSlug(payload?.slug);
    if (!slug) return json(400, { error: "Missing/invalid slug" });

    const store = getStore(STORE_NAME);
    const key = `${KEY_PREFIX}${slug}`;

    let existing = null;
    try {
      existing = await store.get(key, { type: "json" });
    } catch (e) {
      console.log("[partner-save] no existing record or parse error", e?.message);
    }

    // Duplicate prevention: create-only mode
    if (payload?.createOnly && existing) {
      return json(409, { error: "Store already exists", slug });
    }

    const now = new Date().toISOString();

    const partner = {
      ...(existing || {}),
      ...(payload || {}),
      slug,
      createdAt: existing?.createdAt || payload?.createdAt || now,
      updatedAt: now,

      // Preserve important nested objects unless explicitly provided
      stripe: payload?.stripe
        ? { ...(existing?.stripe || {}), ...(payload.stripe || {}) }
        : (existing?.stripe || undefined),

      branding: payload?.branding
        ? { ...(existing?.branding || {}), ...(payload.branding || {}) }
        : (existing?.branding || undefined),
    };

    // Handle optional logo upload during creation
    let logoKey = partner.branding?.logoKey;
    if (payload?.logoDataUrl) {
      const parsed = parseDataUrl(payload.logoDataUrl);
      if (parsed) {
        if (parsed.b64.length > MAX_LOGO_BASE64_SIZE) {
          return json(413, { error: "Logo too large. Maximum size is 4.5MB." });
        }

        const logos = getStore("logos");
        logoKey = `logos/${slug}`;

        await logos.setJSON(logoKey, {
          mime: parsed.mime,
          b64: parsed.b64,
          updatedAt: Date.now(),
        });

        // Update partner with logo key
        partner.branding = partner.branding || {};
        partner.branding.logoKey = logoKey;
      }
    }

    // Remove logoDataUrl from partner object before saving (don't store raw image data)
    delete partner.logoDataUrl;

    await store.setJSON(key, partner);

    // Send welcome email for new partners
    const isNewPartner = payload?.createOnly && !existing;
    if (isNewPartner && partner.email) {
      const storeUrl = `${SITE_URL}/partners/store.html?slug=${slug}`;
      const loginUrl = `${SITE_URL}/partners/login.html`;
      const manageUrl = `${SITE_URL}/partners/manage.html`;

      const emailContent = partnerWelcomeEmail({
        partnerName: partner.name || partner.contactName || slug,
        storeUrl,
        manageUrl,
        loginUrl,
      });

      // Send email (don't block response on email delivery)
      sendEmail({
        to: partner.email,
        ...emailContent,
      }).then(result => {
        if (result.ok) {
          console.log(`[partner-save] Welcome email sent to ${partner.email}`);
        } else {
          console.error(`[partner-save] Failed to send welcome email:`, result.error);
        }
      }).catch(err => {
        console.error(`[partner-save] Email error:`, err);
      });
    }

    return json(200, { ok: true, slug });
  } catch (err) {
    console.error("[partner-save] failed", err);
    return json(500, { error: "Server error" });
  }
};
