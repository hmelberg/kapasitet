import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUnits } from "./build.mjs";

const tables = () => ({
  "municipalities.csv": [{ municipality_code: "5603", county_code: "56", municipality_name: "Hammerfest", county_name: "Finnmark" }],
  "helseforetak.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" }],
  "opptaksomrader.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", hf_id: "983974880" }],
  "municipality_catchment.csv": [{ municipality_code: "5603", municipality_name: "Hammerfest", lokalsykehus_id: "S01", dps_id: "", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" }],
  "sites.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", lokalsykehus_id: "S01", lat: "70.67", lon: "23.65", site_type: "sykehus", akuttfunksjon: "ja" }],
});

test("buildUnits returns an index and one file per unit, with resolvable parents", () => {
  const { index, files } = buildUnits(tables(), { today: "2026-09-02" });
  assert.equal(index.generated, "2026-09-02");
  const ids = index.units.map((u) => u.id);
  assert.deepEqual(ids.slice(0, 5), ["land:H00", "helseregion:H03", "helseregion:H04", "helseregion:H05", "helseregion:H12"]);
  assert.ok(ids.includes("kommune:5603") && ids.includes("behandlingssted:hammerfest") && ids.includes("fylke:56") && ids.includes("opptaksomrade:S01"));
  assert.deepEqual(Object.keys(index.units[0]), ["id", "navn", "type", "parent_ids", "sok"]);
  assert.equal(files["kommune/5603.json"].navn, "Hammerfest");
  assert.equal(Object.keys(files).length, ids.length);
});

test("buildUnits throws on a parent that is not a unit", () => {
  const t = tables();
  t["municipality_catchment.csv"][0].hf_id = "999999999";
  assert.throws(() => buildUnits(t, { today: "2026-09-02" }), /ukjent forelder/);
});
