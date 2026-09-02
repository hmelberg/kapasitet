import { readCsv } from "./lib/csv.mjs";
import { normalized } from "./lib/paths.mjs";
import { SCHEMAS } from "./validate/schemas.mjs";
import { validateTables } from "./validate/rules.mjs";

export async function loadTables(schemas = SCHEMAS) {
  const tables = {};
  for (const file of Object.keys(schemas)) {
    try { tables[file] = (await readCsv(normalized(file))).rows; } catch (e) { if (e.code !== "ENOENT") throw e; }
  }
  return tables;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings, info } = validateTables(await loadTables());
  for (const l of info) console.log(`  ${l}`);
  for (const l of warnings) console.log(`ADVARSEL ${l}`);
  for (const l of errors) console.error(`FEIL ${l}`);
  console.log(`${errors.length} feil, ${warnings.length} advarsler`);
  process.exit(errors.length ? 1 : 0);
}
