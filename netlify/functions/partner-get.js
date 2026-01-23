import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

const normalizeSlug = (raw) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(s)) return null;
  return s;
};

export default async (req) => {
  try {
    if (req.method === "OPTIONS") return json(204, {});
    if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

    const url = new URL(req.url);
    const slug = normalizeSlug(url.searchParams.get("slug"));
    if (!slug) return json(400, { error: "Missing slug" });

    const store = getStore("partners");

    // Try prefixed key first (current format)
    let partner = null;
    try {
      partner = await store.get(`partners/${slug}`, { type: "json" });
    } catch (e) {
      console.error("[partner-get] prefixed key parse error", e?.message);
    }

    // Try direct key (legacy format)
    if (!partner) {
      try {
        partner = await store.get(slug, { type: "json" });
      } catch (e) {
        console.error("[partner-get] legacy key parse error", e?.message);
      }
    }

    if (!partner) return json(404, { error: "Partner not found" });

    // Ensure slug is set
    partner.slug = partner.slug || slug;

    return json(200, partner);
  } catch (err) {
    console.error("[partner-get] failed", err?.message);
    return json(500, { error: "Server error" });
  }
};
