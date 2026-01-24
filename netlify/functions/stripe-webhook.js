import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { sendEmail, orderNotificationEmail } from "./send-email.js";

const SITE_URL = "https://moonshotmp.com";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

  if (!secretKey) {
    console.error("[stripe-webhook] Missing STRIPE_SECRET_KEY");
    return new Response("Server error", { status: 500 });
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  let event;
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  // Verify webhook signature if secret is configured
  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  } else {
    // Parse without verification (for testing or if no webhook secret)
    try {
      event = JSON.parse(body);
      console.log("[stripe-webhook] WARNING: No signature verification");
    } catch (err) {
      return new Response("Invalid JSON", { status: 400 });
    }
  }

  console.log("[stripe-webhook] Received event:", event.type);

  // Handle checkout.session.completed events
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Only process paid sessions
    if (session.payment_status !== "paid") {
      console.log("[stripe-webhook] Session not paid, skipping");
      return new Response("OK", { status: 200 });
    }

    // Get partner slug from metadata
    const partnerSlug = session.metadata?.partner_slug;
    if (!partnerSlug) {
      console.log("[stripe-webhook] No partner_slug in metadata, skipping");
      return new Response("OK", { status: 200 });
    }

    try {
      // Load partner data
      const store = getStore("partners");
      const partner = await store.get(`partners/${partnerSlug}`, { type: "json" });

      if (!partner) {
        console.error("[stripe-webhook] Partner not found:", partnerSlug);
        return new Response("OK", { status: 200 });
      }

      if (!partner.email) {
        console.log("[stripe-webhook] Partner has no email, skipping notification");
        return new Response("OK", { status: 200 });
      }

      // Get line items from the session
      const accountId = partner.stripe?.connectedAccountId;
      let items = [];

      if (accountId) {
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(
            session.id,
            { limit: 10 },
            { stripeAccount: accountId }
          );
          items = lineItems.data.map(li => ({
            name: li.description || "Item",
            quantity: li.quantity || 1,
          }));
        } catch (err) {
          console.error("[stripe-webhook] Failed to fetch line items:", err.message);
          // Continue with empty items
        }
      }

      // If no items from API, try to use metadata
      if (items.length === 0 && session.metadata?.items) {
        try {
          items = JSON.parse(session.metadata.items);
        } catch {}
      }

      // Format order date
      const orderDate = new Date(session.created * 1000).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      // Send notification email
      const customerDetails = session.customer_details || {};
      const emailContent = orderNotificationEmail({
        partnerName: partner.name || partner.contactName || partnerSlug,
        customerName: customerDetails.name || "Customer",
        customerEmail: customerDetails.email || session.customer_email || "Not provided",
        items: items.length > 0 ? items : [{ name: "Diagnostic Service", quantity: 1 }],
        total: session.amount_total || 0,
        orderDate,
        storeUrl: `${SITE_URL}/partners/store.html?slug=${partnerSlug}`,
      });

      const result = await sendEmail({
        to: partner.email,
        ...emailContent,
      });

      if (result.ok) {
        console.log(`[stripe-webhook] Order notification sent to ${partner.email} for session ${session.id}`);
      } else {
        console.error(`[stripe-webhook] Failed to send notification:`, result.error);
      }

    } catch (err) {
      console.error("[stripe-webhook] Error processing checkout:", err);
    }
  }

  return new Response("OK", { status: 200 });
};
