import { ssbQuery, item } from "./lib/ssb.mjs";
import { jsonStatToRows } from "./lib/jsonstat.mjs";
import { readCsv } from "./lib/csv.mjs";
import { normalized } from "./lib/paths.mjs";

export function driftReport(results) {
  const lines = results.map(({ navn, live, csv }) => (live === csv ? `OK     ${navn}: ${live}` : `AVVIK  ${navn}: SSB ${live}, CSV ${csv === undefined ? "mangler" : csv}`));
  return { ok: results.every((r) => r.live === r.csv), lines };
}

const sum = (rows) => rows.reduce((a, r) => a + r.value, 0);
const csvValue = async (file, pred) => { const r = (await readCsv(normalized(file))).rows.find(pred); return r ? Number(r.value) : undefined; };

/** Three cells chosen so that each hits a different table and a different transformation (direct, age-sum over areas, age-sum over sexes). */
export const CHECKS = [
  {
    navn: "13942 Finnmarkssykehuset SOM døgnplasser 2025",
    live: async () => sum(jsonStatToRows(await ssbQuery("13942", [item("HelseReg", ["983974880"]), item("HelseTjenomr", ["SOM"]), item("ContentsCode", ["Dognplass"]), item("Tid", ["2025"])]))),
    csv: () => csvValue("hf_activity.csv", (r) => r.hf_id === "983974880" && r.tjenesteomrade === "SOM" && r.metric === "dognplasser" && r.period === "2025"),
  },
  {
    navn: "13982 S01 Hammerfest SOM befolkning alle aldre 2025",
    live: async () => sum(jsonStatToRows(await ssbQuery("13982", [item("HelseReg", ["S01"]), item("HelseTjenomr", ["SOM"]), item("Kjonn", ["0"]), { code: "Alder", selection: { filter: "all", values: ["*"] } }, item("Tid", ["2025"])]))),
    csv: () => csvValue("catchment_population.csv", (r) => r.omrade_id === "S01" && r.tjenesteomrade === "SOM" && r.aldersgruppe === "alle" && r.period === "2025"),
  },
  {
    navn: "07459 Hammerfest kommune 5603 befolkning 2025",
    live: async () => sum(jsonStatToRows(await ssbQuery("07459", [item("Region", ["5603"]), item("Kjonn", ["1", "2"]), { code: "Alder", selection: { filter: "all", values: ["*"] } }, item("Tid", ["2025"])]))),
    csv: () => csvValue("municipal_population.csv", (r) => r.municipality_code === "5603" && r.aldersgruppe === "alle" && r.period === "2025"),
  },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = [];
  for (const c of CHECKS) results.push({ navn: c.navn, live: await c.live(), csv: await c.csv() });
  const { ok, lines } = driftReport(results);
  for (const l of lines) console.log(l);
  process.exit(ok ? 0 : 1);
}
