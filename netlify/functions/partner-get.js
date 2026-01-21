import { getStore } from "@netlify/blobs";

const STORE_NAME = "partners";
const KEY_PREFIX = "partners/";

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
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

  const url = new URL(req.url);
  const slug = normalizeSlug(url.searchParams.get("slug"));
  if (!slug) return json(400, { error: "Missing slug" });

  const store = getStore(STORE_NAME);
  const key = `${KEY_PREFIX}${slug}`;

  const partner = await store.get(key, { type: "json" });
  if (!partner) return json(404, { error: "Partner not found" });

  return json(200, partner);
};
