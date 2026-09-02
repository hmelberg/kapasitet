import { fhiQuery, fhiItem, fhiAll } from "../lib/fhi.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";

// Same curated ATC groups as the old scripts/fetch-medications-fhi.ps1.
export const GROUPS = {
  R03: "Astma og KOLS",
  A10: "Diabetes",
  C10: "Kolesterolsenkende",
  C09: "Blodtrykk (RAAS-hemmere)",
  C07: "Betablokkere",
  N06A: "Antidepressiva",
  N05B: "Angstdempende",
  N06B: "ADHD / psykostimulerende",
  H03: "Stoffskifte (thyreoidea)",
  M05B: "Benskjorhet (osteoporose)",
  N02A: "Opioider (smertestillende)",
  R06: "Allergi (antihistaminer)",
  A02B: "Magesyre (protonpumpehemmere)",
  N03A: "Epilepsi",
};

export function transformLmr({ dataset }, { today }) {
  const cells = new Map(); // "atc|year" → {users, per_1000}
  for (const r of jsonStatToRows(dataset)) {
    const k = `${r.Atc_Verdi}|${r.Utlevering_Ar}`;
    const c = cells.get(k) ?? { users: null, per_1000: null };
    if (r.MEASURE_TYPE === "AntallBrukere") c.users = r.value;
    if (r.MEASURE_TYPE === "Brukere_Per1000_Innbyggere") c.per_1000 = r.value;
    cells.set(k, c);
  }
  const out = [];
  for (const [k, c] of cells) {
    const [atc, year] = k.split("|");
    if (c.users === null && c.per_1000 === null) continue;
    out.push({ group_code: atc, group_label: GROUPS[atc] ?? atc, period: year, users: c.users, per_1000: c.per_1000, source_id: "fhi_lmr_825", last_updated: today });
  }
  return { "medications.csv": out };
}

const def = {
  meta: {
    id: "fhi_lmr_825",
    navn: "FHI Legemiddelregisteret tabell 825 – brukere per ATC-gruppe, hele landet",
    url: "https://www.fhi.no/he/legemiddelbruk",
    api_url: "https://statistikk-data.fhi.no/api/open/v1/lmr/Table/825/data",
    lisens: "CC BY 4.0",
    query: `Atc_Verdi=${Object.keys(GROUPS).join(",")}, Kjonn_Verdi=TOTALT, Aldersgruppe_Verdi=TOTALT, Utlevering_Ar=*, MEASURE_TYPE=AntallBrukere,Brukere_Per1000_Innbyggere`,
  },
  async fetchRaw(deps) {
    const dataset = await fhiQuery("lmr", 825, [
      fhiItem("Atc_Verdi", Object.keys(GROUPS)), fhiItem("Kjonn_Verdi", ["TOTALT"]), fhiItem("Aldersgruppe_Verdi", ["TOTALT"]), fhiAll("Utlevering_Ar"), fhiItem("MEASURE_TYPE", ["AntallBrukere", "Brukere_Per1000_Innbyggere"]),
    ], deps);
    return { dataset };
  },
  transform: transformLmr,
  columns: { "medications.csv": ["group_code", "group_label", "period", "users", "per_1000", "source_id", "last_updated"] },
};
export default def;
