import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeManifest } from "./manifest.mjs";

test("merges previous entries, static entries and fresh results; fresh wins", () => {
  const previous = { generated: "2026-01-01", sources: [{ id: "ssb_13942", navn: "old", url: "u", api_url: "a", query: "q", lisens: "l", last_fetched: "2026-01-01", tables_out: ["hf_activity.csv"] }, { id: "stale", navn: "x", url: "", api_url: "", query: "", lisens: "", last_fetched: "2025-01-01", tables_out: [] }] };
  const statics = [{ id: "curated_helse_nord", navn: "Kuraterte senger", url: "https://…", api_url: "", query: "", lisens: "manuell", tables_out: ["hospital_beds.csv"] }];
  const results = [{ def: { meta: { id: "ssb_13942", navn: "new", url: "u2", api_url: "a2", query: "q2", lisens: "NLOD" } }, result: { id: "ssb_13942", tables: ["hf_activity.csv", "helseforetak.csv"], rows: {} } }];
  const m = mergeManifest(previous, statics, results, { today: "2026-09-02" });
  assert.equal(m.generated, "2026-09-02");
  assert.deepEqual(m.sources.map((s) => s.id), ["curated_helse_nord", "ssb_13942", "stale"]);
  const s = m.sources.find((x) => x.id === "ssb_13942");
  assert.deepEqual(s, { id: "ssb_13942", navn: "new", url: "u2", api_url: "a2", query: "q2", lisens: "NLOD", last_fetched: "2026-09-02", tables_out: ["hf_activity.csv", "helseforetak.csv"] });
  assert.equal(m.sources.find((x) => x.id === "curated_helse_nord").last_fetched, "");
});

test("sub_sources blir egne oppføringer som arver lisens og last_fetched fra fetcheren", () => {
  const defs = [{ meta: { id: "ssb_kostra", sub_sources: [
    { id: "ssb_11875", navn: "KOSTRA 11875", url: "https://www.ssb.no/statbank/table/11875", api_url: "https://data.ssb.no/api/v0/no/table/11875/", tables_out: ["municipal_capacity.csv"] },
    { id: "ssb_12293", navn: "KOSTRA 12293", url: "https://www.ssb.no/statbank/table/12293", api_url: "https://data.ssb.no/api/v0/no/table/12293/" },
  ] } }, { meta: { id: "ssb_13942" } }];
  const results = [{ def: { meta: { id: "ssb_kostra", navn: "KOSTRA", url: "u", api_url: "a", query: "q", lisens: "NLOD 2.0" } }, result: { id: "ssb_kostra", tables: ["municipal_capacity.csv"], rows: {} } }];
  const m = mergeManifest(null, [], results, { today: "2026-09-02", defs });
  assert.deepEqual(m.sources.map((s) => s.id), ["ssb_11875", "ssb_12293", "ssb_kostra"]);
  assert.deepEqual(m.sources[0], { id: "ssb_11875", navn: "KOSTRA 11875", url: "https://www.ssb.no/statbank/table/11875", api_url: "https://data.ssb.no/api/v0/no/table/11875/", query: "", lisens: "NLOD 2.0", last_fetched: "2026-09-02", tables_out: ["municipal_capacity.csv"], parent: "ssb_kostra" });
  // uten egen tables_out arves fetcherens
  assert.deepEqual(m.sources[1].tables_out, ["municipal_capacity.csv"]);
});

test("sub_sources hoppes over når fetcheren selv ikke er i manifestet", () => {
  const defs = [{ meta: { id: "ssb_kostra", sub_sources: [{ id: "ssb_11875", navn: "KOSTRA 11875", url: "u", api_url: "a" }] } }];
  const m = mergeManifest(null, [], [], { today: "2026-09-02", defs });
  assert.deepEqual(m.sources, []);
});
