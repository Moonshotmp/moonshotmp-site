import { getStore } from "@netlify/blobs";

const STORE_NAME = "partners";
const KEY_PREFIX = "partners/";

const json = (status, body, extraHeaders = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...extraHeaders,
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

  // Load existing record so we don't wipe fields like stripe.*
  const existing = await store.get(key, { type: "json", consistency: "strong" });

  const now = new Date().toISOString();

  // Preserve createdAt and stripe unless explicitly provided
  const partner = {
    ...(existing || {}),
    ...(payload || {}),
    slug,

    createdAt: existing?.createdAt || payload?.createdAt || now,
    updatedAt: now,

    stripe: payload?.stripe ? { ...(existing?.stripe || {}), ...(payload.stripe || {}) } : (existing?.stripe || undefined),
  };

  await store.setJSON(key, partner);

  return json(200, { ok: true, slug });
};
