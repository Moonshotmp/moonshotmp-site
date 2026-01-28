// Create a Stripe SetupIntent for collecting payment method
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

  const { patient_id } = body;
  if (!patient_id) {
    return json(400, { error: "patient_id required" });
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

    // Create SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        supabase_patient_id: patient.id,
      },
    });

    return json(200, {
      client_secret: setupIntent.client_secret,
      customer_id: customerId,
      patient: {
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
      },
    });
  } catch (err) {
    console.error("[membership-setup-intent]", err);
    return json(500, { error: err.message });
  }
};
