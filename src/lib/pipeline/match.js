/**
 * Matches merchant products to competitor listings, then labels each product's
 * price. Runs in scripts/match.mjs (the daily job, every product) and in the
 * background after a product is saved (just that product), never on a request.
 *
 * 1. Narrow without AI: titles are transliterated to Latin (feeds mix "Vereya"
 *    and "Верея"), tokenized and scored by shared tokens weighted by IDF over
 *    all listings, so rare words such as brands count most. Listings in another
 *    KZP category or with a different pack size are dropped.
 * 2. Ask Gemini about the remaining pairs, many per request, throttled, and
 *    resuming after rate limits. Every verdict, rejected ones too, is cached in
 *    `match_verdicts` per normalized product text, so no pair is judged twice
 *    and merchants selling the same product share verdicts. Rejected pairs that
 *    could still be the product (the merchant's text is too vague to be sure)
 *    are flagged `possible` and shown to the merchant as possible matches.
 * 3. Recompute `products.price_status` from confirmed matches and the listings
 *    the merchant linked by hand (`product_links`).
 *
 * Every limit is env config with free-tier defaults, so production (paid tier,
 * stronger model) is a config change.
 */

const env = (name, fallback) => process.env[name] || fallback;

export const matchConfig = () => ({
  model: env('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
  rpm: Number(env('GEMINI_RPM', 10)),
  pairsPerRequest: Number(env('MATCH_PAIRS_PER_REQUEST', 60)),
  maxRequests: Number(env('MATCH_MAX_REQUESTS', Infinity)),
  candidatesPerChain: Number(env('MATCH_CANDIDATES_PER_CHAIN', 3)),
  minScore: Number(env('MATCH_MIN_SCORE', 0.35)),
  minConfidence: Number(env('MATCH_MIN_CONFIDENCE', 0.7)),
  priceTolerance: Number(env('MATCH_PRICE_TOLERANCE', 0.03)),
  // Listings not seen by a scrape for this long count as delisted.
  activeDays: Number(env('MATCH_ACTIVE_DAYS', 7)),
});

// ---------------------------------------------------------------------------
// Text normalization (pure)
// ---------------------------------------------------------------------------

const CYRILLIC = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
};

/** Lowercase Latin text with decimal commas as dots. */
export function translit(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[а-я]/g, (c) => CYRILLIC[c])
    .replace(/(\d),(\d)/g, '$1.$2');
}

const UNITS = { kg: ['g', 1000], gr: ['g', 1], g: ['g', 1], l: ['ml', 1000], lt: ['ml', 1000], ml: ['ml', 1], br: ['pcs', 1], pcs: ['pcs', 1] };
const SIZE = /(?:(\d+)\s*[xh*]\s*)?(\d+(?:\.\d+)?)\s*(kg|gr|g|ml|lt|l|br|pcs)\b/;

/** First pack size in translit text, e.g. "6x1.5l" -> { unit: 'ml', amount: 9000 }. */
export function parseSize(text) {
  const m = SIZE.exec(text);
  if (!m) return null;
  const [unit, factor] = UNITS[m[3]];
  return { unit, amount: Math.round(Number(m[1] ?? 1) * Number(m[2]) * factor) };
}

/** Tokens and pack size of a title. Size tokens are removed, "3%" is kept. */
export function analyze(text) {
  const t = translit(text);
  const size = parseSize(t);
  const tokens = new Set(
    t.replace(new RegExp(SIZE, 'g'), ' ')
      .split(/[^a-z0-9%.]+/)
      .map((w) => w.replace(/^\.+|\.+$/g, ''))
      .filter((w) => w.length > 1 || /\d/.test(w)),
  );
  return { tokens, size };
}

/** Cache key for verdicts: same text in any word order or script -> same key. */
export function matchKey({ name, brand, size }) {
  const { tokens, size: pack } = analyze([name, brand, size].filter(Boolean).join(' '));
  return [...tokens].sort().join(' ') + (pack ? ` |${pack.amount}${pack.unit}` : '');
}

const sameSize = (a, b) => !a || !b || (a.unit === b.unit && a.amount === b.amount);

// ---------------------------------------------------------------------------
// Candidate narrowing (pure)
// ---------------------------------------------------------------------------

/**
 * Inverted token index with IDF weights over `listings`.
 * ponytail: in memory, fine to a few hundred thousand listings; past that, move
 * narrowing into Postgres (full-text or pg_trgm).
 */
export function buildIndex(listings) {
  const docs = listings.map((l) => ({ listing: l, ...analyze(l.title) }));
  const postings = new Map();
  for (const [i, d] of docs.entries()) {
    for (const t of d.tokens) {
      if (!postings.has(t)) postings.set(t, []);
      postings.get(t).push(i);
    }
  }
  const n = docs.length;
  const idf = (t) => Math.log((n + 1) / ((postings.get(t)?.length ?? 0) + 0.5));
  return { docs, postings, idf };
}

/**
 * The best listings per chain for a product: share of the product's IDF weight
 * found in the title, at least `minScore` and at least 60% of that chain's best.
 */
