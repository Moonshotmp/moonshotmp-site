import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

function getCookie(header = "", name) {
  const match = String(header || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return match?.[1];
}

function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

export default async (req) => {
  try {
    if (req.method === "OPTIONS") return json(204, {});
    if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

    const cookieHeader = req.headers.get("cookie") || "";
    const sessionId = getCookie(cookieHeader, "ms_partner_session");
    if (!sessionId) return json(401, { error: "Not signed in" });

    const sessions = getStore("auth_sessions");
    const session = await sessions.get(sessionId, { type: "json" });

    if (!session || !session.expiresAt || session.expiresAt < Date.now()) {
      return json(401, { error: "Session expired" });
    }

    const body = await req.json();
    const parsed = parseDataUrl(body.dataUrl);
    if (!parsed) return json(400, { error: "Invalid image data" });

    // Cap raw base64 to ~6MB to prevent abuse
    if (parsed.b64.length > 8_000_000) {
      return json(413, { error: "Logo too large. Please use a smaller image." });
    }

    const key = `logos/${session.slug}`;
    const logos = getStore("logos");

    await logos.setJSON(key, {
      mime: parsed.mime,
      b64: parsed.b64,
      updatedAt: Date.now(),
    });

    return json(200, { ok: true, logoKey: key, logoVersion: Date.now() });
  } catch (err) {
    console.error("[logo-upload] failed", err?.message);
    return json(500, { error: "Server error" });
  }
};
