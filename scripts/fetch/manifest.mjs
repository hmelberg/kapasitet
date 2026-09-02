const queryText = (q) => (typeof q === "string" ? q : q ? JSON.stringify(q) : "");

/** previous manifest ∪ static entries ∪ fresh results, sorted by id; fresh results overwrite. */
export function mergeManifest(previous, statics, results, { today }) {
  const byId = new Map();
  for (const s of previous?.sources ?? []) byId.set(s.id, s);
  for (const s of statics) byId.set(s.id, { last_fetched: "", ...s });
  for (const { def, result } of results) {
    const { id, navn, url, api_url, query, lisens } = def.meta;
    byId.set(id, { id, navn, url, api_url, query: queryText(query), lisens, last_fetched: today, tables_out: result.tables });
  }
  return { generated: today, sources: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}
