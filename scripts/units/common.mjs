const RANK = { ekte: 0, avledet: 1, estimat: 2 };

/** Tom celle er ukjent, ikke 0 – Number("") === 0, så den fella må stenges eksplisitt. */
export const num = (v) => {
  const n = v === "" || v == null || String(v).trim() === "" ? NaN : Number(v);
  if (!Number.isFinite(n)) throw new Error(`Ikke et tall: "${v}"`);
  return n;
};
export const tall = (r) => ({ value: num(r.value), unit: r.unit, period: r.period, quality: r.quality, source_id: r.source_id });
export const byPeriod = (a, b) => a.period.localeCompare(b.period);

/** rows → nested object keyed by `keys`; leaf = Tall[] sorted by period, or a single Tall with `single` (throws on duplicates). */
export function nest(rows, keys, { single = false } = {}) {
  const root = {};
  for (const r of rows) {
    let node = root;
    for (const k of keys.slice(0, -1)) node = node[r[k]] ??= {};
    const leaf = r[keys[keys.length - 1]];
    if (single) {
      if (leaf in node) throw new Error(`Duplikat for ${keys.map((k) => r[k]).join("/")}`);
      node[leaf] = tall(r);
    } else (node[leaf] ??= []).push(tall(r));
  }
  if (!single) sortLeaves(root);
  return root;
}
function sortLeaves(n) { for (const v of Object.values(n)) Array.isArray(v) ? v.sort(byPeriod) : sortLeaves(v); }

/** Sum `value` over rows sharing `keys` (which must include `period`); quality = worst input. First-seen order. */
export function sumRows(rows, keys) {
  const acc = new Map();
  for (const r of rows) {
    const k = keys.map((c) => r[c]).join("|");
    if (!acc.has(k)) acc.set(k, { ...Object.fromEntries(keys.map((c) => [c, r[c]])), value: 0, unit: r.unit, period: r.period, quality: "ekte", source_id: r.source_id });
    const e = acc.get(k);
    e.value += num(r.value);
    if (RANK[r.quality] > RANK[e.quality]) e.quality = r.quality;
  }
  return [...acc.values()];
}

export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) { const k = typeof key === "function" ? key(r) : r[key]; (m.get(k) ?? m.set(k, []).get(k)).push(r); }
  return m;
}

/** {[code]: {navn, serie: Tall[]}} – used for årsverk, spesialister, kommunale indikatorer. */
export function seriesBlock(rows, codeCol, nameCol) {
  const out = {};
  for (const [code, list] of groupBy(rows, codeCol)) out[code] = { navn: list[0][nameCol], serie: list.map(tall).sort(byPeriod) };
  return out;
}

export const latestPeriod = (rows) => rows.reduce((m, r) => (r.period > m ? r.period : m), "");
export const unitId = (type, code) => `${type}:${code}`;
export const unitPath = (id) => { const [type, code] = id.split(":"); return `${type}/${code}.json`; };
export const ref = (type, code, navn) => ({ id: unitId(type, code), navn: navn ?? code });
export const sok = (...terms) => [...new Set(terms.filter(Boolean).map((t) => String(t).toLowerCase()))];

/** Patients per diagnosis for one region (rows from patients_by_diagnosis(.detail).csv filtered on region_id). */
export function patientsBlock(main, detail) {
  if (main.length === 0) return null;
  const siste = latestPeriod(main);
  const diagnoser = {};
  for (const r of [...main, ...detail]) diagnoser[r.diagnose_kode] = r.diagnose_navn;
  return {
    periode_siste: siste,
    diagnoser,
    tidsserie: nest(main.filter((r) => r.diagnose_kode === "_T" && r.aldersgruppe === "alle"), ["tjenesteomrade", "metric"]),
    siste_aar: nest(main.filter((r) => r.period === siste), ["tjenesteomrade", "diagnose_kode", "metric", "aldersgruppe"], { single: true }),
    undergrupper_siste_aar: nest(detail.filter((r) => r.aldersgruppe === "alle"), ["tjenesteomrade", "diagnose_kode", "metric"], { single: true }),
  };
}
