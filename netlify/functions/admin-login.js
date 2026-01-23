// Simple password-based admin login
// Set ADMIN_PASSWORD in Netlify environment variables

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

// Simple token generation (timestamp + hash)
function generateToken(secret) {
  const timestamp = Date.now();
  const data = `${timestamp}:${secret}`;
  // Simple hash - in production you'd use crypto.subtle
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${timestamp}:${Math.abs(hash).toString(36)}`;
}

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!adminPassword) {
    console.error("[admin-login] ADMIN_PASSWORD not set");
    return json(500, { error: "Admin login not configured" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const password = (body?.password || "").trim();
  if (!password) {
    return json(400, { error: "Password required" });
  }

  if (password !== adminPassword) {
    // Add small delay to prevent brute force
    await new Promise(r => setTimeout(r, 1000));
    return json(401, { error: "Invalid password" });
  }

  // Generate session token (valid for 24 hours)
  const token = generateToken(adminPassword);

  return json(200, {
    ok: true,
    token,
    expiresIn: 86400 // 24 hours in seconds
  });
};
