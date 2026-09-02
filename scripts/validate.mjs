import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readCsv } from "./lib/csv.mjs";
import { normalized, SOURCES_DIR } from "./lib/paths.mjs";
import { SCHEMAS } from "./validate/schemas.mjs";
import { validateTables } from "./validate/rules.mjs";

export async function loadTables(schemas = SCHEMAS) {
  const tables = {};
  for (const file of Object.keys(schemas)) {
    try { tables[file] = (await readCsv(normalized(file))).rows; } catch (e) { if (e.code !== "ENOENT") throw e; }
  }
  return tables;
}

/** data/sources/manifest.json, eller null om den ikke finnes ennå (før første `npm run fetch`). */
export async function loadManifest() {
  try { return JSON.parse(await readFile(join(SOURCES_DIR, "manifest.json"), "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; return null; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings, info } = validateTables(await loadTables(), SCHEMAS, { manifest: await loadManifest() });
  for (const l of info) console.log(`  ${l}`);
  for (const l of warnings) console.log(`ADVARSEL ${l}`);
  for (const l of errors) console.error(`FEIL ${l}`);
  console.log(`${errors.length} feil, ${warnings.length} advarsler`);
  process.exit(errors.length ? 1 : 0);
}
