import { SCHEMAS } from "./schemas.mjs";
import { NATIONAL_HF, PRIVATE_RHF } from "../lib/regions.mjs";

export const QUALITIES = new Set(["ekte", "avledet", "estimat"]);
export const BED_CATEGORIES = new Set(["somatikk", "psykisk_helsevern", "tsb", "intensiv", "fode", "annet"]);
export const BED_TOLERANCE = 0.15;
const CONTROL_SUMS = [
  ["983974880", "Finnmarkssykehuset", 134], ["983974899", "UNN", 593], ["983974910", "Nordlandssykehuset", 295], ["983974929", "Helgelandssykehuset", 121],
];
const NUMERIC = { value: true, senger: true };
// Tabeller der hver kommune i municipalities.csv må ha minst én rad.
const KOMMUNE_COVERAGE = ["municipal_population.csv", "municipal_capacity.csv", "municipal_needs.csv", "municipality_catchment.csv"];
// SSB rapporterer også på aggregatnivå (H00, H03…H12, H03_AV, H06_HF, H99) i tillegg til org.nr.
const AGGREGATE_HF = /^H\d\d(_[A-Z]+)?$/;

/** Tom celle er ukjent, ikke 0 – Number("") === 0 og Number(" ") === 0 er begge endelige. */
const numOrNaN = (v) => (v === "" || v == null || String(v).trim() === "" ? NaN : Number(v));

