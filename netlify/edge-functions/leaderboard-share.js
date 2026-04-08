/**
 * Leaderboard Share — Netlify Edge Function
 * ==========================================
 * Intercepts requests to /leaderboard/entry/* and detects social media
 * crawler user agents. For bots, fetches entry data from the API and
 * returns HTML with dynamic OG tags so share cards render correctly.
 * Regular users get the static page with client-side JS rendering.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;");
}

export default async (request, context) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return context.next();
  }

  // Only intercept for known social media crawlers / link preview bots
  const ua = request.headers.get("user-agent") || "";
  const isBot =
    /facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|iMessageLinkPreview|Googlebot|bingbot/i.test(
      ua
    );

  if (!isBot) {
    return context.next();
  }

  try {
    const API_BASE =
      Deno.env.get("LEADERBOARD_API_URL") ||
      "https://owbgtzil2l.execute-api.us-east-1.amazonaws.com";
    const response = await fetch(
      `${API_BASE}/api/entries/${encodeURIComponent(id)}`
    );

    if (!response.ok) {
      return context.next();
    }

    const data = await response.json();
    const entry = data.entry;

    if (!entry) {
      return context.next();
    }

    const idToLabel = {
      'back-squat': 'Back Squat', 'deadlift': 'Deadlift', 'bench-press': 'Bench Press',
      'clean': 'Clean', 'shoulder-to-overhead': 'Overhead Press', 'overhead-press': 'Overhead Press',
      'mile-run': 'Mile Run', '400m-run': '400m Run', '2k-row': '2,000m Row',
      'pullups-2min': 'Strict Pull-ups in 2 Minutes', 'pushups-2min': 'Push-ups in 2 Minutes',
      'dips-2min': 'Dips in 2 Minutes', 'burpees-2min': 'Burpees in 2 Minutes'
    };

    const name = escapeHtml(entry.name || "Anonymous");
    const eventName = escapeHtml(idToLabel[entry.event] || entry.event || "");
    const result = escapeHtml(entry.result || "");
    const gymName = entry.gymName ? escapeHtml(entry.gymName) : "Park Ridge";

    const title = `${name} — ${eventName} in Park Ridge`;
    const description = `${result} | ${gymName} | Park Ridge Fitness Leaderboard #ParkRidgeFit`;
    const pageUrl = `https://moonshotmp.com/leaderboard/entry/?id=${encodeURIComponent(id)}`;
    const image = "https://moonshotmp.com/images/parkridgefit-og.png";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Moonshot Medical and Performance">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <meta http-equiv="refresh" content="0;url=${pageUrl}">
</head>
<body>
  <p>Redirecting to <a href="${pageUrl}">${title}</a></p>
</body>
</html>`;

    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("[leaderboard-share] edge function error:", e);
    return context.next();
  }
};

export const config = { path: "/leaderboard/entry/*" };
