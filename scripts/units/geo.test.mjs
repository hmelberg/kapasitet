import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOpptaksomradeUnits, buildFylkeUnits, buildKommuneUnits } from "./geo.mjs";

const pop = (code, g, period, value) => ({ municipality_code: code, aldersgruppe: g, period, value: String(value), unit: "personer", source_id: "ssb_07459", quality: "ekte" });
const tables = () => ({
  "municipalities.csv": [
    { municipality_code: "5603", county_code: "56", municipality_name: "Hammerfest", county_name: "Finnmark" },
    { municipality_code: "5601", county_code: "56", municipality_name: "Alta", county_name: "Finnmark" },
  ],
  "helseforetak.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" }],
  "opptaksomrader.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", hf_id: "983974880" }, { omrade_id: "D01", omrade_navn: "Vest-Finnmark", omrade_type: "dps", hf_id: "983974880" }],
  "municipality_catchment.csv": [
    { municipality_code: "5603", municipality_name: "Hammerfest", lokalsykehus_id: "S01", dps_id: "D01", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" },
    { municipality_code: "5601", municipality_name: "Alta", lokalsykehus_id: "S01", dps_id: "D01", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" },
  ],
  "catchment_population.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", tjenesteomrade: "SOM", aldersgruppe: "alle", period: "2025", value: "40000", unit: "personer", source_id: "ssb_13982", quality: "ekte" }],
  "municipal_population.csv": [pop("5603", "alle", "2025", 11000), pop("5601", "alle", "2025", 21000), pop("5603", "0-17", "2025", 2000), pop("5601", "0-17", "2025", 4000), pop("5603", "alle", "2024", 10900), pop("5601", "alle", "2024", 20900)],
  "municipal_capacity.csv": [{ municipality_code: "5603", metric: "sykehjem_plasser", metric_label: "Sykehjemsplasser", period: "2024", value: "90", unit: "plasser", source_id: "ssb_11875", quality: "ekte" }],
  "municipal_needs.csv": [{ municipality_code: "5603", metric: "npr_i00_i99_antall", metric_label: "Hjerte- og karsykdommer – Antall", period: "2024", value: "410", unit: "personer", source_id: "fhi_nokkel_699", quality: "ekte" }],
  "patients_by_diagnosis.csv": [{ region_id: "56", region_navn: "Finnmark", region_type: "fylke", tjenesteomrade: "SOM", aldersgruppe: "alle", diagnose_kode: "_T", diagnose_navn: "I alt", metric: "pasienter", period: "2025", value: "30000", unit: "personer", source_id: "ssb_14824", quality: "ekte" }],
  "patients_by_diagnosis_detail.csv": [],
  "sites.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", lokalsykehus_id: "S01", lat: "70.67", lon: "23.65", site_type: "sykehus", akuttfunksjon: "ja" }],
  "hospital_beds.csv": [],
});

test("opptaksomrade unit lists kommuner, population, hf and site", () => {
  const units = buildOpptaksomradeUnits(tables());
  const s01 = units.find((u) => u.id === "opptaksomrade:S01");
  assert.deepEqual(s01.parent_ids, ["helseforetak:983974880"]);
  assert.deepEqual(s01.fakta.kommuner.map((k) => k.id), ["kommune:5603", "kommune:5601"]);
  assert.equal(s01.fakta.befolkning.SOM.alle[0].value, 40000);
  assert.deepEqual(s01.fakta.behandlingssted, { id: "behandlingssted:hammerfest", navn: "Hammerfest sykehus" });
  const d01 = units.find((u) => u.id === "opptaksomrade:D01");
  assert.equal(d01.fakta.omrade_type, "dps");
  assert.equal(d01.fakta.kommuner.length, 2);
  assert.equal(d01.fakta.behandlingssted, null);
});

test("fylke unit sums kommune population per aldersgruppe and lists HFs with kommune counts", () => {
  const [f] = buildFylkeUnits(tables());
  assert.equal(f.id, "fylke:56");
  assert.deepEqual(f.parent_ids, ["land:H00"]);
  assert.deepEqual(f.fakta.befolkning.alle.map((t) => [t.period, t.value]), [["2024", 31800], ["2025", 32000]]);
  assert.equal(f.fakta.befolkning["0-17"][0].value, 6000);
  assert.equal(f.fakta.pasienter.tidsserie.SOM.pasienter[0].value, 30000);
  assert.deepEqual(f.fakta.helseforetak, [{ id: "helseforetak:983974880", navn: "Finnmarkssykehuset HF", antall_kommuner: 2 }]);
});

test("kommune unit has tilhorighet, population, kapasitet and behov", () => {
  const k = buildKommuneUnits(tables()).find((u) => u.id === "kommune:5603");
  assert.deepEqual(k.parent_ids, ["fylke:56", "opptaksomrade:S01", "opptaksomrade:D01", "helseforetak:983974880"]);
  assert.deepEqual(k.fakta.tilhorighet.hf, { id: "helseforetak:983974880", navn: "Finnmarkssykehuset HF" });
  assert.deepEqual(k.fakta.tilhorighet.helseregion, { id: "helseregion:H05", navn: "Helse Nord" });
  assert.equal(k.fakta.befolkning.alle[1].value, 11000);
  assert.equal(k.fakta.kapasitet.sykehjem_plasser.navn, "Sykehjemsplasser");
  assert.equal(k.fakta.behov.npr_i00_i99_antall.serie[0].value, 410);
  assert.deepEqual(k.sok, ["hammerfest", "5603"]);
});
