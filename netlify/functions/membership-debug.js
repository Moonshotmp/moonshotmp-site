// Debug endpoint to test Supabase connection
import { createClient } from "@supabase/supabase-js";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });

export default async (req) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const debug = {
    url_exists: !!url,
    url_length: url?.length,
    url_preview: url ? url.substring(0, 30) + "..." : null,
    key_exists: !!key,
    key_length: key?.length,
    key_preview: key ? key.substring(0, 20) + "..." : null,
  };

  if (!url || !key) {
    return json(500, { error: "Missing env vars", debug });
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from("patients").select("id, first_name, last_name, email").limit(10);

    if (error) {
      return json(500, { error: error.message, code: error.code, debug });
    }

    return json(200, { ok: true, patients: data, debug });
  } catch (err) {
    return json(500, { error: err.message, debug });
  }
};
