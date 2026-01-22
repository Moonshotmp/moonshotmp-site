import { getStore } from "@netlify/blobs";

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) throw new Error("Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN");
  return getStore({ name, siteID, token });
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
    body: JSON.stringify(body),
  };
}

function parseBlob(x) {
  if (!x) return null;
  if (typeof x === "string") { try { return JSON.parse(x); } catch { return null; } }
  return x;
}

const normalizeSlug = (raw) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(s)) return null;
  return s;
};

async function loadPartner(partnersStore, slug) {
  // Try direct key first (legacy)
  const direct = parseBlob(await partnersStore.get(slug));
  if (direct) return direct;
  // Try prefixed key
  const prefixed = parseBlob(await partnersStore.get(`partners/${slug}`));
  if (prefixed) return prefixed;
  return null;
}

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return json(204, {});
    if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });

    const slug = normalizeSlug(event.queryStringParameters?.slug);
    if (!slug) return json(400, { error: "Missing slug" });

    const partners = store("partners");
    const partner = await loadPartner(partners, slug);
    if (!partner) return json(404, { error: "Partner not found" });

    // Ensure slug is set
    partner.slug = partner.slug || slug;

    return json(200, partner);
  } catch (err) {
    console.error("[partner-get] failed", err);
    return json(500, { error: "Server error" });
  }
}
