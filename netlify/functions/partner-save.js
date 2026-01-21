import { getStore } from "@netlify/blobs";

const STORE_NAME = "partners";
const KEY_PREFIX = "partners/";

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

export default async (req) => {
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

  const existing = await store.get(key, { type: "json", consistency: "strong" });

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

  await store.setJSON(key, partner);

  return json(200, { ok: true, slug });
};
