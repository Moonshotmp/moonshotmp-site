// Create a Stripe subscription ($208/mo HRT membership)
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

  const { patient_id, payment_method_id } = body;
  if (!patient_id || !payment_method_id) {
    return json(400, { error: "patient_id and payment_method_id required" });
  }

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
    const priceId = await getOrCreatePrice(stripe);

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: payment_method_id,
      metadata: {
        supabase_patient_id: patient.id,
        plan_type: "hormone_therapy",
      },
    });

    // Save membership in Supabase
    await db.from("memberships").insert({
      patient_id: patient.id,
      stripe_subscription_id: subscription.id,
      plan_type: "hormone_therapy",
      amount_cents: 20800,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    });

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

// Helper: get or create the $208/mo price
async function getOrCreatePrice(stripe) {
  // Search for existing product
  const products = await stripe.products.search({
    query: "metadata['moonshot_type']:'hrt_membership'",
  });

  if (products.data.length > 0) {
    const prices = await stripe.prices.list({
      product: products.data[0].id,
      active: true,
      limit: 1,
    });
    if (prices.data.length > 0) return prices.data[0].id;
  }

  // Create product + price
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
