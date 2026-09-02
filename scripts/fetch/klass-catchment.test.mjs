import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatchment } from "./klass-catchment.mjs";

const raw = {
  codes629: [
    { code: "883658752", parentCode: null, level: 1, name: "Helse Nord RHF" },
    { code: "983974880", parentCode: "883658752", level: 2, name: "Finnmarkssykehuset HF" },
    { code: "S01", parentCode: "983974880", level: 3, name: "Hammerfest" },
    { code: "S02", parentCode: "983974880", level: 3, name: "Kirkenes" },
    { code: "56010101", parentCode: "S01", level: 4, name: "Alta sentrum" },
    { code: "56010102", parentCode: "S01", level: 4, name: "Bossekop" },
    { code: "56010201", parentCode: "S02", level: 4, name: "Kviby" },
  ],
  codes632: [
    { code: "883658752", parentCode: null, level: 1, name: "Helse Nord RHF" },
    { code: "983974880", parentCode: "883658752", level: 2, name: "Finnmarkssykehuset HF" },
    { code: "D01", parentCode: "983974880", level: 3, name: "DPS Vest-Finnmark" },
    { code: "5601", parentCode: "D01", level: 4, name: "Alta" },
  ],
  corr2688: [
    { sourceCode: "S01", sourceName: "Hammerfest", targetCode: "5601", targetName: "Alta" },
    { sourceCode: "S02", sourceName: "Kirkenes", targetCode: "5601", targetName: "Alta" },
    { sourceCode: "S02", sourceName: "Kirkenes", targetCode: "5605", targetName: "Sør-Varanger" },
  ],
  corr2690: [{ sourceCode: "D01", sourceName: "DPS Vest-Finnmark", targetCode: "5601", targetName: "Alta" }],
  municipalities: [
    { municipality_code: "5601", municipality_name: "Alta" },
    { municipality_code: "5605", municipality_name: "Sør-Varanger" },
    { municipality_code: "9999", municipality_name: "Ukjent" },
  ],
};

