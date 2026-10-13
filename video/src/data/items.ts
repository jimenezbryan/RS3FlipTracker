import history from "./scythe-90d.json";
import categories from "@shared/itemCategories.json";

// REAL: item names, ids, GE prices and 24h volumes (WeirdGloop exchange API, 2026-10-12), categories
// (the app's own shared/itemCategories.json), and the Noxious scythe 90-day history.
// ILLUSTRATIVE: buy/sell spreads, scores, signals, limits. The Scanner API needs a login, so the
// rows are laid out the way the Scanner computes them rather than copied from it.

export type Signal = "Accumulation" | "Smart Money" | "Deep Value" | "Good Value" | "Strong Trend" | "Pullback";

export interface ScannerRow {
  id: number;
  name: string;
  category: string;
  trend: "up" | "down" | "stable";
  tradeScore: number;
  geLimit: number;
  buyPrice: number;
  sellPrice: number;
  volume: number;
  suggestedMarginPct: number;
  confidence: "low" | "medium" | "high";
  signals: Signal[];
}

const cat = (id: number) => (categories as Record<string, string>)[String(id)] ?? "Uncategorised";

const row = (
  id: number, name: string, gePrice: number, volume: number, spreadPct: number, trend: ScannerRow["trend"],
  tradeScore: number, confidence: ScannerRow["confidence"], signals: Signal[],
): ScannerRow => ({
  id, name, category: cat(id), trend, tradeScore, geLimit: 2, volume, confidence, signals,
  buyPrice: gePrice,
  sellPrice: Math.round(gePrice * (1 + spreadPct / 100)),
  suggestedMarginPct: Math.round(spreadPct * 8) / 10,
});

export const SCYTHE_ID = 31725;

export const SCANNER_ROWS: ScannerRow[] = [
  row(51772, "Fractured Staff of Armadyl", 1154478622, 51, 3.1, "stable", 58, "medium", []),
  row(47470, "Eldritch crossbow", 913428809, 18, 2.6, "up", 49, "low", []),
  row(39584, "Praesul codex", 600092846, 54, 4.4, "up", 71, "medium", ["Good Value"]),
  row(37632, "Seren godbow", 584893901, 23, 2.9, "stable", 52, "low", []),
  row(52053, "Dark Shard of Leng", 518268769, 31, 3.3, "down", 55, "medium", []),
  row(SCYTHE_ID, "Noxious scythe", 269949132, 95, 5.8, "down", 84, "high", ["Accumulation"]),
  row(56114, "Elite Dracolich hauberk", 251600405, 55, 2.4, "stable", 47, "low", []),
  row(57022, "Balarak's sash brush", 100245694, 84, 4.9, "stable", 76, "medium", ["Accumulation"]),
  row(41106, "Cinderbane gloves", 36085926, 115, 4.1, "up", 68, "high", ["Smart Money"]),
  row(28437, "Ascension crossbow", 26144507, 71, 2.2, "down", 44, "low", []),
  row(59358, "The Devourer's Nexus (unattuned)", 13583105, 41, 3.6, "stable", 57, "medium", []),
];

export interface HistoryPoint { timestamp: number; price: number; volume: number }
export const SCYTHE_HISTORY: HistoryPoint[] = (history as Record<string, HistoryPoint[]>)[String(SCYTHE_ID)];

// The demo flip. Buy is today's real GE price rounded the way you'd type it ("270m");
// the sell is a hypothetical exit inside the real 90-day range, not a recorded trade.
export const DEMO_FLIP = { buyTyped: "270m", buyPrice: 270_000_000, sellTyped: "292m", sellPrice: 292_000_000, quantity: 1 };
