import { ssbQuery, all, item } from "../lib/ssb.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { readCsv } from "../lib/csv.mjs";
import { normalized } from "../lib/paths.mjs";

const REGION = "KOKkommuneregion0000";

// contents code → [metric, unit]; `suffixDim` appends "_<code>" (lower-cased) and " – <label>" from that dimension.
export const KOSTRA_TABLES = {
  11875: {
    tableId: "11875", query: [all(REGION), all("ContentsCode"), all("Tid")],
    contents: { KOSinstdispplass0000: ["inst_plasser", "plasser"], KOSsykehjdisppla0000: ["sykehjem_plasser", "plasser"], KOSinstdemenspla0000: ["demens_plasser", "plasser"], KOSinsttidsbegrp0000: ["tidsbegrensede_plasser", "plasser"], KOSinstrehabplas0000: ["rehab_plasser", "plasser"] },
  },
  12292: {
    tableId: "12292", query: [all(REGION), all("ContentsCode"), all("Tid")],
    contents: { KOSbeboersykehje0000: ["sykehjem_beboere", "personer"], KOSlangtid0000: ["langtid_beboere", "personer"], KOSkorttid0000: ["korttid_beboere", "personer"], KOSkjernetotalt0000: ["hjemmetjeneste_brukere", "personer"], KOSkjerne80aarov0000: ["hjemmetjeneste_brukere_80pluss", "personer"], KOSaarsverkbruke0000: ["omsorg_arsverk_brukerrettet", "arsverk"], KOSinstoppholdsd0000: ["inst_oppholdsdogn", "dogn"] },
  },
  12293: {
    tableId: "12293", query: [all(REGION), all("ContentsCode"), all("Tid")],
    contents: { KOSbeleggomsorgs0000: ["inst_belegg", "prosent"] },
  },
  11996: {
    tableId: "11996", query: [all(REGION), item("KOKavtaleform0000", ["sum"]), all("KOKfunksjon0000"), all("ContentsCode"), all("Tid")],
    contents: { KOSlegeaarsverk0000: ["legearsverk", "arsverk"] }, suffixDim: "KOKfunksjon0000",
  },
  14533: {
    tableId: "14533", query: [all(REGION), all("KOKyrker0000"), all("ContentsCode"), all("Tid")],
    contents: { KOSARBAARSVERKST0000: ["omsorg_arsverk", "arsverk"] }, suffixDim: "KOKyrker0000",
  },
};

/** cfg.query with its `all("ContentsCode")` entry narrowed to the mapped codes in cfg.contents. */
function queryFor(cfg) {
  const codes = Object.keys(cfg.contents);
  return cfg.query.map((q) => (q.code === "ContentsCode" ? item("ContentsCode", codes) : q));
}

export function transformKostra({ datasets, municipalities }) {
  const keep = new Set(municipalities);
  const out = [];
  for (const [tableId, ds] of Object.entries(datasets)) {
    const cfg = KOSTRA_TABLES[tableId];
    if (!cfg) throw new Error(`[ssb_kostra] KOSTRA-tabell ${tableId} mangler i KOSTRA_TABLES`);
    for (const r of jsonStatToRows(ds)) {
      if (!keep.has(r[REGION])) continue;
      const m = cfg.contents[r.ContentsCode];
      if (!m) throw new Error(`[ssb_kostra] Ukjent ContentsCode "${r.ContentsCode}" i KOSTRA ${tableId}`);
      const suffix = cfg.suffixDim ? `_${String(r[cfg.suffixDim]).toLowerCase()}` : "";
      const labelSuffix = cfg.suffixDim ? ` – ${r[`${cfg.suffixDim}_label`]}` : "";
      out.push({ municipality_code: r[REGION], metric: m[0] + suffix, metric_label: r.ContentsCode_label + labelSuffix, period: r.Tid, value: r.value, unit: m[1], source_id: `ssb_${tableId}`, quality: "ekte" });
    }
  }
  return { "municipal_capacity.csv": out };
}

const def = {
  meta: {
    id: "ssb_kostra",
    navn: "SSB KOSTRA 11875 (plasser), 12292 (beboere/brukere/årsverk), 12293 (belegg), 11996 (legeårsverk), 14533 (årsverk etter yrke) – kommunale helse- og omsorgstjenester",
    url: "https://www.ssb.no/statbank/list/helsetjenester-kommuner",
    api_url: "https://data.ssb.no/api/v0/no/table/{11875,12292,12293,11996,14533}",
    lisens: "NLOD 2.0",
    query: "KOKkommuneregion0000=*, ContentsCode=<mapped koder per tabell, se KOSTRA_TABLES>, Tid=* (+ KOKavtaleform0000=sum, KOKfunksjon0000=* for 11996; KOKyrker0000=* for 14533)",
  },
  async fetchRaw(deps) {
    const datasets = {};
    for (const cfg of Object.values(KOSTRA_TABLES)) datasets[cfg.tableId] = await ssbQuery(cfg.tableId, queryFor(cfg), deps);
    const municipalities = (await readCsv(normalized("municipalities.csv"))).rows.map((m) => m.municipality_code);
    return { datasets, municipalities };
  },
  transform: transformKostra,
  columns: { "municipal_capacity.csv": ["municipality_code", "metric", "metric_label", "period", "value", "unit", "source_id", "quality"] },
};
export default def;
