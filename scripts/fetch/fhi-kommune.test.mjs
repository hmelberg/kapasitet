import { test } from "node:test";
import assert from "node:assert/strict";
import { transformFhiKommune, parseSted } from "./fhi-kommune.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

test("parseSted keeps only current kommune codes", () => {
  assert.equal(parseSted("5603 Hammerfest (2024->)"), "5603");
  assert.equal(parseSted("5406 Hammerfest (2020-2023)"), null);
  assert.equal(parseSted("Landet"), null);
});

test("builds npr/kpr/hjemmetjeneste metrics, normalises AAR and drops suppressed cells", () => {
  const npr699 = makeJsonStat(
    [{ id: "GEO", codes: ["5603", "56"] }, { id: "AAR", codes: ["2024_2024"] }, { id: "KJONN", codes: ["0"] }, { id: "ALDER", codes: ["0_120"] }, { id: "KODEGRUPPE", codes: ["I00_I99"], labels: ["Hjerte- og karsykdommer"] }, { id: "MEASURE_TYPE", codes: ["TELLER", "RATE"], labels: ["Antall", "Per 1000"] }],
    [410, 39.2, "k", 41.0],
  );
  const kpr370 = makeJsonStat(
    [{ id: "GEO", codes: ["5603"] }, { id: "AAR", codes: ["2024_2024"] }, { id: "KJONN", codes: ["0"] }, { id: "ALDER", codes: ["0_74"] }, { id: "KODEGRUPPE", codes: ["Skader"], labels: ["Skader"] }, { id: "MEASURE_TYPE", codes: ["TELLER"], labels: ["Antall"] }],
    [1200],
  );
  const kpr634 = makeJsonStat(
    [{ id: "Sted", codes: ["5603 Hammerfest (2024->)", "5406 Hammerfest (2020-2023)"] }, { id: "AAR", codes: ["2025"] }, { id: "tjtjentypeNavn", codes: ["Totalt_antall_brukere", "Tj_1"], labels: ["Totalt antall brukere", "Praktisk bistand"] }, { id: "MEASURE_TYPE", codes: ["Antall_Brukere"] }],
    [300, 120, 290, 110],
  );
  const out = transformFhiKommune({ npr699, kpr370, kpr634, municipalities: ["5603"] })["municipal_needs.csv"];
  assert.deepEqual(out, [
    { municipality_code: "5603", metric: "npr_i00_i99_antall", metric_label: "Hjerte- og karsykdommer – Antall", period: "2024", value: 410, unit: "personer", source_id: "fhi_nokkel_699", quality: "ekte" },
    { municipality_code: "5603", metric: "npr_i00_i99_rate", metric_label: "Hjerte- og karsykdommer – Per 1000", period: "2024", value: 39.2, unit: "rate", source_id: "fhi_nokkel_699", quality: "ekte" },
    { municipality_code: "5603", metric: "kpr_skader_0_74_antall", metric_label: "Skader – Antall", period: "2024", value: 1200, unit: "personer", source_id: "fhi_nokkel_370", quality: "ekte" },
    { municipality_code: "5603", metric: "hjemmetjeneste_brukere_totalt", metric_label: "Totalt antall brukere", period: "2025", value: 300, unit: "personer", source_id: "fhi_kpr_634", quality: "ekte" },
    { municipality_code: "5603", metric: "hjemmetjeneste_tj_1", metric_label: "Praktisk bistand", period: "2025", value: 120, unit: "personer", source_id: "fhi_kpr_634", quality: "ekte" },
  ]);
});
