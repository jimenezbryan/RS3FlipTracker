# Out-of-range price alerts, price display and account identification

Date: 2026-10-18 (revised after grilling the same day). Vocabulary is in `CONTEXT.md`.

## Intent

Bryan wants to trade price spikes and dips: an item whose price in the last 24h is far outside its normal range (example: Decimation sold at 100m when it normally tops out near 50m). Success means:

1. A Discord **out-of-range alert** fires for such items, in the style of the "Flopper" embed.
2. The same information is visible in the Scanner and in the Log Flip form.
3. Multiple **RS accounts** are easier to identify on flips.

Alerts are global market signals. They are not tied to individual Users, Scanner presets or RS accounts.

## Existing code this builds on

- Alert flow: `.github/workflows/scanner-alerts.yml` (every 15 min) -> `POST /api/cron/alerts` (`server/routes.ts`) -> `runDueAlerts` (`server/scannerAlerts.ts`) -> `server/discord.ts` (`postEmbed`, `formatGpShorthand`). Webhook: `DISCORD_WEBHOOK_URL`.
- Price data: `getAllItemsForScanner()` (bulk, ~2200 items; `buyPrice`, `sellPrice`, `changePct24h`, `geLimit`, `volume`, `hourVolume`); the movers path also has a 7d-ago price (`price7dAgo`, `server/ge-api.ts` ~1121). `getItemIntraday` (hourly, `avgHighPrice`/`avgLowPrice`) and `getItemPriceHistoryFull` (daily), both cached. No market price history is stored in the DB.
- Range math: `calculateObservableRange`, `findSupportResistance`, `MIN_POINTS_FOR_AVERAGE` in `server/technical-indicators.ts`.
- Accounts: `rs_accounts` table, `flips.rsAccountId`, picker in `client/src/components/FlipForm.tsx` (~line 786, default "any").
- Schema changes are applied with `npm run db:push`; there is no migrations folder.
- Self-check pattern: `scripts/check-scanner-alerts.ts` (assert-based `tsx`, no framework).

## Decisions from the grilling session

1. **Trigger:** the check runs as its own step on every cron tick, independent of Scanner presets. `runDueAlerts` returns early when no preset is due, so it must not host this.
2. **Prices:** Spike uses the buy-side price (`avgHighPrice`) against the Normal range high. Dump uses the sell-side price (`avgLowPrice`) against the Normal range low.
3. **Still live:** an item alerts only if its latest price is still beyond the Normal range, or within ~10% of the 24h extreme. A spike that has already reverted does not alert. The pre-screen compares the current price with the 24h-ago and 7d-ago prices, not `changePct24h`.
4. **Liquidity floor:** 24h volume >= `geLimit` and hourly volume > 0. Loosen to half the limit only if alerts are too rare.
5. **Thresholds:** Spike >= 1.25x Normal range high; Dump <= 0.80x Normal range low. Named constants. Before relying on them, the check script samples ~200 items with real 30-day history and reports how many would have alerted over the past week; tune to roughly 5-15 alerts a day across the market.
6. **Grouping:** one Discord message per tick, at most 5 embeds, ranked by percent beyond range. Items beyond the cap are not given a cooldown entry, so they can alert on a later tick.
7. **Chart:** a QuickChart image URL (one combined 1d/7d chart, each series downsampled to ~40 points). The series is public price data. If QuickChart fails, the alert posts without the image.
8. **Scanner:** a cached endpoint `GET /api/scanner/out-of-range` (about 5 minutes) runs the same screen and detector as the cron. The Scanner joins by item id to show a badge on every row and offer an "Out of range" filter/sort. Log Flip uses the per-item detail route. Open to all logged-in users, like the Scanner.
9. **Accounts:** identification only. No per-account profit totals (a separate future spec).
10. **Rollout:** you run `npm run db:push` against production before the deploy that uses the new table. The table is additive. If the cooldown read or write fails, the alert step logs the error and sends nothing that tick (fail closed).

11. **Data sources shown:** every market price in the UI and in the Discord embed names its source with a small tag (Wiki quote, Wiki hourly, Wiki hourly series, Weird Gloop daily), from one table in `shared/priceSources.ts`. User-entered prices are not tagged. The out-of-range embed footer names both: the 24h extreme is a wiki hourly price, the Normal range is a Weird Gloop daily guide price.

