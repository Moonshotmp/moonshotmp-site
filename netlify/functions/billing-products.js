// Return product catalog for billing UI
import { PRODUCTS, CATEGORIES, DISCOUNTS } from "./shared/pricing.js";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,cache-control",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
    },
  });

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});

  // Combine all products into flat array with category info
  const products = [
    ...PRODUCTS.test.map(p => ({ ...p, categoryId: 'test' })),
    ...PRODUCTS.memberships.map(p => ({ ...p, categoryId: 'memberships' })),
    ...PRODUCTS.services.map(p => ({ ...p, categoryId: p.category })),
  ];

  return json(200, {
    products,
    categories: CATEGORIES,
    discounts: Object.values(DISCOUNTS).map(d => ({
      code: d.code,
      percent: d.percent,
      appliesToRecurring: d.appliesToRecurring,
      appliesToOneTime: d.appliesToOneTime,
      appliesToCodes: d.appliesToCodes || [],
    })),
  });
};
