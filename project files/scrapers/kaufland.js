import { fetchText, upsertListings } from './shared.js';

const OFFERS_URL = 'https://www.kaufland.bg/aktualni-predlozheniya/oferti.html';

export const competitorKey = 'kaufland';

// Kaufland's offers page server-renders its data as
// `window.SSR['<uuid>'] = {...}` blobs. Find each one and extract the balanced
// JSON object that follows it (a regex can't safely handle the nested braces
// and quoted strings inside).
function extractOfferTemplates(html) {
  const results = [];
  const marker = "window.SSR['";
  let searchFrom = 0;

  while (true) {
    const markerIndex = html.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;
    const eqIndex = html.indexOf('= {', markerIndex);
    if (eqIndex === -1) break;

    const jsonStart = eqIndex + 2; // index of the opening '{'
    const jsonText = extractBalancedJson(html, jsonStart);
    searchFrom = jsonStart + jsonText.length;

    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.component === 'OfferTemplate' && parsed.props?.offerData) {
        results.push(parsed.props.offerData);
      }
    } catch {
      // Not a parseable JSON object at this position; skip it.
    }
  }

  return results;
}

function extractBalancedJson(str, startIndex) {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < str.length; i++) {
    const ch = str[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return str.slice(startIndex, i + 1);
    }
  }

  throw new Error('Unbalanced JSON in SSR blob');
}

function normalizeOffers(offerDataList) {
  const rows = [];
  for (const offerData of offerDataList) {
    for (const cycle of offerData.cycles ?? []) {
      for (const category of cycle.categories ?? []) {
        for (const offer of category.offers ?? []) {
          const title = [offer.title, offer.subtitle]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (!title || typeof offer.price !== 'number') continue;

          rows.push({
            external_id: offer.offerId,
            title: offer.unit ? `${title} (${offer.unit})` : title,
            price: offer.price,
            // OFFERS_URL is Kaufland's own promotions/offers page, not a full
            // catalog feed — everything scraped from it is, by definition, on
            // promotion (unlike the KZP-fed competitors, this source has no
            // separate "regular price" to compare against).
            on_promo: true,
            url: OFFERS_URL,
          });
        }
      }
    }
  }

  return rows;
}

export async function scrape(supabase) {
  const html = await fetchText(OFFERS_URL);

  const offerTemplates = extractOfferTemplates(html);
  if (offerTemplates.length === 0) {
    throw new Error(
      'No OfferTemplate SSR data found — Kaufland may have changed their page structure',
    );
  }

  const rows = normalizeOffers(offerTemplates);
  return upsertListings(supabase, competitorKey, rows);
}
