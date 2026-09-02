// scripts/fetch/ssb-13982.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transform13982 } from "./ssb-13982.mjs";

const row = (HelseReg, HelseReg_label, HelseTjenomr, Alder, Tid, value) => ({ HelseReg, HelseReg_label, HelseTjenomr, HelseTjenomr_label: HelseTjenomr, Kjonn: "0", Kjonn_label: "Begge kjønn", Alder, Alder_label: Alder, Tid, Tid_label: Tid, value });

test("aggregates single years into groups plus 'alle' and types the area by code", () => {
  const rows = [
    row("S01", "Hammerfest", "SOM", "000", "2025", 10),
    row("S01", "Hammerfest", "SOM", "017", "2025", 5),
    row("S01", "Hammerfest", "SOM", "090", "2025", 2),
    row("S01", "Hammerfest", "SOM", "105+", "2025", 1),
    row("D01", "DPS Vest-Finnmark", "DPS", "030", "2025", 7),
    row("983974880", "Finnmarkssykehuset HF (2020-)", "SOM", "030", "2025", 7),
    row("H05", "Helseregion Nord", "SOM", "030", "2025", 7),
    row("H00", "Hele landet", "SOM", "030", "2025", 7),
  ];
  const out = transform13982({ rows })["catchment_population.csv"];
  const s01 = out.filter((r) => r.omrade_id === "S01");
  assert.deepEqual(s01.map((r) => [r.aldersgruppe, r.value]), [["0-17", 15], ["90+", 3], ["alle", 18]]);
  assert.deepEqual(s01[0], { omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", tjenesteomrade: "SOM", aldersgruppe: "0-17", period: "2025", value: 15, unit: "personer", source_id: "ssb_13982", quality: "ekte" });
  assert.equal(out.find((r) => r.omrade_id === "D01").omrade_type, "dps");
  const hf = out.find((r) => r.omrade_id === "983974880");
  assert.equal(hf.omrade_type, "hf");
  assert.equal(hf.omrade_navn, "Finnmarkssykehuset HF");
  assert.equal(out.find((r) => r.omrade_id === "H05").omrade_type, "helseregion");
  assert.equal(out.find((r) => r.omrade_id === "H00").omrade_type, "land");
});
