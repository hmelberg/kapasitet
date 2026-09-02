import { test } from "node:test";
import assert from "node:assert/strict";
import { transformKostra, KOSTRA_TABLES } from "./ssb-kostra.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

test("maps contents codes to metric names and suffixes by extra dimension", () => {
  const datasets = {
    11875: makeJsonStat([{ id: "KOKkommuneregion0000", codes: ["5603", "EAK"] }, { id: "ContentsCode", codes: ["KOSsykehjdisppla0000"], labels: ["Plasser i sykehjem"] }, { id: "Tid", codes: ["2025"] }], [60, 40000]),
    11996: makeJsonStat([{ id: "KOKkommuneregion0000", codes: ["5603"] }, { id: "KOKavtaleform0000", codes: ["sum"] }, { id: "KOKfunksjon0000", codes: ["253"], labels: ["Helse- og omsorgstjenester i institusjon"] }, { id: "ContentsCode", codes: ["KOSlegeaarsverk0000"], labels: ["Legeårsverk"] }, { id: "Tid", codes: ["2025"] }], [1.5]),
    14533: makeJsonStat([{ id: "KOKkommuneregion0000", codes: ["5603"] }, { id: "KOKyrker0000", codes: ["TOT"], labels: ["Alle yrker"] }, { id: "ContentsCode", codes: ["KOSARBAARSVERKST0000"], labels: ["Årsverk"] }, { id: "Tid", codes: ["2025"] }], [210]),
  };
  const out = transformKostra({ datasets, municipalities: ["5603"] })["municipal_capacity.csv"];
  assert.deepEqual(out, [
    { municipality_code: "5603", metric: "sykehjem_plasser", metric_label: "Plasser i sykehjem", period: "2025", value: 60, unit: "plasser", source_id: "ssb_11875", quality: "ekte" },
    { municipality_code: "5603", metric: "legearsverk_253", metric_label: "Legeårsverk – Helse- og omsorgstjenester i institusjon", period: "2025", value: 1.5, unit: "arsverk", source_id: "ssb_11996", quality: "ekte" },
    { municipality_code: "5603", metric: "omsorg_arsverk_tot", metric_label: "Årsverk – Alle yrker", period: "2025", value: 210, unit: "arsverk", source_id: "ssb_14533", quality: "ekte" },
  ]);
});

test("unknown contents code throws", () => {
  const datasets = { 12293: makeJsonStat([{ id: "KOKkommuneregion0000", codes: ["5603"] }, { id: "ContentsCode", codes: ["KOSnytt0000"] }, { id: "Tid", codes: ["2025"] }], [1]) };
  assert.throws(() => transformKostra({ datasets, municipalities: ["5603"] }), /KOSnytt0000/);
});

test("every configured table has a query with region, contents and time", () => {
  for (const t of Object.values(KOSTRA_TABLES)) {
    const codes = t.query.map((q) => q.code);
    assert.ok(codes.includes("KOKkommuneregion0000") && codes.includes("ContentsCode") && codes.includes("Tid"), t.tableId);
  }
});
