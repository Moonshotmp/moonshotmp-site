import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import crypto from "crypto";

const STORE_NAME = "partners";
const KEY_PREFIX = "partners/";

const normalizeSlug = (raw) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(s)) return null;
  return s;
};

export default async (req) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL || "https://moonshotmp.com";
  if (!secretKey) {
    return new Response("Missing STRIPE_SECRET_KEY", { status: 500 });
  }

  const url = new URL(req.url);
  const slug = normalizeSlug(url.searchParams.get("slug"));
  if (!slug) {
    return new Response("Missing or invalid slug", { status: 400 });
  }

  const store = getStore(STORE_NAME);
  const key = `${KEY_PREFIX}${slug}`;
  const partner = await store.get(key, { type: "json", consistency: "strong" });
  if (!partner) {
    return new Response("Partner not found", { status: 404 });
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  let accountId = partner?.stripe?.connectedAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: "standard" });
    accountId = account.id;

    await store.setJSON(key, {
      ...partner,
      stripe: {
        connectedAccountId: accountId,
        onboarded: false,
      },
    });
  }

  const state = crypto.randomBytes(16).toString("hex");

  await store.setJSON(key, {
    ...partner,
    stripe: {
      ...(partner.stripe || {}),
      connectedAccountId: accountId,
      connectState: state,
      onboarded: false,
    },
  });

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${siteUrl}/partners/setup.html?slug=${slug}&stripe=connected`,
    refresh_url: `${siteUrl}/partners/setup.html?slug=${slug}&stripe=refresh`,
  });

  return new Response(null, {
    status: 302,
    headers: { Location: accountLink.url },
  });
};
