/**
 * Rebuilds shared/itemCategories.json from Jagex's own GE catalogue.
 * Run: npx tsx scripts/refresh-categories.ts
 *
 * The wiki mapping carries no category field — its keys are exactly
 * examine, highalch, icon, id, limit, lowalch, members, name, value — so the only
 * authoritative taxonomy is the official catalogue, and it is paginated twelve items to a
 * page across 45 categories and 26 letter buckets. That is ~590 requests, which is fine
 * once into a committed file and unthinkable at runtime.
 *
 * Re-run when Jagex ships items. Nothing breaks if it goes stale: unlisted items fall into
 * "Uncategorised" and stay filterable, they just sit in the catch-all until this runs again.
 *
 * Page fetches run through a small fixed pool. Sequential took ~90 minutes, most of it spent
 * idling on retries rather than on Jagex's behalf; measured spacing from 120ms to 1500ms
 * changed the failure rate not at all, so the politeness of going slowly bought nothing real.
 * CONCURRENCY stays small for the same reason it exists — this is a once-a-month script
 * against someone else's server, not a race.
 *
 * THE ENDPOINT LIES. Roughly half of all items.json responses come back HTTP 200 with a
 * completely empty body, at every request spacing from 120ms to 1500ms — measured, not
 * guessed, so this is flakiness rather than throttling and slowing down does not help. A
 * first cut of this script checked `res.ok`, let res.json() throw into a bare catch, and gave
 * up after three quick attempts. It reported success having silently lost 4,234 of 7,322
 * items. Hence: an empty body is a retry, never a result, and the run fails loudly rather
 * than writing a file that looks complete.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const UA = { "User-Agent": "RS3FlipTracker/2.0 (bjimenez@virtualsyncsolutions.com)" };
const BASE = "https://secure.runescape.com/m=itemdb_rs/api/catalogue";
/** "#" is the catalogue's bucket for names starting with a digit or punctuation — 27 items
 *  across three categories, all of which an a-z-only list silently drops. */
const LETTERS = ["#", ..."abcdefghijklmnopqrstuvwxyz".split("")];
const PAGE_SIZE = 12;
const DELAY_MS = 120;
/**
 * Measured success rate swings between ~20% and ~50% per attempt, so no fixed attempt count
 * is safe on its own: a first pass at 10 attempts still lost 5 pages out of ~1100, and all
 * five turned out to be perfectly serveable — they just lost ten coin flips in a row. Keep
 * the per-page budget modest and let the sweep below mop up the unlucky ones, rather than
 * paying a high attempt count on every page to insure against a handful.
 */
const ATTEMPTS = 10;
/** Sweeps over whatever the main pass failed to fetch. */
const SWEEPS = 6;
/**
 * Pages fetched at once. Measured against a single letter bucket, 24 requests per setting:
 *
 *   concurrency 1 -> 17% served, 20.0s     concurrency 3 -> 4% served, 7.6s
 *   concurrency 2 -> 13% served, 10.9s     concurrency 6 -> 4% served, 4.3s
 *
 * Parallelism buys wall-clock and pays for it in throttling, so past 2 it is self-defeating —
 * the pages still have to be fetched, just more times. Note the absolute numbers: an earlier
 * measurement the same day put a single sequential stream near 50%, so the catalogue's mood
 * varies by the hour and a run that crawls today may fly tomorrow. Re-measure before assuming
 * a different setting is better.
 */
const CONCURRENCY = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs `worker` over `items`, at most CONCURRENCY at a time, preserving nothing but effects. */
async function pooled<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
      await sleep(DELAY_MS);
    }
  });
  await Promise.all(runners);
}

/** null means "the catalogue genuinely has nothing here" (404). A throw means we gave up. */
async function getJson(url: string): Promise<any | null> {
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 404) return null;
      if (res.ok) {
        const text = await res.text();
        if (text.trim() !== "") return JSON.parse(text);
      }
    } catch {
      /* fall through to retry */
    }
    // Capped: an uncapped ramp spends most of a doomed page's budget asleep, and the empty
    // bodies are flakiness rather than rate limiting, so waiting longer does not help.
    await sleep(Math.min(DELAY_MS * (i + 2), 1_000));
  }
  throw new Error(`gave up after ${ATTEMPTS} attempts: ${url}`);
}

const categories: Record<string, string> = {};
const seenTypes = new Set<string>();
/** Pages the main pass could not fetch, retried by the sweep below. */
const failures: Array<{ key: string; url: string }> = [];
let requests = 0;
/** What the per-letter summaries promised, so a short crawl is detectable rather than assumed. */
let expected = 0;
/** Rows for an id already seen — see absorb(). */
let duplicates = 0;
/**
 * Buckets whose row count disagrees with what the summary advertised, in either direction.
 * Category 0 claims 13 items under "#" and serves zero on every page across 30 attempts;
 * other buckets serve *more* than they claim. Both are the same stale counter upstream, and
 * neither is data we dropped, so both are reported rather than fatal. A page we could not
 * fetch at all is the fatal case, and that is `failures`.
 */
const mismatches: Array<{ category: number; letter: string; claimed: number; served: number }> = [];
/** Per-bucket tallies keyed "category|letter", reconciled after the sweeps rather than during
 *  the main pass — a page recovered by a sweep must retire the shortfall it caused. */
const claimedByBucket = new Map<string, number>();
const servedByBucket = new Map<string, number>();

/**
 * Returns the number of rows taken, so each bucket can be checked against what the summary
 * advertised.
 *
 * ponytail: last category wins for an item listed in several. The scanner shows one category
 * per row and the catalogue offers no primary; if that ever needs to be deterministic, sort
 * the candidates rather than relying on insertion order.
 */
