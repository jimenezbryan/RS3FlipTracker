import Tesseract from "tesseract.js";

interface OCRItem {
  name: string;
  quantity: number;
  confidence: number;
}

interface OCRResult {
  items: OCRItem[];
  rawText: string;
  overallConfidence: number;
}

export interface GEHistoryOCRRow {
  type: "buy" | "sell";
  itemName: string;
  quantity: number;
  price: number;
}

export interface GEHistoryOCRResult {
  rows: GEHistoryOCRRow[];
  rawText: string;
  overallConfidence: number;
}

export async function processScreenshot(imageBuffer: Buffer): Promise<OCRResult> {
  try {
    const result = await Tesseract.recognize(imageBuffer, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    const rawText = result.data.text;
    const overallConfidence = result.data.confidence;

    const items = parseRS3Items(rawText);

    return {
      items,
      rawText,
      overallConfidence,
    };
  } catch (error) {
    console.error("[OCR] Failed to process screenshot:", error);
    throw new Error("Failed to process screenshot");
  }
}

export async function processGEHistoryScreenshot(imageBuffer: Buffer): Promise<GEHistoryOCRResult> {
  try {
    const result = await Tesseract.recognize(imageBuffer, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`[OCR:GE] Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    const rawText = result.data.text || "";
    const rows = parseGEHistoryRows(rawText);

    return {
      rows,
      rawText,
      overallConfidence: result.data.confidence,
    };
  } catch (error) {
    console.error("[OCR:GE] Failed to process GE history screenshot:", error);
    throw new Error("Failed to process GE history screenshot");
  }
}

function parseRS3Items(text: string): OCRItem[] {
  const items: OCRItem[] = [];
  const lines = text.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    const quantityMatch = trimmed.match(/^(\d+[KkMm]?)\s*x?\s*(.+)$/);
    const reverseMatch = trimmed.match(/^(.+?)\s*x?\s*(\d+[KkMm]?)$/);

    let name = "";
    let quantity = 1;
    let confidence = 0.5;

    if (quantityMatch) {
      quantity = parseQuantity(quantityMatch[1]);
      name = quantityMatch[2].trim();
      confidence = 0.7;
    } else if (reverseMatch && reverseMatch[2]) {
      name = reverseMatch[1].trim();
      quantity = parseQuantity(reverseMatch[2]);
      confidence = 0.6;
    } else {
      name = trimmed;
      confidence = 0.4;
    }

    name = cleanItemName(name);

    if (name.length >= 3 && !isNoise(name)) {
      items.push({ name, quantity, confidence });
    }
  }

  return items;
}

function parseQuantity(str: string): number {
  const cleaned = str.toUpperCase().replace(/,/g, "");
  if (cleaned.endsWith("K")) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000);
  }
  if (cleaned.endsWith("M")) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000000);
  }
  return parseInt(cleaned, 10) || 1;
}

function cleanItemName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s\-'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanGEItemName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s\-'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGEHistoryRows(rawText: string): GEHistoryOCRRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: GEHistoryOCRRow[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ");

    // Pattern: Bought 1000 x Rune arrow for 123 gp
    const full = line.match(
      /^(Bought|Sold)\s+([\d.,]+[KkMmBb]?)\s*x?\s*(.+?)\s+for\s+([\d.,]+[KkMmBb]?)\s*gp/i,
    );
    if (full) {
      const type = full[1].toLowerCase() === "bought" ? "buy" : "sell";
      const quantity = parseQuantity(full[2]);
      const itemName = cleanGEItemName(full[3]);
      const price = parseQuantity(full[4]);
      if (itemName && quantity > 0 && price > 0) {
        rows.push({ type, itemName, quantity, price });
      }
      continue;
    }

    // Pattern fallback: Sold Rune arrow x 1000 for 123 gp
    const fallback = line.match(
      /^(Bought|Sold)\s+(.+?)\s+x?\s*([\d.,]+[KkMmBb]?)\s+for\s+([\d.,]+[KkMmBb]?)\s*gp/i,
    );
    if (fallback) {
      const type = fallback[1].toLowerCase() === "bought" ? "buy" : "sell";
      const itemName = cleanGEItemName(fallback[2]);
      const quantity = parseQuantity(fallback[3]);
      const price = parseQuantity(fallback[4]);
      if (itemName && quantity > 0 && price > 0) {
        rows.push({ type, itemName, quantity, price });
      }
      continue;
    }
  }

  return rows;
}

function isNoise(text: string): boolean {
  const noisePatterns = [
    /^bank$/i,
    /^inventory$/i,
    /^equipment$/i,
    /^worn$/i,
    /^price$/i,
    /^value$/i,
    /^total$/i,
    /^coins?$/i,
    /^gp$/i,
    /^\d+$/,
    /^x\d+$/i,
    /^tab\s*\d+$/i,
  ];

  return noisePatterns.some((pattern) => pattern.test(text.trim()));
}

export async function matchItemsToGE(
  items: OCRItem[],
  searchFn: (query: string) => Promise<Array<{ id: number; name: string; price?: number; icon?: string }>>
): Promise<
  Array<{
    original: OCRItem;
    match: { id: number; name: string; price?: number; icon?: string } | null;
    matchConfidence: number;
  }>
> {
  const results = [];

  for (const item of items) {
    try {
      const searchResults = await searchFn(item.name);
      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];
        const nameMatch = calculateNameSimilarity(item.name.toLowerCase(), bestMatch.name.toLowerCase());
        results.push({
          original: item,
          match: bestMatch,
          matchConfidence: nameMatch * item.confidence,
        });
      } else {
        results.push({
          original: item,
          match: null,
          matchConfidence: 0,
        });
      }
    } catch (error) {
      results.push({
        original: item,
        match: null,
        matchConfidence: 0,
      });
    }
  }

  return results;
}

function calculateNameSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;

  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const commonWords = aWords.filter((word) => bWords.includes(word));
  const similarity = (commonWords.length * 2) / (aWords.length + bWords.length);

  return Math.max(0.3, similarity);
}
