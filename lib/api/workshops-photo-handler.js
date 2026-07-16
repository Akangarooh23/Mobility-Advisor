module.exports = async function workshopsPhotoHandler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const ref = String(req.query?.ref || "").trim();
  if (!ref || ref.length < 10) return res.status(400).end();

  const apiKey = process.env.GOOGLE_PLACES_KEY;
  if (!apiKey) return res.status(500).end();

  const url =
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=600&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).end();

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=604800"); // 7 days
    const buf = await upstream.arrayBuffer();
    res.status(200).end(Buffer.from(buf));
  } catch {
    res.status(502).end();
  }
};
