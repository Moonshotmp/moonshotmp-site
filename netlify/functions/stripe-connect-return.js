import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "partners";
const KEY_PREFIX = "partners/";

const normalizeSlug = (raw) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(s)) return null;
  return s;
};

const redirect = (url) =>
  new Response(null, { status: 302, headers: { Location: url } });

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL || "https://moonshotmp.com";
  if (!secretKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

  const url = new URL(req.url);
  const slug = normalizeSlug(url.searchParams.get("slug"));
  const state = String(url.searchParams.get("state") || "");
  if (!slug) return json(400, { error: "Missing/invalid slug" });

  const store = getStore(STORE_NAME);
  const key = `${KEY_PREFIX}${slug}`;
  const partner = await store.get(key, { type: "json", consistency: "strong" });
  if (!partner) return json(404, { error: "Partner not found" });

  // If you stored a connectState, validate it. If not present, just continue.
  const expected = partner?.stripe?.connectState;
  if (expected && state && expected !== state) return json(403, { error: "Invalid state" });

  const connectedAccountId = partner?.stripe?.connectedAccountId;
  if (!connectedAccountId) return json(400, { error: "Missing connectedAccountId" });

  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
  const acct = await stripe.accounts.retrieve(connectedAccountId);

  const onboarded = !!acct.details_submitted;

  const updated = {
    ...partner,
    stripe: {
      ...(partner.stripe || {}),
      onboarded,
      detailsSubmitted: onboarded,
      connectState: null,
      lastCheckedAt: new Date().toISOString(),
    },
  };

  await store.setJSON(key, updated);

  return redirect(`${siteUrl}/partners/connect.html?slug=${encodeURIComponent(slug)}&stripe=${onboarded ? "connected" : "incomplete"}`);
};
