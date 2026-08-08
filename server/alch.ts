/**
 * High-alchemy opportunities for an Alchemiser mk. II.
 *
 * Machine mechanics are from the RS3 wiki, not inferred:
 *   - 25 items/hour, 600/day per machine; the game allows two alchemiser-types
 *   - one nature rune AND six machine charges per item
 *   - pays the full high alchemy value (no Magic xp, but the coins are not reduced)
 *   - refuses any item with a GE price above 500,000
 *
 * No GE tax applies anywhere here: alching pays coins directly, it is not a GE sale. That
 * conveniently sidesteps the unverified 2% tax constant the rest of the app depends on.
 */
import { getMapping, getLatest, getVolumes } from "./ge-api";

export const ITEMS_PER_DAY = 600; // per machine
export const MACHINES = 2;
export const CHARGE_PER_ITEM = 6;
export const CHARGES_PER_DIVINE_CHARGE = 3000;
export const MAX_ALCHABLE_GE_PRICE = 500_000;

export const NATURE_RUNE_ID = 561;
export const DIVINE_CHARGE_ID = 36390;

/** Default liquidity floor. Feeding 1200 items a day by hand needs a deep book. */
export const DEFAULT_MIN_VOLUME = 100_000;

/** A quote nobody has traded against in 24h is not a price you can buy at. */
const MAX_QUOTE_AGE_MS = 24 * 60 * 60 * 1000;

export interface AlchRow {
  id: number;
  name: string;
  icon: string;
  isMembers: boolean;
  /** Instant-buy. You pay the ask to fill thousands of units, not the mid. */
  buyPrice: number;
  highalch: number;
  profitPerItem: number;
  geLimit: number;
  volume: number;
  /** Units you can actually run per day: min(machine throughput, buy limit x 6 windows). */
  dailyCap: number;
  dailyProfit: number;
}

export interface AlchResult {
  rows: AlchRow[];
  naturePrice: number;
  chargePrice: number;
  chargeCostPerItem: number;
  overheadPerItem: number;
  itemsPerDay: number;
  /** How many passed the filters, before profitability. Context for an empty table. */
  qualifyingCount: number;
  profitableCount: number;
  minVolume: number;
  generatedAt: string;
}

export async function getAlchOpportunities(
  minVolume: number = DEFAULT_MIN_VOLUME,
  limit = 10,
): Promise<AlchResult> {
  const [mapping, latest, volumes] = await Promise.all([getMapping(), getLatest(), getVolumes()]);

  const askOf = (id: number): number | null => {
    const t = latest[String(id)];
    if (!t || t.high == null) return null;
    if ((t.highTime ?? 0) * 1000 < Date.now() - MAX_QUOTE_AGE_MS) return null;
    return Math.round(t.high);
  };

  const naturePrice = askOf(NATURE_RUNE_ID);
  const chargePrice = askOf(DIVINE_CHARGE_ID);
  if (naturePrice == null || chargePrice == null) {
    throw new Error("No live price for nature runes or divine charges");
  }

  const chargeCostPerItem = (chargePrice * CHARGE_PER_ITEM) / CHARGES_PER_DIVINE_CHARGE;
  const overheadPerItem = naturePrice + chargeCostPerItem;
  const itemsPerDay = ITEMS_PER_DAY * MACHINES;

  const rows: AlchRow[] = [];
  let qualifyingCount = 0;

  for (const m of mapping) {
    if (!m?.id || !m.name || !m.highalch) continue;
    const volume = volumes[String(m.id)] ?? 0;
    if (volume < minVolume) continue;

    const buyPrice = askOf(m.id);
    if (buyPrice == null || buyPrice <= 0) continue;
    if (buyPrice > MAX_ALCHABLE_GE_PRICE) continue; // the machine will not touch it

    qualifyingCount++;

    const profitPerItem = m.highalch - buyPrice - overheadPerItem;
    const geLimit = m.limit ?? 0;
    const dailyCap = Math.min(itemsPerDay, geLimit * 6); // limits reset every 4h

    rows.push({
      id: m.id,
      name: m.name,
      icon: `https://secure.runescape.com/m=itemdb_rs/obj_sprite.gif?id=${m.id}`,
      isMembers: m.members ?? false,
      buyPrice,
      highalch: m.highalch,
      profitPerItem: Math.round(profitPerItem),
      geLimit,
      volume,
      dailyCap,
      dailyProfit: Math.round(profitPerItem * dailyCap),
    });
  }

  const profitable = rows.filter((r) => r.profitPerItem > 0);

  return {
    rows: [...profitable].sort((a, b) => b.dailyProfit - a.dailyProfit).slice(0, limit),
    naturePrice,
    chargePrice,
    chargeCostPerItem: Math.round(chargeCostPerItem * 10) / 10,
    overheadPerItem: Math.round(overheadPerItem * 10) / 10,
    itemsPerDay,
    qualifyingCount,
    profitableCount: profitable.length,
    minVolume,
    generatedAt: new Date().toISOString(),
  };
}
