// Process cart checkout with mixed recurring + one-time items
import Stripe from "stripe";
import { getSupabase } from "./shared/supabase.js";
import { verifyToken } from "./admin-verify.js";
import { verifyMasterToken } from "./admin-master-verify.js";
import { getProductByCode, calculateCartTotals } from "./shared/pricing.js";

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

  // Auth check
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

  const { patient_id, payment_method_id, cart, discount_code } = body;

  if (!patient_id) return json(400, { error: "patient_id required" });
  if (!payment_method_id) return json(400, { error: "payment_method_id required" });
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return json(400, { error: "cart must be a non-empty array" });
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

  // Calculate totals
  const totals = calculateCartTotals(cart, discount_code);

  if (totals.grandTotal === 0) {
    return json(400, { error: "Cart total is zero" });
  }

  // Separate recurring vs one-time items
  const recurringItems = totals.lineItems.filter(i => i.recurring);
  const oneTimeItems = totals.lineItems.filter(i => !i.recurring);

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
    try {
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: customerId,
      });
    } catch (attachErr) {
      // May already be attached, continue
      if (!attachErr.message.includes("already been attached")) {
        throw attachErr;
      }
    }

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    const results = {
      subscriptions: [],
      payments: [],
      totals,
    };

    // Process recurring items (subscriptions)
    for (const item of recurringItems) {
      const product = getProductByCode(item.code);
      if (!product) continue;

      // Get or create Stripe price
      const priceId = await getOrCreatePrice(stripe, item.code, item.finalAmount / item.quantity, product.name);

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId, quantity: item.quantity }],
        default_payment_method: payment_method_id,
        metadata: {
          supabase_patient_id: patient.id,
          plan_type: item.code,
          discount_code: discount_code || '',
        },
      });

      // Record membership in Supabase
      const periodStart = subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : new Date().toISOString();
      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await db.from("memberships").insert({
        patient_id: patient.id,
        stripe_subscription_id: subscription.id,
        plan_type: item.code + (discount_code ? '_family' : ''),
        amount_cents: item.finalAmount,
        status: subscription.status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
      });

      // Record initial payment if available
      if (subscription.latest_invoice) {
        try {
          const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
          if (invoice.status === 'paid' && invoice.amount_paid > 0) {
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
                type: item.code,
                description: item.name + (discount_code ? ' (Family)' : ''),
                amount_cents: invoice.amount_paid,
                status: "succeeded",
              });
            }
          }
        } catch (invErr) {
          console.error("[billing-cart-checkout] Invoice error:", invErr.message);
        }
      }

      results.subscriptions.push({
        code: item.code,
        name: item.name,
        subscription_id: subscription.id,
        amount: item.finalAmount,
        status: subscription.status,
      });
    }

    // Process one-time items (single PaymentIntent)
    if (oneTimeItems.length > 0 && totals.oneTimeTotal > 0) {
      const description = oneTimeItems
        .map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ''}`)
        .join(', ');

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totals.oneTimeTotal,
        currency: 'usd',
        customer: customerId,
        payment_method: payment_method_id,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: {
          supabase_patient_id: patient.id,
          items: JSON.stringify(oneTimeItems.map(i => ({ code: i.code, qty: i.quantity }))),
        },
        description,
      });

      // Record payment in Supabase
      if (paymentIntent.status === 'succeeded') {
        await db.from("payments").insert({
          patient_id: patient.id,
          stripe_payment_intent_id: paymentIntent.id,
          type: oneTimeItems.length === 1 ? oneTimeItems[0].code : 'multiple_services',
          description,
          amount_cents: totals.oneTimeTotal,
          status: "succeeded",
        });

        results.payments.push({
          payment_intent_id: paymentIntent.id,
          amount: totals.oneTimeTotal,
          description,
          status: paymentIntent.status,
        });
      } else {
        return json(400, {
          error: "One-time payment failed",
          status: paymentIntent.status,
        });
      }
    }

    return json(200, {
      ok: true,
      ...results,
    });
  } catch (err) {
    console.error("[billing-cart-checkout]", err);
    return json(500, { error: err.message });
  }
};

// Helper: get or create a Stripe price for a product
async function getOrCreatePrice(stripe, productCode, amountCents, productName) {
  // Search for existing product by code
  const products = await stripe.products.search({
    query: `metadata['moonshot_code']:'${productCode}'`,
  });

  let product;
  if (products.data.length > 0) {
    product = products.data[0];

    // Check for existing price with this amount
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
    });

    const matchingPrice = prices.data.find(p => p.unit_amount === amountCents);
    if (matchingPrice) return matchingPrice.id;
  } else {
    // Create product
    product = await stripe.products.create({
      name: productName,
      metadata: { moonshot_code: productCode },
    });
  }

  // Create new price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountCents,
    currency: "usd",
    recurring: { interval: "month" },
  });

  return price.id;
}
