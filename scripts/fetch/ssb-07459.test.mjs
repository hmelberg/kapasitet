import { test } from "node:test";
import assert from "node:assert/strict";
import { transform07459 } from "./ssb-07459.mjs";

const row = (Region, Kjonn, Alder, Tid, value) => ({ Region, Region_label: Region, Kjonn, Kjonn_label: Kjonn, Alder, Alder_label: Alder, Tid, Tid_label: Tid, value });

test("sums sexes, groups ages, keeps only current kommuner", () => {
  const rows = [
    row("5603", "1", "030", "2025", 100), row("5603", "2", "030", "2025", 90),
    row("5603", "1", "085", "2025", 4),
    row("5406", "1", "030", "2025", 999), // historic Hammerfest code
    row("56", "1", "030", "2025", 999), // fylke
    row("0", "1", "030", "2025", 999),
  ];
  const out = transform07459({ rows, municipalities: ["5603"] })["municipal_population.csv"];
  assert.deepEqual(out, [
    { municipality_code: "5603", aldersgruppe: "30-49", period: "2025", value: 190, unit: "personer", source_id: "ssb_07459", quality: "ekte" },
    { municipality_code: "5603", aldersgruppe: "80-89", period: "2025", value: 4, unit: "personer", source_id: "ssb_07459", quality: "ekte" },
    { municipality_code: "5603", aldersgruppe: "alle", period: "2025", value: 194, unit: "personer", source_id: "ssb_07459", quality: "ekte" },
  ]);
});
