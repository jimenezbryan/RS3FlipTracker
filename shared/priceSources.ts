/**
 * Where each kind of market price comes from. One table so the UI tags and the Discord footer
 * can never disagree. Hosts are in server/ge-api.ts (WIKI_API_BASE, GE_API_BASE).
 *
 * The two upstreams differ in kind: the wiki has real instant-buy / instant-sell prices at
 * hourly resolution but its RS3 dataset starts 2026-07-23; Weird Gloop has years of history
 * but a single guide price per day, with no buy/sell split.
 */
export type SourceKey = "wiki-quote" | "wiki-hourly" | "wiki-series" | "weirdgloop";

export const SOURCES: Record<SourceKey, { label: string; name: string; detail: string }> = {
  "wiki-quote": {
    label: "Wiki",
    name: "RuneScape Wiki",
    detail:
      "RuneScape Wiki real-time prices (prices.runescape.wiki). The average of the last hour's trades where both sides traded, otherwise the latest single trade on each side.",
  },
  "wiki-hourly": {
    label: "Wiki · hourly",
    name: "RuneScape Wiki",
    detail: "RuneScape Wiki real-time prices (prices.runescape.wiki): the average of trades in one hour, compared with the same hour 24h and 7d earlier.",
  },
  "wiki-series": {
    label: "Wiki · hourly series",
    name: "RuneScape Wiki",
    detail: "RuneScape Wiki real-time prices (prices.runescape.wiki): one point per hour for the last 7 days.",
  },
  weirdgloop: {
    label: "Weird Gloop · daily",
    name: "Weird Gloop",
    detail: "Weird Gloop Exchange (api.weirdgloop.org): one guide price per day. No separate buy and sell prices.",
  },
};
