import { test } from "node:test";
import assert from "node:assert/strict";
import { nest, num, sumRows, seriesBlock, unitPath, sok, patientsBlock } from "./common.mjs";

const row = (o) => ({ unit: "personer", quality: "ekte", source_id: "s", ...o });

test("num kaster på tom celle i stedet for å gi 0", () => {
  assert.equal(num("7"), 7);
  assert.equal(num(0), 0);
  for (const v of ["", " ", "\t", null, undefined]) assert.throws(() => num(v), /Ikke et tall/, `num(${JSON.stringify(v)}) burde kaste`);
});

test("nest builds nested objects with period-sorted Tall[] leaves, or single Tall", () => {
  const rows = [row({ a: "x", b: "p", period: "2025", value: "2" }), row({ a: "x", b: "p", period: "2024", value: "1" }), row({ a: "y", b: "q", period: "2024", value: "3" })];
  const n = nest(rows, ["a", "b"]);
  assert.deepEqual(n.x.p.map((t) => [t.period, t.value]), [["2024", 1], ["2025", 2]]);
  assert.equal(n.y.q[0].value, 3);
  assert.equal(nest(rows.slice(2), ["a", "b"], { single: true }).y.q.value, 3);
  assert.throws(() => nest(rows.slice(0, 2), ["a", "b"], { single: true }), /Duplikat/);
});

test("sumRows sums by keys and keeps the worst quality", () => {
  const rows = [row({ g: "alle", period: "2025", value: "10" }), row({ g: "alle", period: "2025", value: "5", quality: "estimat" }), row({ g: "alle", period: "2024", value: "1" })];
  const s = sumRows(rows, ["g", "period"]);
  assert.deepEqual(s.map((r) => [r.period, r.value, r.quality]), [["2025", 15, "estimat"], ["2024", 1, "ekte"]]);
});

test("seriesBlock, unitPath and sok", () => {
  const b = seriesBlock([row({ metric: "m1", metric_label: "Metric 1", period: "2025", value: "7" })], "metric", "metric_label");
  assert.deepEqual(b, { m1: { navn: "Metric 1", serie: [{ value: 7, unit: "personer", period: "2025", quality: "ekte", source_id: "s" }] } });
  assert.equal(unitPath("kommune:5603"), "kommune/5603.json");
  assert.deepEqual(sok("Hammerfest", "5603", "", "hammerfest"), ["hammerfest", "5603"]);
});

test("patientsBlock splits totals time series, latest-year chapters and detail", () => {
  const p = (o) => row({ region_id: "56", tjenesteomrade: "SOM", metric: "pasienter", unit: "personer", ...o });
  const main = [
    p({ diagnose_kode: "_T", diagnose_navn: "I alt", aldersgruppe: "alle", period: "2024", value: "100" }),
    p({ diagnose_kode: "_T", diagnose_navn: "I alt", aldersgruppe: "alle", period: "2025", value: "110" }),
    p({ diagnose_kode: "IX", diagnose_navn: "Sirkulasjon", aldersgruppe: "67-79", period: "2025", value: "20" }),
  ];
  const detail = [p({ diagnose_kode: "I21", diagnose_navn: "Hjerteinfarkt", aldersgruppe: "alle", period: "2025", value: "5" })];
  const b = patientsBlock(main, detail);
  assert.equal(b.periode_siste, "2025");
  assert.deepEqual(b.diagnoser, { _T: "I alt", IX: "Sirkulasjon", I21: "Hjerteinfarkt" });
  assert.deepEqual(b.tidsserie.SOM.pasienter.map((t) => t.value), [100, 110]);
  assert.equal(b.siste_aar.SOM.IX.pasienter["67-79"].value, 20);
  assert.equal(b.undergrupper_siste_aar.SOM.I21.pasienter.value, 5);
  assert.equal(patientsBlock([], []), null);
});
