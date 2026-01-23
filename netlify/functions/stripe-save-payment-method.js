import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

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

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secretKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const slug = (body?.slug || "").trim().toLowerCase();
  const paymentMethodId = (body?.paymentMethodId || "").trim();

  if (!slug) return json(400, { error: "Missing slug" });
  if (!paymentMethodId) return json(400, { error: "Missing paymentMethodId" });

  try {
    const store = getStore("partners");
    const partner = await store.get(`partners/${slug}`, { type: "json" });
    if (!partner) return json(404, { error: "Partner not found" });

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // Get payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Set as default payment method for the customer
    if (partner.billing?.stripeCustomerId) {
      await stripe.customers.update(partner.billing.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // Save payment method info to partner
    partner.billing = partner.billing || {};
    partner.billing.paymentMethodId = paymentMethodId;
    partner.billing.cardLast4 = paymentMethod.card?.last4;
    partner.billing.cardBrand = paymentMethod.card?.brand;
    partner.billing.cardExpMonth = paymentMethod.card?.exp_month;
    partner.billing.cardExpYear = paymentMethod.card?.exp_year;
    partner.billing.setupAt = new Date().toISOString();
    partner.updatedAt = new Date().toISOString();

    await store.setJSON(`partners/${slug}`, partner);

    return json(200, {
      ok: true,
      cardLast4: paymentMethod.card?.last4,
      cardBrand: paymentMethod.card?.brand,
    });
  } catch (err) {
    console.error("[stripe-save-payment-method] error:", err);
    return json(500, { error: "Failed to save payment method", message: err.message });
  }
};
