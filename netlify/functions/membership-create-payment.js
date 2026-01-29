// Create a one-time payment ($285 comprehensive blood work)
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

  const { patient_id, payment_method_id, discount_code } = body;
  if (!patient_id || !payment_method_id) {
    return json(400, { error: "patient_id and payment_method_id required" });
  }
  const BASE_AMOUNT = 100; // $1 for testing
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

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      payment_method: payment_method_id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      description: hasDiscount ? "Comprehensive Blood Work (Family Discount) - Moonshot Medical" : "Comprehensive Blood Work - Moonshot Medical",
      metadata: {
        supabase_patient_id: patient.id,
        type: hasDiscount ? "lab_work_family" : "lab_work",
      },
    });

    // Record payment
    if (paymentIntent.status === "succeeded") {
      await db.from("payments").insert({
        patient_id: patient.id,
        stripe_payment_intent_id: paymentIntent.id,
        type: hasDiscount ? "lab_work_family" : "lab_work",
        description: hasDiscount ? "Comprehensive Blood Work (Family Discount)" : "Comprehensive Blood Work",
        amount_cents: amountCents,
        status: "succeeded",
      });
    }

    return json(200, {
      ok: true,
      payment_intent_id: paymentIntent.id,
      status: paymentIntent.status,
    });
  } catch (err) {
    console.error("[membership-create-payment]", err);
    return json(500, { error: err.message });
  }
};
