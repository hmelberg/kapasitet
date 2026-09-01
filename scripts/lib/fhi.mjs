import { postJson } from "./http.mjs";

export const FHI_BASE = "https://statistikk-data.fhi.no/api/open/v1";

export const fhiItem = (code, values) => ({ code, filter: "item", values });
export const fhiAll = (code) => ({ code, filter: "all", values: ["*"] });

/** POST {source}/Table/{id}/data, returns a json-stat2 dataset (BOM is stripped by http.mjs). */
export async function fhiQuery(source, tableId, dimensions, { maxRowCount = 500_000, ...opts } = {}) {
  return postJson(`${FHI_BASE}/${source}/Table/${tableId}/data`, { dimensions, response: { format: "json-stat2", maxRowCount } }, opts);
}
