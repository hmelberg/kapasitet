import { test } from "node:test";
import assert from "node:assert/strict";
import { AGE_GROUPS, ageGroup } from "./age.mjs";

test("maps single years into the seven groups", () => {
  assert.deepEqual(AGE_GROUPS, ["0-17", "18-29", "30-49", "50-66", "67-79", "80-89", "90+"]);
  assert.equal(ageGroup("000"), "0-17");
  assert.equal(ageGroup("17"), "0-17");
  assert.equal(ageGroup("18"), "18-29");
  assert.equal(ageGroup("049"), "30-49");
  assert.equal(ageGroup("66"), "50-66");
  assert.equal(ageGroup("079"), "67-79");
  assert.equal(ageGroup("89"), "80-89");
  assert.equal(ageGroup("105+"), "90+");
});

test("throws on non-numeric codes", () => {
  assert.throws(() => ageGroup("Ialt"), /aldersgruppe/);
});
