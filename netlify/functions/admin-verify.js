// Verify admin token is valid

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

// Verify token matches expected format and isn't expired
function verifyToken(token, secret) {
  if (!token || !secret) return false;

  const parts = token.split(":");
  if (parts.length !== 2) return false;

  const timestamp = parseInt(parts[0], 10);
  if (isNaN(timestamp)) return false;

  // Check if token is expired (24 hours)
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours in ms
  if (now - timestamp > maxAge) return false;

  // Verify hash
  const data = `${timestamp}:${secret}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const expectedHash = Math.abs(hash).toString(36);

  return parts[1] === expectedHash;
}

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});

  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!adminPassword) {
    return json(500, { error: "Admin not configured" });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json(401, { error: "Missing authorization" });
  }

  const token = authHeader.slice(7);
  if (!verifyToken(token, adminPassword)) {
    return json(401, { error: "Invalid or expired token" });
  }

  return json(200, { ok: true });
};

// Export for use by other functions
export { verifyToken };
