export async function uploadFileDirect(file, vehicleId = "", fileType = "documents") {
  if (!file || !file.name || !file.size) return null;

  try {
    const presignRes = await fetch("/api/user?route=storage-presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        vehicleId,
        fileType,
      }),
    });

    if (!presignRes.ok) return null;
    const { signedUrl, publicUrl } = await presignRes.json();
    if (!signedUrl || !publicUrl) return null;

    const uploadRes = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    });

    if (!uploadRes.ok) return null;
    return publicUrl;
  } catch {
    return null;
  }
}
