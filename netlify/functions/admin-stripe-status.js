import Stripe from "stripe";

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
    console.error("[admin-stripe-status] JWT decode error:", err.message);
    return { error: "Invalid token", status: 401 };
  }
}

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const auth = await verifyAuth(req);
  if (auth.error) return json(auth.status, { error: auth.error });

  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secretKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const accountIds = body?.accountIds;
  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return json(400, { error: "Missing accountIds array" });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
    const status = {};

    // Fetch account status for each connected account
    for (const accountId of accountIds) {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        status[accountId] = {
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
        };
      } catch (err) {
        console.error(`[admin-stripe-status] Failed to retrieve ${accountId}:`, err.message);
        status[accountId] = {
          charges_enabled: false,
          payouts_enabled: false,
          error: err.message,
        };
      }
    }

    return json(200, { status });
  } catch (err) {
    console.error("[admin-stripe-status] error:", err);
    return json(500, { error: "Failed to check Stripe status" });
  }
};
