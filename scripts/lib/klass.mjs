import { getJson } from "./http.mjs";

export const KLASS_BASE = "https://data.ssb.no/api/klass/v1";

export async function klassCodes(classificationId, { from = "2025-01-01", to = "2025-01-02", level, ...opts } = {}) {
  const lvl = level ? `&selectLevel=${level}` : "";
  const data = await getJson(`${KLASS_BASE}/classifications/${classificationId}/codes?from=${from}&to=${to}${lvl}`, opts);
  return data.codes.map(({ code, parentCode, level: l, name }) => ({ code, parentCode: parentCode ?? null, level: Number(l), name }));
}

export async function klassCorrespondence(tableId, opts = {}) {
  const data = await getJson(`${KLASS_BASE}/correspondencetables/${tableId}`, opts);
  return data.correspondenceMaps.map(({ sourceCode, sourceName, targetCode, targetName }) => ({ sourceCode, sourceName, targetCode, targetName }));
}
