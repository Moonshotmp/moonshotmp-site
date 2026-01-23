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

  const sessionId = body?.sessionId;
  const completedAt = body?.completedAt;
  const notes = body?.notes || "";

  if (!sessionId) {
    return json(400, { error: "Missing sessionId" });
  }

  if (!completedAt) {
    return json(400, { error: "Missing completedAt date" });
  }

  try {
    const store = getStore("completions");

    const completion = {
      sessionId,
      completedAt,
      completedBy: "admin",
      notes,
      updatedAt: new Date().toISOString(),
    };

    await store.setJSON(`completion/${sessionId}`, completion);

    return json(200, { ok: true, completion });
  } catch (err) {
    console.error("[admin-completion-set] error:", err);
    return json(500, { error: "Failed to save completion" });
  }
};
