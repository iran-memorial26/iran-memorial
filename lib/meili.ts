/** Meilisearch client + index helpers.
 *
 *  Meili replaces the Postgres tsvector + pg_trgm fallback for victim search:
 *  - Native typo-tolerance (Persian/Arabic/German diacritics)
 *  - Sub-100ms response on 37k+ docs
 *  - Multi-locale ranking out of the box
 *
 *  The route handler in app/api/search/route.ts falls back to tsvector
 *  if MEILI_HOST is unset or the request times out — Meili is opt-in.
 */
import { Meilisearch, type Index } from "meilisearch";

export const VICTIMS_INDEX = "victims";

export interface VictimDoc {
  id: string;
  slug: string;
  nameLatin: string;
  nameFarsi: string | null;
  aliases: string[];
  occupationEn: string | null;
  occupationFa: string | null;
  occupationDe: string | null;
  placeOfDeath: string | null;
  cityNameEn: string | null;
  cityNameFa: string | null;
  cityNameDe: string | null;
  causeOfDeath: string | null;
  dateOfDeath: number | null; // unix seconds for filterable/sortable
  dateOfBirth: number | null;
  verificationStatus: string;
  hasPhoto: boolean;
}

let _client: Meilisearch | null = null;

export function getMeili(): Meilisearch | null {
  const host = process.env.MEILI_HOST;
  const key = process.env.MEILI_MASTER_KEY;
  if (!host || !key) return null;
  if (!_client) {
    _client = new Meilisearch({ host, apiKey: key });
  }
  return _client;
}

export function getVictimsIndex(): Index<VictimDoc> | null {
  const client = getMeili();
  return client ? client.index<VictimDoc>(VICTIMS_INDEX) : null;
}

/** Idempotent index setup — search/filter/sort attributes + ranking rules.
 *  Safe to call on every reindex. */
export async function ensureVictimsIndex(): Promise<void> {
  const client = getMeili();
  if (!client) throw new Error("MEILI_HOST/MEILI_MASTER_KEY not configured");

  await client.createIndex(VICTIMS_INDEX, { primaryKey: "id" }).catch(() => {
    // index already exists — fine
  });

  const index = client.index<VictimDoc>(VICTIMS_INDEX);

  await index.updateSearchableAttributes([
    "nameLatin",
    "nameFarsi",
    "aliases",
    "occupationEn",
    "occupationFa",
    "occupationDe",
    "cityNameEn",
    "cityNameFa",
    "cityNameDe",
    "placeOfDeath",
    "causeOfDeath",
  ]);

  await index.updateFilterableAttributes([
    "verificationStatus",
    "hasPhoto",
    "dateOfDeath",
  ]);

  await index.updateSortableAttributes(["dateOfDeath", "dateOfBirth"]);

  await index.updateRankingRules([
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
    "hasPhoto:desc",
    "dateOfDeath:desc",
  ]);

  // Persian + Arabic don't separate words by spaces the same way Latin does;
  // Meili 1.11 ships dedicated tokenizers when these stop-words are unset.
  await index.updateStopWords([]);
}
