import { getJson, postJson } from "./http.mjs";
import { jsonStatToRows } from "./jsonstat.mjs";

export const SSB_BASE = "https://data.ssb.no/api/v0/no/table";

export const item = (code, values) => ({ code, selection: { filter: "item", values } });
export const all = (code) => ({ code, selection: { filter: "all", values: ["*"] } });

/** GET metadata: {title, variables:[{code, text, values, valueTexts, elimination}]} */
export async function ssbMetadata(tableId, opts = {}) {
  return getJson(`${SSB_BASE}/${tableId}`, opts);
}

/** POST a query, returns a json-stat2 dataset. */
export async function ssbQuery(tableId, query, opts = {}) {
  return postJson(`${SSB_BASE}/${tableId}`, { query, response: { format: "json-stat2" } }, opts);
}

/**
 * One request per value of `chunkDim` (must be an item selection), rows concatenated.
 * Keeps each request under SSB's 800 000-cell limit.
 */
export async function ssbQueryChunked(tableId, query, chunkDim, opts = {}) {
  const dim = query.find((q) => q.code === chunkDim);
  if (!dim || dim.selection.filter !== "item") {
    throw new Error(`ssbQueryChunked ${tableId}: ${chunkDim} må være en item-seleksjon`);
  }
  const rows = [];
  const datasets = [];
  for (const v of dim.selection.values) {
    const q = query.map((x) => (x.code === chunkDim ? item(chunkDim, [v]) : x));
    const ds = await ssbQuery(tableId, q, opts);
    datasets.push(ds);
    rows.push(...jsonStatToRows(ds));
  }
  return { rows, datasets };
}

/** Values of one dimension from metadata, e.g. all years. */
export function metadataValues(metadata, code) {
  const v = metadata.variables.find((x) => x.code === code);
  if (!v) throw new Error(`SSB-metadata mangler dimensjonen ${code}`);
  return { values: v.values, labels: Object.fromEntries(v.values.map((c, i) => [c, v.valueTexts[i]])) };
}
