/**
 * The Discord embed for one out-of-range alert, in the style of the Flipper bot: title, links,
 * rating, volume/limit, max profit, GE price, 12h|1h, insta buy/sell with relative time, item
 * icon, and a chart. Pure so scripts/check-out-of-range.ts can render it offline; discord.ts
 * only posts what this returns.
 */
import { formatGpShorthand } from "./gpParser";
import type { Detection, HourlyPoint } from "./outOfRange";
import { SOURCES } from "./priceSources";

export interface EmbedHit {
  itemId: number;
  name: string;
  icon: string;
  geLimit: number;
  volume: number;
  margin: number;
  detection: Detection;
  latest: { high: number | null; highTime: number | null; low: number | null; lowTime: number | null };
  series7d: HourlyPoint[];
}

export interface OutOfRangeEmbed {
  title: string;
  color: number;
  url?: string;
  description: string;
  thumbnail?: { url: string };
  image?: { url: string };
  fields: { name: string; value: string; inline?: boolean }[];
  timestamp: string;
  footer: { text: string };
}

const MAX_CHART_POINTS = 40;
const MAX_URL = 1990;
const gp = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));
const ago = (unixSeconds: number | null) => (unixSeconds == null ? "" : ` <t:${unixSeconds}:R>`);

/** 7d hourly series -> QuickChart line chart: the week in blue, the last 24h in amber over it,
 *  and the Normal range as two dashed lines so "how far out" is visible at a glance.
 *
 *  The whole chart config rides in the URL and JSON balloons under percent-encoding, so values
 *  are shown in K/M/B and, if the URL is still too long, the series is thinned and retried. */
export function chartUrl(series7d: HourlyPoint[], normalLow: number, normalHigh: number, nowMs: number): string | null {
  const prices = series7d
    .map((p) => ({ t: p.t, v: p.high != null && p.low != null ? Math.round((p.high + p.low) / 2) : (p.high ?? p.low) }))
    .filter((p): p is { t: number; v: number } => p.v != null);
  if (prices.length < 2) return null;
  const top = Math.max(...prices.map((p) => p.v), normalHigh);
  const [unit, unitName] = top >= 1e9 ? [1e9, "B"] : top >= 1e6 ? [1e6, "M"] : top >= 1e3 ? [1e3, "K"] : [1, ""];
  const r = (n: number) => Math.round((n / unit) * 100) / 100;
  const dayAgo = nowMs - 24 * 3_600_000;

  for (const maxPoints of [MAX_CHART_POINTS, 30, 20, 12]) {
    const step = Math.max(1, Math.ceil(prices.length / maxPoints));
    const sampled = prices.filter((_, i) => i % step === 0 || i === prices.length - 1);
    const config = {
      type: "line",
      data: {
        labels: sampled.map((_, i) => i),
        datasets: [
          { data: sampled.map((p) => r(p.v)), borderColor: "#60a5fa" },
          { data: sampled.map((p) => (p.t >= dayAgo ? r(p.v) : null)), borderColor: "#f59e0b", borderWidth: 3 },
          { data: sampled.map(() => r(normalHigh)), borderColor: "#6b7280", borderDash: [4, 4], borderWidth: 1 },
          { data: sampled.map(() => r(normalLow)), borderColor: "#6b7280", borderDash: [4, 4], borderWidth: 1 },
        ],
      },
      options: {
        legend: { display: false },
        elements: { point: { radius: 0 }, line: { fill: false, borderWidth: 2 } },
        scales: { xAxes: [{ display: false }], yAxes: [{ scaleLabel: { display: true, labelString: `gp (${unitName || "raw"})` } }] },
      },
    };
    const url = `https://quickchart.io/chart?bkg=%23202225&w=520&h=180&c=${encodeURIComponent(JSON.stringify(config))}`;
    if (url.length <= MAX_URL) return url;
  }
  return null;
}

export function buildOutOfRangeEmbed(hit: EmbedHit, nowMs: number): OutOfRangeEmbed {
  const d = hit.detection;
  const spike = d.direction === "spike";
  const fires = d.pctBeyond >= 100 ? "🔥🔥🔥" : d.pctBeyond >= 50 ? "🔥🔥" : "🔥";
  const wiki = `https://runescape.wiki/w/Exchange:${encodeURIComponent(hit.name.replace(/ /g, "_")).replace(/\(/g, "%28").replace(/\)/g, "%29")}`;
  const lines = [
    `[Wiki](${wiki})`,
    `**Rating**: ${fires}`,
    `**Volume**: ${gp(hit.volume)} | **Limit**: ${gp(hit.geLimit)}`,
    `**Max profit**: ${gp(hit.margin * hit.geLimit)}`,
    `**${spike ? "24h high" : "24h low"}**: ${gp(d.extreme)} (${d.pctBeyond.toFixed(0)}% beyond normal)`,
    `**Normal range**: ${formatGpShorthand(d.normalLow)} – ${formatGpShorthand(d.normalHigh)}`,
    `**12h**: ${gp(d.avg12h)} | **1h**: ${gp(d.avg1h)}`,
    ``,
    `**Insta Buy**: ${gp(hit.latest.high)}${ago(hit.latest.highTime)}`,
    `**Insta Sell**: ${gp(hit.latest.low)}${ago(hit.latest.lowTime)}`,
  ];
  const chart = chartUrl(hit.series7d, d.normalLow, d.normalHigh, nowMs);
  return {
    title: `${spike ? "Spike" : "Dump"} on ${hit.name} 👀`,
    // Green when there is something to sell into, red when it is something to buy.
    color: spike ? 0x22c55e : 0xef4444,
    url: wiki,
    description: lines.join("\n"),
    thumbnail: { url: hit.icon },
    ...(chart ? { image: { url: chart } } : {}),
    fields: [],
    timestamp: new Date(nowMs).toISOString(),
    // The 24h extreme is a wiki hourly price; the Normal range is a Weird Gloop daily guide
    // price. Different series, so the embed says so rather than implying one source.
    footer: { text: `RS3 Flip Tracker · Prices: ${SOURCES["wiki-hourly"].name} hourly · Normal range: ${SOURCES.weirdgloop.name} daily` },
  };
}
