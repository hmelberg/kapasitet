const queryText = (q) => (typeof q === "string" ? q : q ? JSON.stringify(q) : "");

/**
 * previous manifest ∪ static entries ∪ fresh results ∪ sub-kilder fra `defs`, sortert på id.
 * Ferske resultater overskriver; sub-kilder overskriver til slutt. En sub-kilde er en tabell
 * en fetcher stempler som `source_id` på radene (KOSTRA 11875, FHI nøkkel 699 …) og arver
 * lisens og last_fetched fra fetcheren sin egen oppføring.
 */
export function mergeManifest(previous, statics, results, { today, defs = [] }) {
  const byId = new Map();
  for (const s of previous?.sources ?? []) byId.set(s.id, s);
  for (const s of statics) byId.set(s.id, { last_fetched: "", ...s });
  for (const { def, result } of results) {
    const { id, navn, url, api_url, query, lisens } = def.meta;
    byId.set(id, { id, navn, url, api_url, query: queryText(query), lisens, last_fetched: today, tables_out: result.tables });
  }
  for (const def of defs) {
    const subs = def.meta.sub_sources;
    const parent = byId.get(def.meta.id);
    if (!Array.isArray(subs) || subs.length === 0 || !parent) continue;
    for (const s of subs) {
      byId.set(s.id, { id: s.id, navn: s.navn, url: s.url, api_url: s.api_url, query: "", lisens: parent.lisens, last_fetched: parent.last_fetched, tables_out: s.tables_out ?? parent.tables_out, parent: parent.id });
    }
  }
  return { generated: today, sources: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}
