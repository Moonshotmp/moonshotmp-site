// Verify master admin token
const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
  });

export function verifyMasterToken(token, masterPassword) {
  if (!token || !masterPassword) return false;

  // Token format: master:timestamp:random
  const parts = token.split(":");
  if (parts.length !== 3 || parts[0] !== "master") return false;

  const timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) return false;

  // Token valid for 7 days
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - timestamp > maxAge) return false;

  return true;
}

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const masterPassword = (process.env.MASTER_ADMIN_PASSWORD || "").trim();

  if (!verifyMasterToken(token, masterPassword)) {
    return json(401, { error: "Unauthorized" });
  }

  return json(200, { ok: true });
};
