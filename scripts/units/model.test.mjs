// Formlås over den committede modellen i apps/web/public/data/units/: leser hvert faktaark
// og sjekker at Tall-kontrakten, foreldrelenkene og proveniensen holder på ekte data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { UNITS_DIR } from "../lib/paths.mjs";
import { loadManifest } from "../validate.mjs";
import { QUALITIES } from "../validate/rules.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

async function readModel() {
  const index = await readJson(join(UNITS_DIR, "index.json"));
  const sheets = new Map();
  for (const type of await readdir(UNITS_DIR, { withFileTypes: true })) {
    if (!type.isDirectory()) continue;
    for (const f of await readdir(join(UNITS_DIR, type.name))) {
      sheets.set(`${type.name}:${f.replace(/\.json$/, "")}`, await readJson(join(UNITS_DIR, type.name, f)));
    }
  }
  return { index, sheets };
}

/** Hvert objekt med numerisk `value` og en `quality` er et Tall og sjekkes; ellers gå videre ned. */
function eachTall(node, fn) {
  if (!node || typeof node !== "object") return;
  if (!Array.isArray(node) && typeof node.value === "number" && node.quality !== undefined) return fn(node);
  for (const v of Object.values(node)) eachTall(v, fn);
}

const model = await readModel();
const manifest = await loadManifest();

test("index.json og filtreet er den samme mengden på minst 500 enheter", () => {
  assert.ok(model.index.units.length >= 500, `bare ${model.index.units.length} enheter i index.json`);
  assert.deepEqual([...model.sheets.keys()].sort(), model.index.units.map((u) => u.id).sort());
});

test("hver parent_ids peker på en enhet som finnes", () => {
  const ids = new Set(model.index.units.map((u) => u.id));
  const dangling = model.index.units.flatMap((u) => u.parent_ids.filter((p) => !ids.has(p)).map((p) => `${u.id} → ${p}`));
  assert.deepEqual(dangling, []);
});

test("hvert Tall har gyldig quality, en periode og en source_id som finnes i manifest.json", () => {
  assert.ok(manifest, "data/sources/manifest.json mangler");
  const known = new Set(manifest.sources.map((s) => s.id));
  const bad = [];
  let n = 0;
  for (const [id, fakta] of model.sheets) {
    eachTall(fakta, (t) => {
      n++;
      if (!QUALITIES.has(t.quality)) bad.push(`${id}: quality "${t.quality}"`);
      if (!/^\d{4}$/.test(String(t.period ?? ""))) bad.push(`${id}: period "${t.period}"`);
      if (!known.has(t.source_id)) bad.push(`${id}: source_id "${t.source_id}" mangler i manifestet`);
    });
  }
  assert.deepEqual(bad.slice(0, 10), []);
  assert.ok(n > 100_000, `bare ${n} Tall i modellen`);
});

test("stikkprøver: Finnmarkssykehuset har somatikk-senger og Hammerfest har befolkning", () => {
  const hf = model.sheets.get("helseforetak:983974880");
  assert.ok(hf.behandlingssteder.some((s) => s.senger?.somatikk), "ingen behandlingssteder med somatikk-senger");
  const kommune = model.sheets.get("kommune:5603");
  assert.ok(Object.keys(kommune.befolkning).length > 0, "kommune 5603 mangler befolkning");
});
