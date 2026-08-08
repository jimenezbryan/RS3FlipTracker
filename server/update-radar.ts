/**
 * Update radar — surfaces what the market is reacting to.
 *
 * Four bulk calls cover the whole game (mapping, /1h now, /1h 24h ago, /volumes), all of
 * them already memoised in ge-api. No per-item requests, no snapshot table.
 *
 * The one thing that makes or breaks this is the anchor, and it took two wrong cuts to get
 * right. First cut compared hourly MIDs on any block and reported 514 of 1168 items "moving"
 * 8%+ — a one-sided hour collapses mid onto whichever side traded. Second cut required both
 * sides to have traded at all and compared bid to bid; that still printed Bolt of cloth at
 * +117,600%, because "traded at all" means twelve units dumped at 1gp is a valid anchor.
 *
 * What actually works is demanding a BOOK, not a print: both sides carrying real size, and
 * ask >= bid so the quote is not internally contradictory (72 items fail that on a given
 * hour). Measured over the live universe, raising the per-side floor to 20 units drops the
 * worst 24h move from 7991% to 546% and the 95th percentile from 69.7% to 40.9%, while only
 * costing a third of the universe. Past 20 the numbers stop improving, so that is the knee.
 */
import { getMapping, getVolumes, getHourly, getHourly24hAgo, type HourlyTick } from "./ge-api";
import { detectThemes, type ThemeCandidate, type ThemeResult } from "@shared/marketThemes";

/** Below this an item's book is too thin for a 24h move to mean anything. */
const MIN_DAILY_VOLUME = 1000;

/** Units that must have traded on EACH side of the hour before its average is an anchor.
 *  Calibrated, not guessed — see the header. Under this, one stray dump sets the price. */
const MIN_SIDE_VOLUME = 20;

/** A real two-way book in this hour: size on both sides, and an ask at or above the bid.
 *  The inversion check is not paranoia — 72 liquid items quote high < low in a given hour,
 *  and each one is a thin side masquerading as a price. */
function hasBook(t: HourlyTick | undefined): t is HourlyTick {
  return (
    !!t &&
    t.avgHighPrice != null &&
    t.avgLowPrice != null &&
    t.highPriceVolume >= MIN_SIDE_VOLUME &&
    t.lowPriceVolume >= MIN_SIDE_VOLUME &&
    t.avgHighPrice >= t.avgLowPrice
  );
}

/** Mid of a book that passed hasBook. Safe here in a way it is not on a raw tick. */
const mid = (t: HourlyTick) => (t.avgHighPrice! + t.avgLowPrice!) / 2;

export interface RadarItem extends ThemeCandidate {
  id: number;
  icon: string;
  volume: number;
  price: number;
  priceWas: number;
}

export interface RadarResult extends Omit<ThemeResult, "themes"> {
  themes: Array<{
    token: string;
    moverCount: number;
    lift: number;
    coherence: number;
    direction: "up" | "down";
    medianMovePct: number;
    items: RadarItem[];
  }>;
  /** Biggest absolute movers regardless of whether they clustered. */
  topMovers: RadarItem[];
  generatedAt: string;
}

export async function getUpdateRadar(): Promise<RadarResult> {
  const [mapping, hourly, yesterday, volumes] = await Promise.all([
    getMapping(),
    getHourly(),
    getHourly24hAgo(),
    getVolumes(),
  ]);

  const universe: RadarItem[] = [];
  for (const m of mapping) {
    if (!m?.id || !m.name) continue;
    const volume = volumes[String(m.id)] ?? 0;
    if (volume < MIN_DAILY_VOLUME) continue;

    const now = hourly[String(m.id)];
    const then = yesterday[String(m.id)];
    if (!hasBook(now) || !hasBook(then)) continue;

    // Mid to mid, which is only trustworthy because hasBook already threw out the quotes
    // where mid is an artefact of one thin side.
    const price = mid(now);
    const priceWas = mid(then);
    if (priceWas <= 0) continue;

    universe.push({
      id: m.id,
      name: m.name,
      examine: m.examine,
      icon: `https://secure.runescape.com/m=itemdb_rs/obj_sprite.gif?id=${m.id}`,
      volume,
      price: Math.round(price),
      priceWas: Math.round(priceWas),
      changePct: ((price - priceWas) / priceWas) * 100,
    });
  }

  const byId = new Map(universe.map((i) => [i.name, i]));
  const result = detectThemes(universe);

  return {
    moverThresholdPct: Math.round(result.moverThresholdPct * 100) / 100,
    moverCount: result.moverCount,
    universeCount: result.universeCount,
    themes: result.themes.slice(0, 12).map((t) => ({
      token: t.token,
      moverCount: t.moverCount,
      lift: Math.round(t.lift * 10) / 10,
      coherence: Math.round(t.coherence * 100) / 100,
      direction: t.direction,
      medianMovePct: Math.round(t.medianMovePct * 10) / 10,
      items: t.items.slice(0, 10).map((i) => byId.get(i.name)!).filter(Boolean),
    })),
    topMovers: [...universe]
      .filter((i) => Math.abs(i.changePct) >= result.moverThresholdPct)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 25),
    generatedAt: new Date().toISOString(),
  };
}
