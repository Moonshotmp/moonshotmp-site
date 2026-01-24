import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Verify token
function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split(":");
  if (parts.length !== 2) return false;
  const timestamp = parseInt(parts[0], 10);
  if (isNaN(timestamp)) return false;
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  if (now - timestamp > maxAge) return false;
  const data = `${timestamp}:${secret}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return parts[1] === Math.abs(hash).toString(36);
}

function checkAuth(req) {
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!adminPassword) return { error: "Admin not configured", status: 500 };

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing authorization", status: 401 };
  }

  const token = authHeader.slice(7);
  if (!verifyToken(token, adminPassword)) {
    return { error: "Invalid or expired token", status: 401 };
  }

  return { ok: true };
}

export default async (req) => {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const auth = checkAuth(req);
  if (auth.error) return json(auth.status, { error: auth.error });

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return json(400, { error: "Missing slug parameter" });
  }

  try {
    const store = getStore("partners");
    const key = `partners/${slug}`;

    // Check if partner exists
    const existing = await store.get(key, { type: "json" });
    if (!existing) {
      return json(404, { error: "Partner not found" });
    }

    // Delete partner
    await store.delete(key);

    // Also try to delete their logo if it exists
    try {
      const logos = getStore("logos");
      await logos.delete(`logos/${slug}`);
    } catch (e) {
      // Logo might not exist, that's fine
    }

    console.log(`[admin-delete-partner] Deleted partner: ${slug}`);
    return json(200, { ok: true, deleted: slug });
  } catch (err) {
    console.error("[admin-delete-partner] error:", err);
    return json(500, { error: "Failed to delete partner" });
  }
};
