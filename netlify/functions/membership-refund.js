// Process a refund for a payment
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

  const { payment_id, payment_intent_id, invoice_id, amount_dollars, reason } = body;
  if (!payment_intent_id && !invoice_id) {
    return json(400, { error: "payment_intent_id or invoice_id required" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getSupabase();

  try {
    // Get payment_intent_id from invoice if not provided
    let piId = payment_intent_id;
    if (!piId && invoice_id) {
      const invoice = await stripe.invoices.retrieve(invoice_id);
      piId = invoice.payment_intent;
      if (!piId && invoice.charge) {
        // Try to get from charge
        const charge = await stripe.charges.retrieve(invoice.charge);
        piId = charge.payment_intent;
      }
      if (!piId) {
        return json(400, { error: "Could not find payment_intent for this invoice" });
      }
      // Update the payment record with the payment_intent_id
      if (payment_id) {
        await db.from("payments").update({ stripe_payment_intent_id: piId }).eq("id", payment_id);
      }
    }

    // Create refund in Stripe
    const refundParams = {
      payment_intent: piId,
      reason: "requested_by_customer",
    };

    // If amount specified, convert to cents for partial refund
    if (amount_dollars) {
      refundParams.amount = Math.round(amount_dollars * 100);
    }

    const refund = await stripe.refunds.create(refundParams);

    // Update payment status in Supabase
    if (payment_id) {
      // Check if this is a full or partial refund
      const { data: payment } = await db
        .from("payments")
        .select("amount_cents")
        .eq("id", payment_id)
        .single();

      const isFullRefund = !amount_dollars || (payment && Math.round(amount_dollars * 100) >= payment.amount_cents);

      await db
        .from("payments")
        .update({
          status: isFullRefund ? "refunded" : "partially_refunded",
          description: db.raw ? undefined : undefined, // Can't easily append in Supabase
        })
        .eq("id", payment_id);
    }

    return json(200, {
      ok: true,
      refund_id: refund.id,
      amount_refunded: refund.amount / 100,
      status: refund.status,
    });
  } catch (err) {
    console.error("[membership-refund]", err);
    return json(500, { error: err.message });
  }
};
