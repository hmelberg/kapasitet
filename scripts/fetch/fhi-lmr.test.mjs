import { test } from "node:test";
import assert from "node:assert/strict";
import { transformLmr, GROUPS } from "./fhi-lmr.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

test("one row per group and year with users and per_1000", () => {
  const dataset = makeJsonStat(
    [{ id: "Atc_Verdi", codes: ["R03", "A10"] }, { id: "Kjonn_Verdi", codes: ["TOTALT"] }, { id: "Aldersgruppe_Verdi", codes: ["TOTALT"] }, { id: "Utlevering_Ar", codes: ["2024", "2025"] }, { id: "MEASURE_TYPE", codes: ["AntallBrukere", "Brukere_Per1000_Innbyggere"] }],
    [400000, 72.1, 410000, 73.0, 250000, 45.0, null, null],
  );
  const out = transformLmr({ dataset }, { today: "2026-09-02" })["medications.csv"];
  assert.deepEqual(out, [
    { group_code: "R03", group_label: "Astma og KOLS", period: "2024", users: 400000, per_1000: 72.1, source_id: "fhi_lmr_825", last_updated: "2026-09-02" },
    { group_code: "R03", group_label: "Astma og KOLS", period: "2025", users: 410000, per_1000: 73.0, source_id: "fhi_lmr_825", last_updated: "2026-09-02" },
    { group_code: "A10", group_label: "Diabetes", period: "2024", users: 250000, per_1000: 45.0, source_id: "fhi_lmr_825", last_updated: "2026-09-02" },
  ]);
  assert.equal(Object.keys(GROUPS).length, 14);
});
