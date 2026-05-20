const { contextBridge } = require("electron");
const screenshot = require("screenshot-desktop");
const Tesseract = require("tesseract.js");

function parseCompactNumber(value) {
  const cleaned = String(value).replace(/,/g, "").trim().toUpperCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
  if (!match) return Number.parseInt(cleaned, 10) || 0;
  const num = Number.parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

function normalizeWhitespace(input) {
  return input.replace(/\s+/g, " ").trim();
}

function parseGeHistoryLines(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const rows = [];
  for (const line of lines) {
    const full = line.match(
      /^(Bought|Sold)\s+([\d.,]+[KMB]?)\s*x?\s*(.+?)\s+for\s+([\d.,]+[KMB]?)\s*gp/i,
    );
    if (full) {
      rows.push({
        type: full[1].toLowerCase() === "bought" ? "buy" : "sell",
        quantity: parseCompactNumber(full[2]),
        itemName: normalizeWhitespace(full[3]),
        price: parseCompactNumber(full[4]),
      });
      continue;
    }

    // Fallback for OCR-jumbled order, e.g. "Sold Dragon bones x 500 for 2810 gp"
    const fallback = line.match(
      /^(Bought|Sold)\s+(.+?)\s+x?\s*([\d.,]+[KMB]?)\s+for\s+([\d.,]+[KMB]?)\s*gp/i,
    );
    if (fallback) {
      rows.push({
        type: fallback[1].toLowerCase() === "bought" ? "buy" : "sell",
        itemName: normalizeWhitespace(fallback[2]),
        quantity: parseCompactNumber(fallback[3]),
        price: parseCompactNumber(fallback[4]),
      });
    }
  }

  return rows.filter((row) => row.itemName && row.quantity > 0 && row.price > 0);
}

async function captureScreenAndParse() {
  const imageBuffer = await screenshot({ format: "png" });

  const result = await Tesseract.recognize(imageBuffer, "eng", {
    logger: () => {},
  });

  const rawText = result.data.text || "";
  const rows = parseGeHistoryLines(rawText);
  return {
    rawText,
    rows,
    confidence: result.data.confidence || 0,
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

