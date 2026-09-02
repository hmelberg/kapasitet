import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSiteUnits, buildHfUnits, buildRegionUnits, bedsBlock } from "./hf.mjs";

const q = { unit: "senger", quality: "ekte", source_id: "ssb_13942" };
const tables = () => ({
  "municipalities.csv": [{ municipality_code: "5603", county_code: "56", municipality_name: "Hammerfest", county_name: "Finnmark" }],
  "helseforetak.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" }],
  "opptaksomrader.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", hf_id: "983974880" }],
  "municipality_catchment.csv": [{ municipality_code: "5603", municipality_name: "Hammerfest", lokalsykehus_id: "S01", dps_id: "D01", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" }],
  "hf_activity.csv": [
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: "134", ...q },
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2024", value: "130", ...q },
    { hf_id: "H05", hf_navn: "Helse Nord", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: "1143", ...q },
    { hf_id: "H00", hf_navn: "Hele landet", helseregion: "", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: "10000", ...q },
  ],
  "hf_staffing.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", yrkesgruppe_kode: "01", yrkesgruppe: "Leger", metric: "arsverk", period: "2025", value: "200", unit: "arsverk", source_id: "ssb_13953", quality: "ekte" }],
  "hf_specialists.csv": [],
  "catchment_population.csv": [
    { omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", tjenesteomrade: "SOM", aldersgruppe: "alle", period: "2025", value: "40000", unit: "personer", source_id: "ssb_13982", quality: "ekte" },
    { omrade_id: "983974880", omrade_navn: "Finnmarkssykehuset HF", omrade_type: "hf", tjenesteomrade: "SOM", aldersgruppe: "alle", period: "2025", value: "75000", unit: "personer", source_id: "ssb_13982", quality: "ekte" },
  ],
  "patients_by_diagnosis.csv": [{ region_id: "H05", region_navn: "Helse Nord", region_type: "helseregion", tjenesteomrade: "SOM", aldersgruppe: "alle", diagnose_kode: "_T", diagnose_navn: "I alt", metric: "pasienter", period: "2025", value: "150000", unit: "personer", source_id: "ssb_14824", quality: "ekte" }],
  "patients_by_diagnosis_detail.csv": [],
  "sites.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", lokalsykehus_id: "S01", lat: "70.67", lon: "23.65", site_type: "sykehus", akuttfunksjon: "ja" }],
  "hospital_beds.csv": [
    { site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", kategori: "somatikk", senger: "46", period: "2024", quality: "ekte", source_url: "https://a", source_note: "n", last_verified: "2026-09-02" },
    { site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", kategori: "somatikk", senger: "50", period: "2025", quality: "ekte", source_url: "https://b", source_note: "n2", last_verified: "2026-09-02" },
  ],
});

test("site unit has beds (latest period), parents and catchment population", () => {
  const [s] = buildSiteUnits(tables());
  assert.equal(s.id, "behandlingssted:hammerfest");
  assert.deepEqual(s.parent_ids, ["helseforetak:983974880", "kommune:5603"]);
  assert.deepEqual(s.fakta.senger.somatikk, { value: 50, unit: "senger", period: "2025", quality: "ekte", source_id: "curated_helse_nord", source_url: "https://b", source_note: "n2", last_verified: "2026-09-02" });
  assert.equal(s.fakta.opptaksomrade.befolkning_alle.value, 40000);
  assert.equal(s.fakta.lat, 70.67);
});

test("hf unit aggregates activity, staffing, population, areas, kommuner and sites", () => {
  const [h] = buildHfUnits(tables());
  assert.equal(h.id, "helseforetak:983974880");
  assert.deepEqual(h.parent_ids, ["helseregion:H05"]);
  assert.deepEqual(h.fakta.aktivitet.SOM.dognplasser.map((t) => t.value), [130, 134]);
  assert.equal(h.fakta.arsverk["01"].navn, "Leger");
  assert.equal(h.fakta.befolkning.SOM.alle[0].value, 75000);
  assert.deepEqual(h.fakta.opptaksomrader, [{ id: "opptaksomrade:S01", navn: "Hammerfest", type: "lokalsykehus" }]);
  assert.deepEqual(h.fakta.kommuner, [{ id: "kommune:5603", navn: "Hammerfest" }]);
  assert.equal(h.fakta.behandlingssteder[0].senger.somatikk.value, 50);
});

test("region units: land + four helseregioner with activity, patients and HF list", () => {
  const units = buildRegionUnits(tables());
  assert.deepEqual(units.map((u) => u.id), ["land:H00", "helseregion:H03", "helseregion:H04", "helseregion:H05", "helseregion:H12"]);
  const nord = units.find((u) => u.id === "helseregion:H05");
  assert.deepEqual(nord.parent_ids, ["land:H00"]);
  assert.equal(nord.fakta.aktivitet.SOM.dognplasser[0].value, 1143);
  assert.equal(nord.fakta.pasienter.tidsserie.SOM.pasienter[0].value, 150000);
  assert.deepEqual(nord.fakta.helseforetak, [{ id: "helseforetak:983974880", navn: "Finnmarkssykehuset HF", type: "hf" }]);
  assert.equal(units[0].fakta.aktivitet.SOM.dognplasser[0].value, 10000);
});

test("bedsBlock keeps the latest period per kategori", () => {
  assert.equal(bedsBlock(tables()["hospital_beds.csv"]).somatikk.period, "2025");
});
