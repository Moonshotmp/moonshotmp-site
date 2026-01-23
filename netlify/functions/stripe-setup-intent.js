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
  if (!slug) return json(400, { error: "Missing slug" });

  try {
    const store = getStore("partners");
    const partner = await store.get(`partners/${slug}`, { type: "json" });
    if (!partner) return json(404, { error: "Partner not found" });

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // Check if partner already has a Stripe customer ID for billing
    let customerId = partner.billing?.stripeCustomerId;

    if (!customerId) {
      // Create a customer for this partner
      const customer = await stripe.customers.create({
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        metadata: {
          partnerSlug: slug,
          contactName: partner.contactName || "",
        },
        address: partner.address ? {
          line1: partner.address.street,
          city: partner.address.city,
          state: partner.address.state,
          postal_code: partner.address.zip,
          country: "US",
        } : undefined,
      });
      customerId = customer.id;

      // Save customer ID to partner
      partner.billing = partner.billing || {};
      partner.billing.stripeCustomerId = customerId;
      partner.updatedAt = new Date().toISOString();
      await store.setJSON(`partners/${slug}`, partner);
    }

    // Create SetupIntent for saving payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        partnerSlug: slug,
      },
    });

    return json(200, {
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (err) {
    console.error("[stripe-setup-intent] error:", err);
    return json(500, { error: "Failed to create setup intent", message: err.message });
  }
};
