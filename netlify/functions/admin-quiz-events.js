/**
 * admin-quiz-events.js — Read funnel events captured by quiz-event.js
 * ===================================================================
 *
 * Auth: same Bearer-token contract as the other admin-* functions
 * (regular admin token OR master admin token).
 *
 * GET params:
 *   ?date=YYYY-MM-DD   List events for a single day. Default: today (UTC).
 *   ?date=2026-05      List events for a whole month.
 *   ?date=all          List ALL events (use sparingly — full scan).
 *   ?format=csv        Return CSV (one row per event). Default: JSON.
 *   ?aggregate=1       Return aggregate counts by quiz/event instead of rows.
 *
 * Examples:
 *   curl -H "Authorization: Bearer $TOKEN" \
 *     'https://moonshotmp.com/.netlify/functions/admin-quiz-events?date=2026-05-03'
 *
 *   curl -H "Authorization: Bearer $TOKEN" \
 *     'https://moonshotmp.com/.netlify/functions/admin-quiz-events?date=all&aggregate=1'
 */
import { getStore } from "@netlify/blobs";
import { verifyMasterToken } from "./admin-master-verify.js";

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

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split(":");
  if (parts.length !== 2) return false;
  const timestamp = parseInt(parts[0], 10);
  if (isNaN(timestamp)) return false;
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  if (now - timestamp > maxAge) return false;
  const data = `${timestamp}:${secret}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return parts[1] === Math.abs(hash).toString(36);
}

function checkAuth(req) {
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  const masterPassword = (process.env.MASTER_ADMIN_PASSWORD || "").trim();

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing authorization", status: 401 };
  }
  const token = authHeader.slice(7);

  const isRegularAdmin = adminPassword && verifyToken(token, adminPassword);
  const isMasterAdmin = verifyMasterToken(token, masterPassword);

  if (!isRegularAdmin && !isMasterAdmin) {
    return { error: "Invalid or expired token", status: 401 };
  }
  return { ok: true };
}

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });

  const auth = checkAuth(req);
  if (auth.error) return json(auth.status, { error: auth.error });

  const url = new URL(req.url);
  const dateParam = (url.searchParams.get("date") || "").trim();
  const format = (url.searchParams.get("format") || "json").trim().toLowerCase();
  const aggregate = url.searchParams.get("aggregate") === "1";

  // Resolve prefix.
  let prefix;
  if (!dateParam) {
    prefix = new Date().toISOString().slice(0, 10) + "/"; // today, UTC
  } else if (dateParam === "all") {
    prefix = "";
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    prefix = dateParam + "/";
  } else if (/^\d{4}-\d{2}$/.test(dateParam)) {
    prefix = dateParam + "-";
  } else {
    return json(400, { error: "invalid_date_format" });
  }

  try {
    const store = getStore("quiz-events");
    const { blobs } = await store.list({ prefix });

    const records = [];
    for (const blob of blobs) {
      try {
        const data = await store.get(blob.key, { type: "json" });
        if (data) records.push(data);
      } catch (e) {
        console.error(`[admin-quiz-events] read failed ${blob.key}:`, e?.message);
      }
    }

    // Sort by timestamp ascending (key prefix is already date+time so the
    // natural blob order is mostly correct; explicit sort handles the rand suffix).
    records.sort((a, b) => (a.ts || "").localeCompare(b.ts || ""));

    if (aggregate) {
      const counts = {};
      for (const r of records) {
        const k = `${r.quiz}::${r.event}`;
        counts[k] = (counts[k] || 0) + 1;
      }
      return json(200, {
        prefix,
        totalEvents: records.length,
        countsByQuizEvent: counts,
      });
    }

    if (format === "csv") {
      const header = "ts,quiz,event,screen\n";
      const rows = records
        .map((r) => `${r.ts || ""},${r.quiz || ""},${r.event || ""},${r.screen || ""}`)
        .join("\n");
      return new Response(header + rows, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      });
    }

    return json(200, {
      prefix,
      totalEvents: records.length,
      events: records,
    });
  } catch (e) {
    console.error("[admin-quiz-events]", e);
    return json(500, { error: "internal_error", message: e?.message });
  }
};
