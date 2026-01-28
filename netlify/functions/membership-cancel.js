// Cancel a membership subscription
import Stripe from "stripe";
import { getSupabase } from "./shared/supabase.js";
import { verifyToken } from "./admin-verify.js";

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
  if (!verifyToken(token, adminPassword)) {
    return json(401, { error: "Unauthorized" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { membership_id } = body;
  if (!membership_id) {
    return json(400, { error: "membership_id required" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = getSupabase();

  // Get membership
  const { data: membership, error: memErr } = await db
    .from("memberships")
    .select("*")
    .eq("id", membership_id)
    .single();

  if (memErr || !membership) {
    return json(404, { error: "Membership not found" });
  }

  try {
    // Cancel at period end (patient keeps access until current period ends)
    const subscription = await stripe.subscriptions.update(
      membership.stripe_subscription_id,
      { cancel_at_period_end: true }
    );

    // Update in Supabase
    await db
      .from("memberships")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
      })
      .eq("id", membership_id);

    return json(200, {
      ok: true,
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
    });
  } catch (err) {
    console.error("[membership-cancel]", err);
    return json(500, { error: err.message });
  }
};
