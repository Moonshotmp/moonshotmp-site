import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
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
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const auth = checkAuth(req);
  if (auth.error) return json(auth.status, { error: auth.error });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const sessionIds = body?.sessionIds;
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return json(400, { error: "Missing sessionIds array" });
  }

  try {
    const store = getStore("completions");
    const completions = {};

    for (const sessionId of sessionIds) {
      try {
        const data = await store.get(`completion/${sessionId}`, { type: "json" });
        if (data) {
          completions[sessionId] = data;
        }
      } catch (e) {
        // Key doesn't exist, skip
      }
    }

    return json(200, { completions });
  } catch (err) {
    console.error("[admin-completion-get] error:", err);
    return json(500, { error: "Failed to load completions" });
  }
};
