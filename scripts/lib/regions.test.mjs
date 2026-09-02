import { test } from "node:test";
import assert from "node:assert/strict";
import { RHF_TO_REGION, PRIVATE_RHF, stripPeriodSuffix, isOrgNr, isRegionCode, regionPrefix } from "./regions.mjs";

test("four RHFs map to the four health regions", () => {
  assert.deepEqual(RHF_TO_REGION, { "883658752": "H05", "983658725": "H03", "983658776": "H04", "991324968": "H12" });
});

test("every private provider points at a known RHF", () => {
  for (const rhf of Object.values(PRIVATE_RHF)) assert.ok(RHF_TO_REGION[rhf], rhf);
});

test("label helpers", () => {
  assert.equal(stripPeriodSuffix("Troms - Romsa - Tromssa (2024-)"), "Troms - Romsa - Tromssa");
  assert.equal(stripPeriodSuffix("Troms (-2023)"), "Troms");
  assert.equal(stripPeriodSuffix("Hele landet"), "Hele landet");
  assert.ok(isOrgNr("983974880"));
  assert.ok(!isOrgNr("H05"));
  assert.ok(isRegionCode("H12"));
  assert.ok(!isRegionCode("H1"));
  assert.equal(regionPrefix("H05"), "H05");
  assert.equal(regionPrefix("H12_AV"), "H12");
  assert.equal(regionPrefix("H00"), "");
  assert.equal(regionPrefix("H06_HF"), "");
  assert.equal(regionPrefix("983974880"), "");
});