export function findCandidates(product, index, { candidatesPerChain, minScore }) {
  const { tokens, size } = analyze([product.name, product.brand, product.size].filter(Boolean).join(' '));
  let total = 0;
  const scores = new Map();
  for (const t of tokens) {
    const w = index.idf(t);
    total += w;
    for (const i of index.postings.get(t) ?? []) scores.set(i, (scores.get(i) ?? 0) + w);
  }

  const byChain = new Map();
  for (const [i, raw] of scores) {
    const { listing, size: listingSize } = index.docs[i];
    const score = raw / total;
    if (score < minScore || !sameSize(size, listingSize)) continue;
    if (product.category_code && listing.category_code && product.category_code !== listing.category_code) continue;
    if (!byChain.has(listing.competitor_key)) byChain.set(listing.competitor_key, []);
    byChain.get(listing.competitor_key).push({ listing, score });
  }

  return [...byChain.values()].flatMap((list) => {
    list.sort((a, b) => b.score - a.score);
    return list.filter((c) => c.score >= list[0].score * 0.6).slice(0, candidatesPerChain);
  });
}

/** Merchant price vs the cheapest confirmed competitor price. */
export function priceStatus(price, competitorPrices, tolerance) {
  if (competitorPrices.length === 0) return 'unmatched';
  const cheapest = Math.min(...competitorPrices);
  if (price > cheapest * (1 + tolerance)) return 'at-risk';
  if (price < cheapest * (1 - tolerance)) return 'opportunity';
  return 'competitive';
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

/** Gemini can't take more work now (daily quota, or overloaded); resume next run. */
export class GeminiUnavailable extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROMPT = `You match grocery products between a merchant's catalog and competitor price lists in Bulgaria.
For each pair, decide whether the competitor listing is the SAME product the merchant sells, so their prices can be compared.
Same means: same brand (or both unbranded/private label of the same kind), same variant (flavor, fat %, type) and same pack size.
Titles may be in Cyrillic or Latin, abbreviated, truncated or in a different word order; that alone is not a difference.
A different brand, a different variant or a different pack size is NOT the same product.
When not the same, set similar to true only if the listing could still be the merchant's product and it is
unclear only because a text leaves out a detail (e.g. no fat %, flavor or pack size); a stated difference is not similar.
Return one result per pair id: same (boolean), similar (boolean), confidence 0..1 and a reason of at most 8 words.`;

const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      id: { type: 'INTEGER' },
      same: { type: 'BOOLEAN' },
      similar: { type: 'BOOLEAN' },
      confidence: { type: 'NUMBER' },
      reason: { type: 'STRING' },
    },
    required: ['id', 'same', 'similar', 'confidence', 'reason'],
  },
};

/**
 * One throttled Gemini client per run. Waits out per-minute limits using the
 * server's retry delay and retries overload errors; throws GeminiUnavailable on
 * a daily limit or a lasting outage, so the run stops and the next resumes.
 */
