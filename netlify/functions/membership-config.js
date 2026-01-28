// Serve public config (Stripe publishable key) to the billing frontend
const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});

  return json(200, {
    stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || "",
  });
};
