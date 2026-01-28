// After terminal payment succeeds, finalize: record payment + optionally start subscription
import Stripe from "stripe";
import { getSupabase } from "./shared/supabase.js";
import { verifyToken } from "./admin-verify.js";

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

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!verifyToken(token, adminPassword)) {
    return json(401, { error: "Unauthorized" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { payment_intent_id, patient_id, type } = body;
  if (!payment_intent_id || !patient_id || !type) {
    return json(400, { error: "payment_intent_id, patient_id, and type required" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getSupabase();

  try {
    // Verify the payment intent succeeded
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== "succeeded") {
      return json(400, { error: `Payment not completed. Status: ${pi.status}` });
    }

    // Record payment
    await db.from("payments").insert({
      patient_id,
      stripe_payment_intent_id: payment_intent_id,
      type: type === "membership" ? "membership" : "lab_work",
      description: type === "membership"
        ? "HRT Membership - First Month (Terminal)"
        : "Comprehensive Blood Work (Terminal)",
      amount_cents: pi.amount,
      status: "succeeded",
    });

    // If membership, create the recurring subscription using the saved card
    if (type === "membership") {
      const { data: patient } = await db
        .from("patients")
        .select("stripe_customer_id")
        .eq("id", patient_id)
        .single();

      if (patient?.stripe_customer_id) {
        // Get the payment method from the terminal payment
        const charges = await stripe.charges.list({
          payment_intent: payment_intent_id,
          limit: 1,
        });

        if (charges.data.length > 0) {
          const pmId = charges.data[0].payment_method;

          // For card_present, we need to create a card payment method from the generated card
          // The terminal payment creates a card_present PM; for recurring we need a card PM
          // Stripe generates a "generated_card" PM we can use for subscriptions
          const pm = await stripe.paymentMethods.retrieve(pmId);
          const reusablePmId = pm.card_present?.generated_card || pmId;

          if (reusablePmId && reusablePmId !== pmId) {
            // Attach the generated card to customer for recurring
            try {
              await stripe.paymentMethods.attach(reusablePmId, {
                customer: patient.stripe_customer_id,
              });
            } catch (e) {
              // May already be attached
              if (!e.message.includes("already been attached")) throw e;
            }

            await stripe.customers.update(patient.stripe_customer_id, {
              invoice_settings: { default_payment_method: reusablePmId },
            });

            // Get price
            const priceId = await getOrCreatePrice(stripe);

            // Create subscription starting next month (first month already paid via terminal)
            const trialEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // ~30 days
            const subscription = await stripe.subscriptions.create({
              customer: patient.stripe_customer_id,
              items: [{ price: priceId }],
              default_payment_method: reusablePmId,
              trial_end: trialEnd,
              metadata: {
                supabase_patient_id: patient_id,
                plan_type: "hormone_therapy",
              },
            });

            await db.from("memberships").insert({
              patient_id,
              stripe_subscription_id: subscription.id,
              plan_type: "hormone_therapy",
              amount_cents: 20800,
              status: "active",
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(trialEnd * 1000).toISOString(),
            });

            return json(200, { ok: true, subscription_id: subscription.id });
          }
        }

        // Fallback: terminal card can't be reused for subscription
        // Record membership without Stripe subscription — staff will need to set up recurring separately
        return json(200, {
          ok: true,
          warning: "Terminal payment processed but card cannot be saved for recurring billing. Set up recurring payment with a manual card entry.",
        });
      }
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error("[membership-terminal-capture]", err);
    return json(500, { error: err.message });
  }
};

async function getOrCreatePrice(stripe) {
  const products = await stripe.products.search({
    query: "metadata['moonshot_type']:'hrt_membership'",
  });
  if (products.data.length > 0) {
    const prices = await stripe.prices.list({ product: products.data[0].id, active: true, limit: 1 });
    if (prices.data.length > 0) return prices.data[0].id;
  }
  const product = await stripe.products.create({
    name: "Hormone Therapy Membership",
    description: "Monthly membership - Moonshot Medical + Performance",
    metadata: { moonshot_type: "hrt_membership" },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 20800,
    currency: "usd",
    recurring: { interval: "month" },
  });
  return price.id;
}
