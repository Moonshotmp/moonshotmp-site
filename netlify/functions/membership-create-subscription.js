// Create a Stripe subscription ($208/mo HRT membership)
import Stripe from "stripe";
import { getSupabase } from "./shared/supabase.js";
import { verifyToken } from "./admin-verify.js";
import { verifyMasterToken } from "./admin-master-verify.js";

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
  const masterPassword = (process.env.MASTER_ADMIN_PASSWORD || "").trim();

  const isRegularAdmin = verifyToken(token, adminPassword);
  const isMasterAdmin = verifyMasterToken(token, masterPassword);

  if (!isRegularAdmin && !isMasterAdmin) {
    return json(401, { error: "Unauthorized" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { patient_id, payment_method_id, discount_code } = body;
  if (!patient_id || !payment_method_id) {
    return json(400, { error: "patient_id and payment_method_id required" });
  }
  const BASE_AMOUNT = 285; // $2.85 for testing
  const hasDiscount = discount_code?.toLowerCase() === 'family';
  const amountCents = hasDiscount ? Math.round(BASE_AMOUNT * 0.6) : BASE_AMOUNT;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getSupabase();

  // Get patient
  const { data: patient, error: patientErr } = await db
    .from("patients")
    .select("*")
    .eq("id", patient_id)
    .single();

  if (patientErr || !patient) {
    return json(404, { error: "Patient not found" });
  }

  try {
    // Get or create Stripe customer
    let customerId = patient.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: `${patient.first_name} ${patient.last_name}`,
        email: patient.email || undefined,
        phone: patient.phone || undefined,
        metadata: {
          supabase_patient_id: patient.id,
          dob: patient.dob,
        },
      });
      customerId = customer.id;

      await db
        .from("patients")
        .update({ stripe_customer_id: customerId })
        .eq("id", patient.id);
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(payment_method_id, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    // Get or create the price for HRT membership
    const priceId = await getOrCreatePrice(stripe, amountCents);

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: payment_method_id,
      metadata: {
        supabase_patient_id: patient.id,
        plan_type: hasDiscount ? "hormone_therapy_family" : "hormone_therapy",
      },
    });

    // Save membership in Supabase
    const periodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : new Date().toISOString();
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.from("memberships").insert({
      patient_id: patient.id,
      stripe_subscription_id: subscription.id,
      plan_type: hasDiscount ? "hormone_therapy_family" : "hormone_therapy",
      amount_cents: amountCents,
      status: subscription.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });

    // Record the initial payment (in case webhook doesn't fire or is delayed)
    if (subscription.status === "active" && subscription.latest_invoice) {
      try {
        const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
        if (invoice.status === "paid" && invoice.amount_paid > 0) {
          // Check if payment already exists (avoid duplicates)
          const { data: existingPayment } = await db
            .from("payments")
            .select("id")
            .eq("stripe_invoice_id", invoice.id)
            .single();

          if (!existingPayment) {
            await db.from("payments").insert({
              patient_id: patient.id,
              stripe_payment_intent_id: invoice.payment_intent,
              stripe_invoice_id: invoice.id,
              type: "membership",
              description: hasDiscount ? "HRT Membership - Monthly (Family)" : "HRT Membership - Monthly",
              amount_cents: invoice.amount_paid,
              status: "succeeded",
            });
          }
        }
      } catch (invErr) {
        console.error("[membership-create-subscription] Failed to record initial payment:", invErr.message);
        // Don't fail the whole request - membership is created, payment will come via webhook
      }
    }

    return json(200, {
      ok: true,
      subscription_id: subscription.id,
      status: subscription.status,
    });
  } catch (err) {
    console.error("[membership-create-subscription]", err);
    return json(500, { error: err.message });
  }
};

// Helper: get or create a monthly price
async function getOrCreatePrice(stripe, amountCents) {
  const isTest = amountCents === 100;
  const productType = isTest ? "test_membership" : "hrt_membership";

  // Search for existing product
  const products = await stripe.products.search({
    query: `metadata['moonshot_type']:'${productType}'`,
  });

  if (products.data.length > 0) {
    // Find price matching the amount
    const prices = await stripe.prices.list({
      product: products.data[0].id,
      active: true,
    });
    const matchingPrice = prices.data.find(p => p.unit_amount === amountCents);
    if (matchingPrice) return matchingPrice.id;
  }

  // Create product + price
  const product = products.data.length > 0 ? products.data[0] : await stripe.products.create({
    name: isTest ? "Test Membership ($1)" : "Hormone Therapy Membership",
    description: isTest ? "Test membership - $1/month" : "Monthly membership - Moonshot Medical + Performance",
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
