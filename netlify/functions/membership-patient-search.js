// Search for patients by name+DOB, fallback to email/phone, or by ID
import { getSupabase } from "./shared/supabase.js";
import { verifyToken } from "./admin-verify.js";
import { verifyMasterToken } from "./admin-master-verify.js";

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

  // Auth check - accept both regular and master admin token
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  const masterPassword = (process.env.MASTER_ADMIN_PASSWORD || "").trim();

  const isRegularAdmin = verifyToken(token, adminPassword);
  const isMasterAdmin = verifyMasterToken(token, masterPassword);

  if (!isRegularAdmin && !isMasterAdmin) {
    return json(401, { error: "Unauthorized" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { first_name, last_name, dob, email, phone, patient_id } = body;
  const db = getSupabase();

  // Direct patient ID lookup
  if (patient_id) {
    const { data, error } = await db
      .from("patients")
      .select("*, memberships(*), payments(*)")
      .eq("id", patient_id)
      .single();

    if (error) return json(500, { error: error.message });
    return json(200, { patients: data ? [data] : [] });
  }

  // Primary search: name + DOB (exact match)
  if (first_name && last_name && dob) {
    const { data, error } = await db
      .from("patients")
      .select("*, memberships(*), payments(*)")
      .ilike("first_name", first_name.trim())
      .ilike("last_name", last_name.trim())
      .eq("dob", dob);

    if (error) return json(500, { error: error.message });
    if (data && data.length > 0) return json(200, { patients: data });
  }

  // Search by name only (if no DOB or exact match not found)
  if (first_name || last_name) {
    let query = db.from("patients").select("*, memberships(*), payments(*)");
    if (first_name) query = query.ilike("first_name", `%${first_name.trim()}%`);
    if (last_name) query = query.ilike("last_name", `%${last_name.trim()}%`);
    query = query.limit(20);

    const { data, error } = await query;
    if (error) return json(500, { error: error.message });
    if (data && data.length > 0) return json(200, { patients: data });
  }

  // Fallback: email
  if (email) {
    const { data, error } = await db
      .from("patients")
      .select("*, memberships(*), payments(*)")
      .ilike("email", email.trim());

    if (error) return json(500, { error: error.message });
    if (data && data.length > 0) return json(200, { patients: data });
  }

  // Fallback: phone
  if (phone) {
    const cleaned = phone.replace(/\D/g, "");
    const { data, error } = await db
      .from("patients")
      .select("*, memberships(*), payments(*)")
      .eq("phone", cleaned);

    if (error) return json(500, { error: error.message });
    if (data && data.length > 0) return json(200, { patients: data });
  }

  return json(200, { patients: [] });
};
