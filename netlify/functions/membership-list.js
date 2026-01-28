// List all members with optional status filter
import { getSupabase } from "./shared/supabase.js";
import { verifyToken } from "./admin-verify.js";

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

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!verifyToken(token, adminPassword)) {
    return json(401, { error: "Unauthorized" });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status"); // active, canceled, past_due, all
  const db = getSupabase();

  let query = db
    .from("memberships")
    .select("*, patients(id, first_name, last_name, dob, email, phone)")
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) return json(500, { error: error.message });

  return json(200, { memberships: data || [] });
};
