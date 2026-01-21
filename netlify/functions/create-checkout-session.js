import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "partners";
const KEY_PREFIX = "partners/";

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

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL || "https://moonshotmp.com";
  if (!secretKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const slug = normalizeSlug(body?.slug);
  const productId = String(body?.productId ?? "").trim();
  if (!slug) return json(400, { error: "Missing/invalid slug" });
  if (!productId) return json(400, { error: "Missing productId" });

  // Load partner
  const store = getStore(STORE_NAME);
  const key = `${KEY_PREFIX}${slug}`;
  const partner = await store.get(key, { type: "json", consistency: "strong" });
  if (!partner) return json(404, { error: "Partner not found" });

  const connectedAccountId = partner?.stripe?.connectedAccountId;
  if (!connectedAccountId)
    return json(400, { error: "Partner not connected to Stripe" });

  if (!partner?.stripe?.onboarded)
    return json(400, { error: "Stripe onboarding incomplete" });

  // Load catalog
  const catalogRes = await fetch(`${siteUrl}/partners/catalog.json`, {
    cache: "no-store",
  });
  const catalog = await catalogRes.json().catch(() => null);
  if (!catalogRes.ok || !catalog)
    return json(500, { error: "Failed to load catalog" });

  const products = Array.isArray(catalog)
    ? catalog
    : catalog.products || [];

  const product = products.find(
    (p) => p.id === productId && p.active !== false
  );
  if (!product) return json(404, { error: "Product not found" });

  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(Number(product.price) * 100),
            product_data: {
              name: product.name,
              description: product.description || undefined,
              images: product.image
                ? [
                    `${siteUrl}${
                      product.image.startsWith("/")
                        ? product.image
                        : `/images/${product.image}`
                    }`,
                  ]
                : undefined,
            },
          },
        },
      ],
      success_url: `${siteUrl}/partners/store.html?slug=${slug}&success=1`,
      cancel_url: `${siteUrl}/partners/store.html?slug=${slug}&canceled=1`,
      client_reference_id: `${slug}:${productId}`,
      metadata: { slug, productId },
    },
    { stripeAccount: connectedAccountId } // 🔑 direct charge
  );

  return json(200, { url: session.url });
};
