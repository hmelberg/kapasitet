import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonStatToRows, makeJsonStat } from "./jsonstat.mjs";

test("walks row-major with the last dimension fastest and drops non-numeric cells", () => {
  const ds = makeJsonStat(
    [{ id: "Region", codes: ["A", "B"], labels: ["Alfa", "Beta"] }, { id: "Tid", codes: ["2024", "2025"] }],
    [1, 2, null, "k"],
  );
  assert.deepEqual(jsonStatToRows(ds), [
    { Region: "A", Region_label: "Alfa", Tid: "2024", Tid_label: "2024", value: 1 },
    { Region: "A", Region_label: "Alfa", Tid: "2025", Tid_label: "2025", value: 2 },
  ]);
});

test("accepts object-form category index ordered by position", () => {
  const ds = makeJsonStat([{ id: "X", codes: ["p", "q"] }], [10, 20]);
  ds.dimension.X.category.index = { q: 1, p: 0 };
  assert.deepEqual(jsonStatToRows(ds).map((r) => [r.X, r.value]), [["p", 10], ["q", 20]]);
});

test("rejects a non-dataset", () => {
  assert.throws(() => jsonStatToRows({ foo: 1 }), /json-stat2/);
});
