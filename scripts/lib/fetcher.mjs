import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { writeCsv } from "./csv.mjs";
import { RAW_DIR, NORMALIZED_DIR } from "./paths.mjs";

/**
 * def = { meta:{id,...}, fetchRaw(deps), transform(raw, deps) → {file: rows}, columns:{file: [..]} }
 * Fetch → save raw JSON (data/raw/<id>.json) → transform → write CSVs. Throws loudly on any gap.
 */
export async function runFetcher(def, { deps = {}, log = console.log, rawDir = RAW_DIR, outDir = NORMALIZED_DIR } = {}) {
  const { id } = def.meta;
  log(`[${id}] henter …`);
  const raw = await def.fetchRaw(deps);
  await mkdir(rawDir, { recursive: true });
  await writeFile(join(rawDir, `${id}.json`), JSON.stringify(raw), "utf8");
  const tables = def.transform(raw, deps);

  // Pass 1: Validate all tables before writing any CSV.
  for (const [file, list] of Object.entries(tables)) {
    const columns = def.columns[file];
    if (!columns) throw new Error(`[${id}] ${file} mangler kolonneliste i def.columns`);
    if (list.length === 0) throw new Error(`[${id}] ${file} fikk 0 rader – kilden har endret seg`);
  }

  // Pass 2: Write all CSVs and build the return object.
  const rows = {};
  for (const [file, list] of Object.entries(tables)) {
    const columns = def.columns[file];
    await writeCsv(join(outDir, file), list, columns);
    rows[file] = list.length;
    log(`[${id}] ${file}: ${list.length} rader`);
  }
  return { id, tables: Object.keys(tables), rows };
}
