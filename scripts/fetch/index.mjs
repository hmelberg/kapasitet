import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runFetcher } from "../lib/fetcher.mjs";
import { SOURCES_DIR } from "../lib/paths.mjs";
import { mergeManifest } from "./manifest.mjs";
import klassCatchment from "./klass-catchment.mjs";
import ssb13942 from "./ssb-13942.mjs";
import ssb13953 from "./ssb-13953.mjs";
import ssb14080 from "./ssb-14080.mjs";
import ssb13982 from "./ssb-13982.mjs";
import ssbPasienter from "./ssb-pasienter.mjs";
import ssb07459 from "./ssb-07459.mjs";
import ssbKostra from "./ssb-kostra.mjs";
import fhiKommune from "./fhi-kommune.mjs";
import fhiLmr from "./fhi-lmr.mjs";

export const ALL_FETCHERS = [klassCatchment, ssb13942, ssb13953, ssb14080, ssb13982, ssbPasienter, ssb07459, ssbKostra, fhiKommune, fhiLmr];

async function readJsonOr(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

export async function main(argv = process.argv.slice(2)) {
  const onlyArg = argv.find((a) => a.startsWith("--only="))?.slice(7) ?? (argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null);
  const only = onlyArg ? new Set(onlyArg.split(",")) : null;
  const fetchers = only ? ALL_FETCHERS.filter((f) => only.has(f.meta.id)) : ALL_FETCHERS;
  if (only && fetchers.length !== only.size) throw new Error(`Ukjent fetcher-id i --only: ${[...only].filter((id) => !ALL_FETCHERS.some((f) => f.meta.id === id)).join(", ")}`);
  const today = new Date().toISOString().slice(0, 10);
  const deps = { today };
  const results = [];
  for (const def of fetchers) results.push({ def, result: await runFetcher(def, { deps }) });
  const manifestPath = join(SOURCES_DIR, "manifest.json");
  const previous = await readJsonOr(manifestPath, null);
  const statics = await readJsonOr(join(SOURCES_DIR, "manifest.static.json"), []);
  await mkdir(SOURCES_DIR, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(mergeManifest(previous, statics, results, { today }), null, 2) + "\n", "utf8");
  console.log(`Skrev ${manifestPath} (${results.length} kilder hentet)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
