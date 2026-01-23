import Stripe from "stripe";

const ALLOWED_EMAIL = "tom@moonshotmp.com";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
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
    console.error("[admin-orders] JWT decode error:", err.message);
    return { error: "Invalid token", status: 401 };
  }
}

export default async (req) => {
  const auth = await verifyAuth(req);
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
    // We'll get completed sessions and expand line_items
    const sessions = await stripe.checkout.sessions.list(
      {
        limit: 100,
        expand: ["data.line_items"],
      },
      { stripeAccount: accountId }
    );

    const orders = [];

    for (const session of sessions.data) {
      // Only include completed/paid sessions
      if (session.payment_status !== "paid") continue;

      // Extract customer info
      const customerDetails = session.customer_details || {};

      // Extract line items
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

    // Sort by date descending
    orders.sort((a, b) => new Date(b.created) - new Date(a.created));

    return json(200, { orders });
  } catch (err) {
    console.error("[admin-orders] error:", err);
    return json(500, { error: "Failed to load orders", message: err.message });
  }
};
