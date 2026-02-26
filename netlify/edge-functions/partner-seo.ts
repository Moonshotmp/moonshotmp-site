import { getStore } from "https://esm.sh/@netlify/blobs@9";
import type { Context } from "https://edge.netlify.com";

const SITE = "https://moonshotmp.com";
const FALLBACK_IMAGE = `${SITE}/images/moonshotmptan.png`;

// Same slug regex used in partner-save.js / partner-get.js
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

// Static files that live in /partners/ — skip them entirely
const STATIC_FILES = new Set([
  "setup.html",
  "login.html",
  "manage.html",
  "store.html",
  "billing.html",
  "cancel.html",
  "checkout-success.html",
  "connect.html",
  "index.html",
  "success.html",
  "terms.html",
  "styles.css",
  "api.js",
  "cart.js",
  "catalog.json",
]);

interface Partner {
  slug?: string;
  name?: string;
  contactName?: string;
  branding?: {
    logoKey?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMetaTags(partner: Partner, slug: string): string {
  const name = escapeHtml(partner.name || partner.contactName || slug);
  const title = `${name} \u00d7 Moonshot Diagnostics \u2014 DEXA Scans & Blood Work`;
  const description = `Book DEXA body composition scans, comprehensive blood panels, and performance diagnostics through ${name}. Powered by Moonshot Medical and Performance.`;
  const url = `${SITE}/partners/${slug}`;

  let imageUrl = FALLBACK_IMAGE;
  if (partner.branding?.logoKey) {
    imageUrl = `${SITE}/.netlify/functions/logo-get?key=${encodeURIComponent(partner.branding.logoKey)}`;
  }

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:site_name" content="Moonshot Medical and Performance">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`,
  ].join("\n  ");
}

export default async (_req: Request, context: Context) => {
  try {
    // Extract the path segment after /partners/
    const segments = context.url.pathname.replace(/^\/partners\//, "").split("/");
    const raw = segments[0]?.toLowerCase().trim();

    // Skip static files and anything with a file extension
    if (!raw || STATIC_FILES.has(raw) || raw.includes(".")) {
      return context.next();
    }

    // Validate slug format
    if (!SLUG_RE.test(raw)) {
      return context.next();
    }

    const slug = raw;

    // Fetch partner data from Blobs
    let partner: Partner | null = null;
    try {
      const store = getStore("partners");

      // Try prefixed key first (current format)
      try {
        partner = await store.get(`partners/${slug}`, { type: "json" }) as Partner | null;
      } catch {
        // parse error — try legacy
      }

      // Try direct key (legacy format)
      if (!partner) {
        try {
          partner = await store.get(slug, { type: "json" }) as Partner | null;
        } catch {
          // not found
        }
      }
    } catch (err) {
      console.error("[partner-seo] Blob fetch failed:", err);
      return context.next();
    }

    // No partner found — let the page render with its default meta tags
    if (!partner) {
      return context.next();
    }

    // Get the rewritten HTML response (store.html via the redirect rule)
    const response = await context.next();
    let html = await response.text();

    // Build replacement meta tags
    const metaTags = buildMetaTags(partner, slug);

    // Strip existing tags we're replacing
    html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, "");
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, "");
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
    html = html.replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, "");
    html = html.replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, "");

    // Also remove the id-based elements (store.html uses id="pageTitle" etc.)
    html = html.replace(/\s+id=["'](?:pageTitle|metaDescription|canonicalLink)["']/gi, "");

    // Inject partner-specific tags before </head>
    html = html.replace(
      /<\/head>/i,
      `  ${metaTags}\n</head>`
    );

    return new Response(html, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    console.error("[partner-seo] edge function error:", err);
    return context.next();
  }
};
