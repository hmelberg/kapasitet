// scripts/fetch/ssb-pasienter.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transformPasienter, keepRegion, chapterCodes } from "./ssb-pasienter.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

test("keepRegion drops historic fylker and F00", () => {
  assert.equal(keepRegion("0", "Hele landet"), "land");
  assert.equal(keepRegion("55", "Troms - Romsa - Tromssa"), "fylke");
  assert.equal(keepRegion("54", "Troms og Finnmark - Romsa ja Finnmárku (2020-2023)"), null);
  assert.equal(keepRegion("19", "Troms - Romsa (-2019)"), null);
  assert.equal(keepRegion("H05", "Helseregion Nord"), "helseregion");
  assert.equal(keepRegion("F00", "Hele landet"), null);
});

test("chapterCodes picks _T and Roman numerals only", () => {
  assert.deepEqual(chapterCodes(["_T", "I", "A00-A09", "II", "XXI", "zz1"]), ["_T", "I", "II", "XXI"]);
});

const som = (Region, Region_label, Alder, Diagnose, Diagnose_label, ContentsCode, Tid, value) => ({ Region, Region_label, Kjonn: "0", Alder, Alder_label: Alder, Aktor: "_T", Diagnose, Diagnose_label, ContentsCode, ContentsCode_label: ContentsCode, Tid, value });

test("somatikk rows map ages, metrics and drop historic regions; VOP rows get diagnose _T", () => {
  const somRows = [
    som("56", "Finnmark - Finnmárku - Finmarkku", "00-17", "I", "(A00-B99) Infeksjoner", "Pasient", "2025", 120),
    som("56", "Finnmark - Finnmárku - Finmarkku", "999A", "_T", "I alt", "OppholdDogn", "2025", 9000),
    som("20", "Finnmark - Finnmárku (-2019)", "999A", "_T", "I alt", "Pasient", "2019", 1),
  ];
  const vopRows = [{ Region: "H05", Region_label: "Helseregion Nord", Kjonn: "0", Alder: "Ialt", Alder_label: "I alt", Aktor: "_T", ContentsCode: "PasientDognBeh", ContentsCode_label: "x", Tid: "2025", value: 800 }];
  const somDetail = makeJsonStat(
    [{ id: "Region", codes: ["56"], labels: ["Finnmark - Finnmárku - Finmarkku"] }, { id: "Kjonn", codes: ["0"] }, { id: "Alder", codes: ["999A"] }, { id: "Aktor", codes: ["_T"] }, { id: "Diagnose", codes: ["E10-E14"], labels: ["(E10-E14) Diabetes mellitus"] }, { id: "ContentsCode", codes: ["Pasient"] }, { id: "Tid", codes: ["2025"] }],
    [640],
  );
  const out = transformPasienter({ somRows, vopRows, somDetail });
  assert.deepEqual(out["patients_by_diagnosis.csv"], [
    { region_id: "56", region_navn: "Finnmark - Finnmárku - Finmarkku", region_type: "fylke", tjenesteomrade: "SOM", aldersgruppe: "0-17", diagnose_kode: "I", diagnose_navn: "(A00-B99) Infeksjoner", metric: "pasienter", period: "2025", value: 120, unit: "personer", source_id: "ssb_14824", quality: "ekte" },
    { region_id: "56", region_navn: "Finnmark - Finnmárku - Finmarkku", region_type: "fylke", tjenesteomrade: "SOM", aldersgruppe: "alle", diagnose_kode: "_T", diagnose_navn: "I alt", metric: "oppholdsdogn", period: "2025", value: 9000, unit: "dogn", source_id: "ssb_14824", quality: "ekte" },
    { region_id: "H05", region_navn: "Helseregion Nord", region_type: "helseregion", tjenesteomrade: "VOP", aldersgruppe: "alle", diagnose_kode: "_T", diagnose_navn: "I alt", metric: "pasienter_dogn", period: "2025", value: 800, unit: "personer", source_id: "ssb_14820", quality: "ekte" },
  ]);
  assert.deepEqual(out["patients_by_diagnosis_detail.csv"], [
    { region_id: "56", region_navn: "Finnmark - Finnmárku - Finmarkku", region_type: "fylke", tjenesteomrade: "SOM", aldersgruppe: "alle", diagnose_kode: "E10-E14", diagnose_navn: "(E10-E14) Diabetes mellitus", metric: "pasienter", period: "2025", value: 640, unit: "personer", source_id: "ssb_14824", quality: "ekte" },
  ]);
});
