// Create a new patient record
import { getSupabase } from "./shared/supabase.js";
import { verifyToken } from "./admin-verify.js";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
  });

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!verifyToken(token, adminPassword)) {
    return json(401, { error: "Unauthorized" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { first_name, last_name, dob, email, phone } = body;
  if (!first_name || !last_name || !dob) {
    return json(400, { error: "first_name, last_name, and dob are required" });
  }

  const db = getSupabase();

  const record = {
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    dob,
    email: email?.trim() || null,
    phone: phone?.replace(/\D/g, "") || null,
  };

  const { data, error } = await db
    .from("patients")
    .upsert(record, { onConflict: "first_name,last_name,dob" })
    .select()
    .single();

  if (error) return json(500, { error: error.message });

  return json(200, { patient: data });
};
