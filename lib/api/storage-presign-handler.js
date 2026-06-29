const authHandler = require("../../api/auth");

function nt(v) { return typeof v === "string" ? v.trim() : String(v ?? "").trim(); }

module.exports = async function storagePresignHandler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const email = nt(sessionPayload?.user?.email).toLowerCase();
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const { fileName, mimeType } = req.body || {};
  if (!nt(fileName)) return res.status(400).json({ error: "fileName required" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: "storage_not_configured" });
  }

  const BUCKET = "vehicle-files";
  const safeName = (name) => String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `vehicles/${safeEmail}/${Date.now()}_${safeName(nt(fileName))}`;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return res.status(500).json({ error: "presign_failed", detail });
    }

    const data = await response.json();
    const signedUrl = `${SUPABASE_URL}${data.url}`;
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

    return res.json({ signedUrl, publicUrl });
  } catch (err) {
    return res.status(500).json({ error: "presign_error", detail: err?.message });
  }
};
