import { test } from "node:test";
import assert from "node:assert/strict";
import { item, all, ssbQuery, ssbQueryChunked, SSB_BASE } from "./ssb.mjs";
import { makeJsonStat } from "./jsonstat.mjs";
import { fakeFetch } from "./test-helpers.mjs";

test("ssbQuery posts the json-stat2 query envelope", async () => {
  const ds = makeJsonStat([{ id: "Tid", codes: ["2025"] }], [1]);
  const fetchImpl = fakeFetch([{ json: ds }]);
  const out = await ssbQuery("13942", [all("HelseReg"), item("Tid", ["2025"])], { fetchImpl });
  assert.equal(fetchImpl.calls[0].url, `${SSB_BASE}/13942`);
  assert.deepEqual(fetchImpl.calls[0].body, {
    query: [
      { code: "HelseReg", selection: { filter: "all", values: ["*"] } },
      { code: "Tid", selection: { filter: "item", values: ["2025"] } },
    ],
    response: { format: "json-stat2" },
  });
  assert.equal(out.value[0], 1);
});

test("ssbQueryChunked runs one query per chunk value and concatenates rows", async () => {
  const fetchImpl = fakeFetch([
    { json: makeJsonStat([{ id: "Tid", codes: ["2024"] }], [5]) },
    { json: makeJsonStat([{ id: "Tid", codes: ["2025"] }], [7]) },
  ]);
  const { rows } = await ssbQueryChunked("07459", [all("Region"), item("Tid", ["2024", "2025"])], "Tid", { fetchImpl });
  assert.deepEqual(fetchImpl.calls.map((c) => c.body.query[1].selection.values), [["2024"], ["2025"]]);
  assert.deepEqual(rows.map((r) => [r.Tid, r.value]), [["2024", 5], ["2025", 7]]);
});

test("ssbQueryChunked refuses a non-item chunk dimension", async () => {
  await assert.rejects(ssbQueryChunked("1", [all("Tid")], "Tid", { fetchImpl: fakeFetch([]) }), /item-seleksjon/);
});
