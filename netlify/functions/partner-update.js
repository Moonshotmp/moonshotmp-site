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

    const slug = String(session.slug || "").trim().toLowerCase();
    if (!slug) return json(401, { error: "Session missing slug" });

    let updates = {};
    try {
      updates = await req.json();
    } catch {}

    const partners = getStore("partners");
    const key = `partners/${slug}`;

    const existing = await partners.get(key, { type: "json" });
    if (!existing) return json(404, { error: "Partner not found" });

    const merged = {
      ...existing,
      slug,
      name: typeof updates.name === "string" ? updates.name : existing.name,
      email: typeof updates.email === "string" ? updates.email : existing.email,
      branding: {
        ...(existing.branding || {}),
        ...(updates.branding || {}),
      },
      stripe: existing.stripe,
      updatedAt: new Date().toISOString(),
    };

    if (merged?.branding?.logoDataUrl) delete merged.branding.logoDataUrl;

    await partners.setJSON(key, merged);
    return json(200, { ok: true });
  } catch (err) {
    console.error("[partner-update] failed", err?.message);
    return json(500, { error: "Server error" });
  }
};
