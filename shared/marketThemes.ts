/**
 * Finds what the market is reacting to, without being told what happened.
 *
 * The idea: when Jagex ships an update, the items it touches move TOGETHER and they share
 * vocabulary. If eight movers all contain "seed", something happened to Farming — and you
 * can know that without reading a single patch note. A news feed can then put a name to the
 * cluster, but the detection does not depend on one.
 *
 * Deliberately no hand-maintained "update -> items" table. That would need editing for
 * every update, which is exactly the thing that rots.
 *
 * Pure functions only, so scripts/check-market-themes.ts can exercise them offline.
 */

export interface ThemeCandidate {
  /** Item name, used for token extraction and display. */
  name: string;
  /** Examine text. Widens the vocabulary — "Magic seed" alone misses "planted in a herb patch". */
  examine?: string;
  /** Signed 24h move, percent. */
  changePct: number;
}

export interface Theme {
  /** The over-represented word, e.g. "seed". */
  token: string;
  /** How many movers contain it. */
  moverCount: number;
  /** Times more common among movers than in the universe. 1.0 = no signal. */
  lift: number;
  /** Share of the cluster moving the same way, 0.5–1.0. */
  coherence: number;
  direction: "up" | "down";
  /** Median absolute move across the cluster. */
  medianMovePct: number;
  /** The movers themselves, biggest absolute move first. */
  items: ThemeCandidate[];
}

export interface ThemeOptions {
  /** Percentile of |change| that counts as "moving". Percentile, not a fixed %, because a
   *  fixed threshold is only ever calibrated for one market — the mistake that made every
   *  Scanner signal fire on 93% of items. */
  moverPercentile?: number;
  /** A cluster needs this many movers. Three items sharing a word is a coincidence. */
  minClusterSize?: number;
  /** Fraction of the cluster that must move the same way. An update pushes its items in one
   *  direction; noise does not. */
  minCoherence?: number;
  /** Minimum lift. Without this, a word common to the WHOLE universe forms a perfect-looking
   *  cluster whenever enough items move — every mover shares it, all in one direction, and
   *  it means nothing. Lift near 1.0 is precisely "no more common among movers than
   *  anywhere else", so requiring 2x is what lets a calm market report no themes at all. */
  minLift?: number;
  /** Words carrying no thematic information. */
  stopWords?: Set<string>;
}

/** Words that appear across unrelated items and would form meaningless clusters. */
export const DEFAULT_STOP_WORDS = new Set([
  "the", "and", "for", "with", "this", "that", "used", "use", "can", "you", "your", "made",
  "from", "into", "out", "one", "two", "all", "not", "但", "very", "some", "more", "than",
  "item", "items", "member", "members", "player", "players", "look", "looks", "looking",
  "seems", "quite", "just", "its", "has", "have", "was", "are", "will", "would",
]);

const DEFAULTS = {
  moverPercentile: 0.95,
  minClusterSize: 4,
  minCoherence: 0.8,
  minLift: 2,
  stopWords: DEFAULT_STOP_WORDS,
};

/** Words of 3+ letters, deduped per item so a name repeating a word does not double-count. */
export function tokenize(text: string, stopWords: Set<string> = DEFAULT_STOP_WORDS): string[] {
  const words = text.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  // Array.from, not spread: tsconfig sets no target, so ES5 downlevelling rejects iterating a Set.
  return Array.from(new Set(words)).filter((w) => !stopWords.has(w));
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ThemeResult {
  themes: Theme[];
  /** The |change| cut that defined a mover, so the UI can show what it filtered on. */
  moverThresholdPct: number;
  moverCount: number;
  universeCount: number;
}

/**
 * @param universe every liquid item with a trustworthy 24h anchor. Callers must have already
 *   dropped one-sided quotes — comparing a one-sided hour to a two-sided one fabricates
 *   double-digit moves out of nothing, which drowns real clusters in noise.
 */
export function detectThemes(universe: ThemeCandidate[], options: ThemeOptions = {}): ThemeResult {
  const opts = { ...DEFAULTS, ...options };
  const empty: ThemeResult = {
    themes: [],
    moverThresholdPct: 0,
    moverCount: 0,
    universeCount: universe.length,
  };
  // Below this the percentile cut is meaningless and every token trivially "lifts".
  if (universe.length < 20) return empty;

  const absSorted = universe.map((i) => Math.abs(i.changePct)).sort((a, b) => a - b);
  const cutIndex = Math.min(absSorted.length - 1, Math.floor(absSorted.length * opts.moverPercentile));
  const moverThresholdPct = absSorted[cutIndex];

  const movers = universe.filter((i) => Math.abs(i.changePct) >= moverThresholdPct);
  if (movers.length < opts.minClusterSize) return { ...empty, moverThresholdPct };

  const tokensOf = new Map<ThemeCandidate, string[]>();
  const countIn = (items: ThemeCandidate[]) => {
    const counts = new Map<string, number>();
    for (const item of items) {
      let tokens = tokensOf.get(item);
      if (!tokens) {
        tokens = tokenize(`${item.name} ${item.examine ?? ""}`, opts.stopWords);
        tokensOf.set(item, tokens);
      }
      for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return counts;
  };

  const universeCounts = countIn(universe);
  const moverCounts = countIn(movers);

  const themes: Theme[] = [];
  for (const [token, moverCount] of Array.from(moverCounts.entries())) {
    if (moverCount < opts.minClusterSize) continue;

    const items = movers.filter((i) => tokensOf.get(i)!.includes(token));
    const up = items.filter((i) => i.changePct > 0).length;
    const coherence = Math.max(up, items.length - up) / items.length;
    if (coherence < opts.minCoherence) continue;

    // Lift: share of movers carrying the word, over its share of the whole universe.
    // Ceilings at universe/movers when every occurrence is a mover, so rank by lift*count
    // rather than lift alone — otherwise every barely-qualifying cluster ties at the top.
    const universeShare = (universeCounts.get(token) ?? moverCount) / universe.length;
    const lift = moverCount / movers.length / universeShare;
    if (lift < opts.minLift) continue;

    themes.push({
      token,
      moverCount,
      lift,
      coherence,
      direction: up > items.length / 2 ? "up" : "down",
      medianMovePct: median(items.map((i) => Math.abs(i.changePct)).sort((a, b) => a - b)),
      items: [...items].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)),
    });
  }

  themes.sort((a, b) => b.lift * b.moverCount - a.lift * a.moverCount);

  // Co-occurring words describe one event, not several: "seed" and "plant" matched the same
  // five items on the live run and would render as two identical cards. Keep the
  // strongest-ranked token and drop any whose items it already covers.
  const kept: Theme[] = [];
  for (const theme of themes) {
    const ids = new Set(theme.items.map((i) => i.name));
    const subsumed = kept.some((k) => k.items.every((i) => ids.has(i.name)) || theme.items.every((i) => k.items.includes(i)));
    if (!subsumed) kept.push(theme);
  }

  return { themes: kept, moverThresholdPct, moverCount: movers.length, universeCount: universe.length };
}
