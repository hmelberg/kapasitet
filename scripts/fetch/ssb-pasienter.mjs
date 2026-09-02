// scripts/fetch/ssb-pasienter.mjs
import { ssbMetadata, metadataValues, ssbQuery, ssbQueryChunked, all, item } from "../lib/ssb.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { regionPrefix } from "../lib/regions.mjs";

export const METRICS = {
  Pasient: ["pasienter", "personer"],
  PasientPolikl: ["pasienter_poliklinikk", "personer"],
  PasientDognBeh: ["pasienter_dogn", "personer"],
  KontaktPolikl: ["polikliniske_konsultasjoner", "antall"],
  DagBehandl: ["dagbehandlinger", "antall"],
  DognOpphold: ["dognopphold", "antall"],
  OppholdDogn: ["oppholdsdogn", "dogn"],
};
// Én oppføring per SSB-tabell: `source_id` stemples på radene og er samtidig sub-kilden i manifestet.
export const SSB_TABLES = [
  { source_id: "ssb_14824", tabell: "14824", navn: "SSB 14824 – pasienter i somatisk spesialisthelsetjeneste etter bosted, alder og diagnose", tables_out: ["patients_by_diagnosis.csv", "patients_by_diagnosis_detail.csv"] },
  { source_id: "ssb_14820", tabell: "14820", navn: "SSB 14820 – pasienter i psykisk helsevern for voksne etter bosted og alder", tables_out: ["patients_by_diagnosis.csv"] },
];
const [T14824, T14820] = SSB_TABLES;

const MAIN_METRICS = ["Pasient", "PasientDognBeh", "DognOpphold", "OppholdDogn"];
const HISTORIC = /\((-\d{4}|\d{4}-\d{4})\)\s*$/;

/** → "land" | "fylke" | "helseregion" | null (drop). */
export function keepRegion(code, label) {
  if (code === "0") return "land";
  if (regionPrefix(code)) return "helseregion";
  if (/^\d{2}$/.test(code) && !HISTORIC.test(label)) return "fylke";
  return null;
}

export const chapterCodes = (codes) => codes.filter((c) => /^([IVX]+|_T)$/.test(c));

const age = (code) => (code === "999A" || code === "Ialt" ? "alle" : code === "00-17" ? "0-17" : code);

function toRow(r, { tjenesteomrade, source_id, diagnose_kode, diagnose_navn }) {
  const region_type = keepRegion(r.Region, r.Region_label);
  if (!region_type) return null;
  const m = METRICS[r.ContentsCode];
  if (!m) throw new Error(`[ssb_pasienter] Ukjent ContentsCode "${r.ContentsCode}" i ${source_id}`);
  return {
    region_id: r.Region, region_navn: r.Region_label, region_type, tjenesteomrade, aldersgruppe: age(r.Alder),
    diagnose_kode, diagnose_navn, metric: m[0], period: r.Tid, value: r.value, unit: m[1], source_id, quality: "ekte",
  };
}

export function transformPasienter({ somRows, vopRows, somDetail }) {
  const main = [];
  for (const r of somRows) {
    const row = toRow(r, { tjenesteomrade: "SOM", source_id: T14824.source_id, diagnose_kode: r.Diagnose, diagnose_navn: r.Diagnose_label });
    if (row) main.push(row);
  }
  for (const r of vopRows) {
    const row = toRow(r, { tjenesteomrade: "VOP", source_id: T14820.source_id, diagnose_kode: "_T", diagnose_navn: "I alt" });
    if (row) main.push(row);
  }
  const detail = [];
  for (const r of jsonStatToRows(somDetail)) {
    const row = toRow(r, { tjenesteomrade: "SOM", source_id: T14824.source_id, diagnose_kode: r.Diagnose, diagnose_navn: r.Diagnose_label });
    if (row) detail.push(row);
  }
  return { "patients_by_diagnosis.csv": main, "patients_by_diagnosis_detail.csv": detail };
}

const COLUMNS = ["region_id", "region_navn", "region_type", "tjenesteomrade", "aldersgruppe", "diagnose_kode", "diagnose_navn", "metric", "period", "value", "unit", "source_id", "quality"];

const def = {
  meta: {
    id: "ssb_pasienter",
    navn: "SSB 14824 Pasienter i somatisk spesialisthelsetjeneste etter bosted, alder og diagnose + SSB 14820 pasienter i psykisk helsevern for voksne",
    url: "https://www.ssb.no/statbank/table/14824",
    api_url: "https://data.ssb.no/api/v0/no/table/14824 og …/14820",
    lisens: "NLOD 2.0",
    query: "14824: Region=*, Kjonn=0, Alder=*, Aktor=_T, Diagnose=kapitler(_T,I..XXI), ContentsCode=Pasient,PasientDognBeh,DognOpphold,OppholdDogn, Tid=* (per år); detalj: siste år, Alder=999A, Diagnose=*, ContentsCode=*; 14820: Region=*, Kjonn=0, Alder=*, Aktor=_T, ContentsCode=*, Tid=*",
    sub_sources: SSB_TABLES.map((t) => ({
      id: t.source_id, navn: t.navn,
      url: `https://www.ssb.no/statbank/table/${t.tabell}`, api_url: `https://data.ssb.no/api/v0/no/table/${t.tabell}/`,
      tables_out: t.tables_out,
    })),
  },
  async fetchRaw(deps) {
    const meta = await ssbMetadata(T14824.tabell, deps);
    const years = metadataValues(meta, "Tid").values;
    const chapters = chapterCodes(metadataValues(meta, "Diagnose").values);
    if (chapters.length < 10) throw new Error(`[ssb_pasienter] SSB 14824: fant bare ${chapters.length} diagnosekapitler`);
    const { rows: somRows } = await ssbQueryChunked(T14824.tabell, [
      all("Region"), item("Kjonn", ["0"]), all("Alder"), item("Aktor", ["_T"]), item("Diagnose", chapters), item("ContentsCode", MAIN_METRICS), item("Tid", years),
    ], "Tid", deps);
    const somDetail = await ssbQuery(T14824.tabell, [
      all("Region"), item("Kjonn", ["0"]), item("Alder", ["999A"]), item("Aktor", ["_T"]), all("Diagnose"), all("ContentsCode"), item("Tid", [years[years.length - 1]]),
    ], deps);
    const vop = await ssbQuery(T14820.tabell, [all("Region"), item("Kjonn", ["0"]), all("Alder"), item("Aktor", ["_T"]), all("ContentsCode"), all("Tid")], deps);
    return { somRows, somDetail, vopRows: jsonStatToRows(vop) };
  },
  transform: transformPasienter,
  columns: { "patients_by_diagnosis.csv": COLUMNS, "patients_by_diagnosis_detail.csv": COLUMNS },
};
export default def;
