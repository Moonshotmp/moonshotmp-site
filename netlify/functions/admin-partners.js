import { getStore } from "@netlify/blobs";
import { verifyMasterToken } from "./admin-master-verify.js";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Verify regular admin token
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
  const masterPassword = (process.env.MASTER_ADMIN_PASSWORD || "").trim();

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing authorization", status: 401 };
  }

  const token = authHeader.slice(7);

  // Accept either regular admin token or master admin token
  const isRegularAdmin = adminPassword && verifyToken(token, adminPassword);
  const isMasterAdmin = verifyMasterToken(token, masterPassword);

  if (!isRegularAdmin && !isMasterAdmin) {
    return { error: "Invalid or expired token", status: 401 };
  }

  return { ok: true };
}

export default async (req) => {
  const auth = checkAuth(req);
  if (auth.error) return json(auth.status, { error: auth.error });

  try {
    const store = getStore("partners");
    const url = new URL(req.url);
    const singleSlug = url.searchParams.get("slug");

    // Single partner lookup
    if (singleSlug) {
      const partner = await store.get(`partners/${singleSlug}`, { type: "json" });
      if (!partner) return json(404, { error: "Partner not found" });
      return json(200, { partner });
    }

    // List all partners
    const { blobs } = await store.list({ prefix: "partners/" });

    const partners = [];
    for (const blob of blobs) {
      try {
        const data = await store.get(blob.key, { type: "json" });
        if (data) partners.push(data);
      } catch (e) {
        console.error(`[admin-partners] Failed to read ${blob.key}:`, e.message);
      }
    }

    // Sort by createdAt descending
    partners.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    return json(200, { partners });
  } catch (err) {
    console.error("[admin-partners] error:", err);
    return json(500, { error: "Failed to load partners" });
  }
};
