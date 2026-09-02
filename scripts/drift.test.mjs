import { test } from "node:test";
import assert from "node:assert/strict";
import { driftReport } from "./drift.mjs";

test("reports OK and AVVIK lines", () => {
  const r = driftReport([{ navn: "a", live: 134, csv: 134 }, { navn: "b", live: 100, csv: 98 }, { navn: "c", live: 5, csv: undefined }]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.lines, ["OK     a: 134", "AVVIK  b: SSB 100, CSV 98", "AVVIK  c: SSB 5, CSV mangler"]);
  assert.equal(driftReport([{ navn: "a", live: 1, csv: 1 }]).ok, true);
});
