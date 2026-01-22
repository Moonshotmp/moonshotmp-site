import crypto from "crypto";
import { getStore } from "@netlify/blobs";

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  });
}

function redirectWithCookie(location, cookie) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Set-Cookie": cookie,
    },
  });
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get("token");
    if (!tokenParam) return redirect("/partners/login.html?error=missing");

    const tokens = getStore("auth_tokens");
    const record = await tokens.get(tokenParam, { type: "json" });

    if (!record || !record.expiresAt || record.expiresAt < Date.now()) {
      return redirect("/partners/login.html?error=expired");
    }

    const sessionId = crypto.randomBytes(32).toString("hex");
    const sessions = getStore("auth_sessions");

    await sessions.setJSON(sessionId, {
      slug: record.slug,
      email: record.email,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    try {
      await tokens.delete(tokenParam);
    } catch {}

    const dest = `/partners/manage.html?verified=1&slug=${encodeURIComponent(record.slug)}`;
    const cookie = `ms_partner_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;

    return redirectWithCookie(dest, cookie);
  } catch (err) {
    console.error("[auth-verify] failed", err);
    return redirect("/partners/login.html?error=server");
  }
};
