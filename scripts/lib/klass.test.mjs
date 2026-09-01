import { test } from "node:test";
import assert from "node:assert/strict";
import { klassCodes, klassCorrespondence } from "./klass.mjs";
import { fakeFetch } from "./test-helpers.mjs";

test("klassCodes builds the URL and normalises level to a number", async () => {
  const fetchImpl = fakeFetch([{ json: { codes: [{ code: "S01", parentCode: "983974880", level: "3", name: "Hammerfest", extra: 1 }] } }]);
  const out = await klassCodes(629, { level: 3, fetchImpl });
  assert.equal(fetchImpl.calls[0].url, "https://data.ssb.no/api/klass/v1/classifications/629/codes?from=2025-01-01&to=2025-01-02&selectLevel=3");
  assert.deepEqual(out, [{ code: "S01", parentCode: "983974880", level: 3, name: "Hammerfest" }]);
});

test("klassCorrespondence returns the four map fields", async () => {
  const fetchImpl = fakeFetch([{ json: { correspondenceMaps: [{ sourceCode: "S01", sourceName: "Hammerfest", targetCode: "5601", targetName: "Alta", x: 1 }] } }]);
  const out = await klassCorrespondence(2688, { fetchImpl });
  assert.equal(fetchImpl.calls[0].url, "https://data.ssb.no/api/klass/v1/correspondencetables/2688");
  assert.deepEqual(out, [{ sourceCode: "S01", sourceName: "Hammerfest", targetCode: "5601", targetName: "Alta" }]);
});
