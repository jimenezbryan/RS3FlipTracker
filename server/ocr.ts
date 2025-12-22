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
