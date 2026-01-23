import { getStore } from "@netlify/blobs";

const ALLOWED_EMAIL = "tom@moonshotmp.com";

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

async function verifyAuth(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing authorization header", status: 401 };
  }

  const token = authHeader.slice(7);

  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token format");

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const email = payload.email;

    if (!email || email !== ALLOWED_EMAIL) {
      return { error: "Unauthorized", status: 403 };
    }

    return { email };
  } catch (err) {
    console.error("[admin-completion-get] JWT decode error:", err.message);
    return { error: "Invalid token", status: 401 };
  }
}

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const auth = await verifyAuth(req);
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
