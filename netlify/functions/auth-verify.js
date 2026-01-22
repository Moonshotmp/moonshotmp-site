import { getStore } from "@netlify/blobs";
import crypto from "crypto";

function redirect(location, extraHeaders = {}) {
  return {
    statusCode: 302,
    headers: {
      Location: location,
      ...extraHeaders,
    },
    body: "",
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function safeLower(s) {
  return String(s || "").trim().toLowerCase();
}

async function getJson(store, key) {
  const v = await store.get(key, { type: "json" });
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

export async function handler(event) {
  try {
    const q = event.queryStringParameters || {};
    const token = q.token || q.t || "";
    const slugHint = safeLower(q.slug || "");

    if (!token) {
      const dest = `/partners/login.html${slugHint ? `?slug=${encodeURIComponent(slugHint)}` : ""}`;
      return redirect(dest);
    }

    const tokens = getStore("auth_tokens");
    const tokenRec = await getJson(tokens, token);

    // If token missing/expired, bounce to login with slug if we have it.
    const slug = safeLower(tokenRec?.slug || slugHint);
    if (!tokenRec) {
      const dest = `/partners/login.html${slug ? `?slug=${encodeURIComponent(slug)}&error=expired` : ""}`;
      return redirect(dest);
    }

    if (!tokenRec.expiresAt || tokenRec.expiresAt < Date.now()) {
      // Burn token if it exists but expired
      try { await tokens.delete(token); } catch {}
      const dest = `/partners/login.html${slug ? `?slug=${encodeURIComponent(slug)}&error=expired` : ""}`;
      return redirect(dest);
    }

    if (!slug) {
      // Token exists but no slug is a hard error
      return json(400, { error: "Token missing slug" });
    }

    // Create a new session
    const sessionId = crypto.randomBytes(24).toString("hex");
    const sessions = getStore("auth_sessions");

    const session = {
      slug,
      email: tokenRec.email || "",
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
    };

    if (typeof sessions.setJSON === "function") {
      await sessions.setJSON(sessionId, session);
    } else {
      await sessions.set(sessionId, JSON.stringify(session));
    }

    // Burn the token (one-time)
    try { await tokens.delete(token); } catch {}

    // CRITICAL: cookie must be Path=/ or manage.html won't send it to functions.
    // Secure+SameSite=Lax is correct for same-site magic link landings.
    const cookie = [
      `ms_partner_session=${sessionId}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      `Max-Age=${60 * 60 * 24 * 7}`,
    ].join("; ");

    const dest = `/partners/manage.html?verified=1&slug=${encodeURIComponent(slug)}`;
    return redirect(dest, { "Set-Cookie": cookie });
  } catch (err) {
    console.error("[auth-verify] failed", err);
    return json(500, { error: "Server error" });
  }
}