function absorb(data: any): number {
  let rows = 0;
  for (const item of data?.items ?? []) {
    if (typeof item?.id === "number" && typeof item?.type === "string") {
      if (categories[String(item.id)] !== undefined) duplicates++;
      categories[String(item.id)] = item.type;
      seenTypes.add(item.type);
      rows++;
    }
  }
  return rows;
}

for (let category = 0; category < 45; category++) {
  let summary: any;
  try {
    summary = await getJson(`${BASE}/category.json?category=${category}`);
  } catch (err) {
    // A lost summary loses a whole category, and there is no page list to sweep. Stop.
    console.error(`\nFATAL: could not read the summary for category ${category}.\n  ${err}`);
    process.exit(1);
  }
  requests++;
  await sleep(DELAY_MS);
  if (!summary?.alpha) continue;

  const counts = new Map<string, number>();
  for (const bucket of summary.alpha as Array<{ letter: string; items: number }>) {
    if (bucket.items > 0 && LETTERS.includes(bucket.letter)) counts.set(bucket.letter, bucket.items);
  }
  if (counts.size === 0) continue;

  // Every page of every letter in this category, fetched through one pool. Doing it per
  // letter would idle the pool on each short bucket.
  const jobs: Array<{ key: string; url: string }> = [];
  for (const [letter, count] of Array.from(counts.entries())) {
    expected += count;
    const key = `${category}|${letter}`;
    claimedByBucket.set(key, count);
    for (let page = 1; page <= Math.ceil(count / PAGE_SIZE); page++) {
      // encodeURIComponent matters for "#", which would otherwise truncate the URL as a fragment.
      jobs.push({
        key,
        url: `${BASE}/items.json?category=${category}&alpha=${encodeURIComponent(letter)}&page=${page}`,
      });
    }
  }

  await pooled(jobs, async ({ key, url }) => {
    requests++;
    try {
      // absorb() mutates shared state, but only ever after its await resolves, and JS runs
      // that continuation to completion — so the pool cannot interleave two absorbs.
      const rows = absorb(await getJson(url));
      servedByBucket.set(key, (servedByBucket.get(key) ?? 0) + rows);
    } catch {
      failures.push({ key, url });
    }
  });
  const done = Object.keys(categories).length;
  console.log(
    `category ${String(category).padStart(2)} -> ${done}/${expected} items (${requests} requests, ${failures.length} lost)`,
  );
}

// Mop up the unlucky pages. Every failure from the first pass at 10 attempts turned out to be
// serveable on a later try, so sweeping converges where a bigger per-page budget only spends
// more time on the 99% that never needed it.
for (let sweep = 1; sweep <= SWEEPS && failures.length > 0; sweep++) {
  const remaining = failures.splice(0, failures.length);
  console.log(`sweep ${sweep}: retrying ${remaining.length} lost page(s)`);
  await pooled(remaining, async ({ key, url }) => {
    requests++;
    try {
      servedByBucket.set(key, (servedByBucket.get(key) ?? 0) + absorb(await getJson(url)));
    } catch {
      failures.push({ key, url });
    }
  });
}

// Only now are the tallies final: a page recovered by a sweep must not leave behind the
// shortfall it caused during the main pass.
for (const [key, claimed] of Array.from(claimedByBucket.entries())) {
  const served = servedByBucket.get(key) ?? 0;
  if (served !== claimed) {
    const [category, letter] = key.split("|");
    mismatches.push({ category: Number(category), letter, claimed, served });
  }
}

const got = Object.keys(categories).length;
const phantom = mismatches.reduce((s, x) => s + Math.max(0, x.claimed - x.served), 0);
const extra = mismatches.reduce((s, x) => s + Math.max(0, x.served - x.claimed), 0);

/**
 * The only thing that means we lost data is a page we could not fetch. An earlier version of
 * this gate also required `got + duplicates + phantom === expected`, on the theory that every
 * advertised row must end up stored, repeated, or unserved. That identity is not sound: it
 * assumes the alpha counters only ever over-count. A clean run — 0 pages lost, 0 duplicates —
 * failed it by 36 rows because buckets on the other side of the ledger served *more* than they
 * advertised, and the identity had no term for that. With `extra` counted the equation is true
 * by construction and so checks nothing; the honest check is `failures`, and the two counters
 * below are reported for eyeballing rather than enforced.
 */
if (failures.length > 0) {
  console.error(
    `\nINCOMPLETE: ${failures.length} page(s) could not be fetched after ${SWEEPS} sweeps.\n` +
      `Not writing the file — a partial map would quietly file real items under "Uncategorised".`,
  );
  for (const f of failures) console.error(`  ${f.url}`);
  process.exit(1);
}

for (const m of mismatches) {
  const verb = m.served < m.claimed ? "serves only" : "serves";
  console.warn(
    `note: category ${m.category} bucket "${m.letter}" advertises ${m.claimed} but ${verb} ${m.served} — stale counter upstream`,
  );
}

const out = join(import.meta.dirname, "..", "shared", "itemCategories.json");
// Sorted keys so a refresh produces a readable diff instead of a reshuffled blob.
const sorted: Record<string, string> = {};
for (const id of Object.keys(categories).sort((a, b) => Number(a) - Number(b))) sorted[id] = categories[id];
writeFileSync(out, JSON.stringify(sorted, null, 0) + "\n");

console.log(
  `\nwrote ${got} items across ${seenTypes.size} categories in ${requests} requests ` +
    `(${expected} rows advertised, ${duplicates} repeats, ${phantom} advertised but never served, ` +
    `${extra} served but never advertised)`,
);
console.log(Array.from(seenTypes).sort().join(" · "));