test("opptaksomrader lists S and D areas with their HF", () => {
  const { opptaksomrader } = buildCatchment(raw);
  assert.deepEqual(opptaksomrader, [
    { omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", hf_id: "983974880" },
    { omrade_id: "S02", omrade_navn: "Kirkenes", omrade_type: "lokalsykehus", hf_id: "983974880" },
    { omrade_id: "D01", omrade_navn: "DPS Vest-Finnmark", omrade_type: "dps", hf_id: "983974880" },
  ]);
});

test("split kommune gets the area with most grunnkretser and quality=avledet; missing DPS is noted", () => {
  const { catchment } = buildCatchment(raw);
  const alta = catchment.find((r) => r.municipality_code === "5601");
  assert.equal(alta.lokalsykehus_id, "S01");
  assert.equal(alta.dps_id, "D01");
  assert.equal(alta.hf_id, "983974880");
  assert.equal(alta.helseregion, "H05");
  assert.equal(alta.quality, "avledet");
  assert.match(alta.note, /Delt lokalsykehus: S01 Hammerfest \(2\), S02 Kirkenes \(1\)/);
  const sv = catchment.find((r) => r.municipality_code === "5605");
  assert.equal(sv.lokalsykehus_id, "S02");
  assert.equal(sv.dps_id, "");
  assert.equal(sv.quality, "avledet");
  assert.match(sv.note, /Ikke i KLASS 2690/);
  const ukjent = catchment.find((r) => r.municipality_code === "9999");
  assert.equal(ukjent.lokalsykehus_id, "");
  assert.equal(ukjent.hf_id, "");
  assert.match(ukjent.note, /Ikke i KLASS 2688/);
});

test("split DPS: whole-kommune code (10000 weight) beats grunnkrets codes", () => {
  const rawDpsSplit = {
    codes629: [
      { code: "883658752", parentCode: null, level: 1, name: "Helse Nord RHF" },
      { code: "983974880", parentCode: "883658752", level: 2, name: "Finnmarkssykehuset HF" },
      { code: "S01", parentCode: "983974880", level: 3, name: "Hammerfest" },
      { code: "56010101", parentCode: "S01", level: 4, name: "Alta sentrum" },
    ],
    codes632: [
      { code: "883658752", parentCode: null, level: 1, name: "Helse Nord RHF" },
      { code: "983974880", parentCode: "883658752", level: 2, name: "Finnmarkssykehuset HF" },
      { code: "D01", parentCode: "983974880", level: 3, name: "DPS Vest" },
      { code: "D02", parentCode: "983974880", level: 3, name: "DPS Øst" },
      { code: "56010101", parentCode: "D01", level: 4, name: "Alta-grunnkrets-1" },
      { code: "56010102", parentCode: "D01", level: 4, name: "Alta-grunnkrets-2" },
      { code: "56010103", parentCode: "D01", level: 4, name: "Alta-grunnkrets-3" },
      { code: "5601", parentCode: "D02", level: 4, name: "Alta" },
    ],
    corr2688: [{ sourceCode: "S01", sourceName: "Hammerfest", targetCode: "5601", targetName: "Alta" }],
    corr2690: [
      { sourceCode: "D01", sourceName: "DPS Vest", targetCode: "5601", targetName: "Alta" },
      { sourceCode: "D02", sourceName: "DPS Øst", targetCode: "5601", targetName: "Alta" },
    ],
    municipalities: [{ municipality_code: "5601", municipality_name: "Alta" }],
  };
  const { catchment } = buildCatchment(rawDpsSplit);
  const alta = catchment[0];
  assert.equal(alta.dps_id, "D02");
  assert.equal(alta.quality, "avledet");
  assert.match(alta.note, /Delt DPS: D02 DPS Øst \(10000\), D01 DPS Vest \(3\)/);
});

test("throws when HF's RHF is not in RHF_TO_REGION", () => {
  const rawUnknownRhf = {
    codes629: [
      { code: "111111111", parentCode: null, level: 1, name: "Unknown RHF" },
      { code: "983974880", parentCode: "111111111", level: 2, name: "Finnmarkssykehuset HF" },
      { code: "S01", parentCode: "983974880", level: 3, name: "Hammerfest" },
      { code: "56010101", parentCode: "S01", level: 4, name: "Alta sentrum" },
    ],
    codes632: [
      { code: "111111111", parentCode: null, level: 1, name: "Unknown RHF" },
      { code: "983974880", parentCode: "111111111", level: 2, name: "Finnmarkssykehuset HF" },
      { code: "D01", parentCode: "983974880", level: 3, name: "DPS Vest-Finnmark" },
      { code: "5601", parentCode: "D01", level: 4, name: "Alta" },
    ],
    corr2688: [{ sourceCode: "S01", sourceName: "Hammerfest", targetCode: "5601", targetName: "Alta" }],
    corr2690: [{ sourceCode: "D01", sourceName: "DPS Vest-Finnmark", targetCode: "5601", targetName: "Alta" }],
    municipalities: [{ municipality_code: "5601", municipality_name: "Alta" }],
  };
  assert.throws(
    () => buildCatchment(rawUnknownRhf),
    /ukjent helseregion/
  );
});

test("throws when corr2688 references an S code not in codes629", () => {
  const rawDanglingCode = {
    codes629: [
      { code: "883658752", parentCode: null, level: 1, name: "Helse Nord RHF" },
      { code: "983974880", parentCode: "883658752", level: 2, name: "Finnmarkssykehuset HF" },
      { code: "S01", parentCode: "983974880", level: 3, name: "Hammerfest" },
      { code: "56010101", parentCode: "S01", level: 4, name: "Alta sentrum" },
    ],
    codes632: [
      { code: "883658752", parentCode: null, level: 1, name: "Helse Nord RHF" },
      { code: "983974880", parentCode: "883658752", level: 2, name: "Finnmarkssykehuset HF" },
      { code: "D01", parentCode: "983974880", level: 3, name: "DPS Vest-Finnmark" },
      { code: "5601", parentCode: "D01", level: 4, name: "Alta" },
    ],
    corr2688: [{ sourceCode: "SNONEXISTENT", sourceName: "Nonexistent", targetCode: "5601", targetName: "Alta" }],
    corr2690: [{ sourceCode: "D01", sourceName: "DPS Vest-Finnmark", targetCode: "5601", targetName: "Alta" }],
    municipalities: [{ municipality_code: "5601", municipality_name: "Alta" }],
  };
  assert.throws(
    () => buildCatchment(rawDanglingCode),
    /ukjent områdekode/
  );
});
