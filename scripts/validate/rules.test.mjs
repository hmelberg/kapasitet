import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTables } from "./rules.mjs";

const schemas = {
  "municipalities.csv": { columns: ["municipality_code", "county_code", "municipality_name", "county_name"], required: true },
  "helseforetak.csv": { columns: ["hf_id", "hf_navn", "rhf_id", "helseregion", "type"], required: true },
  "opptaksomrader.csv": { columns: ["omrade_id", "omrade_navn", "omrade_type", "hf_id"], required: true },
  "municipality_catchment.csv": { columns: ["municipality_code", "municipality_name", "lokalsykehus_id", "dps_id", "hf_id", "helseregion", "quality", "note"], required: true },
  "hf_activity.csv": { columns: ["hf_id", "hf_navn", "helseregion", "tjenesteomrade", "metric", "period", "value", "unit", "source_id", "quality"], required: true },
  "sites.csv": { columns: ["site_id", "site_navn", "hf_id", "municipality_code", "lokalsykehus_id", "lat", "lon", "site_type", "akuttfunksjon"], required: false },
  "hospital_beds.csv": { columns: ["site_id", "site_navn", "hf_id", "source_id", "municipality_code", "kategori", "senger", "period", "quality", "source_url", "source_note", "last_verified"], required: false },
};

const good = () => ({
  "municipalities.csv": [{ municipality_code: "5603", county_code: "56", municipality_name: "Hammerfest", county_name: "Finnmark" }],
  "helseforetak.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" }],
  "opptaksomrader.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", hf_id: "983974880" }, { omrade_id: "D01", omrade_navn: "Vest-Finnmark", omrade_type: "dps", hf_id: "983974880" }],
  "municipality_catchment.csv": [{ municipality_code: "5603", municipality_name: "Hammerfest", lokalsykehus_id: "S01", dps_id: "D01", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" }],
  "hf_activity.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: "134", unit: "senger", source_id: "ssb_13942", quality: "ekte" }],
  "sites.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", lokalsykehus_id: "S01", lat: "70.67", lon: "23.65", site_type: "sykehus", akuttfunksjon: "ja" }],
  "hospital_beds.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", source_id: "curated_helse_nord", municipality_code: "5603", kategori: "somatikk", senger: "130", period: "2025", quality: "ekte", source_url: "https://x", source_note: "", last_verified: "2026-09-02" }],
});

test("clean tables give no errors and an info line for the bed control", () => {
  const r = validateTables(good(), schemas);
  assert.deepEqual(r.errors, []);
  assert.ok(r.info.some((l) => l.includes("983974880") && l.includes("130") && l.includes("134")));
});

test("kontrollsummen hoppes over når en somatikk-rad er estimat fordelt fra SSB", () => {
  const t = good();
  t["hospital_beds.csv"].push({ ...t["hospital_beds.csv"][0], site_id: "kirkenes", site_navn: "Kirkenes sykehus", source_id: "ssb_13942", senger: "300", quality: "estimat" });
  t["sites.csv"].push({ ...t["sites.csv"][0], site_id: "kirkenes", site_navn: "Kirkenes sykehus" });
  const r = validateTables(t, schemas);
  assert.deepEqual(r.errors, []); // 430 mot 134 ville vært langt utenfor toleransen
  assert.ok(r.info.some((l) => /983974880: 1 av 2 somatikk-rader er estimat.*ikke uavhengig/.test(l)));
  assert.ok(!r.info.some((l) => /avvik/.test(l)));
});

test("tom numerisk celle er ikke 0, men en feil", () => {
  const t = good();
  t["hf_activity.csv"][0].value = "";
  t["hospital_beds.csv"][0].senger = "  ";
  const r = validateTables(t, schemas);
  assert.ok(r.errors.some((e) => /hf_activity.*ikke-numerisk/.test(e)));
  assert.ok(r.errors.some((e) => /hospital_beds.*ikke-numerisk/.test(e)));
});

test("lokalsykehus_id, sengekategori og duplikate sengerader kontrolleres", () => {
  const t = good();
  t["sites.csv"][0].lokalsykehus_id = "S99";
  t["hospital_beds.csv"][0].kategori = "somatik";
  t["hospital_beds.csv"].push({ ...t["hospital_beds.csv"][0] });
  const r = validateTables(t, schemas);
  assert.ok(r.errors.some((e) => /sites.csv: lokalsykehus_id 1 ukjente lokalsykehus_id: S99/.test(e)));
  assert.ok(r.errors.some((e) => /hospital_beds.csv: kategori 1 ukjente kategorier: somatik/.test(e)));
  assert.ok(r.errors.some((e) => /hospital_beds.csv: 2 rader deler samme site_id\/kategori\/period \(hammerfest\/somatik\/2025\)/.test(e)));
  // tom lokalsykehus_id er lov (Klinikk Alta har ingen)
  t["sites.csv"][0].lokalsykehus_id = "";
  assert.ok(!validateTables(t, schemas).errors.some((e) => /lokalsykehus_id/.test(e)));
});

