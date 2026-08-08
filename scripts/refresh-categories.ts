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
 * ponytail: sequential with a fixed delay rather than a concurrency pool. It is a
 * once-a-month script and Jagex's catalogue is not a service worth hammering; if it ever
 * needs to be fast, batch the letter buckets.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const UA = { "User-Agent": "RS3FlipTracker/2.0 (bjimenez@virtualsyncsolutions.com)" };
const BASE = "https://secure.runescape.com/m=itemdb_rs/api/catalogue";
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const PAGE_SIZE = 12;
const DELAY_MS = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, attempts = 3): Promise<any | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.ok) return await res.json();
      // The catalogue returns 404 for empty category/letter pairs, which is not an error.
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await sleep(DELAY_MS * (i + 2));
  }
  return null;
}

const categories: Record<string, string> = {};
const seenTypes = new Set<string>();
let requests = 0;

for (let category = 0; category < 45; category++) {
  const summary = await getJson(`${BASE}/category.json?category=${category}`);
  requests++;
  await sleep(DELAY_MS);
  if (!summary?.alpha) continue;

  const counts = new Map<string, number>();
  for (const bucket of summary.alpha as Array<{ letter: string; items: number }>) {
    if (bucket.items > 0 && LETTERS.includes(bucket.letter)) counts.set(bucket.letter, bucket.items);
  }
  if (counts.size === 0) continue;

  for (const [letter, count] of Array.from(counts.entries())) {
    const pages = Math.ceil(count / PAGE_SIZE);
    for (let page = 1; page <= pages; page++) {
      const data = await getJson(`${BASE}/items.json?category=${category}&alpha=${letter}&page=${page}`);
      requests++;
      await sleep(DELAY_MS);
      for (const item of data?.items ?? []) {
        if (typeof item?.id === "number" && typeof item?.type === "string") {
          categories[String(item.id)] = item.type;
          seenTypes.add(item.type);
        }
      }
    }
  }
  const done = Object.keys(categories).length;
  console.log(`category ${String(category).padStart(2)} -> ${done} items mapped (${requests} requests)`);
}

const out = join(import.meta.dirname, "..", "shared", "itemCategories.json");
// Sorted keys so a refresh produces a readable diff instead of a reshuffled blob.
const sorted: Record<string, string> = {};
for (const id of Object.keys(categories).sort((a, b) => Number(a) - Number(b))) sorted[id] = categories[id];
writeFileSync(out, JSON.stringify(sorted, null, 0) + "\n");

console.log(
  `\nwrote ${Object.keys(sorted).length} items across ${seenTypes.size} categories in ${requests} requests`,
);
console.log(Array.from(seenTypes).sort().join(" · "));
