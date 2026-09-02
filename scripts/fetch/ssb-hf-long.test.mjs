// scripts/fetch/ssb-hf-long.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHfLongFetcher } from "./ssb-hf-long.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

const f = makeHfLongFetcher({
  id: "ssb_13953", tableId: "13953", navn: "x", dim: "Yrke", dimCol: "yrkesgruppe_kode", dimLabelCol: "yrkesgruppe", contentsCode: "Arsverk", outFile: "hf_staffing.csv",
});

test("keeps land, regions and HF rows, drops RHF org.nr, normalises nbsp in labels", () => {
  const dataset = makeJsonStat(
    [
      { id: "HelseReg", codes: ["H00", "H05", "883658752", "983974880"], labels: ["Hele landet", "Helse Nord", "Helse Nord RHF", "Finnmarkssykehuset HF (2020-)"] },
      { id: "Yrke", codes: ["02"], labels: ["Sykepleiere mv."] },
      { id: "HelseTjenomr", codes: ["TOT"] },
      { id: "ContentsCode", codes: ["Arsverk"] },
      { id: "Tid", codes: ["2025"] },
    ],
    [100, 50, 50, 10],
  );
  const out = f.transform({ dataset, hfRegion: { "983974880": "H05" } });
  assert.deepEqual(out["hf_staffing.csv"], [
    { hf_id: "H00", hf_navn: "Hele landet", helseregion: "", yrkesgruppe_kode: "02", yrkesgruppe: "Sykepleiere mv.", metric: "arsverk", period: "2025", value: 100, unit: "arsverk", source_id: "ssb_13953", quality: "ekte" },
    { hf_id: "H05", hf_navn: "Helse Nord", helseregion: "H05", yrkesgruppe_kode: "02", yrkesgruppe: "Sykepleiere mv.", metric: "arsverk", period: "2025", value: 50, unit: "arsverk", source_id: "ssb_13953", quality: "ekte" },
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", yrkesgruppe_kode: "02", yrkesgruppe: "Sykepleiere mv.", metric: "arsverk", period: "2025", value: 10, unit: "arsverk", source_id: "ssb_13953", quality: "ekte" },
  ]);
  assert.deepEqual(f.columns["hf_staffing.csv"], ["hf_id", "hf_navn", "helseregion", "yrkesgruppe_kode", "yrkesgruppe", "metric", "period", "value", "unit", "source_id", "quality"]);
});

test("unknown HF org.nr throws", () => {
  const dataset = makeJsonStat([{ id: "HelseReg", codes: ["111111111"] }, { id: "Yrke", codes: ["02"] }, { id: "HelseTjenomr", codes: ["TOT"] }, { id: "ContentsCode", codes: ["Arsverk"] }, { id: "Tid", codes: ["2025"] }], [1]);
  assert.throws(() => f.transform({ dataset, hfRegion: {} }), /111111111/);
});
