import { getStore } from "@netlify/blobs";

const ALLOWED_EMAIL = "tom@moonshotmp.com";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Verify JWT and check email allowlist
async function verifyAuth(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing authorization header", status: 401 };
  }

  const token = authHeader.slice(7);

  try {
    // Decode JWT payload (Netlify Identity tokens are base64url encoded)
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token format");

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const email = payload.email;

    if (!email || email !== ALLOWED_EMAIL) {
      return { error: "Unauthorized", status: 403 };
    }

    return { email };
  } catch (err) {
    console.error("[admin-partners] JWT decode error:", err.message);
    return { error: "Invalid token", status: 401 };
  }
}

export default async (req) => {
  const auth = await verifyAuth(req);
  if (auth.error) return json(auth.status, { error: auth.error });

  try {
    const store = getStore("partners");
    const url = new URL(req.url);
    const singleSlug = url.searchParams.get("slug");

    // Single partner lookup
    if (singleSlug) {
      const partner = await store.get(`partners/${singleSlug}`, { type: "json" });
      if (!partner) return json(404, { error: "Partner not found" });
      return json(200, { partner });
    }

    // List all partners
    const { blobs } = await store.list({ prefix: "partners/" });

    const partners = [];
    for (const blob of blobs) {
      try {
        const data = await store.get(blob.key, { type: "json" });
        if (data) partners.push(data);
      } catch (e) {
        console.error(`[admin-partners] Failed to read ${blob.key}:`, e.message);
      }
    }

    // Sort by createdAt descending
    partners.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    return json(200, { partners });
  } catch (err) {
    console.error("[admin-partners] error:", err);
    return json(500, { error: "Failed to load partners" });
  }
};