export function createGemini({ model, rpm }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY must be set');
  const gap = 60_000 / rpm;
  let last = 0;

  return async function judge(pairs) {
    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${PROMPT}\n\nPairs:\n${JSON.stringify(pairs)}` }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
    });

    for (let attempt = 1; ; attempt++) {
      await sleep(Math.max(0, last + gap - Date.now()));
      last = Date.now();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body,
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
        return JSON.parse(text || '[]');
      }

      const details = json.error?.details ?? [];
      if (res.status === 429) {
        const daily = details.some((d) => d.violations?.some((v) => /PerDay/i.test(v.quotaId ?? '')));
        if (daily || attempt > 5) throw new GeminiUnavailable(json.error?.message ?? 'Gemini quota exhausted');
        const delay = details.find((d) => d.retryDelay)?.retryDelay;
        await sleep((Number.parseFloat(delay) || 60) * 1000);
      } else if (res.status >= 500) {
        if (attempt > 3) throw new GeminiUnavailable(`${res.status}: ${json.error?.message ?? res.statusText}`);
        await sleep(5000 * 2 ** attempt);
      } else {
        throw new Error(`Gemini ${res.status}: ${json.error?.message ?? res.statusText}`);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const PAGE = 1000;
const CHUNK = 200;

const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/** All rows of an ordered query, page by page. */
async function loadAll(query) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/**
 * Matches every product, or only `productIds`, (service-role client) and
 * refreshes their price statuses. `judge` defaults to a Gemini client; pass a
 * fake to run without AI.
 */
export async function runMatch(supabase, { config = matchConfig(), judge, log = console.log, productIds } = {}) {
  const since = new Date(Date.now() - config.activeDays * 864e5).toISOString();
  const listings = await loadAll(() =>
    supabase.from('competitor_listings').select('id, competitor_key, title, category_code, price').gte('captured_at', since).order('id'),
  );
  const products = await loadAll(() => {
    const q = supabase.from('products').select('id, name, brand, size, category_code, price, match_key, price_status');
    return (productIds ? q.in('id', productIds) : q).order('id');
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  log(`${products.length} products, ${listings.length} active listings`);

  const index = buildIndex(listings);
  const activeById = new Map(listings.map((l) => [l.id, l]));

  // One entry per distinct match key; products that share a key share verdicts.
  const byKey = new Map();
  for (const p of products) {
    const key = matchKey(p);
    if (!byKey.has(key)) byKey.set(key, { product: p, ids: [] });
    byKey.get(key).ids.push(p.id);
  }

  for (const [key, { ids }] of byKey) {
    const stale = ids.filter((id) => productById.get(id).match_key !== key);
    for (const part of chunks(stale, CHUNK)) {
      const { error } = await supabase.from('products').update({ match_key: key }).in('id', part);
      if (error) throw error;
    }
  }

  const verdicts = new Map([...byKey.keys()].map((k) => [k, new Map()]));
  for (const part of chunks([...byKey.keys()], 50)) {
    const rows = await loadAll(() =>
      supabase.from('match_verdicts').select('match_key, listing_id, confirmed, possible').in('match_key', part)
        .order('match_key').order('listing_id'),
    );
    for (const v of rows) verdicts.get(v.match_key).set(v.listing_id, v);
  }

  // Listings merchants linked by hand, per product.
  const links = new Map();
  for (const part of chunks(products.map((p) => p.id), CHUNK)) {
    const rows = await loadAll(() =>
      supabase.from('product_links').select('product_id, listing_id').in('product_id', part).order('product_id').order('listing_id'),
    );
    for (const l of rows) links.set(l.product_id, [...(links.get(l.product_id) ?? []), l.listing_id]);
  }

  // Pairs no one has judged yet, and rejections from before `possible` existed.
  const pending = [];
  for (const [key, { product }] of byKey) {
    for (const { listing } of findCandidates(product, index, config)) {
      const v = verdicts.get(key).get(listing.id);
      if (!v || (!v.confirmed && v.possible == null)) pending.push({ key, product, listing });
    }
  }
  log(`${byKey.size} distinct products, ${pending.length} pairs to judge`);

  let requests = 0;
  let judged = 0;
  let stopped = null;
  if (pending.length) judge ??= createGemini(config);
  for (const batch of chunks(pending, config.pairsPerRequest)) {
    if (requests >= config.maxRequests) {
      stopped = `MATCH_MAX_REQUESTS (${config.maxRequests}) reached`;
      break;
    }
    requests++;
    let results;
    try {
      results = await judge(
        batch.map((p, id) => ({
          id,
          merchant: [p.product.name, p.product.brand, p.product.size].filter(Boolean).join(' '),
          competitor: p.listing.title,
        })),
      );
    } catch (error) {
      if (!(error instanceof GeminiUnavailable)) throw error;
      stopped = `Gemini unavailable: ${error.message}`;
      break;
    }

    const rows = results
      .filter((r) => batch[r.id])
      .map((r) => {
        const { key, listing } = batch[r.id];
        const confidence = Math.min(1, Math.max(0, Number(r.confidence) || 0));
        const confirmed = Boolean(r.same) && confidence >= config.minConfidence;
        return {
          match_key: key,
          listing_id: listing.id,
          confirmed,
          // A low-confidence "same" is a possible match too.
          possible: !confirmed && (Boolean(r.similar) || Boolean(r.same)),
          confidence,
          reason: String(r.reason ?? '').slice(0, 200),
          model: config.model,
        };
      });
    // Unanswered pairs stay pending and are asked again next run.
    const { error } = await supabase.from('match_verdicts').upsert(rows, { onConflict: 'match_key,listing_id' });
    if (error) throw error;
    for (const r of rows) verdicts.get(r.match_key).set(r.listing_id, r);
    judged += rows.length;
    log(`request ${requests}: ${rows.filter((r) => r.confirmed).length}/${rows.length} confirmed`);
  }

  // Price statuses from confirmed or linked, still-listed matches.
  const changes = new Map();
  const counts = {};
  for (const [key, { ids }] of byKey) {
    const confirmed = [...verdicts.get(key).values()].filter((v) => v.confirmed).map((v) => v.listing_id);
    for (const id of ids) {
      const p = productById.get(id);
      const prices = [...new Set([...confirmed, ...(links.get(id) ?? [])])]
        .filter((listingId) => activeById.has(listingId))
        .map((listingId) => Number(activeById.get(listingId).price));
      const status = priceStatus(Number(p.price), prices, config.priceTolerance);
      counts[status] = (counts[status] ?? 0) + 1;
      if (status !== p.price_status) {
        if (!changes.has(status)) changes.set(status, []);
        changes.get(status).push(id);
      }
    }
  }
  for (const [status, ids] of changes) {
    for (const part of chunks(ids, CHUNK)) {
      const { error } = await supabase.from('products').update({ price_status: status }).in('id', part);
      if (error) throw error;
    }
  }

  return { products: products.length, pending: pending.length, judged, requests, stopped, counts };
}
