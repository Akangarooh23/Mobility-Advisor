const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORAGE_MODE = String(process.env.ATTACHMENT_STORAGE_MODE || "filesystem").trim().toLowerCase();
const STORAGE_ROOT = path.resolve(
  process.env.ATTACHMENT_STORAGE_DIR || path.join(__dirname, "..", "storage", "attachments")
);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureStorageRoot() {
  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }
}

function isPointer(content = "") {
  return normalizeText(content).startsWith("fs:");
}

function safeFileNameSegment(value = "") {
  return normalizeText(String(value || "")).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
}

function extensionFromMimeType(mimeType = "") {
  const mime = normalizeText(mimeType).toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  return "bin";
}

function mimeTypeFromFileName(fileName = "") {
  const normalized = normalizeText(fileName).toLowerCase();
  if (normalized.endsWith(".pdf")) return "application/pdf";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function buildAccessPath(pointer = "", mimeType = "", fileName = "") {
  const normalizedPointer = normalizeText(pointer);
  if (!isPointer(normalizedPointer)) {
    return "";
  }

  const key = normalizedPointer.slice(3);
  const query = new URLSearchParams();
  query.set("key", key);

  const normalizedMimeType = normalizeText(mimeType);
  if (normalizedMimeType) {
    query.set("mimeType", normalizedMimeType);
  }

  const normalizedName = normalizeText(fileName);
  if (normalizedName) {
    query.set("name", normalizedName);
  }

  return `/api/attachment-file?${query.toString()}`;
}

function storeAttachmentContent({
  contentBase64 = "",
  mimeType = "",
  fileName = "",
  namespace = "attachments",
} = {}) {
  const normalizedContent = normalizeText(contentBase64);
  if (!normalizedContent) {
    return "";
  }

  if (isPointer(normalizedContent)) {
    return normalizedContent;
  }

  if (STORAGE_MODE === "database") {
    return normalizedContent;
  }

  try {
    const buffer = Buffer.from(normalizedContent, "base64");
    if (!buffer.length) {
      return normalizedContent;
    }

    ensureStorageRoot();

    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const ext = extensionFromMimeType(mimeType) || extensionFromMimeType(mimeTypeFromFileName(fileName));
    const namespaceSegment = safeFileNameSegment(namespace) || "attachments";
    const originalName = safeFileNameSegment(path.basename(fileName || ""));
    const outputDir = path.join(STORAGE_ROOT, namespaceSegment);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = originalName ? `${hash}-${originalName}` : hash;
    const outputName = `${baseName}.${ext}`;
    const outputPath = path.join(outputDir, outputName);

    if (!fs.existsSync(outputPath)) {
      fs.writeFileSync(outputPath, buffer);
    }

    const relativePath = path.relative(STORAGE_ROOT, outputPath).replace(/\\/g, "/");
    return `fs:${relativePath}`;
  } catch {
    // If storage fails, keep DB-compatible base64 fallback.
    return normalizedContent;
  }
}

function buildAttachmentFromStored({
  name = "",
  size = 0,
  mimeType = "",
  storedContent = "",
} = {}) {
  const normalizedName = normalizeText(name);
  const normalizedMimeType = normalizeText(mimeType);
  const normalizedStoredContent = normalizeText(storedContent);

  const base = {
    name: normalizedName,
    size: Number(size || 0),
    mimeType: normalizedMimeType,
  };

  if (isPointer(normalizedStoredContent)) {
    return {
      ...base,
      contentBase64: "",
      path: buildAccessPath(normalizedStoredContent, normalizedMimeType || mimeTypeFromFileName(normalizedName), normalizedName),
      storageKey: normalizedStoredContent,
    };
  }

  return {
    ...base,
    contentBase64: normalizedStoredContent,
  };
}

function resolveAttachmentAbsolutePathFromKey(key = "") {
  const normalizedKey = normalizeText(key).replace(/^\/+/, "");
  if (!normalizedKey || normalizedKey.includes("..") || path.isAbsolute(normalizedKey)) {
    return "";
  }

  return path.resolve(STORAGE_ROOT, normalizedKey);
}

function readAttachmentByKey(key = "") {
  const absolutePath = resolveAttachmentAbsolutePathFromKey(key);
  if (!absolutePath) {
    return null;
  }

  if (!absolutePath.startsWith(STORAGE_ROOT)) {
    return null;
  }

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return {
    absolutePath,
    fileName: path.basename(absolutePath),
    buffer: fs.readFileSync(absolutePath),
  };
}

function deleteAttachmentByPointer(pointer = "") {
  const normalizedPointer = normalizeText(pointer);
  if (!isPointer(normalizedPointer)) {
    return false;
  }

  const key = normalizedPointer.slice(3);
  const absolutePath = resolveAttachmentAbsolutePathFromKey(key);
  if (!absolutePath || !absolutePath.startsWith(STORAGE_ROOT)) {
    return false;
  }

  if (!fs.existsSync(absolutePath)) {
    return false;
  }

  try {
    fs.unlinkSync(absolutePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  storeAttachmentContent,
  buildAttachmentFromStored,
  buildAccessPath,
  isPointer,
  readAttachmentByKey,
  deleteAttachmentByPointer,
  mimeTypeFromFileName,
};
