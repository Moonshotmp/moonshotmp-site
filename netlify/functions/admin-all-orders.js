import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { verifyMasterToken } from "./admin-master-verify.js";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
  });

// Verify regular admin token
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
  const masterPassword = (process.env.MASTER_ADMIN_PASSWORD || "").trim();

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing authorization", status: 401 };
  }

  const token = authHeader.slice(7);

  // Accept either regular admin token or master admin token
  const isRegularAdmin = adminPassword && verifyToken(token, adminPassword);
  const isMasterAdmin = verifyMasterToken(token, masterPassword);

  if (!isRegularAdmin && !isMasterAdmin) {
    return { error: "Invalid or expired token", status: 401 };
  }

  return { ok: true };
}

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});

  const auth = checkAuth(req);
  if (auth.error) return json(auth.status, { error: auth.error });

  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secretKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

  try {
    const store = getStore("partners");
    const { blobs } = await store.list({ prefix: "partners/" });

    const partners = [];
    for (const blob of blobs) {
      try {
        const data = await store.get(blob.key, { type: "json" });
        if (data) partners.push(data);
      } catch (e) {
        console.error(`[admin-all-orders] Failed to read ${blob.key}:`, e.message);
      }
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // Also load completions
    const completionsStore = getStore("completions");

    const allOrders = [];
    const partnerStats = {}; // slug -> { uniqueCustomers: Set, totalRevenue: number }

    for (const partner of partners) {
      const accountId = partner.stripe?.connectedAccountId;
      if (!accountId) continue;

      partnerStats[partner.slug] = {
        uniqueCustomers: new Set(),
        totalRevenue: 0,
      };

      try {
        const sessions = await stripe.checkout.sessions.list(
          {
            limit: 100,
            expand: ["data.line_items"],
          },
          { stripeAccount: accountId }
        );

        for (const session of sessions.data) {
          if (session.payment_status !== "paid") continue;

          const customerDetails = session.customer_details || {};
          const customerEmail = customerDetails.email || session.customer_email;

          // Track unique customers and revenue
          if (customerEmail) {
            partnerStats[partner.slug].uniqueCustomers.add(customerEmail.toLowerCase());
          }
          partnerStats[partner.slug].totalRevenue += session.amount_total || 0;

          const items = (session.line_items?.data || []).map((li) => ({
            name: li.description || li.price?.product?.name || "Item",
            quantity: li.quantity || 1,
            amount: li.amount_total || 0,
          }));

          // Check completion status
          let completion = null;
          try {
            completion = await completionsStore.get(`completion/${session.id}`, { type: "json" });
          } catch {}

          allOrders.push({
            sessionId: session.id,
            partnerSlug: partner.slug,
            partnerName: partner.name || partner.slug,
            created: session.created ? new Date(session.created * 1000).toISOString() : null,
            amount: session.amount_total || 0,
            currency: session.currency || "usd",
            customerName: customerDetails.name || null,
            customerEmail: customerEmail || null,
            items,
            completed: !!completion,
            completedAt: completion?.completedAt || null,
          });
        }
      } catch (err) {
        console.error(`[admin-all-orders] Failed to fetch orders for ${partner.slug}:`, err.message);
      }
    }

    // Sort by created date descending
    allOrders.sort((a, b) => new Date(b.created) - new Date(a.created));

    // Convert Sets to counts
    const partnerStatsOutput = {};
    for (const slug of Object.keys(partnerStats)) {
      partnerStatsOutput[slug] = {
        uniqueCustomers: partnerStats[slug].uniqueCustomers.size,
        totalRevenue: partnerStats[slug].totalRevenue,
      };
    }

    return json(200, {
      orders: allOrders,
      partnerStats: partnerStatsOutput,
    });
  } catch (err) {
    console.error("[admin-all-orders] error:", err);
    return json(500, { error: "Failed to load orders", message: err.message });
  }
};
