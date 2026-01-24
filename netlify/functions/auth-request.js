import crypto from "crypto";
import { getStore } from "@netlify/blobs";
import { sendEmail } from "./send-email.js";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function sendMagicLink(to, link) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #101921; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2530; border-radius: 8px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
      <h1 style="color: #F0EEE9; margin: 0 0 24px; font-size: 24px;">Sign in to your store</h1>
      <p style="color: #B2BFBE; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
        Click the button below to access your partner dashboard:
      </p>
      <a href="${link}" style="display: inline-block; background: #4ade80; color: #101921; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Sign In
      </a>
      <p style="color: #666; font-size: 14px; margin-top: 24px;">
        This link expires in 15 minutes. If you didn't request this, you can ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Sign in to your Moonshot partner store:\n\n${link}\n\nThis link expires in 15 minutes.`;

  return sendEmail({
    to,
    subject: "Sign in to your Moonshot Partner store",
    html,
    text,
  });
}

export default async (req) => {
  try {
    const { slug, email } = await req.json().catch(() => ({}));
    if (!slug || !email) return json(200, { ok: true });

    const partners = getStore("partners");

    // Try both key formats with strong consistency
    let partner = await partners.get(`partners/${slug}`, { type: "json", consistency: "strong" });
    if (!partner) {
      partner = await partners.get(slug, { type: "json", consistency: "strong" });
    }
    console.log("[auth-request] Partner found:", !!partner, "Email match:", partner?.email?.toLowerCase() === email.toLowerCase());

    if (!partner) return json(200, { ok: true });
    if ((partner.email || "").toLowerCase() !== email.toLowerCase()) {
      return json(200, { ok: true }); // silent fail
    }

    const token = crypto.randomBytes(24).toString("hex");
    const tokens = getStore("auth_tokens");

    await tokens.setJSON(token, {
      slug,
      email,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const link = `${process.env.SITE_URL || "https://moonshotmp.com"}/.netlify/functions/auth-verify?token=${token}`;
    console.log("[auth-request] Sending magic link to:", email);
    const result = await sendMagicLink(email, link);
    console.log("[auth-request] Email result:", JSON.stringify(result));

    if (!result.ok) {
      console.error("[auth-request] Email failed:", result.error);
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error("[auth-request] failed", err);
    return json(500, { error: "Server error" });
  }
};
