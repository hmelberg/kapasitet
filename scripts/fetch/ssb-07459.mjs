import { ssbMetadata, metadataValues, ssbQueryChunked, all, item } from "../lib/ssb.mjs";
import { readCsv } from "../lib/csv.mjs";
import { normalized } from "../lib/paths.mjs";
import { AGE_GROUPS } from "../lib/age.mjs";
import { aggregateAges } from "./ssb-13982.mjs";

const FIRST_YEAR = 2015;

export function transform07459({ rows, municipalities }) {
  const keep = new Set(municipalities);
  const kommuneRows = rows.filter((r) => keep.has(r.Region));
  const out = [];
  for (const e of aggregateAges(kommuneRows, { key: (r) => r.Region, name: (r) => r.Region_label, extra: () => "" })) {
    for (const g of [...AGE_GROUPS, "alle"]) {
      if (g !== "alle" && e.groups[g] === 0) continue;
      out.push({ municipality_code: e.id, aldersgruppe: g, period: e.period, value: e.groups[g], unit: "personer", source_id: "ssb_07459", quality: "ekte" });
    }
  }
  return { "municipal_population.csv": out };
}

const def = {
  meta: {
    id: "ssb_07459",
    navn: "SSB 07459 Befolkning etter kommune, kjønn og ettårig alder",
    url: "https://www.ssb.no/statbank/table/07459",
    api_url: "https://data.ssb.no/api/v0/no/table/07459",
    lisens: "NLOD 2.0",
    query: `Region=*, Kjonn=*, Alder=*, Tid>=${FIRST_YEAR} (én forespørsel per år)`,
  },
  async fetchRaw(deps) {
    const meta = await ssbMetadata("07459", deps);
    const years = metadataValues(meta, "Tid").values.filter((y) => Number(y) >= FIRST_YEAR);
    const { rows } = await ssbQueryChunked("07459", [all("Region"), all("Kjonn"), all("Alder"), item("Tid", years)], "Tid", deps);
    const municipalities = (await readCsv(normalized("municipalities.csv"))).rows.map((m) => m.municipality_code);
    const keep = new Set(municipalities);
    return { rows: rows.filter((r) => keep.has(r.Region)), municipalities };
  },
  transform: transform07459,
  columns: { "municipal_population.csv": ["municipality_code", "aldersgruppe", "period", "value", "unit", "source_id", "quality"] },
};
export default def;
