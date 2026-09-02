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
