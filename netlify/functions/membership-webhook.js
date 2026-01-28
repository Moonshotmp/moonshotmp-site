// Stripe webhook handler for membership events
// Handles subscription updates, payment failures, and invoice payments
import Stripe from "stripe";
import { getSupabase } from "./shared/supabase.js";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET;

  let event;
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[membership-webhook] Signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const db = getSupabase();
  console.log(`[membership-webhook] Event: ${event.type}`);

  try {
    switch (event.type) {
      // Subscription status changes
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const patientId = subscription.metadata?.supabase_patient_id;

        if (!patientId) {
          console.log("[membership-webhook] No patient ID in metadata, skipping");
          break;
        }

        const newStatus = subscription.status === "active" ? "active"
          : subscription.status === "past_due" ? "past_due"
          : subscription.status === "canceled" ? "canceled"
          : subscription.status === "unpaid" ? "unpaid"
          : subscription.status;

        await db
          .from("memberships")
          .update({
            status: newStatus,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            canceled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : null,
          })
          .eq("stripe_subscription_id", subscription.id);

        // TODO: Update Elation tags when API credentials are available
        // await updateElationTags(patientId, newStatus);
        console.log(`[membership-webhook] Updated membership ${subscription.id} to ${newStatus}`);
        break;
      }

      // Invoice paid (recurring membership payment)
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (!invoice.subscription) break; // Not a subscription invoice

        const patientId = invoice.subscription_details?.metadata?.supabase_patient_id
          || invoice.metadata?.supabase_patient_id;

        if (!patientId) {
          // Try to find patient by Stripe customer ID
          const { data: patient } = await db
            .from("patients")
            .select("id")
            .eq("stripe_customer_id", invoice.customer)
            .single();

          if (patient) {
            await db.from("payments").insert({
              patient_id: patient.id,
              stripe_payment_intent_id: invoice.payment_intent,
              stripe_invoice_id: invoice.id,
              type: "membership",
              description: "HRT Membership - Monthly",
              amount_cents: invoice.amount_paid,
              status: "succeeded",
            });
          }
        } else {
          await db.from("payments").insert({
            patient_id: patientId,
            stripe_payment_intent_id: invoice.payment_intent,
            stripe_invoice_id: invoice.id,
            type: "membership",
            description: "HRT Membership - Monthly",
            amount_cents: invoice.amount_paid,
            status: "succeeded",
          });
        }
        console.log(`[membership-webhook] Recorded invoice payment ${invoice.id}`);
        break;
      }

      // Invoice payment failed
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.log(`[membership-webhook] Payment failed for invoice ${invoice.id}, customer ${invoice.customer}`);
        // Stripe will automatically retry and update subscription status
        // The subscription.updated event will handle status change to past_due
        break;
      }

      default:
        console.log(`[membership-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[membership-webhook] Error handling ${event.type}:`, err);
    // Return 200 anyway to prevent Stripe from retrying
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
