import Stripe from "stripe";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
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
  const auth = checkAuth(req);
  if (auth.error) return json(auth.status, { error: auth.error });

  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secretKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const accountId = url.searchParams.get("accountId");

  if (!slug || !accountId) {
    return json(400, { error: "Missing slug or accountId" });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // List checkout sessions for this connected account
    const sessions = await stripe.checkout.sessions.list(
      {
        limit: 100,
        expand: ["data.line_items"],
      },
      { stripeAccount: accountId }
    );

    const orders = [];

    for (const session of sessions.data) {
      if (session.payment_status !== "paid") continue;

      const customerDetails = session.customer_details || {};

      const items = (session.line_items?.data || []).map((li) => ({
        name: li.description || li.price?.product?.name || "Item",
        quantity: li.quantity || 1,
        amount: li.amount_total || 0,
      }));

      orders.push({
        sessionId: session.id,
        paymentIntentId: session.payment_intent,
        created: session.created ? new Date(session.created * 1000).toISOString() : null,
        amount: session.amount_total || 0,
        currency: session.currency || "usd",
        customerName: customerDetails.name || null,
        customerEmail: customerDetails.email || session.customer_email || null,
        customerPhone: customerDetails.phone || null,
        items,
        metadata: session.metadata || {},
      });
    }

    orders.sort((a, b) => new Date(b.created) - new Date(a.created));

    return json(200, { orders });
  } catch (err) {
    console.error("[admin-orders] error:", err);
    return json(500, { error: "Failed to load orders", message: err.message });
  }
};
