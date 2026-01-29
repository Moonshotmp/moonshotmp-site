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

  const { payment_intent_id, patient_id, type, discount_code } = body;
  if (!payment_intent_id || !patient_id || !type) {
    return json(400, { error: "payment_intent_id, patient_id, and type required" });
  }
  const hasDiscount = discount_code?.toLowerCase() === 'family';

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getSupabase();

  try {
    // Verify the payment intent succeeded
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== "succeeded") {
      return json(400, { error: `Payment not completed. Status: ${pi.status}` });
    }

    // Record payment
    const discountLabel = hasDiscount ? " (Family Discount)" : "";
    const paymentType = hasDiscount
      ? (type === "membership" ? "membership_family" : "lab_work_family")
      : (type === "membership" ? "membership" : "lab_work");
    await db.from("payments").insert({
      patient_id,
      stripe_payment_intent_id: payment_intent_id,
      type: paymentType,
      description: type === "membership"
        ? `HRT Membership - First Month${discountLabel} (Terminal)`
        : `Comprehensive Blood Work${discountLabel} (Terminal)`,
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
            const baseAmount = 285; // $2.85 for testing
            const amountCents = hasDiscount ? Math.round(baseAmount * 0.6) : baseAmount;
            const priceId = await getOrCreatePrice(stripe, amountCents, hasDiscount);
            const planType = hasDiscount ? "hormone_therapy_family" : "hormone_therapy";

            // Create subscription starting next month (first month already paid via terminal)
            const trialEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // ~30 days
            const subscription = await stripe.subscriptions.create({
              customer: patient.stripe_customer_id,
              items: [{ price: priceId }],
              default_payment_method: reusablePmId,
              trial_end: trialEnd,
              metadata: {
                supabase_patient_id: patient_id,
                plan_type: planType,
              },
            });

            await db.from("memberships").insert({
              patient_id,
              stripe_subscription_id: subscription.id,
              plan_type: planType,
              amount_cents: amountCents,
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

async function getOrCreatePrice(stripe, amountCents, hasDiscount) {
  const productType = hasDiscount ? "hrt_membership_family" : "hrt_membership";
  const products = await stripe.products.search({
    query: `metadata['moonshot_type']:'${productType}'`,
  });
  if (products.data.length > 0) {
    const prices = await stripe.prices.list({ product: products.data[0].id, active: true });
    const matchingPrice = prices.data.find(p => p.unit_amount === amountCents);
    if (matchingPrice) return matchingPrice.id;
  }
  const product = products.data.length > 0 ? products.data[0] : await stripe.products.create({
    name: hasDiscount ? "Hormone Therapy Membership (Family)" : "Hormone Therapy Membership",
    description: hasDiscount ? "Family discount membership - Moonshot Medical" : "Monthly membership - Moonshot Medical + Performance",
    metadata: { moonshot_type: productType },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountCents,
    currency: "usd",
    recurring: { interval: "month" },
  });
  return price.id;
}
