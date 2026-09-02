import { rm, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { UNITS_DIR } from "./lib/paths.mjs";
import { loadTables, loadManifest } from "./validate.mjs";
import { SCHEMAS } from "./validate/schemas.mjs";
import { validateTables } from "./validate/rules.mjs";
import { buildUnits } from "./units/build.mjs";

const tables = await loadTables();
const { errors } = validateTables(tables, SCHEMAS, { manifest: await loadManifest() });
if (errors.length) { for (const e of errors) console.error(`FEIL ${e}`); process.exit(1); }
const { index, files } = buildUnits(tables, { today: new Date().toISOString().slice(0, 10) });
await rm(UNITS_DIR, { recursive: true, force: true });
for (const [rel, fakta] of Object.entries(files)) {
  const p = join(UNITS_DIR, rel);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(fakta), "utf8");
}
await writeFile(join(UNITS_DIR, "index.json"), JSON.stringify(index), "utf8");
console.log(`Skrev ${Object.keys(files).length} enheter + index.json til ${UNITS_DIR}`);
