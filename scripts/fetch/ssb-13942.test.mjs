// scripts/fetch/ssb-13942.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transform13942 } from "./ssb-13942.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

const dataset = makeJsonStat(
  [
    { id: "HelseReg", codes: ["H00", "H05_AV", "983974880", "984027737"], labels: ["Hele landet", "Avtalespesialister i Helseregion Nord", "Finnmarkssykehuset HF", "Haraldsplass diakonale sykehus AS"] },
    { id: "HelseTjenomr", codes: ["SOM"], labels: ["Somatikk"] },
    { id: "ContentsCode", codes: ["Dognplass", "BeleggSsb"], labels: ["Døgnplasser", "Beleggsprosent"] },
    { id: "Tid", codes: ["2025"] },
  ],
  [10000, 85, 1000, 84, 134, 80, 100, 90],
);
const klass = [
  { code: "883658752", parentCode: null, level: 1, name: "Helse Nord RHF" },
  { code: "983974880", parentCode: "883658752", level: 2, name: "Finnmarkssykehuset HF" },
];

test("hf_activity rows carry metric mapping, unit and region", () => {
  const { "hf_activity.csv": rows } = transform13942({ dataset, klass });
  const fin = rows.filter((r) => r.hf_id === "983974880");
  assert.deepEqual(fin, [
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: 134, unit: "senger", source_id: "ssb_13942", quality: "ekte" },
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "beleggsprosent", period: "2025", value: 80, unit: "prosent", source_id: "ssb_13942", quality: "ekte" },
  ]);
  assert.equal(rows.find((r) => r.hf_id === "H00").helseregion, "");
  assert.equal(rows.find((r) => r.hf_id === "H05_AV").helseregion, "H05");
  assert.equal(rows.find((r) => r.hf_id === "984027737").helseregion, "H03");
});

test("helseforetak.csv has one row per org.nr with rhf and type", () => {
  const { "helseforetak.csv": hf } = transform13942({ dataset, klass });
  assert.deepEqual(hf, [
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" },
    { hf_id: "984027737", hf_navn: "Haraldsplass diakonale sykehus AS", rhf_id: "983658725", helseregion: "H03", type: "privat" },
  ]);
});

test("unknown metric or org.nr throws", () => {
  const bad = makeJsonStat([{ id: "HelseReg", codes: ["H00"] }, { id: "HelseTjenomr", codes: ["SOM"] }, { id: "ContentsCode", codes: ["Nytt"] }, { id: "Tid", codes: ["2025"] }], [1]);
  assert.throws(() => transform13942({ dataset: bad, klass }), /\[ssb_13942\]/);
  const unknownOrg = makeJsonStat([{ id: "HelseReg", codes: ["111111111"] }, { id: "HelseTjenomr", codes: ["SOM"] }, { id: "ContentsCode", codes: ["Dognplass"] }, { id: "Tid", codes: ["2025"] }], [1]);
  assert.throws(() => transform13942({ dataset: unknownOrg, klass }), /\[ssb_13942\]/);
});

test("invalid HelseReg code (neither 9 digits nor H) throws with source id", () => {
  const invalid = makeJsonStat([{ id: "HelseReg", codes: ["X1"] }, { id: "HelseTjenomr", codes: ["SOM"] }, { id: "ContentsCode", codes: ["Dognplass"] }, { id: "Tid", codes: ["2025"] }], [1]);
  assert.throws(() => transform13942({ dataset: invalid, klass }), /\[ssb_13942\]/);
});
