import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function getCookie(header = "", name) {
  const match = String(header || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return match?.[1];
}

export default async (req) => {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const sessionId = getCookie(cookieHeader, "ms_partner_session");
    console.log("[partner-me] cookie present", { hasSessionCookie: !!sessionId });

    if (!sessionId) return json(401, { error: "Not signed in" });

    const sessions = getStore("auth_sessions");
    const session = await sessions.get(sessionId, { type: "json" });

    console.log("[partner-me] session lookup", { found: !!session });

    if (!session) return json(401, { error: "Session not found" });
    if (session.expiresAt && session.expiresAt < Date.now()) {
      return json(401, { error: "Session expired" });
    }
    if (!session.slug) return json(500, { error: "Session missing slug" });

    const partners = getStore("partners");

    // Try both key formats
    let partner = await partners.get(`partners/${session.slug}`, { type: "json" });
    if (!partner) {
      partner = await partners.get(session.slug, { type: "json" });
    }

    console.log("[partner-me] partner lookup", { slug: session.slug, found: !!partner });

    if (!partner) return json(404, { error: "Partner not found" });

    partner.slug = partner.slug || session.slug;

    return json(200, { ok: true, partner });
  } catch (err) {
    console.error("[partner-me] failed", err?.message);
    return json(500, { error: "Server error" });
  }
};
