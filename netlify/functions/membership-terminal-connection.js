// Create a Stripe Terminal connection token
import Stripe from "stripe";
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

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const connectionToken = await stripe.terminal.connectionTokens.create();
    return json(200, { secret: connectionToken.secret });
  } catch (err) {
    console.error("[membership-terminal-connection]", err);
    return json(500, { error: err.message });
  }
};
