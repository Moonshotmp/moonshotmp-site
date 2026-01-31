// Sync payments from Stripe to Supabase (backfill missing payments)
import Stripe from "stripe";
import { getSupabase } from "./shared/supabase.js";
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

  // Master admin only
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const masterPassword = (process.env.MASTER_ADMIN_PASSWORD || "").trim();

  if (!verifyMasterToken(token, masterPassword)) {
    return json(401, { error: "Unauthorized - master admin only" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getSupabase();

  try {
    // Get all memberships with Stripe subscription IDs
    const { data: memberships, error: memErr } = await db
      .from("memberships")
      .select("*, patients(id, stripe_customer_id)")
      .not("stripe_subscription_id", "is", null);

    if (memErr) throw memErr;

    let synced = 0;
    let skipped = 0;

    for (const mem of memberships || []) {
      if (!mem.stripe_subscription_id) continue;

      // Get subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(mem.stripe_subscription_id, {
        expand: ["latest_invoice"],
      });

      // Get all invoices for this subscription
      const invoices = await stripe.invoices.list({
        subscription: subscription.id,
        limit: 100,
      });

      for (const invoice of invoices.data) {
        if (invoice.status !== "paid" || !invoice.amount_paid) continue;

        // Get the payment_intent_id - may need to expand invoice
        let paymentIntentId = invoice.payment_intent;
        if (!paymentIntentId && invoice.charge) {
          // Try to get from charge
          try {
            const charge = await stripe.charges.retrieve(invoice.charge);
            paymentIntentId = charge.payment_intent;
          } catch (e) {
            console.log("Could not get payment_intent from charge:", e.message);
          }
        }

        // Check if payment already exists
        const { data: existing } = await db
          .from("payments")
          .select("id, stripe_payment_intent_id")
          .eq("stripe_invoice_id", invoice.id)
          .single();

        if (existing) {
          // Update if missing payment_intent_id
          if (!existing.stripe_payment_intent_id && paymentIntentId) {
            await db
              .from("payments")
              .update({ stripe_payment_intent_id: paymentIntentId })
              .eq("id", existing.id);
            synced++;
          } else {
            skipped++;
          }
          continue;
        }

        // Insert payment
        await db.from("payments").insert({
          patient_id: mem.patient_id,
          stripe_payment_intent_id: paymentIntentId,
          stripe_invoice_id: invoice.id,
          type: "membership",
          description: "HRT Membership - Monthly",
          amount_cents: invoice.amount_paid,
          status: "succeeded",
          created_at: new Date(invoice.created * 1000).toISOString(),
        });
        synced++;
      }
    }

    return json(200, {
      ok: true,
      synced,
      skipped,
      message: `Synced ${synced} payments, skipped ${skipped} existing`,
    });
  } catch (err) {
    console.error("[membership-sync-payments]", err);
    return json(500, { error: err.message });
  }
};