## Design

### Detector (`shared/outOfRange.ts`, pure)

`detectOutOfRange(hourly24h, daily30d, latest)`:

- Normal range: daily low/high over the prior 30 days, excluding the last 24h.
- Spike: 24h `avgHighPrice` max >= 1.25x Normal range high, and the latest price still qualifies (decision 3). Dump: mirrored on `avgLowPrice` and the Normal range low at 0.80x.
- Returns `null` when there are fewer than `MIN_POINTS_FOR_AVERAGE` baseline points (the wiki RS3 dataset starts 2026-07-23, so young items have thin baselines).
- Otherwise returns direction, 24h extreme, Normal range low/high, percent beyond range, and 12h/1h average prices.

### Detection run (`server/outOfRange.ts`)

One function used by both the cron and the endpoint:

1. Take the bulk `items`. Screen by liquidity floor and by current price vs the 24h-ago and 7d-ago prices.
2. Fetch history (cached) for at most ~20 survivors and run the detector.
3. Return detections ranked by percent beyond range.

### Cron (`server/routes.ts`, `server/scannerAlerts.ts`)

- After `runDueAlerts`, run the detection, drop items under cooldown, take the top 5, send one message, then write cooldown rows.
- Cooldown table `out_of_range_alerts` (`itemId`, `direction`, `lastAlertAt`, `lastPrice`) in `shared/schema.ts`. Skip the same item and direction for 6h unless the price moved a further 10%.

### Embed (`server/discord.ts`)

New `sendOutOfRangeAlertToDiscord`, built on `postEmbed`:

- Title "Spike on <item>" or "Dump on <item>", red/green by direction.
- Links: Wiki and price page. Rating: 1-3 fire emoji scaled by percent beyond range.
- Lines: Volume | Limit; Max profit (limit x margin); GE price; 12h | 1h average; Insta Buy and Insta Sell with relative time (`<t:unix:R>`).
- Thumbnail: item icon (source confirmed during implementation). Image: the QuickChart chart.

### Scanner and Log Flip

- Scanner: badge and "Out of range" filter/sort from `GET /api/scanner/out-of-range` (decision 8).
- `FlipForm.tsx`: on picking an item, show the badge and Normal range beside the buy/sell fields (detail route), and warn when the entered price is outside the range.

### Accounts

- The picker defaults to the last account used, remembered in the browser.
- `FlipCard` and `FlipTable` rows show the RS account name, or "Unassigned" when empty.
- The flips list filter has an "Unassigned" option.

### Data-source tags

A shared `SourceTag` component (label plus tooltip) sits next to each market price: Scanner BUY/SELL headers, Scanner detail ranges and fair value, Market Insights and Log Flip "GE Price", Movers price and change columns, Alerts and Watchlist "Current Price", and the price chart (follows the selected period). The Scanner BUY/SELL tag is per column because the hourly-vs-latest choice is per item inside the scanner cache and is not exposed to the client.

## Out of scope

Per-account or per-user alert rules, user-editable thresholds, per-account profit totals, bulk-assigning old flips to accounts, our own chart rendering, a stored market price-history table.

## Risks

- Thin 30d baseline on young items: detector returns `null` below the minimum point count.
- Cron time budget on Vercel: ~20 candidate cap, cached history, one awaited webhook post.
- QuickChart dependency: alert still posts without the image.
- Mixed series: the alert compares a wiki hourly price against a Weird Gloop daily guide price. Fine at 25%/20%, and stated in the embed footer. Around 2026-10-23 the wiki will hold 90 days and the baseline can move to it.
- Production table must exist before deploy (decision 10); the code fails closed if it doesn't.

## Testing

- `scripts/check-out-of-range.ts`: a Decimation-like series (100m over a 50m high) fires; an in-range series, a thin-data series, a low-volume series and a spike that has already reverted do not; cooldown suppresses repeats; the sampling report prints alerts per week.
- `npx tsc --noEmit`.
- Manual `workflow_dispatch` of "Scanner alerts", confirming an embed with thumbnail and chart in Discord.
- Browser check: badge and filter in the Scanner, warning in Log Flip, account picker default, account badge and filter.
