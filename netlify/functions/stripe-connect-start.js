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

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const redirect = (url) =>
  new Response(null, { status: 302, headers: { Location: url } });

function getBaseUrl(req) {
  // Prefer env var if it's a valid absolute URL
  const env = (process.env.SITE_URL || "").trim();
  if (env) {
    try {
      const u = new URL(env.startsWith("http") ? env : `https://${env}`);
      return u.origin;
    } catch {
      // fall through
    }
  }

  // Fallback: derive from request host (works on prod + deploy previews)
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (!host) return "https://moonshotmp.com";
  return `${proto}://${host}`;
}

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

  const url = new URL(req.url);
  const slug = normalizeSlug(url.searchParams.get("slug"));
  if (!slug) return json(400, { error: "Missing/invalid slug" });

  const store = getStore(STORE_NAME);
  const key = `${KEY_PREFIX}${slug}`;
  const partner = await store.get(key, { type: "json", consistency: "strong" });
  if (!partner) return json(404, { error: "Partner not found" });

  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
  const baseUrl = getBaseUrl(req);

  try {
    // Create or reuse connected account
    let accountId = partner?.stripe?.connectedAccountId;
    if (!accountId) {
      const acct = await stripe.accounts.create({ type: "standard" });
      accountId = acct.id;

      await store.setJSON(key, {
        ...partner,
        stripe: {
          ...(partner.stripe || {}),
          connectedAccountId: accountId,
          onboarded: false,
        },
      });
    }

    // Store a state token (optional validation)
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

    // Build absolute URLs safely
    const returnUrl = new URL(
      `/.netlify/functions/stripe-connect-return?slug=${encodeURIComponent(slug)}&state=${encodeURIComponent(state)}`,
      baseUrl
    ).toString();

    const refreshUrl = new URL(
      `/partners/setup.html?slug=${encodeURIComponent(slug)}&stripe=refresh`,
      baseUrl
    ).toString();

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    return redirect(link.url);
  } catch (err) {
    return json(500, {
      error: "Stripe connect start failed",
      message: err?.message || String(err),
      baseUrl,
    });
  }
};
