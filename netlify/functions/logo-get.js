import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const key = (url.searchParams.get("key") || "").trim();
    if (!key) {
      return new Response("Missing key", { status: 400 });
    }

    const logos = getStore("logos");
    const rec = await logos.get(key, { type: "json" });

    if (!rec || !rec.b64 || !rec.mime) {
      return new Response("Not found", { status: 404 });
    }

    const buf = Uint8Array.from(atob(rec.b64), (c) => c.charCodeAt(0));

    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": rec.mime,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[logo-get] failed", err?.message);
    return new Response("Server error", { status: 500 });
  }
};
