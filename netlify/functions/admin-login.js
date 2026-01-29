// Admin login with email 2FA
// Set ADMIN_PASSWORD in Netlify environment variables
import { getSupabase } from "./shared/supabase.js";
import { sendEmail, loginCodeEmail } from "./send-email.js";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

// Simple token generation (timestamp + hash)
function generateToken(secret) {
  const timestamp = Date.now();
  const data = `${timestamp}:${secret}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${timestamp}:${Math.abs(hash).toString(36)}`;
}

// Generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate session ID
function generateSessionId() {
  return `billing_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!adminPassword) {
    console.error("[admin-login] ADMIN_PASSWORD not set");
    return json(500, { error: "Admin login not configured" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { password, session_id, code } = body;

  // Step 2: Verify email code
  if (session_id && code) {
    const db = getSupabase();

    const { data: authCode, error } = await db
      .from("auth_codes")
      .select("*")
      .eq("session_id", session_id)
      .eq("code", code)
      .eq("type", "billing")
      .single();

    if (error || !authCode) {
      await new Promise(r => setTimeout(r, 1000));
      return json(401, { error: "Invalid or expired code" });
    }

    // Check expiry (10 minutes)
    const codeAge = Date.now() - new Date(authCode.created_at).getTime();
    if (codeAge > 10 * 60 * 1000) {
      await db.from("auth_codes").delete().eq("id", authCode.id);
      return json(401, { error: "Code expired" });
    }

    // Delete used code
    await db.from("auth_codes").delete().eq("id", authCode.id);

    // Generate session token
    const token = generateToken(adminPassword);
    return json(200, {
      ok: true,
      token,
      expiresIn: 86400
    });
  }

  // Step 1: Verify password and send code
  if (!password) {
    return json(400, { error: "Password required" });
  }

  if (password !== adminPassword) {
    await new Promise(r => setTimeout(r, 1000));
    return json(401, { error: "Invalid password" });
  }

  // Generate and store code
  const verifyCode = generateCode();
  const sessionId = generateSessionId();
  const db = getSupabase();

  // Clean up old codes
  await db
    .from("auth_codes")
    .delete()
    .eq("type", "billing")
    .lt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  // Store new code
  const { error: insertErr } = await db.from("auth_codes").insert({
    session_id: sessionId,
    code: verifyCode,
    type: "billing",
  });

  if (insertErr) {
    console.error("[admin-login] Failed to store code:", insertErr);
    return json(500, { error: "Failed to generate verification code" });
  }

  // Send email
  const emailContent = loginCodeEmail({ code: verifyCode, portalName: "Billing Portal" });
  const emailResult = await sendEmail({
    to: "ops@moonshotmp.com",
    subject: emailContent.subject,
    html: emailContent.html,
  });

  if (!emailResult.ok) {
    console.error("[admin-login] Failed to send email:", emailResult.error);
    return json(500, { error: "Failed to send verification code" });
  }

  return json(200, {
    ok: true,
    requires_code: true,
    session_id: sessionId,
    message: "Verification code sent to ops@moonshotmp.com"
  });
};