test("hf_id i SSB-tabellene godtar org.nr, H-aggregater og felleseide/private HF-er – ikke annet", () => {
  const t = good();
  t["hf_activity.csv"] = [
    { ...t["hf_activity.csv"][0], hf_id: "H05" },
    { ...t["hf_activity.csv"][0], hf_id: "H06_HF" },
    { ...t["hf_activity.csv"][0], hf_id: "818711832" }, // Luftambulansetjenesten HF (NATIONAL_HF)
    { ...t["hf_activity.csv"][0], hf_id: "883971752" }, // Sunnaas sykehus HF (PRIVATE_RHF)
  ];
  assert.ok(!validateTables(t, schemas).errors.some((e) => /ukjent hf_id/.test(e)));
  t["hf_activity.csv"].push({ ...t["hf_activity.csv"][0], hf_id: "999999999" }, { ...t["hf_activity.csv"][0], hf_id: "999999999" });
  assert.ok(validateTables(t, schemas).errors.some((e) => e === "[hf_activity.csv] ukjent hf_id 999999999 (2 rader)"));
});

test("hver kommune må ha rader i befolknings-, kapasitets- og behovstabellen", () => {
  const t = good();
  const cap = { municipality_code: "5603", metric: "inst_plasser", metric_label: "Plasser", period: "2025", value: "138", unit: "plasser", source_id: "ssb_11875", quality: "ekte" };
  t["municipal_capacity.csv"] = [cap];
  t["municipal_population.csv"] = [];
  const r = validateTables(t, { ...schemas, "municipal_capacity.csv": { columns: Object.keys(cap), required: true }, "municipal_population.csv": { columns: Object.keys(cap), required: true } });
  assert.ok(r.errors.some((e) => e === "[municipal_population.csv] mangler rader for 1 kommuner: 5603…"));
  assert.ok(!r.errors.some((e) => /municipal_capacity.csv\] mangler/.test(e)));
});

test("schema, quality, missing HF and bed deviation are errors; optional tables are warnings", () => {
  const t = good();
  t["hf_activity.csv"][0].quality = "gjett";
  t["municipality_catchment.csv"][0].hf_id = "";
  t["hospital_beds.csv"][0].senger = "90";
  delete t["sites.csv"];
  t["helseforetak.csv"] = t["helseforetak.csv"].map(({ type, ...rest }) => rest);
  const r = validateTables(t, schemas);
  assert.ok(r.errors.some((e) => /hf_activity.*quality/.test(e)));
  assert.ok(r.errors.some((e) => /5603.*mangler HF/.test(e)));
  assert.ok(r.errors.some((e) => /983974880.*avviker/.test(e)));
  assert.ok(r.errors.some((e) => /helseforetak.csv.*kolonner/.test(e)));
  assert.ok(r.warnings.some((w) => /sites.csv/.test(w)));
});

test("duplicate catchment row and unknown site reference are errors", () => {
  const t = good();
  t["municipality_catchment.csv"].push({ ...t["municipality_catchment.csv"][0], lokalsykehus_id: "S02" });
  t["hospital_beds.csv"][0].site_id = "ukjent";
  const r = validateTables(t, schemas);
  assert.ok(r.errors.some((e) => /5603.*flere enn ett/.test(e)));
  assert.ok(r.errors.some((e) => /hospital_beds.*site_id.*ukjent/.test(e)));
});

test("source_id må finnes i manifestet, men bare når et manifest er gitt", () => {
  const t = good();
  t["hf_activity.csv"][0].source_id = "ssb_99999";
  assert.deepEqual(validateTables(t, schemas).errors, []);
  const manifest = { generated: "2026-09-02", sources: [{ id: "ssb_13942" }, { id: "curated_helse_nord" }] };
  const r = validateTables(t, schemas, { manifest });
  assert.deepEqual(r.errors, ["[hf_activity.csv] source_id 'ssb_99999' finnes ikke i manifest.json"]);
  t["hf_activity.csv"][0].source_id = "ssb_13942";
  assert.deepEqual(validateTables(t, schemas, { manifest }).errors, []);
});

test("catchment_population.csv is checked against opptaksomrader.csv only for its latest period", () => {
  const t = good();
  t["catchment_population.csv"] = [
    { omrade_id: "S26", omrade_navn: "Kristiansund", omrade_type: "lokalsykehus", tjenesteomrade: "SOM", aldersgruppe: "alle", period: "2020", value: "47000", unit: "personer", source_id: "ssb_13982", quality: "ekte" },
    { omrade_id: "S99", omrade_navn: "Ukjent", omrade_type: "lokalsykehus", tjenesteomrade: "SOM", aldersgruppe: "alle", period: "2025", value: "100", unit: "personer", source_id: "ssb_13982", quality: "ekte" },
  ];
  const r = validateTables(t, schemas);
  assert.ok(r.errors.some((e) => /catchment_population.*siste periode \(2025\).*S99/.test(e)));
  assert.ok(!r.errors.some((e) => /S26/.test(e)));
});
