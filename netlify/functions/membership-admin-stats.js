// Get admin stats (patient counts, etc)
import { getSupabase } from "./shared/supabase.js";
import { verifyToken } from "./admin-verify.js";
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

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
  const masterPassword = (process.env.MASTER_ADMIN_PASSWORD || "").trim();

  // Accept either regular admin token or master admin token
  const isRegularAdmin = verifyToken(token, adminPassword);
  const isMasterAdmin = verifyMasterToken(token, masterPassword);

  if (!isRegularAdmin && !isMasterAdmin) {
    return json(401, { error: "Unauthorized" });
  }

  const db = getSupabase();

  try {
    const { data: patients, error: patientError } = await db
      .from("patients")
      .select("id, created_at")
      .order("created_at", { ascending: false });

    if (patientError) {
      return json(500, { error: patientError.message });
    }

    return json(200, {
      patients: patients || [],
      total_patients: patients?.length || 0,
    });
  } catch (err) {
    console.error("[membership-admin-stats]", err);
    return json(500, { error: err.message });
  }
};