export function validateTables(tables, schemas = SCHEMAS, { manifest } = {}) {
  const errors = [], warnings = [], info = [];
  const err = (m) => errors.push(m);

  // 1. presence + columns
  for (const [file, s] of Object.entries(schemas)) {
    const rows = tables[file];
    if (!rows) { (s.required ? errors : warnings).push(`${file} mangler${s.required ? "" : " (ikke kuratert ennå)"}`); continue; }
    const have = rows.length ? Object.keys(rows[0]) : s.columns;
    if (have.join(",") !== s.columns.join(",")) err(`${file}: kolonner er [${have}] – forventet [${s.columns}]`);
  }
  const t = (file) => tables[file] ?? [];

  // 2–3. quality, numbers, period
  for (const [file, rows] of Object.entries(tables)) {
    if (!schemas[file]) continue;
    const cols = schemas[file].columns;
    let badQ = 0, badN = 0, badP = 0, example = "";
    for (const r of rows) {
      if (cols.includes("quality") && !QUALITIES.has(r.quality)) { badQ++; example ||= JSON.stringify(r); }
      for (const c of cols) if (NUMERIC[c] && !Number.isFinite(numOrNaN(r[c]))) badN++;
      if (cols.includes("period") && !/^\d{4}$/.test(r.period)) badP++;
    }
    if (badQ) err(`${file}: ${badQ} rader med ugyldig quality, f.eks. ${example}`);
    if (badN) err(`${file}: ${badN} rader med ikke-numerisk value/senger`);
    if (badP) err(`${file}: ${badP} rader med period som ikke er årstall`);
  }

  // 4. catchment integrity
  const hfIds = new Set(t("helseforetak.csv").map((r) => r.hf_id));
  const areas = new Map(t("opptaksomrader.csv").map((r) => [r.omrade_id, r]));
  const catchBy = new Map();
  for (const r of t("municipality_catchment.csv")) (catchBy.get(r.municipality_code) ?? catchBy.set(r.municipality_code, []).get(r.municipality_code)).push(r);
  for (const m of t("municipalities.csv")) {
    const rows = catchBy.get(m.municipality_code) ?? [];
    if (rows.length === 0) { err(`Kommune ${m.municipality_code} ${m.municipality_name} mangler i municipality_catchment.csv`); continue; }
    if (rows.length > 1) err(`Kommune ${m.municipality_code} har flere enn ett lokalsykehusområde i municipality_catchment.csv (${rows.map((r) => r.lokalsykehus_id).join(", ")})`);
    const r = rows[0];
    if (!r.hf_id || !hfIds.has(r.hf_id)) err(`Kommune ${m.municipality_code} ${m.municipality_name} mangler HF (hf_id="${r.hf_id}")`);
    if (!areas.has(r.lokalsykehus_id)) err(`Kommune ${m.municipality_code}: lokalsykehus_id "${r.lokalsykehus_id}" finnes ikke i opptaksomrader.csv`);
    if (!r.dps_id) warnings.push(`Kommune ${m.municipality_code} ${m.municipality_name} mangler DPS-område`);
  }

  // 5. referential integrity
  const muniIds = new Set(t("municipalities.csv").map((r) => r.municipality_code));
  const siteIds = new Set(t("sites.csv").map((r) => r.site_id));
  const ref = (file, col, ok, label) => {
    const bad = [...new Set(t(file).filter((r) => !ok(r[col])).map((r) => r[col]))];
    if (bad.length) err(`${file}: ${col} ${bad.length} ukjente ${label}: ${bad.slice(0, 5).join(", ")}`);
  };
  for (const f of ["opptaksomrader.csv", "sites.csv", "hospital_beds.csv"]) ref(f, "hf_id", (v) => hfIds.has(v), "HF");
  for (const f of Object.keys(tables).filter((f) => f.startsWith("municipal_")).concat("sites.csv", "hospital_beds.csv")) ref(f, "municipality_code", (v) => muniIds.has(v), "kommuner");
  ref("hospital_beds.csv", "site_id", (v) => siteIds.has(v), "site_id");
  ref("sites.csv", "lokalsykehus_id", (v) => v === "" || areas.has(v), "lokalsykehus_id");
  ref("hospital_beds.csv", "kategori", (v) => BED_CATEGORIES.has(v), "kategorier");

  // hf_id i SSB-tabellene: org.nr fra helseforetak.csv, H-aggregater, felleseide og private/historiske HF-er
  const knownHf = (v) => hfIds.has(v) || AGGREGATE_HF.test(v) || NATIONAL_HF.has(v) || v in PRIVATE_RHF;
  for (const file of ["hf_activity.csv", "hf_staffing.csv", "hf_specialists.csv"]) {
    const counts = new Map();
    for (const r of t(file)) if (!knownHf(r.hf_id)) counts.set(r.hf_id, (counts.get(r.hf_id) ?? 0) + 1);
    for (const [id, n] of counts) err(`[${file}] ukjent hf_id ${id} (${n} rader)`);
  }

  // hver kommune må ha rader i befolknings-, kapasitets-, behovs- og tilhørighetstabellen
  for (const file of KOMMUNE_COVERAGE) {
    if (!tables[file]) continue;
    const have = new Set(t(file).map((r) => r.municipality_code));
    const missing = [...muniIds].filter((c) => !have.has(c));
    if (missing.length) err(`[${file}] mangler rader for ${missing.length} kommuner: ${missing.slice(0, 5).join(", ")}…`);
  }

  // samme (site_id, kategori, period) to ganger ville stille overskrive hverandre i bedsBlock
  const bedKeys = new Map();
  for (const r of t("hospital_beds.csv")) {
    const k = `${r.site_id}/${r.kategori}/${r.period}`;
    bedKeys.set(k, (bedKeys.get(k) ?? 0) + 1);
  }
  for (const [k, n] of bedKeys) if (n > 1) err(`hospital_beds.csv: ${n} rader deler samme site_id/kategori/period (${k})`);

  const cpRows = t("catchment_population.csv");
  const cpLatest = cpRows.reduce((max, r) => (r.period > max ? r.period : max), "");
  const cpBad = [...new Set(cpRows.filter((r) => r.period === cpLatest && (r.omrade_type === "lokalsykehus" || r.omrade_type === "dps") && !areas.has(r.omrade_id)).map((r) => r.omrade_id))];
  if (cpBad.length) err(`catchment_population.csv: ${cpBad.length} områder i siste periode (${cpLatest}) finnes ikke i opptaksomrader.csv: ${cpBad.slice(0, 5).join(", ")}`);

  // 6. curated somatic beds vs SSB 13942
  const ssbBeds = new Map(); // hf_id → {period, value}
  for (const r of t("hf_activity.csv")) {
    if (r.tjenesteomrade !== "SOM" || r.metric !== "dognplasser") continue;
    const cur = ssbBeds.get(r.hf_id);
    if (!cur || r.period > cur.period) ssbBeds.set(r.hf_id, { period: r.period, value: Number(r.value) });
  }
  const curated = new Map(); // hf_id → Map(site_id → {period, senger, quality})
  for (const r of t("hospital_beds.csv")) {
    if (r.kategori !== "somatikk") continue;
    const sites = curated.get(r.hf_id) ?? curated.set(r.hf_id, new Map()).get(r.hf_id);
    const cur = sites.get(r.site_id);
    if (!cur || r.period > cur.period) sites.set(r.site_id, { period: r.period, senger: Number(r.senger), quality: r.quality });
  }
  for (const [hf, sites] of curated) {
    const rows = [...sites.values()];
    const sum = rows.reduce((a, s) => a + s.senger, 0);
    const ssb = ssbBeds.get(hf);
    if (!ssb) { warnings.push(`hospital_beds.csv: HF ${hf} har ingen SOM døgnplasser i hf_activity.csv å kontrollere mot`); continue; }
    // En estimat-rad er selv utledet av SSB-tallet, så et avvik målt mot den er sirkulært, ikke en kontroll.
    const est = rows.filter((s) => s.quality === "estimat").length;
    if (est) { info.push(`HF ${hf}: ${est} av ${rows.length} somatikk-rader er estimat (fordelt fra SSB 13942) — kontrollsummen er ikke uavhengig, sjekk hoppet over`); continue; }
    const dev = Math.abs(sum - ssb.value) / ssb.value;
    const line = `HF ${hf}: kuratert somatikk ${sum} senger vs SSB 13942 ${ssb.value} døgnplasser (${ssb.period}), avvik ${(dev * 100).toFixed(1)} %`;
    if (dev > BED_TOLERANCE) err(`${line} – avviker mer enn ${BED_TOLERANCE * 100} %`); else info.push(line);
  }
  for (const h of t("helseforetak.csv")) if (h.type === "hf" && !curated.has(h.hf_id)) info.push(`HF ${h.hf_id} ${h.hf_navn}: ingen kuratert sengetabell`);

  // 7. control sums
  for (const [hf, navn, expected] of CONTROL_SUMS) {
    const row = t("hf_activity.csv").find((r) => r.hf_id === hf && r.tjenesteomrade === "SOM" && r.metric === "dognplasser" && r.period === "2025");
    if (row && Number(row.value) !== expected) warnings.push(`Kontrollsum: ${navn} SOM døgnplasser 2025 er ${row.value}, forventet ${expected} (SSB har revidert?)`);
  }

  // 8. provenienss: hver source_id må kunne slås opp i manifestet (hoppes over uten manifest)
  if (manifest) {
    const known = new Set((manifest.sources ?? []).map((s) => s.id));
    for (const [file, rows] of Object.entries(tables)) {
      if (!schemas[file]?.columns.includes("source_id")) continue;
      for (const id of new Set(rows.map((r) => r.source_id).filter(Boolean))) {
        if (!known.has(id)) err(`[${file}] source_id '${id}' finnes ikke i manifest.json`);
      }
    }
  }
  return { errors, warnings, info };
}
