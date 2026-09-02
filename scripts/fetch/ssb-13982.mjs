import { ssbMetadata, metadataValues, ssbQueryChunked, all, item } from "../lib/ssb.mjs";
import { AGE_GROUPS, ageGroup } from "../lib/age.mjs";
import { isOrgNr, stripPeriodSuffix } from "../lib/regions.mjs";

export function areaType(code) {
  if (code.startsWith("S")) return "lokalsykehus";
  if (code.startsWith("D")) return "dps";
  if (isOrgNr(code)) return "hf";
  if (code === "H00") return "land";
  if (code.startsWith("H")) return "helseregion";
  throw new Error(`[ssb_13982] Ukjent HelseReg-kode "${code}" i SSB 13982`);
}

/** Sum single-year rows into AGE_GROUPS + "alle" per (area, tjenesteomrade, year). */
export function aggregateAges(rows, { key, name, extra }) {
  const acc = new Map();
  for (const r of rows) {
    const k = [key(r), extra(r), r.Tid].join("|");
    if (!acc.has(k)) acc.set(k, { id: key(r), navn: name(r), extra: extra(r), period: r.Tid, groups: Object.fromEntries([...AGE_GROUPS, "alle"].map((g) => [g, 0])) });
    const e = acc.get(k);
    e.groups[ageGroup(r.Alder)] += r.value;
    e.groups.alle += r.value;
  }
  return [...acc.values()];
}

export function transform13982({ rows }) {
  const out = [];
  for (const e of aggregateAges(rows, { key: (r) => r.HelseReg, name: (r) => stripPeriodSuffix(r.HelseReg_label), extra: (r) => r.HelseTjenomr })) {
    if (e.groups.alle === 0) continue; // retired or not-yet-created area-code for this period (e.g. S26/S27 post-2025, S50 pre-2025) – not a real zero population
    for (const g of [...AGE_GROUPS, "alle"]) {
      if (g !== "alle" && e.groups[g] === 0) continue;
      out.push({ omrade_id: e.id, omrade_navn: e.navn, omrade_type: areaType(e.id), tjenesteomrade: e.extra, aldersgruppe: g, period: e.period, value: e.groups[g], unit: "personer", source_id: "ssb_13982", quality: "ekte" });
    }
  }
  return { "catchment_population.csv": out };
}

const def = {
  meta: {
    id: "ssb_13982",
    navn: "SSB 13982 Befolkning i opptaksområder for helseforetak, etter tjenesteområde og alder",
    url: "https://www.ssb.no/statbank/table/13982",
    api_url: "https://data.ssb.no/api/v0/no/table/13982",
    lisens: "NLOD 2.0",
    query: "HelseReg=*, HelseTjenomr=*, Kjonn=0, Alder=*, Tid=<alle år fra metadata, én forespørsel per år>",
  },
  async fetchRaw(deps) {
    const meta = await ssbMetadata("13982", deps);
    const years = metadataValues(meta, "Tid").values;
    const query = [all("HelseReg"), all("HelseTjenomr"), item("Kjonn", ["0"]), all("Alder"), item("Tid", years)];
    const { rows } = await ssbQueryChunked("13982", query, "Tid", deps);
    return { rows };
  },
  transform: transform13982,
  columns: { "catchment_population.csv": ["omrade_id", "omrade_navn", "omrade_type", "tjenesteomrade", "aldersgruppe", "period", "value", "unit", "source_id", "quality"] },
};
export default def;
