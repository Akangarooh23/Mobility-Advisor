const {
  readAttachmentByKey,
  mimeTypeFromFileName,
} = require("../attachmentStorage");
const authHandler = require("../../api/auth");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseFileNameForHeader(value = "") {
  return normalizeText(value).replace(/[\r\n"]/g, "").slice(0, 180);
}

module.exports = async function attachmentFileHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  if (!sessionEmail) {
    return res.status(401).json({ error: "Sesion no valida para descargar adjuntos." });
  }

  const key = normalizeText(req.query?.key);
  if (!key) {
    return res.status(400).json({ error: "Falta key del adjunto." });
  }

  const attachment = readAttachmentByKey(key);
  if (!attachment) {
    return res.status(404).json({ error: "Adjunto no encontrado." });
  }

  const requestedFileName = parseFileNameForHeader(req.query?.name);
  const resolvedFileName = requestedFileName || attachment.fileName || "adjunto.bin";
  const requestedMimeType = normalizeText(req.query?.mimeType);
  const resolvedMimeType = requestedMimeType || mimeTypeFromFileName(resolvedFileName);

  res.setHeader("Content-Type", resolvedMimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${resolvedFileName}"`);
  return res.status(200).end(attachment.buffer);
};
