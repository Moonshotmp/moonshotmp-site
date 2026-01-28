// Create a PaymentIntent for Stripe Terminal (in-person payment)
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

  const { patient_id, type } = body; // type: 'membership' or 'lab_work'
  if (!patient_id || !type) {
    return json(400, { error: "patient_id and type required" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getSupabase();

  const { data: patient, error: patientErr } = await db
    .from("patients")
    .select("*")
    .eq("id", patient_id)
    .single();

  if (patientErr || !patient) {
    return json(404, { error: "Patient not found" });
  }

  try {
    // Get or create customer
    let customerId = patient.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: `${patient.first_name} ${patient.last_name}`,
        email: patient.email || undefined,
        phone: patient.phone || undefined,
        metadata: { supabase_patient_id: patient.id, dob: patient.dob },
      });
      customerId = customer.id;
      await db.from("patients").update({ stripe_customer_id: customerId }).eq("id", patient.id);
    }

    const amount = type === "membership" ? 20800 : 28500;
    const description = type === "membership"
      ? "Hormone Therapy Membership - First Month"
      : "Comprehensive Blood Work";

    // Create PaymentIntent for terminal
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: customerId,
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      description: `${description} - Moonshot Medical`,
      metadata: {
        supabase_patient_id: patient.id,
        type,
      },
    });

    return json(200, {
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    });
  } catch (err) {
    console.error("[membership-terminal-payment]", err);
    return json(500, { error: err.message });
  }
};
