import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
let openai: OpenAI | undefined;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

interface IdentifiedItem {
  name: string;
  quantity: number;
  confidence: number;
  notes?: string;
}

interface VisionAnalysisResult {
  items: IdentifiedItem[];
  rawResponse: string;
  success: boolean;
  error?: string;
}

export interface GEHistoryVisionRow {
  type: "buy" | "sell";
  itemName: string;
  quantity: number;
  price: number;
  confidence?: number;
}

export interface GEHistoryVisionResult {
  rows: GEHistoryVisionRow[];
  rawResponse: string;
  success: boolean;
  error?: string;
}

export async function analyzeRS3Screenshot(imageBuffer: Buffer): Promise<VisionAnalysisResult> {
  try {
    const openai = getOpenAI();
    const base64Image = imageBuffer.toString("base64");
    const mimeType = detectImageMimeType(imageBuffer);

    const systemPrompt = `You are an expert at identifying items from RuneScape 3 (RS3) bank screenshots. 
Your task is to analyze the screenshot and identify all visible items with their quantities.

RS3 Bank Screenshot Characteristics:
- Items appear in a grid of slots
- Each slot shows an item icon with a quantity overlay (usually in the corner)
- Quantities may be abbreviated: K = thousands (1K = 1,000), M = millions (1M = 1,000,000), B = billions
- Some items stack, showing large numbers; others don't stack and show quantity as separate slots
- Item names should match official RS3 item names as closely as possible

Output Requirements:
- Identify each unique item and its total quantity
- Use official RS3 item names (e.g., "Rune platebody", "Dragon bones", "Grimy ranarr")
- Convert abbreviated quantities to full numbers (e.g., "12.5K" → 12500)
- Include a confidence score (0-1) for each identification
- Add notes for uncertain identifications

Respond with valid JSON only, in this exact format:
{
  "items": [
    {"name": "Item Name", "quantity": 1000, "confidence": 0.95, "notes": "optional notes"},
    ...
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this RS3 bank screenshot and identify all items with their quantities. Return the results as JSON.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        items: [],
        rawResponse: "",
        success: false,
        error: "No response from AI",
      };
    }

    const parsed = JSON.parse(content);
    const items: IdentifiedItem[] = (parsed.items || []).map((item: any) => ({
      name: String(item.name || "").trim(),
      quantity: parseQuantity(item.quantity),
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.5)),
      notes: item.notes,
    })).filter((item: IdentifiedItem) => item.name.length > 0);

    return {
      items,
      rawResponse: content,
      success: true,
    };
  } catch (error: any) {
    console.error("[AI Vision] Error analyzing screenshot:", error);
    return {
      items: [],
      rawResponse: "",
      success: false,
      error: error.message || "Failed to analyze screenshot",
    };
  }
}

export async function analyzeGEHistoryScreenshot(imageBuffer: Buffer): Promise<GEHistoryVisionResult> {
  try {
    const openai = getOpenAI();
    const base64Image = imageBuffer.toString("base64");
    const mimeType = detectImageMimeType(imageBuffer);

    const systemPrompt = `You are an expert at reading RuneScape 3 Grand Exchange history screenshots.
Extract transaction rows from the GE history area only.

For each row, return:
- type: "buy" or "sell"
- itemName: official RS3 item name if possible
- quantity: integer quantity (convert K/M/B abbreviations)
- price: integer GP per item
- confidence: 0-1

Ignore UI noise and unrelated text.
Respond with valid JSON only in this format:
{
  "rows": [
    {"type":"buy","itemName":"Rune arrow","quantity":1000,"price":120,"confidence":0.93}
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract GE history rows from this screenshot and return JSON.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        rows: [],
        rawResponse: "",
        success: false,
        error: "No response from AI",
      };
    }

    const parsed = JSON.parse(content);
    const rows: GEHistoryVisionRow[] = (parsed.rows || [])
      .map((row: any) => ({
        type: row.type === "sell" ? "sell" : "buy",
        itemName: String(row.itemName || "").trim(),
        quantity: parseQuantity(row.quantity),
        price: parseQuantity(row.price),
        confidence: Math.min(1, Math.max(0, Number(row.confidence) || 0.5)),
      }))
      .filter((row: GEHistoryVisionRow) => row.itemName.length > 0 && row.quantity > 0 && row.price > 0);

    return {
      rows,
      rawResponse: content,
      success: true,
    };
  } catch (error: any) {
    console.error("[AI Vision] Error analyzing GE history screenshot:", error);
    return {
      rows: [],
      rawResponse: "",
      success: false,
      error: error.message || "Failed to analyze GE history screenshot",
    };
  }
}

function parseQuantity(value: any): number {
  if (typeof value === "number") return Math.round(value);
  
  const str = String(value).toUpperCase().replace(/,/g, "").trim();
  
  if (str.endsWith("B")) {
    return Math.round(parseFloat(str.slice(0, -1)) * 1000000000);
  }
  if (str.endsWith("M")) {
    return Math.round(parseFloat(str.slice(0, -1)) * 1000000);
  }
  if (str.endsWith("K")) {
    return Math.round(parseFloat(str.slice(0, -1)) * 1000);
  }
  
  return parseInt(str, 10) || 1;
}

function detectImageMimeType(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "image/webp";
  return "image/png";
}
