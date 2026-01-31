// Update default payment method for a patient
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

  const { patient_id, payment_method_id } = body;
  if (!patient_id) return json(400, { error: "patient_id required" });
  if (!payment_method_id) return json(400, { error: "payment_method_id required" });

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

  if (!patient.stripe_customer_id) {
    return json(400, { error: "Patient has no Stripe customer" });
  }

  try {
    // Attach payment method to customer (may already be attached)
    try {
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: patient.stripe_customer_id,
      });
    } catch (attachErr) {
      if (!attachErr.message.includes("already been attached")) {
        throw attachErr;
      }
    }

    // Set as default payment method
    await stripe.customers.update(patient.stripe_customer_id, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    // Update any active subscriptions to use this payment method
    const subscriptions = await stripe.subscriptions.list({
      customer: patient.stripe_customer_id,
      status: 'active',
    });

    for (const sub of subscriptions.data) {
      await stripe.subscriptions.update(sub.id, {
        default_payment_method: payment_method_id,
      });
    }

    return json(200, {
      ok: true,
      message: "Payment method updated",
      subscriptions_updated: subscriptions.data.length,
    });
  } catch (err) {
    console.error("[membership-update-default-payment]", err);
    return json(500, { error: err.message });
  }
};
