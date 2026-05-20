const { contextBridge, nativeImage } = require("electron");
const screenshot = require("screenshot-desktop");

async function captureScreenAndParse(baseUrl, token) {
  if (!baseUrl) throw new Error("Missing baseUrl");
  if (!token) throw new Error("Missing token");
  const rawBuffer = await screenshot({ format: "png" });
  const image = nativeImage.createFromBuffer(rawBuffer);
  const { width, height } = image.getSize();
  const maxWidth = 1600;
  const resized = width > maxWidth
    ? image.resize({ width: maxWidth, height: Math.round((height * maxWidth) / width) })
    : image;
  const jpegBuffer = resized.toJPEG(68);
  const imageBase64 = jpegBuffer.toString("base64");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/companion/parse/ge-history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      imageBase64,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Parse failed (${response.status})`);
  }
  return {
    rawText: data.rawText || "",
    rows: data.rows || [],
    confidence: 100,
  };
}

async function verifyToken(baseUrl, token) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/companion/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Auth failed (${response.status})`);
  }
  return data;
}

async function ingestRows(baseUrl, token, rows, source = "mac-companion-electron") {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/companion/ingest/ge-history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      rows,
      source,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Ingest failed (${response.status})`);
  }
  return data;
}

contextBridge.exposeInMainWorld("companionApi", {
  captureScreenAndParse,
  verifyToken,
  ingestRows,
});
