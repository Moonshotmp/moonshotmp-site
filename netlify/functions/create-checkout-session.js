import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

const normalizeSlug = (raw) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(s)) return null;
  return s;
};

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  const siteUrl = (process.env.SITE_URL || "").trim() || "https://moonshotmp.com";
  if (!secretKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const slug = normalizeSlug(body?.slug);
  if (!slug) return json(400, { error: "Missing/invalid slug" });

  // Support both single product (legacy) and cart items
  let cartItems = body?.items;
  if (!cartItems && body?.productId) {
    // Legacy single product support
    cartItems = [{ id: body.productId, quantity: 1 }];
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return json(400, { error: "Missing items" });
  }

  try {
    // Partner
    const store = getStore("partners");
    const partner = await store.get(`partners/${slug}`, { type: "json" });
    if (!partner) return json(404, { error: "Partner not found" });

    const connectedAccountId = partner?.stripe?.connectedAccountId;
    if (!connectedAccountId) return json(400, { error: "Partner not connected to Stripe" });

    // Catalog
    const catalogRes = await fetch(`${siteUrl}/partners/catalog.json`, { cache: "no-store" });
    const catalog = await catalogRes.json().catch(() => null);
    if (!catalogRes.ok || !catalog) return json(500, { error: "Failed to load catalog" });

    const products = Array.isArray(catalog) ? catalog : (catalog.products || []);

    // Build line items
    const lineItems = [];
    const itemDetails = [];

    for (const cartItem of cartItems) {
      const productId = String(cartItem.id || "").trim();
      const quantity = Math.max(1, parseInt(cartItem.quantity, 10) || 1);

      const product = products.find((p) => String(p.id) === productId && p.active !== false);
      if (!product) {
        return json(404, { error: `Product not found: ${productId}` });
      }

      const amount = Math.round(Number(product.price) * 100);
      if (!Number.isFinite(amount) || amount <= 0) {
        return json(400, { error: "Invalid product price", productId });
      }

      const imageUrl = product.image
        ? (product.image.startsWith("http")
            ? product.image
            : `${siteUrl}${product.image.startsWith("/") ? product.image : `/images/${product.image}`}`)
        : undefined;

      lineItems.push({
        quantity,
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: {
            name: String(product.name || "Product"),
            description: product.description ? String(product.description).slice(0, 500) : undefined,
            images: imageUrl ? [imageUrl] : undefined,
          },
        },
      });

      itemDetails.push({ id: productId, name: product.name, quantity, price: product.price });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        success_url: `${siteUrl}/partners/success.html?slug=${encodeURIComponent(slug)}`,
        cancel_url: `${siteUrl}/partners/cancel.html?slug=${encodeURIComponent(slug)}`,
        client_reference_id: slug,
        metadata: {
          slug,
          partnerName: partner.name || slug,
          items: JSON.stringify(itemDetails).slice(0, 500),
        },
      },
      { stripeAccount: connectedAccountId }
    );

    return json(200, { ok: true, url: session.url });
  } catch (err) {
    console.error("[create-checkout-session] error", err);
    return json(500, {
      error: "Checkout session failed",
      message: err?.message || String(err),
      type: err?.type,
      code: err?.code,
    });
  }
};
