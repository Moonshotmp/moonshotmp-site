import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

function getCookie(header = "", name) {
  const match = String(header || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return match?.[1];
}

export default async (req) => {
  try {
    // Verify session
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

    // Get partner data
    const partners = getStore("partners");
    const partner = await partners.get(`partners/${slug}`, { type: "json" });
    if (!partner) return json(404, { error: "Partner not found" });

    const accountId = partner.stripe?.connectedAccountId;
    if (!accountId) {
      return json(200, { orders: [], message: "Stripe not connected" });
    }

    const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
    if (!secretKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // List checkout sessions for this connected account
    const sessions_list = await stripe.checkout.sessions.list(
      {
        limit: 100,
        expand: ["data.line_items"],
      },
      { stripeAccount: accountId }
    );

    const orders = [];

    for (const cs of sessions_list.data) {
      if (cs.payment_status !== "paid") continue;

      const customerDetails = cs.customer_details || {};

      const items = (cs.line_items?.data || []).map((li) => ({
        name: li.description || li.price?.product?.name || "Item",
        quantity: li.quantity || 1,
        amount: li.amount_total || 0,
      }));

      orders.push({
        sessionId: cs.id,
        created: cs.created ? new Date(cs.created * 1000).toISOString() : null,
        amount: cs.amount_total || 0,
        currency: cs.currency || "usd",
        customerName: customerDetails.name || null,
        customerEmail: customerDetails.email || cs.customer_email || null,
        items,
      });
    }

    orders.sort((a, b) => new Date(b.created) - new Date(a.created));

    return json(200, { orders });
  } catch (err) {
    console.error("[partner-orders] error:", err);
    return json(500, { error: "Failed to load orders", message: err.message });
  }
};
