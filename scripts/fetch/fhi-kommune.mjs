import { fhiQuery, fhiItem, fhiAll } from "../lib/fhi.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { readCsv } from "../lib/csv.mjs";
import { normalized } from "../lib/paths.mjs";

// Én oppføring per FHI-tabell: `source_id` stemples på radene og er samtidig sub-kilden i manifestet.
export const FHI_TABLES = [
  { source_id: "fhi_nokkel_699", bank: "nokkel", tabell: 699, navn: "FHI Kommunehelsa nøkkel 699 – brukere av spesialisthelsetjenesten (NPR) per diagnosegruppe" },
  { source_id: "fhi_nokkel_370", bank: "nokkel", tabell: 370, navn: "FHI Kommunehelsa nøkkel 370 – brukere av kommunale helse- og omsorgstjenester (KPR) 0–74 år per diagnosegruppe" },
  { source_id: "fhi_kpr_634", bank: "kpr", tabell: 634, navn: "FHI Kommunehelsa kpr 634 – mottakere av hjemmetjenester etter tjenestetype" },
];
const [T699, T370, T634] = FHI_TABLES;

const MEASURES = { TELLER: ["antall", "personer"], RATE: ["rate", "rate"] };
const year = (aar) => String(aar).split("_")[0];
const slug = (s) => String(s).toLowerCase();

/** "5603 Hammerfest (2024->)" → "5603"; historic "(2020-2023)" and "Landet" → null. */
export function parseSted(code) {
  const m = /^(\d{4}) .+ \(\d{4}->\)$/.exec(String(code));
  return m ? m[1] : null;
}

function nokkelRows(ds, { prefix, source_id, alderSuffix = "" }) {
  const out = [];
  for (const r of jsonStatToRows(ds)) {
    const m = MEASURES[r.MEASURE_TYPE];
    if (!m) throw new Error(`[fhi_kommune] Ukjent MEASURE_TYPE "${r.MEASURE_TYPE}" i FHI ${source_id}`);
    out.push({
      municipality_code: r.GEO,
      metric: `${prefix}_${slug(r.KODEGRUPPE)}${alderSuffix}_${m[0]}`,
      metric_label: `${r.KODEGRUPPE_label} – ${r.MEASURE_TYPE_label}`,
      period: year(r.AAR), value: r.value, unit: m[1], source_id, quality: "ekte",
    });
  }
  return out;
}

function hjemmetjenesteRows(ds) {
  const out = [];
  for (const r of jsonStatToRows(ds)) {
    const code = parseSted(r.Sted);
    if (!code) continue;
    const t = r.tjtjentypeNavn === "Totalt_antall_brukere" ? "brukere_totalt" : slug(r.tjtjentypeNavn);
    out.push({ municipality_code: code, metric: `hjemmetjeneste_${t}`, metric_label: r.tjtjentypeNavn_label, period: year(r.AAR), value: r.value, unit: "personer", source_id: T634.source_id, quality: "ekte" });
  }
  return out;
}

export function transformFhiKommune({ npr699, kpr370, kpr634, municipalities }) {
  const keep = new Set(municipalities);
  const rows = [
    ...nokkelRows(npr699, { prefix: "npr", source_id: T699.source_id }),
    ...nokkelRows(kpr370, { prefix: "kpr", source_id: T370.source_id, alderSuffix: "_0_74" }),
    ...hjemmetjenesteRows(kpr634),
  ].filter((r) => keep.has(r.municipality_code));
  return { "municipal_needs.csv": rows };
}

const def = {
  meta: {
    id: "fhi_kommune",
    navn: "FHI Kommunehelsa: NPR-brukere per diagnosegruppe (nokkel 699), KPR-brukere 0–74 år (nokkel 370), mottakere av hjemmetjenester (kpr 634)",
    url: "https://statistikk.fhi.no/kommunehelsa",
    api_url: "https://statistikk-data.fhi.no/api/open/v1/{nokkel/Table/699,nokkel/Table/370,kpr/Table/634}/data",
    lisens: "CC BY 4.0",
    query: "699: GEO=*, AAR=*, KJONN=0, ALDER=0_120, KODEGRUPPE=*, MEASURE_TYPE=TELLER,RATE; 370: samme men ALDER=0_74; 634: Sted=*, AAR=*, tjtjentypeNavn=*, MEASURE_TYPE=Antall_Brukere",
    sub_sources: FHI_TABLES.map((t) => ({
      id: t.source_id, navn: t.navn,
      url: "https://statistikk.fhi.no/kommunehelsa", api_url: `https://statistikk-data.fhi.no/api/open/v1/${t.bank}/Table/${t.tabell}/data`,
      tables_out: ["municipal_needs.csv"],
    })),
  },
  async fetchRaw(deps) {
    const npr699 = await fhiQuery(T699.bank, T699.tabell, [fhiAll("GEO"), fhiAll("AAR"), fhiItem("KJONN", ["0"]), fhiItem("ALDER", ["0_120"]), fhiAll("KODEGRUPPE"), fhiItem("MEASURE_TYPE", ["TELLER", "RATE"])], deps);
    const kpr370 = await fhiQuery(T370.bank, T370.tabell, [fhiAll("GEO"), fhiAll("AAR"), fhiItem("KJONN", ["0"]), fhiItem("ALDER", ["0_74"]), fhiAll("KODEGRUPPE"), fhiItem("MEASURE_TYPE", ["TELLER", "RATE"])], deps);
    const kpr634 = await fhiQuery(T634.bank, T634.tabell, [fhiAll("Sted"), fhiAll("AAR"), fhiAll("tjtjentypeNavn"), fhiItem("MEASURE_TYPE", ["Antall_Brukere"])], deps);
    const municipalities = (await readCsv(normalized("municipalities.csv"))).rows.map((m) => m.municipality_code);
    return { npr699, kpr370, kpr634, municipalities };
  },
  transform: transformFhiKommune,
  columns: { "municipal_needs.csv": ["municipality_code", "metric", "metric_label", "period", "value", "unit", "source_id", "quality"] },
};
export default def;
