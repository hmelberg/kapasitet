# Datagrunnlag fase 1–3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modelled data in `kapasitet` with a zero-dependency Node pipeline that fetches real SSB/FHI/KLASS data into normalized CSVs, a curated bed table for Helse Nord, a validator with control sums, and a unit model (`index.json` + fact-sheet JSON per unit) that the UI, the scenario engine and the later LLM layer all read.

**Architecture:** `scripts/lib/` holds small pure helpers (CSV, json-stat2, HTTP with retry, SSB/FHI/KLASS clients). Each source has one fetcher module in `scripts/fetch/` exporting `meta`, `query`, `columns`, `fetchRaw(deps)` and a pure `transform(raw)`; `scripts/lib/fetcher.mjs` runs them (raw JSON → `data/raw/` gitignored, CSV → `data/normalized/`). `scripts/validate.mjs` and `scripts/units/` are pure functions over the parsed CSVs with thin CLI wrappers. Tests are `node:test` with fake `fetch`; no network in tests.

**Tech Stack:** Node ≥ 22 ESM (`.mjs`), built-in `fetch`, `node:test`, no npm dependencies. Data APIs: SSB Statbank v0 (json-stat2), SSB KLASS v1, FHI open API v1 (json-stat2).

**Spec:** `docs/superpowers/specs/2026-09-02-datagrunnlag-og-scenario-v2-design.md` (sections 2–5 and phase 1–3 of section 9). Read it first.

## Global Constraints

- Pipeline: "Node ≥ 20 ESM i `scripts/`, null avhengigheter utover Node." Root `package.json` has **no dependencies**. Tests use the `--test` glob form, which needs Node ≥ 22 (the machine runs Node 26); `engines.node` in the root package is `>=22`.
- Language: "UI bokmål med æøå. Kode engelsk. Datakolonner norsk snake_case." Code identifiers, comments and commit messages in English; CSV column names Norwegian snake_case **without** æøå (`dognplasser`, `arsverk`, `omrade_id`); error messages printed to the terminal in Norwegian.
- Quality: every numeric row carries `quality` ∈ `ekte | avledet | estimat`. Fetched register data is `ekte`.
- Modelled data (`capacity.csv`, `needs.csv`, `medication_use.csv`, `hospital_unit_beds.csv`, the `.ps1` scripts, `sources.csv`, the old `csv.ts` loaders) is **not** deleted in this plan — that happens in plan 2 together with the UI rewrite, so `next build` stays green throughout. New CSVs are written **next to** the old ones. Exception: `medications.csv` is overwritten by the ported LMR fetcher with identical columns.
- `fetch` is the only step that touches the network. `validate`, `build:data` and `test` are offline.
- Pipeline errors are loud: unknown SSB/FHI code → throw with source id; HTTP 4xx → throw; never write a partial CSV (transform runs fully before any write).
- Commits: subagents commit locally only; the controller pushes after each phase when `npm test` and `cd apps/web && npm run build` are green.
- All file paths below are relative to the repo root `/Users/hom/Documents/GitHub/kapasitet`. The shell cwd resets between commands — always `cd /Users/hom/Documents/GitHub/kapasitet && …`.

## File structure

```
package.json                       root: scripts fetch/validate/build:data/test/drift (no deps)
.gitignore                         + data/raw/
scripts/
  lib/
    paths.mjs                      ROOT, RAW_DIR, NORMALIZED_DIR, SOURCES_DIR, UNITS_DIR
    csv.mjs                        toCsv / parseCsv / writeCsv / readCsv (RFC 4180, BOM-safe)
    jsonstat.mjs                   jsonStatToRows(ds) / makeJsonStat(dims, values)
    http.mjs                       requestJson/getJson/postJson with retry, timeout, BOM strip
    ssb.mjs                        item/all, ssbMetadata, ssbQuery, ssbQueryChunked
    fhi.mjs                        fhiItem/fhiAll, fhiQuery
    klass.mjs                      klassCodes, klassCorrespondence
    age.mjs                        AGE_GROUPS, ageGroup(code)
    regions.mjs                    RHF_TO_REGION, REGION_NAMES, PRIVATE_RHF, stripPeriodSuffix
    fetcher.mjs                    runFetcher({meta, fetchRaw, transform, columns})
    test-helpers.mjs               fakeFetch(responses)
    *.test.mjs
  fetch/
    klass-catchment.mjs            opptaksomrader.csv, municipality_catchment.csv
    ssb-13942.mjs                  hf_activity.csv, helseforetak.csv
    ssb-hf-long.mjs                factory for 13953 / 14080
    ssb-13953.mjs                  hf_staffing.csv
    ssb-14080.mjs                  hf_specialists.csv
    ssb-13982.mjs                  catchment_population.csv
    ssb-pasienter.mjs              patients_by_diagnosis.csv, patients_by_diagnosis_detail.csv (14824 + 14820)
    ssb-07459.mjs                  municipal_population.csv
    ssb-kostra.mjs                 municipal_capacity.csv (11875, 12292, 12293, 11996, 14533)
    fhi-kommune.mjs                municipal_needs.csv (nokkel 699, nokkel 370, kpr 634)
    fhi-lmr.mjs                    medications.csv (port of fetch-medications-fhi.ps1)
    index.mjs                      runs all fetchers, writes data/sources/manifest.json
    *.test.mjs
  validate.mjs                     CLI; validateTables() in scripts/validate/rules.mjs
  validate/rules.mjs
  validate/rules.test.mjs
  drift.mjs                        manual: three live cells vs CSV
  units/
    tall.mjs                       tall(), latest(), groupBy helpers
    build.mjs                      buildUnits(tables) → { index, files }
    build.test.mjs
  build-units.mjs                  CLI: read CSVs → write apps/web/public/data/units/**
data/
  raw/                             gitignored json-stat snapshots
  normalized/                      new CSVs (listed per task)
  sources/manifest.static.json     curated source entries (hospital_beds sources, OSM, Geonorge)
  sources/manifest.json            generated by fetch/index.mjs
apps/web/public/data/units/        generated by build:data, committed
```

Table columns produced by this plan (all in `data/normalized/`):

| File | Columns |
|---|---|
| `helseforetak.csv` | `hf_id, hf_navn, rhf_id, helseregion, type` |
| `opptaksomrader.csv` | `omrade_id, omrade_navn, omrade_type, hf_id` |
| `municipality_catchment.csv` | `municipality_code, municipality_name, lokalsykehus_id, dps_id, hf_id, helseregion, quality, note` |
| `hf_activity.csv` | `hf_id, hf_navn, helseregion, tjenesteomrade, metric, period, value, unit, source_id, quality` |
| `hf_staffing.csv` | `hf_id, hf_navn, tjenesteomrade, yrkesgruppe_kode, yrkesgruppe, period, value, unit, source_id, quality` |
| `hf_specialists.csv` | `hf_id, hf_navn, tjenesteomrade, spesialitet_kode, spesialitet, period, value, unit, source_id, quality` |
| `catchment_population.csv` | `omrade_id, omrade_navn, omrade_type, tjenesteomrade, aldersgruppe, period, value, unit, source_id, quality` |
| `patients_by_diagnosis.csv` / `_detail.csv` | `region_id, region_navn, region_type, tjenesteomrade, aldersgruppe, diagnose_kode, diagnose_navn, metric, period, value, unit, source_id, quality` |
| `municipal_population.csv` | `municipality_code, aldersgruppe, period, value, unit, source_id, quality` |
| `municipal_capacity.csv` | `municipality_code, metric, metric_label, period, value, unit, source_id, quality` |
| `municipal_needs.csv` | `municipality_code, metric, metric_label, period, value, unit, source_id, quality` |
| `sites.csv` | `site_id, site_navn, hf_id, municipality_code, lokalsykehus_id, lat, lon, site_type, akuttfunksjon` |
| `hospital_beds.csv` | `site_id, site_navn, hf_id, municipality_code, kategori, senger, period, quality, source_url, source_note, last_verified` |
| `medications.csv` (unchanged shape) | `group_code, group_label, period, users, per_1000, source_id, last_updated` |

Deviations from spec §4.1, decided while probing the APIs (spec is updated in the same commit as this plan): `catchment_population.csv` has no `kjonn`/`hf_id` columns (only kjønn samlet is kept; `hf_id` comes from `opptaksomrader.csv`); `patients_by_diagnosis.csv` uses `region_id`/`region_type` because 14824 also publishes land (`0`) and helseregion (`H03`…) rows; SSB 14820 (VOP) has **no** diagnosis dimension, so VOP rows carry `diagnose_kode=_T`; KOSTRA institution places come from table **11875** (12292 only has residents) and occupancy from **12293**.

Verified API facts used below (probed 2026-09-02):

- SSB 13942: `HelseReg` 43 codes (9-digit org.nr for HF/private, `H00`, `H03`, `H04`, `H05`, `H12`, `H03_AV`…, `H06_HF`, `H06_HR`); `HelseTjenomr` `TOT, SOM, VOP, BUP, TSB`; `ContentsCode` `Dognplass, Utskriv, Liggedag, Polikliniske, Dag, Sengedogn, BeleggSsb, BeleggOecd`; `Tid` 2015–2025. Labels carry period suffixes: `Oslo Universitetssykehus HF (2009-)`, `Martina Hansens Hospital AS (-2024)`, `Helseregion Sør-Øst (2007-)`.
- SSB 13953: `HelseReg` 76 codes, `Yrke` 30 (labels contain ` `), `HelseTjenomr` `TOT, AMB, SOM, BUP, TSB, VOP, AOS`, `ContentsCode` `Arsverk`. SSB 14080: `HelseReg` 76, `Spesialitet` 49, `HelseTjenomr`, `ContentsCode` `AvtAarsverk`.
- SSB 13982: `HelseReg` 145 (org.nr, `H..`, `S01`–`S50`, `D01`–`D69`), `HelseTjenomr` `SOM, VOP, BUP, TSB, DPS`, `Kjonn` `0, 2, 1`, `Alder` `000`…`104`, `105+`, `Tid` 2015–2026. 145×5×106 = 76 850 cells per year → chunk by `Tid`.
- SSB 14824: `Region` 39 (`0`, 2-digit fylker incl. historic with suffix `(-2019)`/`(2020-2023)`, `H03/H04/H05/H12`), `Alder` `999A, 00-17, 18-29, 30-49, 50-66, 67-79, 80-89, 90+`, `Aktor` `_T, offhel, avtspes`, `Diagnose` 222 (chapters are Roman numerals `I`…`XXI` plus `_T`; subgroups like `A00-A09`; `zz1` = Annen), `ContentsCode` `Pasient, PasientPolikl, PasientDognBeh, KontaktPolikl, DagBehandl, DognOpphold, OppholdDogn`, `Tid` 2015–2025.
- SSB 14820: `Region` 39, `Kjonn` `0,2,1`, `Alder` `Ialt, 18-29, 30-49, 50-66, 67+`, `Aktor`, `ContentsCode` `Pasient, PasientDognBeh, OppholdDogn, KontaktPolikl`, `Tid` 2015–2025. No `Diagnose`.
- SSB 07459: `Region` 994 (4-digit kommuner + fylker + `0`), `Kjonn` `2, 1`, `Alder` `000`…`105+`, `Tid` 1986–2026. 994×2×106 = 210 728 cells per year → chunk by `Tid`.
- KOSTRA (`KOKkommuneregion0000` 891 codes: 4-digit kommuner + `EAK…`/`EKG…` groups; `Tid` 2015–2025): 11875 contents `KOSinstdispplass0000, KOSsykehjdisppla0000, KOSinstdemenspla0000, KOSinsttidsbegrp0000, KOSinstrehabplas0000`; 12292 contents `KOSbeboersykehje0000, KOSlangtid0000, KOSkorttid0000, KOSkjernetotalt0000, KOSkjerne80aarov0000, KOSaarsverkbruke0000, KOSinstoppholdsd0000`; 12293 `KOSbeleggomsorgs0000`; 11996 `KOKavtaleform0000` (`sum`…), `KOKfunksjon0000` `FGK10, 120, 232, 233, 241, 253, 256`, contents `KOSlegeaarsverk0000`; 14533 `KOKyrker0000` `TOT, 01…06, 07a…07e, 08, 09, 99`, contents `KOSARBAARSVERKST0000`.
- KLASS: `GET https://data.ssb.no/api/klass/v1/classifications/629/codes?from=2025-01-01&to=2025-01-02[&selectLevel=N]` → `{codes:[{code, parentCode, level:"1", name, …}]}`. 629 (somatikk): level 1 = 4 RHF org.nr, level 2 = 21 HF/private org.nr, level 3 = 48 `S`-codes (parent = HF), level 4 = 14 483 grunnkrets codes (8 digits, parent = `S`-code). 632 (DPS): same, level 3 = 69 `D`-codes, level 4 = 13 908 codes of which 119 are whole kommuner (4 digits). `GET …/correspondencetables/2688` → `{correspondenceMaps:[{sourceCode:"S01", sourceName:"Hammerfest", targetCode:"5601", targetName:"Alta"}]}` (364 rows, 357 distinct kommuner; split kommuner: `0301` S34/S35/S36/S49, `4601` S16/S17, `3203` S30/S31, `3903` S31/S46, `1834` S09/S11). 2690 = DPS → kommune. RHF org.nr: `883658752` Helse Nord, `983658725` Helse Vest, `983658776` Helse Midt-Norge, `991324968` Helse Sør-Øst.
- FHI: `POST https://statistikk-data.fhi.no/api/open/v1/{source}/Table/{id}/data` body `{"dimensions":[{"code":"GEO","filter":"all","values":["*"]},{"code":"AAR","filter":"item","values":["2024_2024"]}],"response":{"format":"json-stat2","maxRowCount":500000}}`; body starts with a UTF-8 BOM; `value` is a flat array that may contain the string `"k"` for suppressed cells. `nokkel` 699 (NPR_1): `GEO` (`0`, 2-digit fylke, 4-digit kommune), `AAR` `2012_2012`…`2024_2024`, `KJONN` `0`, `ALDER` `0_120`, `KODEGRUPPE` `I00_I99, J440_J449, M00_M99, S00_T78`, `MEASURE_TYPE` `TELLER, RATE, MEIS, SMR`. `nokkel` 370 (KPR_1): `AAR` `2017_2017`…`2024_2024`, `ALDER` `0_74, 75_79`, `KODEGRUPPE` `K70_K99, P01_P29ogP70_P99, L01_L29ogL70_L71ogL82_L99, Skader`. `kpr` 634: `AAR` `2017`…`2025`, `Sted` codes are strings like `5603 Hammerfest (2024->)`, `5406 Hammerfest (2020-2023)`, `0301 Oslo (2008->)`, `Landet`; `tjtjentypeNavn` `Totalt_antall_brukere, Tj_1 … Tj_29`; `MEASURE_TYPE` `Antall_Brukere`. `lmr` 825: `Atc_Verdi`, `Kjonn_Verdi` `TOTALT`, `Aldersgruppe_Verdi` `TOTALT`, `Utlevering_Ar` 2004–2025, `MEASURE_TYPE` `AntallBrukere, Brukere_Per1000_Innbyggere, DDD, Befolkning`.
- Control sums (13942, 2025, `Dognplass` / `BeleggSsb`): Finnmarkssykehuset SOM 134/69, VOP 30/77, BUP 8/95, TSB 12/77, TOT 184/72; UNN SOM 593/74, TOT 813/79; Nordlandssykehuset SOM 295/97, TOT 439/93; Helgelandssykehuset SOM 121/79, TOT 159/78; Helseregion Nord (`H05`) SOM 1143/80, TOT 1595/82.

---
## Phase 1 – Pipeline and real specialist data

### Task 1: Root package, paths, CSV and json-stat2 helpers

**Files:**
- Modify: `package.json` (repo root – it already exists with npm workspaces; add scripts, do not replace it)
- Modify: `.gitignore` (ignore `data/raw/*` but keep the tracked `data/raw/README.md`)
- Create: `scripts/lib/paths.mjs`, `scripts/lib/csv.mjs`, `scripts/lib/jsonstat.mjs`
- Test: `scripts/lib/csv.test.mjs`, `scripts/lib/jsonstat.test.mjs`

**Interfaces:**
- Produces: `toCsv(rows, columns): string`, `parseCsv(text): {columns: string[], rows: Record<string,string>[]}`, `writeCsv(filePath, rows, columns): Promise<void>`, `readCsv(filePath): Promise<{columns, rows}>`; `jsonStatToRows(ds): Array<Record<string, string|number>>` (keys: each dimension id → code, `<id>_label` → label, `value` → number; rows whose value is not a finite number are dropped); `makeJsonStat(dims, values)` (test fixture builder, `dims = [{id, codes, labels?}]`, `values` flat row-major); path constants `ROOT, RAW_DIR, NORMALIZED_DIR, SOURCES_DIR, UNITS_DIR` and helpers `normalized(name)`, `raw(name)`.

- [ ] **Step 1: Root package.json and gitignore**

The root `package.json` currently is:

```json
{
  "name": "kapasitet",
  "private": true,
  "version": "0.1.0",
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "npm run dev -w @kapasitet/web",
    "build": "npm run build -w @kapasitet/web",
    "lint": "npm run lint -w @kapasitet/web",
    "validate:data": "node scripts/validate-csv.mjs",
    "ci": "npm run validate:data ; npm run build"
  },
  "engines": { "node": ">=20" }
}
```

Keep everything (the app's `dev`/`build` go through the workspace, and `validate:data` is the old validator that plan 2 deletes) and change only two things: `engines.node` → `">=22"` (the `--test` glob needs it), and add these five scripts:

```json
"fetch": "node scripts/fetch/index.mjs",
"validate": "node scripts/validate.mjs",
"build:data": "node scripts/build-units.mjs",
"drift": "node scripts/drift.mjs",
"test": "node --test \"scripts/**/*.test.mjs\""
```

Do not add `"type": "module"` – all pipeline files are `.mjs`, and the old `scripts/*.mjs` must keep working until plan 2 removes them.

Replace nothing in `.gitignore`; append:

```
data/raw/*
!data/raw/README.md
```

- [ ] **Step 2: paths.mjs**

```js
// scripts/lib/paths.mjs
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const RAW_DIR = join(ROOT, "data", "raw");
export const NORMALIZED_DIR = join(ROOT, "data", "normalized");
export const SOURCES_DIR = join(ROOT, "data", "sources");
export const UNITS_DIR = join(ROOT, "apps", "web", "public", "data", "units");

export const normalized = (name) => join(NORMALIZED_DIR, name);
export const raw = (name) => join(RAW_DIR, name);
```

- [ ] **Step 3: Failing CSV tests**

```js
// scripts/lib/csv.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, parseCsv } from "./csv.mjs";

test("toCsv quotes commas, quotes and newlines, and writes empty for null", () => {
  const csv = toCsv([{ a: 'x,y', b: 'he said "hi"', c: null }, { a: "plain", b: 1.5, c: "line\nbreak" }], ["a", "b", "c"]);
  assert.equal(csv, 'a,b,c\n"x,y","he said ""hi""",\nplain,1.5,"line\nbreak"\n');
});

test("parseCsv strips BOM, handles quoted fields and CRLF, returns objects", () => {
  const { columns, rows } = parseCsv('﻿a,b\r\n"x,y",2\r\nplain,"q""q"\r\n');
  assert.deepEqual(columns, ["a", "b"]);
  assert.deepEqual(rows, [{ a: "x,y", b: "2" }, { a: "plain", b: 'q"q' }]);
});

test("round trip", () => {
  const rows = [{ k: "æøå", v: "a,b" }];
  assert.deepEqual(parseCsv(toCsv(rows, ["k", "v"])).rows, rows);
});
```

- [ ] **Step 4: Run to verify failure**

Run: `cd /Users/hom/Documents/GitHub/kapasitet && node --test scripts/lib/csv.test.mjs`
Expected: FAIL – cannot find module `./csv.mjs`.

- [ ] **Step 5: Implement csv.mjs**

```js
// scripts/lib/csv.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function escapeCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows, columns) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => escapeCell(row[c])).join(","));
  return lines.join("\n") + "\n";
}

export function parseCsv(text) {
  const src = text.replace(/^﻿/, "");
  const records = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); records.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); records.push(row); }
  const nonEmpty = records.filter((r) => r.length > 1 || r[0] !== "");
  if (nonEmpty.length === 0) return { columns: [], rows: [] };
  const columns = nonEmpty[0];
  const rows = nonEmpty.slice(1).map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ""])));
  return { columns, rows };
}

export async function writeCsv(filePath, rows, columns) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, toCsv(rows, columns), "utf8");
}

export async function readCsv(filePath) {
  return parseCsv(await readFile(filePath, "utf8"));
}
```

- [ ] **Step 6: Run CSV tests** – Expected: 3 PASS.

- [ ] **Step 7: Failing json-stat2 tests**

```js
// scripts/lib/jsonstat.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonStatToRows, makeJsonStat } from "./jsonstat.mjs";

test("walks row-major with the last dimension fastest and drops non-numeric cells", () => {
  const ds = makeJsonStat(
    [{ id: "Region", codes: ["A", "B"], labels: ["Alfa", "Beta"] }, { id: "Tid", codes: ["2024", "2025"] }],
    [1, 2, null, "k"],
  );
  assert.deepEqual(jsonStatToRows(ds), [
    { Region: "A", Region_label: "Alfa", Tid: "2024", Tid_label: "2024", value: 1 },
    { Region: "A", Region_label: "Alfa", Tid: "2025", Tid_label: "2025", value: 2 },
  ]);
});

test("accepts object-form category index ordered by position", () => {
  const ds = makeJsonStat([{ id: "X", codes: ["p", "q"] }], [10, 20]);
  ds.dimension.X.category.index = { q: 1, p: 0 };
  assert.deepEqual(jsonStatToRows(ds).map((r) => [r.X, r.value]), [["p", 10], ["q", 20]]);
});

test("rejects a non-dataset", () => {
  assert.throws(() => jsonStatToRows({ foo: 1 }), /json-stat2/);
});
```

- [ ] **Step 8: Run to verify failure** – Expected: FAIL, module not found.

- [ ] **Step 9: Implement jsonstat.mjs**

```js
// scripts/lib/jsonstat.mjs
// json-stat2: `value` is a flat row-major array over `id` (last dimension varies fastest).

export function jsonStatToRows(ds) {
  if (!ds || !Array.isArray(ds.id) || !Array.isArray(ds.size) || !ds.dimension) {
    throw new Error("Ikke et json-stat2-datasett (mangler id/size/dimension)");
  }
  const dims = ds.id.map((id) => {
    const cat = ds.dimension[id].category;
    const codes = Array.isArray(cat.index)
      ? cat.index
      : Object.keys(cat.index).sort((a, b) => cat.index[a] - cat.index[b]);
    return { id, codes, labels: cat.label ?? {} };
  });
  const total = ds.size.reduce((a, b) => a * b, 1);
  const rows = [];
  for (let flat = 0; flat < total; flat++) {
    const v = Array.isArray(ds.value) ? ds.value[flat] : ds.value?.[String(flat)];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const row = { value: v };
    let rem = flat;
    for (let d = dims.length - 1; d >= 0; d--) {
      const pos = rem % ds.size[d];
      rem = Math.floor(rem / ds.size[d]);
      const code = dims[d].codes[pos];
      row[dims[d].id] = code;
      row[`${dims[d].id}_label`] = dims[d].labels[code] ?? code;
    }
    rows.push(row);
  }
  return rows;
}

/** Test/fixture builder. dims: [{id, codes, labels?}], values: flat row-major array. */
export function makeJsonStat(dims, values) {
  const id = dims.map((d) => d.id);
  const size = dims.map((d) => d.codes.length);
  const dimension = Object.fromEntries(
    dims.map((d) => [
      d.id,
      { category: { index: [...d.codes], label: Object.fromEntries(d.codes.map((c, i) => [c, d.labels?.[i] ?? c])) } },
    ]),
  );
  return { class: "dataset", version: "2.0", id, size, dimension, value: values };
}
```

- [ ] **Step 10: Run all tests** – `npm test` → 6 PASS.

- [ ] **Step 11: Commit**

```bash
git add package.json .gitignore scripts/lib/paths.mjs scripts/lib/csv.mjs scripts/lib/csv.test.mjs scripts/lib/jsonstat.mjs scripts/lib/jsonstat.test.mjs
git commit -m "feat(pipeline): root package, csv and json-stat2 helpers"
```

### Task 2: HTTP with retry, SSB/FHI/KLASS clients, fake fetch

**Files:**
- Create: `scripts/lib/http.mjs`, `scripts/lib/ssb.mjs`, `scripts/lib/fhi.mjs`, `scripts/lib/klass.mjs`, `scripts/lib/test-helpers.mjs`
- Test: `scripts/lib/http.test.mjs`, `scripts/lib/ssb.test.mjs`, `scripts/lib/klass.test.mjs`

**Interfaces:**
- Consumes: `jsonStatToRows` (Task 1).
- Produces: `requestJson(url, {method, body, fetchImpl, retries, timeoutMs, sleep})`, `getJson(url, opts)`, `postJson(url, body, opts)`, `class HttpError extends Error {status}`; `item(code, values)`, `all(code)`, `ssbMetadata(tableId, opts)`, `ssbQuery(tableId, query, opts) → dataset`, `ssbQueryChunked(tableId, query, chunkDim, opts) → {rows, datasets}`; `fhiItem(code, values)`, `fhiAll(code)`, `fhiQuery(source, tableId, dimensions, opts) → dataset`; `klassCodes(classificationId, {from, to, level, ...opts}) → [{code, parentCode, level, name}]`, `klassCorrespondence(tableId, opts) → [{sourceCode, sourceName, targetCode, targetName}]`; `fakeFetch(responses)` where each response is `{status?, json}` or a function `({url, init}) => {status?, json}`; `fakeFetch(...).calls` records `{url, method, body}`. Every client takes `opts` and forwards `fetchImpl`/`sleep` so tests never hit the network.

- [ ] **Step 1: test-helpers.mjs**

```js
// scripts/lib/test-helpers.mjs
export function fakeFetch(responses) {
  const queue = [...responses];
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined });
    const next = queue.shift();
    if (!next) throw new Error(`fakeFetch: ingen respons igjen for ${url}`);
    const { status = 200, json } = typeof next === "function" ? next({ url, init }) : next;
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(json) };
  };
  impl.calls = calls;
  return impl;
}
```

- [ ] **Step 2: Failing http tests**

```js
// scripts/lib/http.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { requestJson, HttpError } from "./http.mjs";
import { fakeFetch } from "./test-helpers.mjs";

const noSleep = async () => {};

test("retries on 503 then returns parsed JSON", async () => {
  const fetchImpl = fakeFetch([{ status: 503, json: "x" }, { status: 503, json: "x" }, { json: { ok: 1 } }]);
  const out = await requestJson("https://x/y", { fetchImpl, sleep: noSleep });
  assert.deepEqual(out, { ok: 1 });
  assert.equal(fetchImpl.calls.length, 3);
});

test("does not retry 4xx and throws HttpError with status", async () => {
  const fetchImpl = fakeFetch([{ status: 404, json: "nope" }]);
  await assert.rejects(requestJson("https://x/y", { fetchImpl, sleep: noSleep }), (e) => e instanceof HttpError && e.status === 404);
  assert.equal(fetchImpl.calls.length, 1);
});

test("gives up after retries with a Norwegian message", async () => {
  const fetchImpl = fakeFetch([{ status: 500, json: 1 }, { status: 500, json: 1 }, { status: 500, json: 1 }, { status: 500, json: 1 }]);
  await assert.rejects(requestJson("https://x/y", { fetchImpl, sleep: noSleep }), /ga opp etter 4 forsøk/);
});

test("POST sends JSON body with content-type; strips BOM in response", async () => {
  const seen = [];
  const impl = async (url, init) => {
    seen.push(init);
    return { ok: true, status: 200, text: async () => "﻿" + JSON.stringify({ a: 1 }) };
  };
  const out = await requestJson("https://x/y", { method: "POST", body: { q: 1 }, fetchImpl: impl, sleep: noSleep });
  assert.deepEqual(out, { a: 1 });
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].headers["content-type"], "application/json");
  assert.equal(seen[0].body, '{"q":1}');
});
```

- [ ] **Step 3: Run** – Expected: FAIL, module not found.

- [ ] **Step 4: Implement http.mjs**

```js
// scripts/lib/http.mjs
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export async function requestJson(url, {
  method = "GET", body, fetchImpl = globalThis.fetch, retries = 3, timeoutMs = 120_000, sleep = defaultSleep, headers = {},
} = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 3 ** (attempt - 1));
    try {
      const res = await fetchImpl(url, {
        method,
        headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      if (res.ok) return JSON.parse(text.replace(/^﻿/, ""));
      const err = new HttpError(`${method} ${url}: HTTP ${res.status} ${text.slice(0, 300)}`, res.status);
      if (!RETRY_STATUS.has(res.status)) throw err;
      lastErr = err;
    } catch (e) {
      if (e instanceof HttpError && !RETRY_STATUS.has(e.status)) throw e;
      lastErr = e;
    }
  }
  throw new Error(`${method} ${url}: ga opp etter ${retries + 1} forsøk – ${lastErr?.message ?? lastErr}`);
}

export const getJson = (url, opts = {}) => requestJson(url, { ...opts, method: "GET" });
export const postJson = (url, body, opts = {}) => requestJson(url, { ...opts, method: "POST", body });
```

- [ ] **Step 5: Run http tests** – Expected: 4 PASS.

- [ ] **Step 6: Failing SSB + KLASS tests**

```js
// scripts/lib/ssb.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { item, all, ssbQuery, ssbQueryChunked, SSB_BASE } from "./ssb.mjs";
import { makeJsonStat } from "./jsonstat.mjs";
import { fakeFetch } from "./test-helpers.mjs";

test("ssbQuery posts the json-stat2 query envelope", async () => {
  const ds = makeJsonStat([{ id: "Tid", codes: ["2025"] }], [1]);
  const fetchImpl = fakeFetch([{ json: ds }]);
  const out = await ssbQuery("13942", [all("HelseReg"), item("Tid", ["2025"])], { fetchImpl });
  assert.equal(fetchImpl.calls[0].url, `${SSB_BASE}/13942`);
  assert.deepEqual(fetchImpl.calls[0].body, {
    query: [
      { code: "HelseReg", selection: { filter: "all", values: ["*"] } },
      { code: "Tid", selection: { filter: "item", values: ["2025"] } },
    ],
    response: { format: "json-stat2" },
  });
  assert.equal(out.value[0], 1);
});

test("ssbQueryChunked runs one query per chunk value and concatenates rows", async () => {
  const fetchImpl = fakeFetch([
    { json: makeJsonStat([{ id: "Tid", codes: ["2024"] }], [5]) },
    { json: makeJsonStat([{ id: "Tid", codes: ["2025"] }], [7]) },
  ]);
  const { rows } = await ssbQueryChunked("07459", [all("Region"), item("Tid", ["2024", "2025"])], "Tid", { fetchImpl });
  assert.deepEqual(fetchImpl.calls.map((c) => c.body.query[1].selection.values), [["2024"], ["2025"]]);
  assert.deepEqual(rows.map((r) => [r.Tid, r.value]), [["2024", 5], ["2025", 7]]);
});

test("ssbQueryChunked refuses a non-item chunk dimension", async () => {
  await assert.rejects(ssbQueryChunked("1", [all("Tid")], "Tid", { fetchImpl: fakeFetch([]) }), /item-seleksjon/);
});
```

```js
// scripts/lib/klass.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { klassCodes, klassCorrespondence } from "./klass.mjs";
import { fakeFetch } from "./test-helpers.mjs";

test("klassCodes builds the URL and normalises level to a number", async () => {
  const fetchImpl = fakeFetch([{ json: { codes: [{ code: "S01", parentCode: "983974880", level: "3", name: "Hammerfest", extra: 1 }] } }]);
  const out = await klassCodes(629, { level: 3, fetchImpl });
  assert.equal(fetchImpl.calls[0].url, "https://data.ssb.no/api/klass/v1/classifications/629/codes?from=2025-01-01&to=2025-01-02&selectLevel=3");
  assert.deepEqual(out, [{ code: "S01", parentCode: "983974880", level: 3, name: "Hammerfest" }]);
});

test("klassCorrespondence returns the four map fields", async () => {
  const fetchImpl = fakeFetch([{ json: { correspondenceMaps: [{ sourceCode: "S01", sourceName: "Hammerfest", targetCode: "5601", targetName: "Alta", x: 1 }] } }]);
  const out = await klassCorrespondence(2688, { fetchImpl });
  assert.equal(fetchImpl.calls[0].url, "https://data.ssb.no/api/klass/v1/correspondencetables/2688");
  assert.deepEqual(out, [{ sourceCode: "S01", sourceName: "Hammerfest", targetCode: "5601", targetName: "Alta" }]);
});
```

- [ ] **Step 7: Run** – Expected: FAIL, modules not found.

- [ ] **Step 8: Implement ssb.mjs, fhi.mjs, klass.mjs**

```js
// scripts/lib/ssb.mjs
import { getJson, postJson } from "./http.mjs";
import { jsonStatToRows } from "./jsonstat.mjs";

export const SSB_BASE = "https://data.ssb.no/api/v0/no/table";

export const item = (code, values) => ({ code, selection: { filter: "item", values } });
export const all = (code) => ({ code, selection: { filter: "all", values: ["*"] } });

/** GET metadata: {title, variables:[{code, text, values, valueTexts, elimination}]} */
export async function ssbMetadata(tableId, opts = {}) {
  return getJson(`${SSB_BASE}/${tableId}`, opts);
}

/** POST a query, returns a json-stat2 dataset. */
export async function ssbQuery(tableId, query, opts = {}) {
  return postJson(`${SSB_BASE}/${tableId}`, { query, response: { format: "json-stat2" } }, opts);
}

/**
 * One request per value of `chunkDim` (must be an item selection), rows concatenated.
 * Keeps each request under SSB's 800 000-cell limit.
 */
export async function ssbQueryChunked(tableId, query, chunkDim, opts = {}) {
  const dim = query.find((q) => q.code === chunkDim);
  if (!dim || dim.selection.filter !== "item") {
    throw new Error(`ssbQueryChunked ${tableId}: ${chunkDim} må være en item-seleksjon`);
  }
  const rows = [];
  const datasets = [];
  for (const v of dim.selection.values) {
    const q = query.map((x) => (x.code === chunkDim ? item(chunkDim, [v]) : x));
    const ds = await ssbQuery(tableId, q, opts);
    datasets.push(ds);
    rows.push(...jsonStatToRows(ds));
  }
  return { rows, datasets };
}

/** Values of one dimension from metadata, e.g. all years. */
export function metadataValues(metadata, code) {
  const v = metadata.variables.find((x) => x.code === code);
  if (!v) throw new Error(`SSB-metadata mangler dimensjonen ${code}`);
  return { values: v.values, labels: Object.fromEntries(v.values.map((c, i) => [c, v.valueTexts[i]])) };
}
```

```js
// scripts/lib/fhi.mjs
import { postJson } from "./http.mjs";

export const FHI_BASE = "https://statistikk-data.fhi.no/api/open/v1";

export const fhiItem = (code, values) => ({ code, filter: "item", values });
export const fhiAll = (code) => ({ code, filter: "all", values: ["*"] });

/** POST {source}/Table/{id}/data, returns a json-stat2 dataset (BOM is stripped by http.mjs). */
export async function fhiQuery(source, tableId, dimensions, { maxRowCount = 500_000, ...opts } = {}) {
  return postJson(`${FHI_BASE}/${source}/Table/${tableId}/data`, { dimensions, response: { format: "json-stat2", maxRowCount } }, opts);
}
```

```js
// scripts/lib/klass.mjs
import { getJson } from "./http.mjs";

export const KLASS_BASE = "https://data.ssb.no/api/klass/v1";

export async function klassCodes(classificationId, { from = "2025-01-01", to = "2025-01-02", level, ...opts } = {}) {
  const lvl = level ? `&selectLevel=${level}` : "";
  const data = await getJson(`${KLASS_BASE}/classifications/${classificationId}/codes?from=${from}&to=${to}${lvl}`, opts);
  return data.codes.map(({ code, parentCode, level: l, name }) => ({ code, parentCode: parentCode ?? null, level: Number(l), name }));
}

export async function klassCorrespondence(tableId, opts = {}) {
  const data = await getJson(`${KLASS_BASE}/correspondencetables/${tableId}`, opts);
  return data.correspondenceMaps.map(({ sourceCode, sourceName, targetCode, targetName }) => ({ sourceCode, sourceName, targetCode, targetName }));
}
```

- [ ] **Step 9: Run all tests** – `npm test` → all PASS.

- [ ] **Step 10: Commit**

```bash
git add scripts/lib/http.mjs scripts/lib/http.test.mjs scripts/lib/ssb.mjs scripts/lib/ssb.test.mjs scripts/lib/fhi.mjs scripts/lib/klass.mjs scripts/lib/klass.test.mjs scripts/lib/test-helpers.mjs
git commit -m "feat(pipeline): http retry client and SSB/FHI/KLASS wrappers"
```

### Task 3: Age groups, region constants and the fetcher runner

**Files:**
- Create: `scripts/lib/age.mjs`, `scripts/lib/regions.mjs`, `scripts/lib/fetcher.mjs`
- Test: `scripts/lib/age.test.mjs`, `scripts/lib/regions.test.mjs`, `scripts/lib/fetcher.test.mjs`

**Interfaces:**
- Consumes: `writeCsv` (Task 1), `RAW_DIR`, `NORMALIZED_DIR` (Task 1).
- Produces: `AGE_GROUPS` (7 labels), `ageGroup(singleYearCode): string` (`"0-17" … "90+"`; `"105+"`, `"105"`, `"999"`-style codes → highest group; throws on non-numeric); `RHF_TO_REGION: Record<orgnr, "H03"|"H04"|"H05"|"H12">`, `REGION_NAMES`, `PRIVATE_RHF: Record<orgnr, rhfOrgnr>`, `stripPeriodSuffix(label)`, `isOrgNr(code)` (`/^\d{9}$/`), `isRegionCode(code)` (`/^H\d\d$/`), `regionPrefix(code)` (`"H03_AV"` → `"H03"`, `"H00"`/`"H06_HF"`/`"S01"` → `""`); `runFetcher(def, ctx)` where `def = {meta: {id, navn, url, api_url, lisens, query?}, fetchRaw(deps): Promise<raw>, transform(raw, deps): Record<csvFileName, rows[]>, columns: Record<csvFileName, string[]>}` and `ctx = {deps, log, rawDir, outDir}` → `{id, tables: string[], rows: Record<file, number>}`. Every fetcher module in `scripts/fetch/` exports a `def` of that shape as its default export; `deps` is `{fetchImpl, sleep, today}` and fetchers forward `fetchImpl`/`sleep` into every SSB/FHI/KLASS call.

- [ ] **Step 1: Failing tests**

```js
// scripts/lib/age.test.mjs
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
```

```js
// scripts/lib/regions.test.mjs
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
```

```js
// scripts/lib/fetcher.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFetcher } from "./fetcher.mjs";

test("runFetcher writes raw json and one csv per transform key", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kap-"));
  const def = {
    meta: { id: "test_1", navn: "Test", url: "https://x", api_url: "https://x/api", lisens: "NLOD" },
    fetchRaw: async (deps) => ({ hello: deps.today }),
    transform: (raw) => ({ "a.csv": [{ k: "v", n: 1 }] }),
    columns: { "a.csv": ["k", "n"] },
  };
  const result = await runFetcher(def, { deps: { today: "2026-09-02" }, log: () => {}, rawDir: dir, outDir: dir });
  assert.deepEqual(result, { id: "test_1", tables: ["a.csv"], rows: { "a.csv": 1 } });
  assert.deepEqual(JSON.parse(await readFile(join(dir, "test_1.json"), "utf8")), { hello: "2026-09-02" });
  assert.equal(await readFile(join(dir, "a.csv"), "utf8"), "k,n\nv,1\n");
});

test("runFetcher refuses a table without a column list or with zero rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kap-"));
  const base = { meta: { id: "t" }, fetchRaw: async () => ({}), columns: {} };
  await assert.rejects(
    runFetcher({ ...base, transform: () => ({ "b.csv": [{ x: 1 }] }) }, { deps: {}, log: () => {}, rawDir: dir, outDir: dir }),
    /kolonneliste/,
  );
  await assert.rejects(
    runFetcher({ ...base, columns: { "b.csv": ["x"] }, transform: () => ({ "b.csv": [] }) }, { deps: {}, log: () => {}, rawDir: dir, outDir: dir }),
    /0 rader/,
  );
});
```

- [ ] **Step 2: Run** – `cd /Users/hom/Documents/GitHub/kapasitet && node --test scripts/lib/age.test.mjs scripts/lib/regions.test.mjs scripts/lib/fetcher.test.mjs` → FAIL, modules not found.

- [ ] **Step 3: Implement**

```js
// scripts/lib/age.mjs
export const AGE_GROUPS = ["0-17", "18-29", "30-49", "50-66", "67-79", "80-89", "90+"];
const UPPER = [17, 29, 49, 66, 79, 89];

/** Single-year age code ("000", "17", "105+") → one of AGE_GROUPS. */
export function ageGroup(code) {
  const n = parseInt(String(code), 10);
  if (Number.isNaN(n)) throw new Error(`Kan ikke tolke aldersgruppe fra koden "${code}"`);
  for (let i = 0; i < UPPER.length; i++) if (n <= UPPER[i]) return AGE_GROUPS[i];
  return AGE_GROUPS[AGE_GROUPS.length - 1];
}
```

```js
// scripts/lib/regions.mjs
// RHF org.nr → helseregion code used by SSB (H03 Vest, H04 Midt, H05 Nord, H12 Sør-Øst).
export const RHF_TO_REGION = {
  "883658752": "H05", // Helse Nord RHF
  "983658725": "H03", // Helse Vest RHF
  "983658776": "H04", // Helse Midt-Norge RHF
  "991324968": "H12", // Helse Sør-Øst RHF
};

export const REGION_NAMES = { H03: "Helse Vest", H04: "Helse Midt-Norge", H05: "Helse Nord", H12: "Helse Sør-Øst" };

// Private/ideal providers that appear in SSB 13942 but are not under an RHF in KLASS 629.
export const PRIVATE_RHF = {
  "916270097": "983658725", // Voss DPS NKS Bjørkeli
  "919865636": "983658725", // Solli DPS
  "922716552": "983658725", // Betanien sykehus (Bergen)
  "981275721": "991324968", // Betanien Hospital Skien
  "984027737": "983658725", // Haraldsplass Diakonale Sykehus
  "985773238": "991324968", // Revmatismesykehuset Lillehammer
  "985962170": "991324968", // Martina Hansens Hospital
  "986106839": "983658725", // Haugesund Sanitetsforenings Revmatismesykehus
  "987554401": "983658725", // NKS Olaviken alderspsykiatriske sykehus
  "996380041": "983658725", // NKS Jæren DPS
};

/** "Troms (2024-)" → "Troms"; "Troms (-2023)" → "Troms". */
export const stripPeriodSuffix = (label) => String(label).replace(/\s*\((\d{4})?-(\d{4})?\)\s*$/, "").trim();
export const isOrgNr = (code) => /^\d{9}$/.test(String(code));
export const isRegionCode = (code) => /^H\d\d$/.test(String(code));
/** SSB region-ish codes: "H05" → "H05", "H12_AV" → "H12"; H00 (whole country), H06_* (private without oppdragsdokument) → "". */
export const regionPrefix = (code) => (/^H(03|04|05|12)/.test(String(code)) ? String(code).slice(0, 3) : "");
```

```js
// scripts/lib/fetcher.mjs
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
  const rows = {};
  for (const [file, list] of Object.entries(tables)) {
    const columns = def.columns[file];
    if (!columns) throw new Error(`[${id}] ${file} mangler kolonneliste i def.columns`);
    if (list.length === 0) throw new Error(`[${id}] ${file} fikk 0 rader – kilden har endret seg`);
    await writeCsv(join(outDir, file), list, columns);
    rows[file] = list.length;
    log(`[${id}] ${file}: ${list.length} rader`);
  }
  return { id, tables: Object.keys(tables), rows };
}
```

- [ ] **Step 4: Run all tests** – `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/age.mjs scripts/lib/age.test.mjs scripts/lib/regions.mjs scripts/lib/regions.test.mjs scripts/lib/fetcher.mjs scripts/lib/fetcher.test.mjs
git commit -m "feat(pipeline): age groups, region constants and fetcher runner"
```

### Task 4: Fetcher `klass-catchment` – opptaksområder and kommune → område

**Files:**
- Create: `scripts/fetch/klass-catchment.mjs`
- Test: `scripts/fetch/klass-catchment.test.mjs`

**Interfaces:**
- Consumes: `klassCodes`, `klassCorrespondence` (Task 2), `readCsv` (Task 1), `RHF_TO_REGION`, `PRIVATE_RHF` (Task 3), `runFetcher` def shape (Task 3).
- Produces: default export `def` with `meta.id = "ssb_klass_opptak"`; writes `opptaksomrader.csv` (`omrade_id, omrade_navn, omrade_type, hf_id`) and `municipality_catchment.csv` (`municipality_code, municipality_name, lokalsykehus_id, dps_id, hf_id, helseregion, quality, note`). Also exports the pure function `buildCatchment(raw)` for tests, where `raw = {codes629, codes632, corr2688, corr2690, municipalities}`.

KLASS facts (verified 2026-09-02): 629 = lokalsykehusområder: level 1 RHF org.nr, level 2 HF org.nr, level 3 `S01`…`S50`, level 4 = 8-digit grunnkrets codes (no whole kommuner). 632 = DPS-områder: level 3 `D01`…`D69`, level 4 = grunnkretser **and** 119 whole-kommune 4-digit codes. Correspondence 2688 = lokalsykehusområde → kommune, 2690 = DPS-område → kommune; split kommuner (Oslo 0301, Bergen 4601, Asker 3203, Holmestrand 3903, Lurøy 1834, …) appear with several source areas. The kommune's main area is the one with most level-4 codes that start with the kommune code; a whole-kommune entry in 632 counts as 10 000.

- [ ] **Step 1: Failing test**

```js
// scripts/fetch/klass-catchment.test.mjs
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
```

- [ ] **Step 2: Run** – `cd /Users/hom/Documents/GitHub/kapasitet && node --test scripts/fetch/klass-catchment.test.mjs` → FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/fetch/klass-catchment.mjs
import { klassCodes, klassCorrespondence } from "../lib/klass.mjs";
import { readCsv } from "../lib/csv.mjs";
import { normalized } from "../lib/paths.mjs";
import { RHF_TO_REGION, PRIVATE_RHF } from "../lib/regions.mjs";

const WHOLE_KOMMUNE_WEIGHT = 10_000;

function areasByCode(codes) {
  return Object.fromEntries(codes.filter((c) => c.level === 3).map((c) => [c.code, c]));
}

/** area → { kommune → weight } from level-4 codes (grunnkrets 8-digit or whole kommune 4-digit). */
function coverage(codes) {
  const cov = {};
  for (const c of codes) {
    if (c.level !== 4) continue;
    const kommune = c.code.slice(0, 4);
    const w = c.code.length === 4 ? WHOLE_KOMMUNE_WEIGHT : 1;
    ((cov[c.parentCode] ??= {})[kommune] ??= 0);
    cov[c.parentCode][kommune] += w;
  }
  return cov;
}

function pickArea(kommune, candidates, areas, cov) {
  if (candidates.length === 0) return { id: "", note: null, split: false };
  if (candidates.length === 1) return { id: candidates[0], note: null, split: false };
  const scored = candidates
    .map((id) => ({ id, n: cov[id]?.[kommune] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  const desc = scored.map((s) => `${s.id} ${areas[s.id]?.name ?? ""} (${s.n})`).join(", ");
  return { id: scored[0].id, note: desc, split: true };
}

export function buildCatchment({ codes629, codes632, corr2688, corr2690, municipalities }) {
  const sAreas = areasByCode(codes629);
  const dAreas = areasByCode(codes632);
  const opptaksomrader = [
    ...Object.values(sAreas).map((a) => ({ omrade_id: a.code, omrade_navn: a.name, omrade_type: "lokalsykehus", hf_id: a.parentCode })),
    ...Object.values(dAreas).map((a) => ({ omrade_id: a.code, omrade_navn: a.name, omrade_type: "dps", hf_id: a.parentCode })),
  ];
  const sCov = coverage(codes629);
  const dCov = coverage(codes632);
  const sCand = {};
  for (const m of corr2688) (sCand[m.targetCode] ??= []).push(m.sourceCode);
  const dCand = {};
  for (const m of corr2690) (dCand[m.targetCode] ??= []).push(m.sourceCode);
  const hfParent = Object.fromEntries(codes629.filter((c) => c.level === 2).map((c) => [c.code, c.parentCode]));

  const catchment = municipalities.map((m) => {
    const k = m.municipality_code;
    const s = pickArea(k, sCand[k] ?? [], sAreas, sCov);
    const d = pickArea(k, dCand[k] ?? [], dAreas, dCov);
    const notes = [];
    if (!s.id) notes.push("Ikke i KLASS 2688");
    if (s.split) notes.push(`Delt lokalsykehus: ${s.note}`);
    if (!d.id) notes.push("Ikke i KLASS 2690");
    if (d.split) notes.push(`Delt DPS: ${d.note}`);
    const hf_id = s.id ? sAreas[s.id].parentCode : "";
    const rhf = hf_id ? hfParent[hf_id] ?? PRIVATE_RHF[hf_id] : "";
    return {
      municipality_code: k,
      municipality_name: m.municipality_name,
      lokalsykehus_id: s.id,
      dps_id: d.id,
      hf_id,
      helseregion: rhf ? RHF_TO_REGION[rhf] ?? "" : "",
      quality: notes.length === 0 ? "ekte" : "avledet",
      note: notes.join("; "),
    };
  });
  return { opptaksomrader, catchment };
}

const def = {
  meta: {
    id: "ssb_klass_opptak",
    navn: "SSB KLASS 629 lokalsykehusområder og 632 DPS-områder med korrespondanse til kommune (2688, 2690)",
    url: "https://www.ssb.no/klass/klassifikasjoner/629",
    api_url: "https://data.ssb.no/api/klass/v1/classifications/629/codes",
    lisens: "NLOD 2.0",
  },
  async fetchRaw(deps) {
    const municipalities = (await readCsv(normalized("municipalities.csv"))).rows;
    return {
      codes629: await klassCodes(629, deps),
      codes632: await klassCodes(632, deps),
      corr2688: await klassCorrespondence(2688, deps),
      corr2690: await klassCorrespondence(2690, deps),
      municipalities,
    };
  },
  transform(raw) {
    const { opptaksomrader, catchment } = buildCatchment(raw);
    return { "opptaksomrader.csv": opptaksomrader, "municipality_catchment.csv": catchment };
  },
  columns: {
    "opptaksomrader.csv": ["omrade_id", "omrade_navn", "omrade_type", "hf_id"],
    "municipality_catchment.csv": ["municipality_code", "municipality_name", "lokalsykehus_id", "dps_id", "hf_id", "helseregion", "quality", "note"],
  },
};
export default def;
```

Note: `data/normalized/municipalities.csv` has columns `municipality_code,county_code,municipality_name,county_name` (357 kommuner, 2024 codes, BOM header – `parseCsv` strips it); `fetchRaw` reads it because the kommune list must match the app's list, not KLASS's.

- [ ] **Step 4: Run** – PASS. Then `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/klass-catchment.mjs scripts/fetch/klass-catchment.test.mjs
git commit -m "feat(fetch): KLASS opptaksomrader and kommune catchment"
```

### Task 5: Fetcher `ssb-13942` – HF activity, beds, occupancy + `helseforetak.csv`

**Files:**
- Create: `scripts/fetch/ssb-13942.mjs`
- Test: `scripts/fetch/ssb-13942.test.mjs`

**Interfaces:**
- Consumes: `ssbQuery`, `all` (Task 2), `klassCodes` (Task 2), `jsonStatToRows` (Task 1), `RHF_TO_REGION`, `PRIVATE_RHF`, `isOrgNr`, `isRegionCode`, `stripPeriodSuffix` (Task 3).
- Produces: default `def` (id `ssb_13942`), exported pure `transform13942(raw)`; writes `hf_activity.csv` (`hf_id, hf_navn, helseregion, tjenesteomrade, metric, period, value, unit, source_id, quality`) and `helseforetak.csv` (`hf_id, hf_navn, rhf_id, helseregion, type`). `helseforetak.csv` holds org.nr rows only (regions are not HFs). In `hf_activity.csv` region rows have `hf_id = "H05"` etc. with `helseregion` = the same code, `hf_id = "H00"` = whole country with `helseregion = ""`, and the `H03_AV`/`H06_*` rows are kept as-is (helseregion `H03` / `""`).

SSB 13942 facts (verified 2026-09-02): `HelseReg` 43 codes = 32 org.nr (19 HF, 13 private incl. Lovisenberg 965985166 and Diakonhjemmet 982791952 which KLASS lists under Helse Sør-Øst) + `H00` Hele landet, `H03/H04/H05/H12` helseregioner, `H03_AV/H04_AV/H05_AV/H12_AV` avtalespesialister per region, `H06_HF`/`H06_HR` private foretak uten oppdragsdokument. There is **no** `0` code in this table. `HelseTjenomr` `TOT, SOM, VOP, BUP, TSB` (keep all), `ContentsCode` `Dognplass, Utskriv, Liggedag, Polikliniske, Dag, Sengedogn, BeleggSsb, BeleggOecd`, `Tid` 2015–2025. 43×5×8×11 = 18 920 cells → one request. Rule for `helseregion`: org.nr → RHF via KLASS level 2 or `PRIVATE_RHF` (throw if unknown); any other code → `regionPrefix(code)` (so `H03_AV` → `H03`, `H00`/`H06_*` → `""`). Codes that are neither 9 digits nor start with `H` → throw.

- [ ] **Step 1: Failing test**

```js
// scripts/fetch/ssb-13942.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transform13942 } from "./ssb-13942.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

const dataset = makeJsonStat(
  [
    { id: "HelseReg", codes: ["H00", "H05_AV", "983974880", "984027737"], labels: ["Hele landet", "Avtalespesialister i Helseregion Nord", "Finnmarkssykehuset HF", "Haraldsplass diakonale sykehus AS"] },
    { id: "HelseTjenomr", codes: ["SOM"], labels: ["Somatikk"] },
    { id: "ContentsCode", codes: ["Dognplass", "BeleggSsb"], labels: ["Døgnplasser", "Beleggsprosent"] },
    { id: "Tid", codes: ["2025"] },
  ],
  [10000, 85, 1000, 84, 134, 80, 100, 90],
);
const klass = [
  { code: "883658752", parentCode: null, level: 1, name: "Helse Nord RHF" },
  { code: "983974880", parentCode: "883658752", level: 2, name: "Finnmarkssykehuset HF" },
];

test("hf_activity rows carry metric mapping, unit and region", () => {
  const { "hf_activity.csv": rows } = transform13942({ dataset, klass });
  const fin = rows.filter((r) => r.hf_id === "983974880");
  assert.deepEqual(fin, [
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: 134, unit: "senger", source_id: "ssb_13942", quality: "ekte" },
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "beleggsprosent", period: "2025", value: 80, unit: "prosent", source_id: "ssb_13942", quality: "ekte" },
  ]);
  assert.equal(rows.find((r) => r.hf_id === "H00").helseregion, "");
  assert.equal(rows.find((r) => r.hf_id === "H05_AV").helseregion, "H05");
  assert.equal(rows.find((r) => r.hf_id === "984027737").helseregion, "H03");
});

test("helseforetak.csv has one row per org.nr with rhf and type", () => {
  const { "helseforetak.csv": hf } = transform13942({ dataset, klass });
  assert.deepEqual(hf, [
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" },
    { hf_id: "984027737", hf_navn: "Haraldsplass diakonale sykehus AS", rhf_id: "983658725", helseregion: "H03", type: "privat" },
  ]);
});

test("unknown metric or org.nr throws", () => {
  const bad = makeJsonStat([{ id: "HelseReg", codes: ["H00"] }, { id: "HelseTjenomr", codes: ["SOM"] }, { id: "ContentsCode", codes: ["Nytt"] }, { id: "Tid", codes: ["2025"] }], [1]);
  assert.throws(() => transform13942({ dataset: bad, klass }), /Ukjent ContentsCode "Nytt"/);
  const unknownOrg = makeJsonStat([{ id: "HelseReg", codes: ["111111111"] }, { id: "HelseTjenomr", codes: ["SOM"] }, { id: "ContentsCode", codes: ["Dognplass"] }, { id: "Tid", codes: ["2025"] }], [1]);
  assert.throws(() => transform13942({ dataset: unknownOrg, klass }), /111111111/);
});
```

- [ ] **Step 2: Run** – FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/fetch/ssb-13942.mjs
import { ssbQuery, all } from "../lib/ssb.mjs";
import { klassCodes } from "../lib/klass.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { RHF_TO_REGION, PRIVATE_RHF, isOrgNr, regionPrefix, stripPeriodSuffix } from "../lib/regions.mjs";

export const METRICS = {
  Dognplass: ["dognplasser", "senger"],
  Utskriv: ["utskrivninger", "antall"],
  Liggedag: ["liggedager", "dogn"],
  Polikliniske: ["polikliniske_konsultasjoner", "antall"],
  Dag: ["dagbehandlinger", "antall"],
  Sengedogn: ["sengedogn", "dogn"],
  BeleggSsb: ["beleggsprosent", "prosent"],
  BeleggOecd: ["beleggsprosent_oecd", "prosent"],
};

function rhfOf(orgnr, klassParent) {
  const rhf = klassParent[orgnr] ?? PRIVATE_RHF[orgnr];
  if (!rhf) throw new Error(`Org.nr ${orgnr} finnes verken i KLASS 629 nivå 2 eller i PRIVATE_RHF – legg den til i scripts/lib/regions.mjs`);
  return rhf;
}

export function transform13942({ dataset, klass }) {
  const klassParent = Object.fromEntries(klass.filter((c) => c.level === 2).map((c) => [c.code, c.parentCode]));
  const rows = jsonStatToRows(dataset);
  const activity = [];
  const hfs = new Map();
  for (const r of rows) {
    const m = METRICS[r.ContentsCode];
    if (!m) throw new Error(`Ukjent ContentsCode "${r.ContentsCode}" i SSB 13942 – oppdater METRICS`);
    const code = r.HelseReg;
    let helseregion = "";
    if (isOrgNr(code)) {
      const rhf = rhfOf(code, klassParent);
      helseregion = RHF_TO_REGION[rhf];
      if (!hfs.has(code)) {
        const navn = stripPeriodSuffix(r.HelseReg_label);
        hfs.set(code, { hf_id: code, hf_navn: navn, rhf_id: rhf, helseregion, type: /\bHF$/.test(navn) ? "hf" : "privat" });
      }
    } else if (code.startsWith("H")) helseregion = regionPrefix(code);
    else throw new Error(`Ukjent HelseReg-kode "${code}" i SSB 13942`);
    activity.push({
      hf_id: code, hf_navn: stripPeriodSuffix(r.HelseReg_label), helseregion, tjenesteomrade: r.HelseTjenomr,
      metric: m[0], period: r.Tid, value: r.value, unit: m[1], source_id: "ssb_13942", quality: "ekte",
    });
  }
  return { "hf_activity.csv": activity, "helseforetak.csv": [...hfs.values()] };
}

const def = {
  meta: {
    id: "ssb_13942",
    navn: "SSB 13942 Spesialisthelsetjenesten – døgnplasser, aktivitet og belegg etter helseforetak",
    url: "https://www.ssb.no/statbank/table/13942",
    api_url: "https://data.ssb.no/api/v0/no/table/13942",
    lisens: "NLOD 2.0",
    query: [all("HelseReg"), all("HelseTjenomr"), all("ContentsCode"), all("Tid")],
  },
  async fetchRaw(deps) {
    return { dataset: await ssbQuery("13942", def.meta.query, deps), klass: await klassCodes(629, { level: 2, ...deps }) };
  },
  transform: transform13942,
  columns: {
    "hf_activity.csv": ["hf_id", "hf_navn", "helseregion", "tjenesteomrade", "metric", "period", "value", "unit", "source_id", "quality"],
    "helseforetak.csv": ["hf_id", "hf_navn", "rhf_id", "helseregion", "type"],
  },
};
export default def;
```

- [ ] **Step 4: Run** – PASS; `npm test` PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/ssb-13942.mjs scripts/fetch/ssb-13942.test.mjs
git commit -m "feat(fetch): SSB 13942 HF activity, beds and helseforetak list"
```

### Task 6: Fetchers `ssb-13953` (staffing) and `ssb-14080` (specialists) via one factory

**Files:**
- Create: `scripts/fetch/ssb-hf-long.mjs`, `scripts/fetch/ssb-13953.mjs`, `scripts/fetch/ssb-14080.mjs`
- Test: `scripts/fetch/ssb-hf-long.test.mjs`

**Interfaces:**
- Consumes: `ssbQuery`, `all`, `item` (Task 2), `jsonStatToRows` (Task 1), `isOrgNr`, `isRegionCode`, `stripPeriodSuffix` (Task 3).
- Produces: `makeHfLongFetcher({id, tableId, navn, dim, dimCol, dimLabelCol, contentsCode, outFile})` → `def` with extra export `transform(raw)`; `hf_staffing.csv` (`hf_id, hf_navn, helseregion, yrkesgruppe_kode, yrkesgruppe, period, value, unit, source_id, quality`), `hf_specialists.csv` (same with `spesialitet_kode, spesialitet`). To keep fetchers independent of each other's output, the factory receives `hfRegion: Record<hf_id, helseregion>` built in `fetchRaw` from `klassCodes(629, {level:2})` + `PRIVATE_RHF` (same rule as Task 5); unknown org.nr → throw.

SSB facts (verified 2026-09-02): 13953 dims `HelseReg` (76 codes: `H00`, `H..`-codes, RHF org.nr, HF/private org.nr), `Yrke` 30 codes (labels contain non-breaking spaces), `HelseTjenomr` (`TOT, AMB, SOM, BUP, TSB, VOP, AOS` – select `TOT` only), `ContentsCode` `Arsverk`, `Tid`. 14080 dims `HelseReg` 76, `Spesialitet` 49, `HelseTjenomr` (select `TOT`), `ContentsCode` `AvtAarsverk`, `Tid`. Keep every `H`-prefixed code (helseregion via `regionPrefix`) and 9-digit codes that are in `hfRegion` (HF/private); RHF org.nr (keys of `RHF_TO_REGION`) are dropped because the `H..` rows already carry the regional totals; any other 9-digit code → throw.

- [ ] **Step 1: Failing test**

```js
// scripts/fetch/ssb-hf-long.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHfLongFetcher } from "./ssb-hf-long.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

const f = makeHfLongFetcher({
  id: "ssb_13953", tableId: "13953", navn: "x", dim: "Yrke", dimCol: "yrkesgruppe_kode", dimLabelCol: "yrkesgruppe", contentsCode: "Arsverk", outFile: "hf_staffing.csv",
});

test("keeps land, regions and HF rows, drops RHF org.nr, normalises nbsp in labels", () => {
  const dataset = makeJsonStat(
    [
      { id: "HelseReg", codes: ["H00", "H05", "883658752", "983974880"], labels: ["Hele landet", "Helse Nord", "Helse Nord RHF", "Finnmarkssykehuset HF (2020-)"] },
      { id: "Yrke", codes: ["02"], labels: ["Sykepleiere\u00a0mv."] },
      { id: "HelseTjenomr", codes: ["TOT"] },
      { id: "ContentsCode", codes: ["Arsverk"] },
      { id: "Tid", codes: ["2025"] },
    ],
    [100, 50, 50, 10],
  );
  const out = f.transform({ dataset, hfRegion: { "983974880": "H05" } });
  assert.deepEqual(out["hf_staffing.csv"], [
    { hf_id: "H00", hf_navn: "Hele landet", helseregion: "", yrkesgruppe_kode: "02", yrkesgruppe: "Sykepleiere mv.", period: "2025", value: 100, unit: "arsverk", source_id: "ssb_13953", quality: "ekte" },
    { hf_id: "H05", hf_navn: "Helse Nord", helseregion: "H05", yrkesgruppe_kode: "02", yrkesgruppe: "Sykepleiere mv.", period: "2025", value: 50, unit: "arsverk", source_id: "ssb_13953", quality: "ekte" },
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", yrkesgruppe_kode: "02", yrkesgruppe: "Sykepleiere mv.", period: "2025", value: 10, unit: "arsverk", source_id: "ssb_13953", quality: "ekte" },
  ]);
  assert.deepEqual(f.columns["hf_staffing.csv"], ["hf_id", "hf_navn", "helseregion", "yrkesgruppe_kode", "yrkesgruppe", "period", "value", "unit", "source_id", "quality"]);
});

test("unknown HF org.nr throws", () => {
  const dataset = makeJsonStat([{ id: "HelseReg", codes: ["111111111"] }, { id: "Yrke", codes: ["02"] }, { id: "HelseTjenomr", codes: ["TOT"] }, { id: "ContentsCode", codes: ["Arsverk"] }, { id: "Tid", codes: ["2025"] }], [1]);
  assert.throws(() => f.transform({ dataset, hfRegion: {} }), /111111111/);
});
```

- [ ] **Step 2: Run** – FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/fetch/ssb-hf-long.mjs
import { ssbQuery, all, item } from "../lib/ssb.mjs";
import { klassCodes } from "../lib/klass.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { RHF_TO_REGION, PRIVATE_RHF, isOrgNr, regionPrefix, stripPeriodSuffix } from "../lib/regions.mjs";

/** hf org.nr → helseregion from KLASS 629 level 2 plus PRIVATE_RHF. Shared by 13953/14080. */
export async function fetchHfRegion(deps) {
  const klass = await klassCodes(629, { level: 2, ...deps });
  const map = Object.fromEntries(klass.map((c) => [c.code, RHF_TO_REGION[c.parentCode]]));
  for (const [org, rhf] of Object.entries(PRIVATE_RHF)) map[org] ??= RHF_TO_REGION[rhf];
  return map;
}

const clean = (s) => stripPeriodSuffix(String(s).replaceAll("\u00a0", " "));

export function makeHfLongFetcher({ id, tableId, navn, dim, dimCol, dimLabelCol, contentsCode, outFile }) {
  const columns = ["hf_id", "hf_navn", "helseregion", dimCol, dimLabelCol, "period", "value", "unit", "source_id", "quality"];
  const query = [all("HelseReg"), all(dim), item("HelseTjenomr", ["TOT"]), item("ContentsCode", [contentsCode]), all("Tid")];
  function transform({ dataset, hfRegion }) {
    const out = [];
    for (const r of jsonStatToRows(dataset)) {
      const code = r.HelseReg;
      let helseregion = "";
      if (isOrgNr(code)) {
        if (RHF_TO_REGION[code]) continue; // RHF total rows – the H.. rows already carry those
        helseregion = hfRegion[code];
        if (!helseregion) throw new Error(`Org.nr ${code} i SSB ${tableId} finnes verken i KLASS 629 nivå 2 eller i PRIVATE_RHF`);
      } else if (code.startsWith("H")) helseregion = regionPrefix(code);
      else throw new Error(`Ukjent HelseReg-kode "${code}" i SSB ${tableId}`);
      out.push({
        hf_id: code, hf_navn: clean(r.HelseReg_label), helseregion, [dimCol]: r[dim], [dimLabelCol]: clean(r[`${dim}_label`]),
        period: r.Tid, value: r.value, unit: "arsverk", source_id: id, quality: "ekte",
      });
    }
    return { [outFile]: out };
  }
  return {
    meta: { id, navn, url: `https://www.ssb.no/statbank/table/${tableId}`, api_url: `https://data.ssb.no/api/v0/no/table/${tableId}`, lisens: "NLOD 2.0", query },
    async fetchRaw(deps) {
      return { dataset: await ssbQuery(tableId, query, deps), hfRegion: await fetchHfRegion(deps) };
    },
    transform,
    columns: { [outFile]: columns },
  };
}
```

```js
// scripts/fetch/ssb-13953.mjs
import { makeHfLongFetcher } from "./ssb-hf-long.mjs";
export default makeHfLongFetcher({
  id: "ssb_13953", tableId: "13953",
  navn: "SSB 13953 Avtalte årsverk i spesialisthelsetjenesten etter helseforetak og yrkesgruppe",
  dim: "Yrke", dimCol: "yrkesgruppe_kode", dimLabelCol: "yrkesgruppe", contentsCode: "Arsverk", outFile: "hf_staffing.csv",
});
```

```js
// scripts/fetch/ssb-14080.mjs
import { makeHfLongFetcher } from "./ssb-hf-long.mjs";
export default makeHfLongFetcher({
  id: "ssb_14080", tableId: "14080",
  navn: "SSB 14080 Avtalte legeårsverk i spesialisthelsetjenesten etter helseforetak og spesialitet",
  dim: "Spesialitet", dimCol: "spesialitet_kode", dimLabelCol: "spesialitet", contentsCode: "AvtAarsverk", outFile: "hf_specialists.csv",
});
```

- [ ] **Step 4: Run** – PASS; `npm test` PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/ssb-hf-long.mjs scripts/fetch/ssb-hf-long.test.mjs scripts/fetch/ssb-13953.mjs scripts/fetch/ssb-14080.mjs
git commit -m "feat(fetch): SSB 13953 staffing and 14080 specialists per HF"
```

### Task 7: Fetcher `ssb-13982` – population per opptaksområde

**Files:**
- Create: `scripts/fetch/ssb-13982.mjs`
- Test: `scripts/fetch/ssb-13982.test.mjs`

**Interfaces:**
- Consumes: `ssbMetadata`, `metadataValues`, `ssbQueryChunked`, `all`, `item` (Task 2), `AGE_GROUPS`, `ageGroup` (Task 3), `isOrgNr`, `regionPrefix`, `stripPeriodSuffix` (Task 3).
- Produces: default `def` (id `ssb_13982`), exported `transform13982(raw)` with `raw = {rows}` (rows already decoded by `ssbQueryChunked`); writes `catchment_population.csv` (`omrade_id, omrade_navn, omrade_type, tjenesteomrade, aldersgruppe, period, value, unit, source_id, quality`). `aldersgruppe` ∈ `AGE_GROUPS ∪ {"alle"}`; `omrade_type` ∈ `lokalsykehus | dps | hf | helseregion | land`.

SSB 13982 facts: `HelseReg` 145 codes (org.nr, `H00`, `H03…`, `S01`–`S50`, `D01`–`D69`), `HelseTjenomr` `SOM, VOP, BUP, TSB, DPS`, `Kjonn` `0, 2, 1`, `Alder` single years `000`…`104`, `105+`, `Tid` 2015–2026. One year = 145×5×106 = 76 850 cells → chunk by `Tid`.

- [ ] **Step 1: Failing test**

```js
// scripts/fetch/ssb-13982.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transform13982 } from "./ssb-13982.mjs";

const row = (HelseReg, HelseReg_label, HelseTjenomr, Alder, Tid, value) => ({ HelseReg, HelseReg_label, HelseTjenomr, HelseTjenomr_label: HelseTjenomr, Kjonn: "0", Kjonn_label: "Begge kjønn", Alder, Alder_label: Alder, Tid, Tid_label: Tid, value });

test("aggregates single years into groups plus 'alle' and types the area by code", () => {
  const rows = [
    row("S01", "Hammerfest", "SOM", "000", "2025", 10),
    row("S01", "Hammerfest", "SOM", "017", "2025", 5),
    row("S01", "Hammerfest", "SOM", "090", "2025", 2),
    row("S01", "Hammerfest", "SOM", "105+", "2025", 1),
    row("D01", "DPS Vest-Finnmark", "DPS", "030", "2025", 7),
    row("983974880", "Finnmarkssykehuset HF (2020-)", "SOM", "030", "2025", 7),
    row("H05", "Helseregion Nord", "SOM", "030", "2025", 7),
    row("H00", "Hele landet", "SOM", "030", "2025", 7),
  ];
  const out = transform13982({ rows })["catchment_population.csv"];
  const s01 = out.filter((r) => r.omrade_id === "S01");
  assert.deepEqual(s01.map((r) => [r.aldersgruppe, r.value]), [["0-17", 15], ["90+", 3], ["alle", 18]]);
  assert.deepEqual(s01[0], { omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", tjenesteomrade: "SOM", aldersgruppe: "0-17", period: "2025", value: 15, unit: "personer", source_id: "ssb_13982", quality: "ekte" });
  assert.equal(out.find((r) => r.omrade_id === "D01").omrade_type, "dps");
  const hf = out.find((r) => r.omrade_id === "983974880");
  assert.equal(hf.omrade_type, "hf");
  assert.equal(hf.omrade_navn, "Finnmarkssykehuset HF");
  assert.equal(out.find((r) => r.omrade_id === "H05").omrade_type, "helseregion");
  assert.equal(out.find((r) => r.omrade_id === "H00").omrade_type, "land");
});
```

- [ ] **Step 2: Run** – `cd /Users/hom/Documents/GitHub/kapasitet && node --test scripts/fetch/ssb-13982.test.mjs` → FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/fetch/ssb-13982.mjs
import { ssbMetadata, metadataValues, ssbQueryChunked, all, item } from "../lib/ssb.mjs";
import { AGE_GROUPS, ageGroup } from "../lib/age.mjs";
import { isOrgNr, stripPeriodSuffix } from "../lib/regions.mjs";

export function areaType(code) {
  if (code.startsWith("S")) return "lokalsykehus";
  if (code.startsWith("D")) return "dps";
  if (isOrgNr(code)) return "hf";
  if (code === "H00") return "land";
  if (code.startsWith("H")) return "helseregion";
  throw new Error(`Ukjent HelseReg-kode "${code}" i SSB 13982`);
}

/** Sum single-year rows into AGE_GROUPS + "alle" per (area, tjenesteomrade, year). */
export function aggregateAges(rows, { key, name, extra }) {
  const acc = new Map();
  for (const r of rows) {
    const k = [key(r), extra(r), r.Tid].join("|");
    if (!acc.has(k)) acc.set(k, { id: key(r), navn: name(r), extra: extra(r), period: r.Tid, groups: Object.fromEntries([...AGE_GROUPS, "alle"].map((g) => [g, 0])) });
    const e = acc.get(k);
    e.groups[ageGroup(r.Alder)] += r.value;
    e.groups.alle += r.value;
  }
  return [...acc.values()];
}

export function transform13982({ rows }) {
  const out = [];
  for (const e of aggregateAges(rows, { key: (r) => r.HelseReg, name: (r) => stripPeriodSuffix(r.HelseReg_label), extra: (r) => r.HelseTjenomr })) {
    for (const g of [...AGE_GROUPS, "alle"]) {
      if (g !== "alle" && e.groups[g] === 0) continue;
      out.push({ omrade_id: e.id, omrade_navn: e.navn, omrade_type: areaType(e.id), tjenesteomrade: e.extra, aldersgruppe: g, period: e.period, value: e.groups[g], unit: "personer", source_id: "ssb_13982", quality: "ekte" });
    }
  }
  return { "catchment_population.csv": out };
}

const def = {
  meta: {
    id: "ssb_13982",
    navn: "SSB 13982 Befolkning i opptaksområder for helseforetak, etter tjenesteområde og alder",
    url: "https://www.ssb.no/statbank/table/13982",
    api_url: "https://data.ssb.no/api/v0/no/table/13982",
    lisens: "NLOD 2.0",
    query: "HelseReg=*, HelseTjenomr=*, Kjonn=0, Alder=*, Tid=<alle år fra metadata, én forespørsel per år>",
  },
  async fetchRaw(deps) {
    const meta = await ssbMetadata("13982", deps);
    const years = metadataValues(meta, "Tid").values;
    const query = [all("HelseReg"), all("HelseTjenomr"), item("Kjonn", ["0"]), all("Alder"), item("Tid", years)];
    const { rows } = await ssbQueryChunked("13982", query, "Tid", deps);
    return { rows };
  },
  transform: transform13982,
  columns: { "catchment_population.csv": ["omrade_id", "omrade_navn", "omrade_type", "tjenesteomrade", "aldersgruppe", "period", "value", "unit", "source_id", "quality"] },
};
export default def;
```

Note on the test's expected order: `aggregateAges` keeps first-seen order and `transform13982` emits groups in `AGE_GROUPS` order followed by `alle`, skipping zero groups (except `alle`).

- [ ] **Step 4: Run** – PASS; `npm test` PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/ssb-13982.mjs scripts/fetch/ssb-13982.test.mjs
git commit -m "feat(fetch): SSB 13982 population per opptaksomrade"
```

### Task 8: Fetcher `ssb-pasienter` – 14824 (somatikk) + 14820 (psykisk helsevern voksne)

**Files:**
- Create: `scripts/fetch/ssb-pasienter.mjs`
- Test: `scripts/fetch/ssb-pasienter.test.mjs`

**Interfaces:**
- Consumes: `ssbMetadata`, `metadataValues`, `ssbQuery`, `ssbQueryChunked`, `all`, `item` (Task 2), `jsonStatToRows` (Task 1), `regionPrefix`, `stripPeriodSuffix` (Task 3).
- Produces: default `def` (id `ssb_pasienter`), exported `transformPasienter(raw)` with `raw = {somRows, somDetail (json-stat2 dataset), vopRows, somRegionLabels}`; writes `patients_by_diagnosis.csv` and `patients_by_diagnosis_detail.csv`, both with columns `region_id, region_navn, region_type, tjenesteomrade, aldersgruppe, diagnose_kode, diagnose_navn, metric, period, value, unit, source_id, quality`. `region_type` ∈ `land | fylke | helseregion`; `tjenesteomrade` ∈ `SOM | VOP`; `source_id` = `ssb_14824` / `ssb_14820` per row.

SSB facts (verified 2026-09-02): **14824** dims `Region` 39 (`0` Hele landet, `F00` Hele landet – drop, 2-digit fylker: current ones have plain labels e.g. `Troms - Romsa - Tromssa`, historic ones carry `(-2019)`, `(-2017)`, `(2020-2023)`; `H03/H04/H05/H12`), `Kjonn` `0,2,1`, `Alder` `999A, 00-17, 18-29, 30-49, 50-66, 67-79, 80-89, 90+`, `Aktor` `_T, offhel, avtspes`, `Diagnose` 222 (`_T`, ICD-10 chapters as Roman numerals `I`…`XXI`, sub-blocks like `A00-A09`, `zz1` Annen), `ContentsCode` `Pasient, PasientPolikl, PasientDognBeh, KontaktPolikl, DagBehandl, DognOpphold, OppholdDogn`, `Tid` 2015–2025. **14820** dims `Region` 39 (same list), `Kjonn`, `Alder` `Ialt, 18-29, 30-49, 50-66, 67+`, `Aktor`, `ContentsCode` `Pasient, PasientDognBeh, OppholdDogn, KontaktPolikl`, `Tid` 2015–2025; no `Diagnose` dimension.

Size decisions: the main SOM table keeps 4 metrics (`Pasient, PasientDognBeh, DognOpphold, OppholdDogn`), all ages, chapters + `_T`, all years (≈ 20 regions × 8 × 22 × 4 × 11 ≈ 155 000 rows). The detail table keeps the latest year only, `999A`, all 222 diagnoses, all 7 metrics (≈ 31 000 rows). VOP keeps all 4 metrics, all ages, all years.

- [ ] **Step 1: Failing test**

```js
// scripts/fetch/ssb-pasienter.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transformPasienter, keepRegion, chapterCodes } from "./ssb-pasienter.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

test("keepRegion drops historic fylker and F00", () => {
  assert.equal(keepRegion("0", "Hele landet"), "land");
  assert.equal(keepRegion("55", "Troms - Romsa - Tromssa"), "fylke");
  assert.equal(keepRegion("54", "Troms og Finnmark - Romsa ja Finnmárku (2020-2023)"), null);
  assert.equal(keepRegion("19", "Troms - Romsa (-2019)"), null);
  assert.equal(keepRegion("H05", "Helseregion Nord"), "helseregion");
  assert.equal(keepRegion("F00", "Hele landet"), null);
});

test("chapterCodes picks _T and Roman numerals only", () => {
  assert.deepEqual(chapterCodes(["_T", "I", "A00-A09", "II", "XXI", "zz1"]), ["_T", "I", "II", "XXI"]);
});

const som = (Region, Region_label, Alder, Diagnose, Diagnose_label, ContentsCode, Tid, value) => ({ Region, Region_label, Kjonn: "0", Alder, Alder_label: Alder, Aktor: "_T", Diagnose, Diagnose_label, ContentsCode, ContentsCode_label: ContentsCode, Tid, value });

test("somatikk rows map ages, metrics and drop historic regions; VOP rows get diagnose _T", () => {
  const somRows = [
    som("56", "Finnmark - Finnmárku - Finmarkku", "00-17", "I", "(A00-B99) Infeksjoner", "Pasient", "2025", 120),
    som("56", "Finnmark - Finnmárku - Finmarkku", "999A", "_T", "I alt", "OppholdDogn", "2025", 9000),
    som("20", "Finnmark - Finnmárku (-2019)", "999A", "_T", "I alt", "Pasient", "2019", 1),
  ];
  const vopRows = [{ Region: "H05", Region_label: "Helseregion Nord", Kjonn: "0", Alder: "Ialt", Alder_label: "I alt", Aktor: "_T", ContentsCode: "PasientDognBeh", ContentsCode_label: "x", Tid: "2025", value: 800 }];
  const somDetail = makeJsonStat(
    [{ id: "Region", codes: ["56"], labels: ["Finnmark - Finnmárku - Finmarkku"] }, { id: "Kjonn", codes: ["0"] }, { id: "Alder", codes: ["999A"] }, { id: "Aktor", codes: ["_T"] }, { id: "Diagnose", codes: ["E10-E14"], labels: ["(E10-E14) Diabetes mellitus"] }, { id: "ContentsCode", codes: ["Pasient"] }, { id: "Tid", codes: ["2025"] }],
    [640],
  );
  const out = transformPasienter({ somRows, vopRows, somDetail });
  assert.deepEqual(out["patients_by_diagnosis.csv"], [
    { region_id: "56", region_navn: "Finnmark - Finnmárku - Finmarkku", region_type: "fylke", tjenesteomrade: "SOM", aldersgruppe: "0-17", diagnose_kode: "I", diagnose_navn: "(A00-B99) Infeksjoner", metric: "pasienter", period: "2025", value: 120, unit: "personer", source_id: "ssb_14824", quality: "ekte" },
    { region_id: "56", region_navn: "Finnmark - Finnmárku - Finmarkku", region_type: "fylke", tjenesteomrade: "SOM", aldersgruppe: "alle", diagnose_kode: "_T", diagnose_navn: "I alt", metric: "oppholdsdogn", period: "2025", value: 9000, unit: "dogn", source_id: "ssb_14824", quality: "ekte" },
    { region_id: "H05", region_navn: "Helseregion Nord", region_type: "helseregion", tjenesteomrade: "VOP", aldersgruppe: "alle", diagnose_kode: "_T", diagnose_navn: "I alt", metric: "pasienter_dogn", period: "2025", value: 800, unit: "personer", source_id: "ssb_14820", quality: "ekte" },
  ]);
  assert.deepEqual(out["patients_by_diagnosis_detail.csv"], [
    { region_id: "56", region_navn: "Finnmark - Finnmárku - Finmarkku", region_type: "fylke", tjenesteomrade: "SOM", aldersgruppe: "alle", diagnose_kode: "E10-E14", diagnose_navn: "(E10-E14) Diabetes mellitus", metric: "pasienter", period: "2025", value: 640, unit: "personer", source_id: "ssb_14824", quality: "ekte" },
  ]);
});
```

- [ ] **Step 2: Run** – FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/fetch/ssb-pasienter.mjs
import { ssbMetadata, metadataValues, ssbQuery, ssbQueryChunked, all, item } from "../lib/ssb.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { regionPrefix } from "../lib/regions.mjs";

export const METRICS = {
  Pasient: ["pasienter", "personer"],
  PasientPolikl: ["pasienter_poliklinikk", "personer"],
  PasientDognBeh: ["pasienter_dogn", "personer"],
  KontaktPolikl: ["polikliniske_konsultasjoner", "antall"],
  DagBehandl: ["dagbehandlinger", "antall"],
  DognOpphold: ["dognopphold", "antall"],
  OppholdDogn: ["oppholdsdogn", "dogn"],
};
const MAIN_METRICS = ["Pasient", "PasientDognBeh", "DognOpphold", "OppholdDogn"];
const HISTORIC = /\((-\d{4}|\d{4}-\d{4})\)\s*$/;

/** → "land" | "fylke" | "helseregion" | null (drop). */
export function keepRegion(code, label) {
  if (code === "0") return "land";
  if (regionPrefix(code)) return "helseregion";
  if (/^\d{2}$/.test(code) && !HISTORIC.test(label)) return "fylke";
  return null;
}

export const chapterCodes = (codes) => codes.filter((c) => /^([IVX]+|_T)$/.test(c));

const age = (code) => (code === "999A" || code === "Ialt" ? "alle" : code === "00-17" ? "0-17" : code);

function toRow(r, { tjenesteomrade, source_id, diagnose_kode, diagnose_navn }) {
  const region_type = keepRegion(r.Region, r.Region_label);
  if (!region_type) return null;
  const m = METRICS[r.ContentsCode];
  if (!m) throw new Error(`Ukjent ContentsCode "${r.ContentsCode}" i ${source_id}`);
  return {
    region_id: r.Region, region_navn: r.Region_label, region_type, tjenesteomrade, aldersgruppe: age(r.Alder),
    diagnose_kode, diagnose_navn, metric: m[0], period: r.Tid, value: r.value, unit: m[1], source_id, quality: "ekte",
  };
}

export function transformPasienter({ somRows, vopRows, somDetail }) {
  const main = [];
  for (const r of somRows) {
    const row = toRow(r, { tjenesteomrade: "SOM", source_id: "ssb_14824", diagnose_kode: r.Diagnose, diagnose_navn: r.Diagnose_label });
    if (row) main.push(row);
  }
  for (const r of vopRows) {
    const row = toRow(r, { tjenesteomrade: "VOP", source_id: "ssb_14820", diagnose_kode: "_T", diagnose_navn: "I alt" });
    if (row) main.push(row);
  }
  const detail = [];
  for (const r of jsonStatToRows(somDetail)) {
    const row = toRow(r, { tjenesteomrade: "SOM", source_id: "ssb_14824", diagnose_kode: r.Diagnose, diagnose_navn: r.Diagnose_label });
    if (row) detail.push(row);
  }
  return { "patients_by_diagnosis.csv": main, "patients_by_diagnosis_detail.csv": detail };
}

const COLUMNS = ["region_id", "region_navn", "region_type", "tjenesteomrade", "aldersgruppe", "diagnose_kode", "diagnose_navn", "metric", "period", "value", "unit", "source_id", "quality"];

const def = {
  meta: {
    id: "ssb_pasienter",
    navn: "SSB 14824 Pasienter i somatisk spesialisthelsetjeneste etter bosted, alder og diagnose + SSB 14820 pasienter i psykisk helsevern for voksne",
    url: "https://www.ssb.no/statbank/table/14824",
    api_url: "https://data.ssb.no/api/v0/no/table/14824 og …/14820",
    lisens: "NLOD 2.0",
    query: "14824: Region=*, Kjonn=0, Alder=*, Aktor=_T, Diagnose=kapitler(_T,I..XXI), ContentsCode=Pasient,PasientDognBeh,DognOpphold,OppholdDogn, Tid=* (per år); detalj: siste år, Alder=999A, Diagnose=*, ContentsCode=*; 14820: Region=*, Kjonn=0, Alder=*, Aktor=_T, ContentsCode=*, Tid=*",
  },
  async fetchRaw(deps) {
    const meta = await ssbMetadata("14824", deps);
    const years = metadataValues(meta, "Tid").values;
    const chapters = chapterCodes(metadataValues(meta, "Diagnose").values);
    if (chapters.length < 10) throw new Error(`SSB 14824: fant bare ${chapters.length} diagnosekapitler`);
    const { rows: somRows } = await ssbQueryChunked("14824", [
      all("Region"), item("Kjonn", ["0"]), all("Alder"), item("Aktor", ["_T"]), item("Diagnose", chapters), item("ContentsCode", MAIN_METRICS), item("Tid", years),
    ], "Tid", deps);
    const somDetail = await ssbQuery("14824", [
      all("Region"), item("Kjonn", ["0"]), item("Alder", ["999A"]), item("Aktor", ["_T"]), all("Diagnose"), all("ContentsCode"), item("Tid", [years[years.length - 1]]),
    ], deps);
    const vop = await ssbQuery("14820", [all("Region"), item("Kjonn", ["0"]), all("Alder"), item("Aktor", ["_T"]), all("ContentsCode"), all("Tid")], deps);
    return { somRows, somDetail, vopRows: jsonStatToRows(vop) };
  },
  transform: transformPasienter,
  columns: { "patients_by_diagnosis.csv": COLUMNS, "patients_by_diagnosis_detail.csv": COLUMNS },
};
export default def;
```

- [ ] **Step 4: Run** – PASS; `npm test` PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/ssb-pasienter.mjs scripts/fetch/ssb-pasienter.test.mjs
git commit -m "feat(fetch): SSB 14824/14820 patients by region, age and diagnosis"
```

### Task 9: Fetcher `ssb-07459` – kommune population by age group

**Files:**
- Create: `scripts/fetch/ssb-07459.mjs`
- Test: `scripts/fetch/ssb-07459.test.mjs`

**Interfaces:**
- Consumes: `ssbMetadata`, `metadataValues`, `ssbQueryChunked`, `all`, `item` (Task 2), `readCsv`, `normalized` (Task 1), `aggregateAges` and `AGE_GROUPS` (Task 7 / Task 3).
- Produces: default `def` (id `ssb_07459`), exported `transform07459(raw)` with `raw = {rows, municipalities: string[]}`; writes `municipal_population.csv` (`municipality_code, aldersgruppe, period, value, unit, source_id, quality`).

SSB 07459 facts: `Region` 994 (4-digit kommuner current + historic, fylker, `0`), `Kjonn` `2, 1` (no total – sum both), `Alder` `000`…`105+`, `Tid` 1986–2026. Per year 994×2×106 = 210 728 cells → chunk by `Tid`, years ≥ 2015 only.

- [ ] **Step 1: Failing test**

```js
// scripts/fetch/ssb-07459.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transform07459 } from "./ssb-07459.mjs";

const row = (Region, Kjonn, Alder, Tid, value) => ({ Region, Region_label: Region, Kjonn, Kjonn_label: Kjonn, Alder, Alder_label: Alder, Tid, Tid_label: Tid, value });

test("sums sexes, groups ages, keeps only current kommuner", () => {
  const rows = [
    row("5603", "1", "030", "2025", 100), row("5603", "2", "030", "2025", 90),
    row("5603", "1", "085", "2025", 4),
    row("5406", "1", "030", "2025", 999), // historic Hammerfest code
    row("56", "1", "030", "2025", 999), // fylke
    row("0", "1", "030", "2025", 999),
  ];
  const out = transform07459({ rows, municipalities: ["5603"] })["municipal_population.csv"];
  assert.deepEqual(out, [
    { municipality_code: "5603", aldersgruppe: "30-49", period: "2025", value: 190, unit: "personer", source_id: "ssb_07459", quality: "ekte" },
    { municipality_code: "5603", aldersgruppe: "80-89", period: "2025", value: 4, unit: "personer", source_id: "ssb_07459", quality: "ekte" },
    { municipality_code: "5603", aldersgruppe: "alle", period: "2025", value: 194, unit: "personer", source_id: "ssb_07459", quality: "ekte" },
  ]);
});
```

- [ ] **Step 2: Run** – FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/fetch/ssb-07459.mjs
import { ssbMetadata, metadataValues, ssbQueryChunked, all, item } from "../lib/ssb.mjs";
import { readCsv } from "../lib/csv.mjs";
import { normalized } from "../lib/paths.mjs";
import { AGE_GROUPS } from "../lib/age.mjs";
import { aggregateAges } from "./ssb-13982.mjs";

const FIRST_YEAR = 2015;

export function transform07459({ rows, municipalities }) {
  const keep = new Set(municipalities);
  const kommuneRows = rows.filter((r) => keep.has(r.Region));
  const out = [];
  for (const e of aggregateAges(kommuneRows, { key: (r) => r.Region, name: (r) => r.Region_label, extra: () => "" })) {
    for (const g of [...AGE_GROUPS, "alle"]) {
      if (g !== "alle" && e.groups[g] === 0) continue;
      out.push({ municipality_code: e.id, aldersgruppe: g, period: e.period, value: e.groups[g], unit: "personer", source_id: "ssb_07459", quality: "ekte" });
    }
  }
  return { "municipal_population.csv": out };
}

const def = {
  meta: {
    id: "ssb_07459",
    navn: "SSB 07459 Befolkning etter kommune, kjønn og ettårig alder",
    url: "https://www.ssb.no/statbank/table/07459",
    api_url: "https://data.ssb.no/api/v0/no/table/07459",
    lisens: "NLOD 2.0",
    query: `Region=*, Kjonn=*, Alder=*, Tid>=${FIRST_YEAR} (én forespørsel per år)`,
  },
  async fetchRaw(deps) {
    const meta = await ssbMetadata("07459", deps);
    const years = metadataValues(meta, "Tid").values.filter((y) => Number(y) >= FIRST_YEAR);
    const { rows } = await ssbQueryChunked("07459", [all("Region"), all("Kjonn"), all("Alder"), item("Tid", years)], "Tid", deps);
    const municipalities = (await readCsv(normalized("municipalities.csv"))).rows.map((m) => m.municipality_code);
    return { rows, municipalities };
  },
  transform: transform07459,
  columns: { "municipal_population.csv": ["municipality_code", "aldersgruppe", "period", "value", "unit", "source_id", "quality"] },
};
export default def;
```

Memory note for the raw file: 12 years × ~210k rows of decoded objects is ~2.5 M rows in `data/raw/ssb_07459.json` (~300 MB). That is too big: in `fetchRaw`, filter to kommune rows **before** returning – replace `return { rows, municipalities }` with

```js
    const keep = new Set(municipalities);
    return { rows: rows.filter((r) => keep.has(r.Region)), municipalities };
```

(the transform filter then becomes a no-op safety net; keep it).

- [ ] **Step 4: Run** – PASS; `npm test` PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/ssb-07459.mjs scripts/fetch/ssb-07459.test.mjs
git commit -m "feat(fetch): SSB 07459 kommune population by age group"
```

### Task 10: Fetcher `ssb-kostra` – municipal care capacity (5 KOSTRA tables)

**Files:**
- Create: `scripts/fetch/ssb-kostra.mjs`
- Test: `scripts/fetch/ssb-kostra.test.mjs`

**Interfaces:**
- Consumes: `ssbQuery`, `all`, `item` (Task 2), `jsonStatToRows` (Task 1), `readCsv`, `normalized` (Task 1).
- Produces: default `def` (id `ssb_kostra`), exported `KOSTRA_TABLES` config and `transformKostra(raw)` with `raw = {datasets: Record<tableId, dataset>, municipalities: string[]}`; writes `municipal_capacity.csv` (`municipality_code, metric, metric_label, period, value, unit, source_id, quality`) with `source_id = "ssb_<tableId>"`.

KOSTRA facts (verified 2026-09-02): region dimension `KOKkommuneregion0000` (891 codes: 4-digit kommuner incl. historic, `EAK…`/`EKG…` aggregates), `Tid` 2015–2025, contents dimension `ContentsCode`. Tables: **11875** `KOSinstdispplass0000, KOSsykehjdisppla0000, KOSinstdemenspla0000, KOSinsttidsbegrp0000, KOSinstrehabplas0000`; **12292** `KOSbeboersykehje0000, KOSlangtid0000, KOSkorttid0000, KOSkjernetotalt0000, KOSkjerne80aarov0000, KOSaarsverkbruke0000, KOSinstoppholdsd0000`; **12293** `KOSbeleggomsorgs0000`; **11996** extra dims `KOKavtaleform0000` (select `sum`) and `KOKfunksjon0000` (`FGK10, 120, 232, 233, 241, 253, 256`), contents `KOSlegeaarsverk0000`; **14533** extra dim `KOKyrker0000` (`TOT, 01…06, 07a…07e, 08, 09, 99`), contents `KOSARBAARSVERKST0000`. Largest table: 891×16×11 = 156 816 cells → one request each.

- [ ] **Step 1: Failing test**

```js
// scripts/fetch/ssb-kostra.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transformKostra, KOSTRA_TABLES } from "./ssb-kostra.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

test("maps contents codes to metric names and suffixes by extra dimension", () => {
  const datasets = {
    11875: makeJsonStat([{ id: "KOKkommuneregion0000", codes: ["5603", "EAK"] }, { id: "ContentsCode", codes: ["KOSsykehjdisppla0000"], labels: ["Plasser i sykehjem"] }, { id: "Tid", codes: ["2025"] }], [60, 40000]),
    11996: makeJsonStat([{ id: "KOKkommuneregion0000", codes: ["5603"] }, { id: "KOKavtaleform0000", codes: ["sum"] }, { id: "KOKfunksjon0000", codes: ["253"], labels: ["Helse- og omsorgstjenester i institusjon"] }, { id: "ContentsCode", codes: ["KOSlegeaarsverk0000"], labels: ["Legeårsverk"] }, { id: "Tid", codes: ["2025"] }], [1.5]),
    14533: makeJsonStat([{ id: "KOKkommuneregion0000", codes: ["5603"] }, { id: "KOKyrker0000", codes: ["TOT"], labels: ["Alle yrker"] }, { id: "ContentsCode", codes: ["KOSARBAARSVERKST0000"], labels: ["Årsverk"] }, { id: "Tid", codes: ["2025"] }], [210]),
  };
  const out = transformKostra({ datasets, municipalities: ["5603"] })["municipal_capacity.csv"];
  assert.deepEqual(out, [
    { municipality_code: "5603", metric: "sykehjem_plasser", metric_label: "Plasser i sykehjem", period: "2025", value: 60, unit: "plasser", source_id: "ssb_11875", quality: "ekte" },
    { municipality_code: "5603", metric: "legearsverk_253", metric_label: "Legeårsverk – Helse- og omsorgstjenester i institusjon", period: "2025", value: 1.5, unit: "arsverk", source_id: "ssb_11996", quality: "ekte" },
    { municipality_code: "5603", metric: "omsorg_arsverk_tot", metric_label: "Årsverk – Alle yrker", period: "2025", value: 210, unit: "arsverk", source_id: "ssb_14533", quality: "ekte" },
  ]);
});

test("unknown contents code throws", () => {
  const datasets = { 12293: makeJsonStat([{ id: "KOKkommuneregion0000", codes: ["5603"] }, { id: "ContentsCode", codes: ["KOSnytt0000"] }, { id: "Tid", codes: ["2025"] }], [1]) };
  assert.throws(() => transformKostra({ datasets, municipalities: ["5603"] }), /KOSnytt0000/);
});

test("every configured table has a query with region, contents and time", () => {
  for (const t of Object.values(KOSTRA_TABLES)) {
    const codes = t.query.map((q) => q.code);
    assert.ok(codes.includes("KOKkommuneregion0000") && codes.includes("ContentsCode") && codes.includes("Tid"), t.tableId);
  }
});
```

- [ ] **Step 2: Run** – FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/fetch/ssb-kostra.mjs
import { ssbQuery, all, item } from "../lib/ssb.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { readCsv } from "../lib/csv.mjs";
import { normalized } from "../lib/paths.mjs";

const REGION = "KOKkommuneregion0000";

// contents code → [metric, unit]; `suffixDim` appends "_<code>" (lower-cased) and " – <label>" from that dimension.
export const KOSTRA_TABLES = {
  11875: {
    tableId: "11875", query: [all(REGION), all("ContentsCode"), all("Tid")],
    contents: { KOSinstdispplass0000: ["inst_plasser", "plasser"], KOSsykehjdisppla0000: ["sykehjem_plasser", "plasser"], KOSinstdemenspla0000: ["demens_plasser", "plasser"], KOSinsttidsbegrp0000: ["tidsbegrensede_plasser", "plasser"], KOSinstrehabplas0000: ["rehab_plasser", "plasser"] },
  },
  12292: {
    tableId: "12292", query: [all(REGION), all("ContentsCode"), all("Tid")],
    contents: { KOSbeboersykehje0000: ["sykehjem_beboere", "personer"], KOSlangtid0000: ["langtid_beboere", "personer"], KOSkorttid0000: ["korttid_beboere", "personer"], KOSkjernetotalt0000: ["hjemmetjeneste_brukere", "personer"], KOSkjerne80aarov0000: ["hjemmetjeneste_brukere_80pluss", "personer"], KOSaarsverkbruke0000: ["omsorg_arsverk_brukerrettet", "arsverk"], KOSinstoppholdsd0000: ["inst_oppholdsdogn", "dogn"] },
  },
  12293: {
    tableId: "12293", query: [all(REGION), all("ContentsCode"), all("Tid")],
    contents: { KOSbeleggomsorgs0000: ["inst_belegg", "prosent"] },
  },
  11996: {
    tableId: "11996", query: [all(REGION), item("KOKavtaleform0000", ["sum"]), all("KOKfunksjon0000"), all("ContentsCode"), all("Tid")],
    contents: { KOSlegeaarsverk0000: ["legearsverk", "arsverk"] }, suffixDim: "KOKfunksjon0000",
  },
  14533: {
    tableId: "14533", query: [all(REGION), all("KOKyrker0000"), all("ContentsCode"), all("Tid")],
    contents: { KOSARBAARSVERKST0000: ["omsorg_arsverk", "arsverk"] }, suffixDim: "KOKyrker0000",
  },
};

export function transformKostra({ datasets, municipalities }) {
  const keep = new Set(municipalities);
  const out = [];
  for (const [tableId, ds] of Object.entries(datasets)) {
    const cfg = KOSTRA_TABLES[tableId];
    if (!cfg) throw new Error(`KOSTRA-tabell ${tableId} mangler i KOSTRA_TABLES`);
    for (const r of jsonStatToRows(ds)) {
      if (!keep.has(r[REGION])) continue;
      const m = cfg.contents[r.ContentsCode];
      if (!m) throw new Error(`Ukjent ContentsCode "${r.ContentsCode}" i KOSTRA ${tableId}`);
      const suffix = cfg.suffixDim ? `_${String(r[cfg.suffixDim]).toLowerCase()}` : "";
      const labelSuffix = cfg.suffixDim ? ` – ${r[`${cfg.suffixDim}_label`]}` : "";
      out.push({ municipality_code: r[REGION], metric: m[0] + suffix, metric_label: r.ContentsCode_label + labelSuffix, period: r.Tid, value: r.value, unit: m[1], source_id: `ssb_${tableId}`, quality: "ekte" });
    }
  }
  return { "municipal_capacity.csv": out };
}

const def = {
  meta: {
    id: "ssb_kostra",
    navn: "SSB KOSTRA 11875 (plasser), 12292 (beboere/brukere/årsverk), 12293 (belegg), 11996 (legeårsverk), 14533 (årsverk etter yrke) – kommunale helse- og omsorgstjenester",
    url: "https://www.ssb.no/statbank/list/helsetjenester-kommuner",
    api_url: "https://data.ssb.no/api/v0/no/table/{11875,12292,12293,11996,14533}",
    lisens: "NLOD 2.0",
    query: "KOKkommuneregion0000=*, ContentsCode=*, Tid=* (+ KOKavtaleform0000=sum, KOKfunksjon0000=* for 11996; KOKyrker0000=* for 14533)",
  },
  async fetchRaw(deps) {
    const datasets = {};
    for (const cfg of Object.values(KOSTRA_TABLES)) datasets[cfg.tableId] = await ssbQuery(cfg.tableId, cfg.query, deps);
    const municipalities = (await readCsv(normalized("municipalities.csv"))).rows.map((m) => m.municipality_code);
    return { datasets, municipalities };
  },
  transform: transformKostra,
  columns: { "municipal_capacity.csv": ["municipality_code", "metric", "metric_label", "period", "value", "unit", "source_id", "quality"] },
};
export default def;
```

- [ ] **Step 4: Run** – PASS; `npm test` PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/ssb-kostra.mjs scripts/fetch/ssb-kostra.test.mjs
git commit -m "feat(fetch): KOSTRA municipal care capacity (5 tables)"
```

### Task 11: Fetcher `fhi-kommune` – NPR/KPR need indicators and home-care users per kommune

**Files:**
- Create: `scripts/fetch/fhi-kommune.mjs`
- Test: `scripts/fetch/fhi-kommune.test.mjs`

**Interfaces:**
- Consumes: `fhiQuery`, `fhiItem`, `fhiAll` (Task 2), `jsonStatToRows` (Task 1), `readCsv`, `normalized` (Task 1).
- Produces: default `def` (id `fhi_kommune`), exported `transformFhiKommune(raw)` with `raw = {npr699, kpr370, kpr634 (json-stat2 datasets), municipalities: string[]}`; writes `municipal_needs.csv` (`municipality_code, metric, metric_label, period, value, unit, source_id, quality`) with `source_id` ∈ `fhi_nokkel_699 | fhi_nokkel_370 | fhi_kpr_634`.

FHI facts (verified 2026-09-02): endpoint `POST https://statistikk-data.fhi.no/api/open/v1/{source}/Table/{id}/data`, body `{"dimensions":[{"code","filter","values"}],"response":{"format":"json-stat2","maxRowCount":500000}}`; response starts with a BOM (stripped by `http.mjs`), `value` may contain the string `"k"` (suppressed; `jsonStatToRows` drops it). `nokkel/699` (NPR_1, spesialisthelsetjenesten): `GEO` (`0`, 2-digit fylke, 4-digit kommune incl. historic), `AAR` `2012_2012`…`2024_2024`, `KJONN` `0`, `ALDER` `0_120`, `KODEGRUPPE` `I00_I99, J440_J449, M00_M99, S00_T78`, `MEASURE_TYPE` `TELLER, RATE, MEIS, SMR`. `nokkel/370` (KPR_1, primærhelsetjenesten): `AAR` `2017_2017`…`2024_2024`, `ALDER` `0_74, 75_79`, `KODEGRUPPE` `K70_K99, P01_P29ogP70_P99, L01_L29ogL70_L71ogL82_L99, Skader`, other dims as 699. `kpr/634` (hjemmetjenester): `AAR` `2017`…`2025`, `Sted` codes are label strings like `5603 Hammerfest (2024->)`, `5406 Hammerfest (2020-2023)`, `Landet`; `tjtjentypeNavn` `Totalt_antall_brukere, Tj_1 … Tj_29`; `MEASURE_TYPE` `Antall_Brukere`.

- [ ] **Step 1: Failing test**

```js
// scripts/fetch/fhi-kommune.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transformFhiKommune, parseSted } from "./fhi-kommune.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

test("parseSted keeps only current kommune codes", () => {
  assert.equal(parseSted("5603 Hammerfest (2024->)"), "5603");
  assert.equal(parseSted("5406 Hammerfest (2020-2023)"), null);
  assert.equal(parseSted("Landet"), null);
});

test("builds npr/kpr/hjemmetjeneste metrics, normalises AAR and drops suppressed cells", () => {
  const npr699 = makeJsonStat(
    [{ id: "GEO", codes: ["5603", "56"] }, { id: "AAR", codes: ["2024_2024"] }, { id: "KJONN", codes: ["0"] }, { id: "ALDER", codes: ["0_120"] }, { id: "KODEGRUPPE", codes: ["I00_I99"], labels: ["Hjerte- og karsykdommer"] }, { id: "MEASURE_TYPE", codes: ["TELLER", "RATE"], labels: ["Antall", "Per 1000"] }],
    [410, 39.2, "k", 41.0],
  );
  const kpr370 = makeJsonStat(
    [{ id: "GEO", codes: ["5603"] }, { id: "AAR", codes: ["2024_2024"] }, { id: "KJONN", codes: ["0"] }, { id: "ALDER", codes: ["0_74"] }, { id: "KODEGRUPPE", codes: ["Skader"], labels: ["Skader"] }, { id: "MEASURE_TYPE", codes: ["TELLER"], labels: ["Antall"] }],
    [1200],
  );
  const kpr634 = makeJsonStat(
    [{ id: "Sted", codes: ["5603 Hammerfest (2024->)", "5406 Hammerfest (2020-2023)"] }, { id: "AAR", codes: ["2025"] }, { id: "tjtjentypeNavn", codes: ["Totalt_antall_brukere", "Tj_1"], labels: ["Totalt antall brukere", "Praktisk bistand"] }, { id: "MEASURE_TYPE", codes: ["Antall_Brukere"] }],
    [300, 120, 290, 110],
  );
  const out = transformFhiKommune({ npr699, kpr370, kpr634, municipalities: ["5603"] })["municipal_needs.csv"];
  assert.deepEqual(out, [
    { municipality_code: "5603", metric: "npr_i00_i99_antall", metric_label: "Hjerte- og karsykdommer – Antall", period: "2024", value: 410, unit: "personer", source_id: "fhi_nokkel_699", quality: "ekte" },
    { municipality_code: "5603", metric: "npr_i00_i99_rate", metric_label: "Hjerte- og karsykdommer – Per 1000", period: "2024", value: 39.2, unit: "rate", source_id: "fhi_nokkel_699", quality: "ekte" },
    { municipality_code: "5603", metric: "kpr_skader_0_74_antall", metric_label: "Skader – Antall", period: "2024", value: 1200, unit: "personer", source_id: "fhi_nokkel_370", quality: "ekte" },
    { municipality_code: "5603", metric: "hjemmetjeneste_brukere_totalt", metric_label: "Totalt antall brukere", period: "2025", value: 300, unit: "personer", source_id: "fhi_kpr_634", quality: "ekte" },
    { municipality_code: "5603", metric: "hjemmetjeneste_tj_1", metric_label: "Praktisk bistand", period: "2025", value: 120, unit: "personer", source_id: "fhi_kpr_634", quality: "ekte" },
  ]);
});
```

- [ ] **Step 2: Run** – `cd /Users/hom/Documents/GitHub/kapasitet && node --test scripts/fetch/fhi-kommune.test.mjs` → FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/fetch/fhi-kommune.mjs
import { fhiQuery, fhiItem, fhiAll } from "../lib/fhi.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";
import { readCsv } from "../lib/csv.mjs";
import { normalized } from "../lib/paths.mjs";

const MEASURES = { TELLER: ["antall", "personer"], RATE: ["rate", "rate"] };
const year = (aar) => String(aar).split("_")[0];
const slug = (s) => String(s).toLowerCase();

/** "5603 Hammerfest (2024->)" → "5603"; historic "(2020-2023)" and "Landet" → null. */
export function parseSted(code) {
  const m = /^(\d{4}) .+ \(\d{4}->\)$/.exec(String(code));
  return m ? m[1] : null;
}

function nokkelRows(ds, { prefix, source_id, alderSuffix = "" }) {
  const out = [];
  for (const r of jsonStatToRows(ds)) {
    const m = MEASURES[r.MEASURE_TYPE];
    if (!m) continue; // MEIS/SMR are not requested; skip defensively
    out.push({
      municipality_code: r.GEO,
      metric: `${prefix}_${slug(r.KODEGRUPPE)}${alderSuffix}_${m[0]}`,
      metric_label: `${r.KODEGRUPPE_label} – ${r.MEASURE_TYPE_label}`,
      period: year(r.AAR), value: r.value, unit: m[1], source_id, quality: "ekte",
    });
  }
  return out;
}

function hjemmetjenesteRows(ds) {
  const out = [];
  for (const r of jsonStatToRows(ds)) {
    const code = parseSted(r.Sted);
    if (!code) continue;
    const t = r.tjtjentypeNavn === "Totalt_antall_brukere" ? "brukere_totalt" : slug(r.tjtjentypeNavn);
    out.push({ municipality_code: code, metric: `hjemmetjeneste_${t}`, metric_label: r.tjtjentypeNavn_label, period: year(r.AAR), value: r.value, unit: "personer", source_id: "fhi_kpr_634", quality: "ekte" });
  }
  return out;
}

export function transformFhiKommune({ npr699, kpr370, kpr634, municipalities }) {
  const keep = new Set(municipalities);
  const rows = [
    ...nokkelRows(npr699, { prefix: "npr", source_id: "fhi_nokkel_699" }),
    ...nokkelRows(kpr370, { prefix: "kpr", source_id: "fhi_nokkel_370", alderSuffix: "_0_74" }),
    ...hjemmetjenesteRows(kpr634),
  ].filter((r) => keep.has(r.municipality_code));
  return { "municipal_needs.csv": rows };
}

const def = {
  meta: {
    id: "fhi_kommune",
    navn: "FHI Kommunehelsa: NPR-brukere per diagnosegruppe (nokkel 699), KPR-brukere 0–74 år (nokkel 370), mottakere av hjemmetjenester (kpr 634)",
    url: "https://statistikk.fhi.no/kommunehelsa",
    api_url: "https://statistikk-data.fhi.no/api/open/v1/{nokkel/Table/699,nokkel/Table/370,kpr/Table/634}/data",
    lisens: "CC BY 4.0",
    query: "699: GEO=*, AAR=*, KJONN=0, ALDER=0_120, KODEGRUPPE=*, MEASURE_TYPE=TELLER,RATE; 370: samme men ALDER=0_74; 634: Sted=*, AAR=*, tjtjentypeNavn=*, MEASURE_TYPE=Antall_Brukere",
  },
  async fetchRaw(deps) {
    const npr699 = await fhiQuery("nokkel", 699, [fhiAll("GEO"), fhiAll("AAR"), fhiItem("KJONN", ["0"]), fhiItem("ALDER", ["0_120"]), fhiAll("KODEGRUPPE"), fhiItem("MEASURE_TYPE", ["TELLER", "RATE"])], deps);
    const kpr370 = await fhiQuery("nokkel", 370, [fhiAll("GEO"), fhiAll("AAR"), fhiItem("KJONN", ["0"]), fhiItem("ALDER", ["0_74"]), fhiAll("KODEGRUPPE"), fhiItem("MEASURE_TYPE", ["TELLER", "RATE"])], deps);
    const kpr634 = await fhiQuery("kpr", 634, [fhiAll("Sted"), fhiAll("AAR"), fhiAll("tjtjentypeNavn"), fhiItem("MEASURE_TYPE", ["Antall_Brukere"])], deps);
    const municipalities = (await readCsv(normalized("municipalities.csv"))).rows.map((m) => m.municipality_code);
    return { npr699, kpr370, kpr634, municipalities };
  },
  transform: transformFhiKommune,
  columns: { "municipal_needs.csv": ["municipality_code", "metric", "metric_label", "period", "value", "unit", "source_id", "quality"] },
};
export default def;
```

If the live 370 call answers 400 (its `KJONN`/`ALDER` codes were inferred from 699, not probed), run `curl -s https://statistikk-data.fhi.no/api/open/v1/nokkel/Table/370/dimension | sed 's/^\xef\xbb\xbf//' | python3 -c 'import json,sys; [print(d["code"], [c["value"] for c in (d.get("categories") or [])][:8]) for d in json.load(sys.stdin)["dimensions"]]'` and correct the item values – do not silently switch to `all`.

- [ ] **Step 4: Run** – PASS; `npm test` PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/fhi-kommune.mjs scripts/fetch/fhi-kommune.test.mjs
git commit -m "feat(fetch): FHI Kommunehelsa need indicators and home-care users"
```

### Task 12: Fetcher `fhi-lmr` – port of `fetch-medications-fhi.ps1` (national medication use)

**Files:**
- Create: `scripts/fetch/fhi-lmr.mjs`
- Test: `scripts/fetch/fhi-lmr.test.mjs`

**Interfaces:**
- Consumes: `fhiQuery`, `fhiItem`, `fhiAll` (Task 2), `jsonStatToRows` (Task 1).
- Produces: default `def` (id `fhi_lmr_825`), exported `GROUPS`, `transformLmr(raw, deps)` with `raw = {dataset}`; overwrites `data/normalized/medications.csv` with the **same columns the app already reads**: `group_code, group_label, period, users, per_1000, source_id, last_updated` (all years instead of 8 hand-picked ones; `last_updated = deps.today`). `medication_use.csv` (the per-kommune estimate the .ps1 also wrote) is **not** regenerated; it stays as-is until plan 2 deletes it.

- [ ] **Step 1: Failing test**

```js
// scripts/fetch/fhi-lmr.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { transformLmr, GROUPS } from "./fhi-lmr.mjs";
import { makeJsonStat } from "../lib/jsonstat.mjs";

test("one row per group and year with users and per_1000", () => {
  const dataset = makeJsonStat(
    [{ id: "Atc_Verdi", codes: ["R03", "A10"] }, { id: "Kjonn_Verdi", codes: ["TOTALT"] }, { id: "Aldersgruppe_Verdi", codes: ["TOTALT"] }, { id: "Utlevering_Ar", codes: ["2024", "2025"] }, { id: "MEASURE_TYPE", codes: ["AntallBrukere", "Brukere_Per1000_Innbyggere"] }],
    [400000, 72.1, 410000, 73.0, 250000, 45.0, null, null],
  );
  const out = transformLmr({ dataset }, { today: "2026-09-02" })["medications.csv"];
  assert.deepEqual(out, [
    { group_code: "R03", group_label: "Astma og KOLS", period: "2024", users: 400000, per_1000: 72.1, source_id: "fhi_lmr_825", last_updated: "2026-09-02" },
    { group_code: "R03", group_label: "Astma og KOLS", period: "2025", users: 410000, per_1000: 73.0, source_id: "fhi_lmr_825", last_updated: "2026-09-02" },
    { group_code: "A10", group_label: "Diabetes", period: "2024", users: 250000, per_1000: 45.0, source_id: "fhi_lmr_825", last_updated: "2026-09-02" },
  ]);
  assert.equal(Object.keys(GROUPS).length, 14);
});
```

- [ ] **Step 2: Run** – FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/fetch/fhi-lmr.mjs
import { fhiQuery, fhiItem, fhiAll } from "../lib/fhi.mjs";
import { jsonStatToRows } from "../lib/jsonstat.mjs";

// Same curated ATC groups as the old scripts/fetch-medications-fhi.ps1.
export const GROUPS = {
  R03: "Astma og KOLS",
  A10: "Diabetes",
  C10: "Kolesterolsenkende",
  C09: "Blodtrykk (RAAS-hemmere)",
  C07: "Betablokkere",
  N06A: "Antidepressiva",
  N05B: "Angstdempende",
  N06B: "ADHD / psykostimulerende",
  H03: "Stoffskifte (thyreoidea)",
  M05B: "Benskjorhet (osteoporose)",
  N02A: "Opioider (smertestillende)",
  R06: "Allergi (antihistaminer)",
  A02B: "Magesyre (protonpumpehemmere)",
  N03A: "Epilepsi",
};

export function transformLmr({ dataset }, { today }) {
  const cells = new Map(); // "atc|year" → {users, per_1000}
  for (const r of jsonStatToRows(dataset)) {
    const k = `${r.Atc_Verdi}|${r.Utlevering_Ar}`;
    const c = cells.get(k) ?? { users: null, per_1000: null };
    if (r.MEASURE_TYPE === "AntallBrukere") c.users = r.value;
    if (r.MEASURE_TYPE === "Brukere_Per1000_Innbyggere") c.per_1000 = r.value;
    cells.set(k, c);
  }
  const out = [];
  for (const [k, c] of cells) {
    const [atc, year] = k.split("|");
    if (c.users === null && c.per_1000 === null) continue;
    out.push({ group_code: atc, group_label: GROUPS[atc] ?? atc, period: year, users: c.users, per_1000: c.per_1000, source_id: "fhi_lmr_825", last_updated: today });
  }
  return { "medications.csv": out };
}

const def = {
  meta: {
    id: "fhi_lmr_825",
    navn: "FHI Legemiddelregisteret tabell 825 – brukere per ATC-gruppe, hele landet",
    url: "https://www.fhi.no/he/legemiddelbruk",
    api_url: "https://statistikk-data.fhi.no/api/open/v1/lmr/Table/825/data",
    lisens: "CC BY 4.0",
    query: `Atc_Verdi=${Object.keys(GROUPS).join(",")}, Kjonn_Verdi=TOTALT, Aldersgruppe_Verdi=TOTALT, Utlevering_Ar=*, MEASURE_TYPE=AntallBrukere,Brukere_Per1000_Innbyggere`,
  },
  async fetchRaw(deps) {
    const dataset = await fhiQuery("lmr", 825, [
      fhiItem("Atc_Verdi", Object.keys(GROUPS)), fhiItem("Kjonn_Verdi", ["TOTALT"]), fhiItem("Aldersgruppe_Verdi", ["TOTALT"]), fhiAll("Utlevering_Ar"), fhiItem("MEASURE_TYPE", ["AntallBrukere", "Brukere_Per1000_Innbyggere"]),
    ], deps);
    return { dataset };
  },
  transform: transformLmr,
  columns: { "medications.csv": ["group_code", "group_label", "period", "users", "per_1000", "source_id", "last_updated"] },
};
export default def;
```

- [ ] **Step 4: Run** – PASS; `npm test` PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch/fhi-lmr.mjs scripts/fetch/fhi-lmr.test.mjs
git commit -m "feat(fetch): port FHI LMR medication fetcher to node"
```

### Task 13: `fetch/index.mjs`, manifest, and the first real fetch

**Files:**
- Create: `scripts/fetch/index.mjs`, `scripts/fetch/manifest.mjs`, `data/sources/manifest.static.json`
- Test: `scripts/fetch/manifest.test.mjs`
- Generated (committed): `data/normalized/{helseforetak,opptaksomrader,municipality_catchment,hf_activity,hf_staffing,hf_specialists,catchment_population,patients_by_diagnosis,patients_by_diagnosis_detail,municipal_population,municipal_capacity,municipal_needs,medications}.csv`, `data/sources/manifest.json`

**Interfaces:**
- Consumes: every fetcher `def` (Tasks 4–12), `runFetcher` (Task 3), `SOURCES_DIR` (Task 1).
- Produces: `ALL_FETCHERS: def[]` (ordered), `mergeManifest(previous, staticEntries, results, {today}) → manifest` where `manifest = {generated: ISO date, sources: [{id, navn, url, api_url, query, lisens, last_fetched, tables_out}]}`; CLI `npm run fetch [-- --only id1,id2]`.

- [ ] **Step 1: Failing manifest test**

```js
// scripts/fetch/manifest.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeManifest } from "./manifest.mjs";

test("merges previous entries, static entries and fresh results; fresh wins", () => {
  const previous = { generated: "2026-01-01", sources: [{ id: "ssb_13942", navn: "old", url: "u", api_url: "a", query: "q", lisens: "l", last_fetched: "2026-01-01", tables_out: ["hf_activity.csv"] }, { id: "stale", navn: "x", url: "", api_url: "", query: "", lisens: "", last_fetched: "2025-01-01", tables_out: [] }] };
  const statics = [{ id: "curated_helse_nord", navn: "Kuraterte senger", url: "https://…", api_url: "", query: "", lisens: "manuell", tables_out: ["hospital_beds.csv"] }];
  const results = [{ def: { meta: { id: "ssb_13942", navn: "new", url: "u2", api_url: "a2", query: "q2", lisens: "NLOD" } }, result: { id: "ssb_13942", tables: ["hf_activity.csv", "helseforetak.csv"], rows: {} } }];
  const m = mergeManifest(previous, statics, results, { today: "2026-09-02" });
  assert.equal(m.generated, "2026-09-02");
  assert.deepEqual(m.sources.map((s) => s.id), ["curated_helse_nord", "ssb_13942", "stale"]);
  const s = m.sources.find((x) => x.id === "ssb_13942");
  assert.deepEqual(s, { id: "ssb_13942", navn: "new", url: "u2", api_url: "a2", query: "q2", lisens: "NLOD", last_fetched: "2026-09-02", tables_out: ["hf_activity.csv", "helseforetak.csv"] });
  assert.equal(m.sources.find((x) => x.id === "curated_helse_nord").last_fetched, "");
});
```

- [ ] **Step 2: Run** – FAIL.

- [ ] **Step 3: Implement manifest.mjs, index.mjs, manifest.static.json**

```js
// scripts/fetch/manifest.mjs
const queryText = (q) => (typeof q === "string" ? q : q ? JSON.stringify(q) : "");

/** previous manifest ∪ static entries ∪ fresh results, sorted by id; fresh results overwrite. */
export function mergeManifest(previous, statics, results, { today }) {
  const byId = new Map();
  for (const s of previous?.sources ?? []) byId.set(s.id, s);
  for (const s of statics) byId.set(s.id, { last_fetched: "", ...s });
  for (const { def, result } of results) {
    const { id, navn, url, api_url, query, lisens } = def.meta;
    byId.set(id, { id, navn, url, api_url, query: queryText(query), lisens, last_fetched: today, tables_out: result.tables });
  }
  return { generated: today, sources: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}
```

```js
// scripts/fetch/index.mjs
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
```

`data/sources/manifest.static.json` (curated sources that no fetcher produces; Task 16 fills `hospital_beds.csv`):

```json
[
  {
    "id": "curated_helse_nord",
    "navn": "Kuraterte sengetall per behandlingssted i Helse Nord (manuell innsamling fra HF-ene og SSB 13942)",
    "url": "https://www.helse-nord.no",
    "api_url": "",
    "query": "",
    "lisens": "Offentlige kilder, se source_url per rad",
    "tables_out": ["sites.csv", "hospital_beds.csv"]
  }
]
```

- [ ] **Step 4: Run tests** – `npm test` → PASS.

- [ ] **Step 5: Run the real fetch**

Run: `cd /Users/hom/Documents/GitHub/kapasitet && npm run fetch 2>&1 | tee /tmp/kapasitet-fetch.log | tail -40`
Expected: one `[id] henter …` line per fetcher, then `[id] file.csv: N rader` lines, then `Skrev …/manifest.json (10 kilder hentet)`. Takes a few minutes (07459 and 13982 make 12 requests each). If a fetcher throws, read the message: an unknown code means the source changed – add it to the mapping in that fetcher and rerun `npm run fetch -- --only <id>`.

Sanity checks afterwards (all must hold):

```bash
cd /Users/hom/Documents/GitHub/kapasitet
wc -l data/normalized/{helseforetak,opptaksomrader,municipality_catchment,hf_activity,hf_staffing,hf_specialists,catchment_population,patients_by_diagnosis,patients_by_diagnosis_detail,municipal_population,municipal_capacity,municipal_needs,medications}.csv
grep -c "" data/normalized/opptaksomrader.csv        # 48 S + 69 D + header = 118
grep -c ",ekte," data/normalized/municipality_catchment.csv   # ≈ 350 of 357
grep "983974880,Finnmarkssykehuset HF,H05,SOM,dognplasser,2025" data/normalized/hf_activity.csv   # value 134
grep "^0301," data/normalized/municipality_catchment.csv     # Oslo → S34/S35/S36/S49 main area, avledet, note lists all four
ls data/raw/                                                 # one json per fetcher, gitignored
git status --short | grep -v "^??" | head                    # only data files changed
```

- [ ] **Step 6: Commit code, data and manifest**

```bash
cd /Users/hom/Documents/GitHub/kapasitet
git add scripts/fetch/index.mjs scripts/fetch/manifest.mjs scripts/fetch/manifest.test.mjs data/sources/manifest.static.json data/sources/manifest.json data/normalized/*.csv
git commit -m "feat(data): first real fetch – KLASS catchment, SSB HF/patient/population tables, KOSTRA, FHI"
```

### Task 14: Validator – schemas, quality, bridge-table integrity, bed control sum

**Files:**
- Create: `scripts/validate/schemas.mjs`, `scripts/validate/rules.mjs`, `scripts/validate.mjs`
- Test: `scripts/validate/rules.test.mjs`

**Interfaces:**
- Consumes: `ALL_FETCHERS` (Task 13) for column lists, `readCsv`, `normalized`, `NORMALIZED_DIR` (Task 1).
- Produces: `SCHEMAS: {[file]: {columns: string[], required: boolean}}`, `QUALITIES = new Set(["ekte","avledet","estimat"])`, `validateTables(tables, schemas = SCHEMAS) → {errors: string[], warnings: string[], info: string[]}` where `tables = {[file]: rows[]}` (rows are the string records from `readCsv`; files not present are simply absent from `tables`). CLI `npm run validate` exits 1 on any error. Task 16 flips `sites.csv`/`hospital_beds.csv` to `required: true`; Task 18 reads `SCHEMAS` to know which CSVs to load.

Rules (from spec §5): (1) every schema file present (required → error, optional → warning) with exactly the listed columns in order; (2) `quality` ∈ `QUALITIES` on every row of every table that has the column; (3) `value`/`senger` numeric, `period` = 4 digits; (4) every kommune in `municipalities.csv` has exactly one row in `municipality_catchment.csv` with a non-empty `hf_id` that exists in `helseforetak.csv` and a `lokalsykehus_id` that exists in `opptaksomrader.csv` (missing `dps_id` → warning); (5) referential integrity: `hf_id` in `opptaksomrader/sites/hospital_beds` ∈ helseforetak; `municipality_code` in `municipal_*`, `sites`, `hospital_beds` ∈ municipalities; `site_id` in hospital_beds ∈ sites; `omrade_id` of type lokalsykehus/dps in `catchment_population` ∈ opptaksomrader; (6) for each HF with curated somatikk rows: Σ `senger` (kategori somatikk, latest period in the curated table per site) vs SSB 13942 `dognplasser` SOM latest period → error if deviation > 15 %, otherwise info line; HFs of type `hf` without curated rows → info "ingen kuratert sengetabell"; (7) control sums (warnings, because SSB revises): 13942 Finnmarkssykehuset SOM dognplasser 2025 = 134, UNN 593, Nordlandssykehuset 295, Helgelandssykehuset 121.

- [ ] **Step 1: Failing test**

```js
// scripts/validate/rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTables } from "./rules.mjs";

const schemas = {
  "municipalities.csv": { columns: ["municipality_code", "county_code", "municipality_name", "county_name"], required: true },
  "helseforetak.csv": { columns: ["hf_id", "hf_navn", "rhf_id", "helseregion", "type"], required: true },
  "opptaksomrader.csv": { columns: ["omrade_id", "omrade_navn", "omrade_type", "hf_id"], required: true },
  "municipality_catchment.csv": { columns: ["municipality_code", "municipality_name", "lokalsykehus_id", "dps_id", "hf_id", "helseregion", "quality", "note"], required: true },
  "hf_activity.csv": { columns: ["hf_id", "hf_navn", "helseregion", "tjenesteomrade", "metric", "period", "value", "unit", "source_id", "quality"], required: true },
  "sites.csv": { columns: ["site_id", "site_navn", "hf_id", "municipality_code", "lokalsykehus_id", "lat", "lon", "site_type", "akuttfunksjon"], required: false },
  "hospital_beds.csv": { columns: ["site_id", "site_navn", "hf_id", "municipality_code", "kategori", "senger", "period", "quality", "source_url", "source_note", "last_verified"], required: false },
};

const good = () => ({
  "municipalities.csv": [{ municipality_code: "5603", county_code: "56", municipality_name: "Hammerfest", county_name: "Finnmark" }],
  "helseforetak.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" }],
  "opptaksomrader.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", hf_id: "983974880" }, { omrade_id: "D01", omrade_navn: "Vest-Finnmark", omrade_type: "dps", hf_id: "983974880" }],
  "municipality_catchment.csv": [{ municipality_code: "5603", municipality_name: "Hammerfest", lokalsykehus_id: "S01", dps_id: "D01", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" }],
  "hf_activity.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: "134", unit: "senger", source_id: "ssb_13942", quality: "ekte" }],
  "sites.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", lokalsykehus_id: "S01", lat: "70.67", lon: "23.65", site_type: "sykehus", akuttfunksjon: "ja" }],
  "hospital_beds.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", kategori: "somatikk", senger: "130", period: "2025", quality: "ekte", source_url: "https://x", source_note: "", last_verified: "2026-09-02" }],
});

test("clean tables give no errors and an info line for the bed control", () => {
  const r = validateTables(good(), schemas);
  assert.deepEqual(r.errors, []);
  assert.ok(r.info.some((l) => l.includes("983974880") && l.includes("130") && l.includes("134")));
});

test("schema, quality, missing HF and bed deviation are errors; optional tables are warnings", () => {
  const t = good();
  t["hf_activity.csv"][0].quality = "gjett";
  t["municipality_catchment.csv"][0].hf_id = "";
  t["hospital_beds.csv"][0].senger = "90";
  delete t["sites.csv"];
  t["helseforetak.csv"] = t["helseforetak.csv"].map(({ type, ...rest }) => rest);
  const r = validateTables(t, schemas);
  assert.ok(r.errors.some((e) => /hf_activity.*quality/.test(e)));
  assert.ok(r.errors.some((e) => /5603.*mangler HF/.test(e)));
  assert.ok(r.errors.some((e) => /983974880.*avviker/.test(e)));
  assert.ok(r.errors.some((e) => /helseforetak.csv.*kolonner/.test(e)));
  assert.ok(r.warnings.some((w) => /sites.csv/.test(w)));
});

test("duplicate catchment row and unknown site reference are errors", () => {
  const t = good();
  t["municipality_catchment.csv"].push({ ...t["municipality_catchment.csv"][0], lokalsykehus_id: "S02" });
  t["hospital_beds.csv"][0].site_id = "ukjent";
  const r = validateTables(t, schemas);
  assert.ok(r.errors.some((e) => /5603.*flere enn ett/.test(e)));
  assert.ok(r.errors.some((e) => /hospital_beds.*site_id.*ukjent/.test(e)));
});
```

- [ ] **Step 2: Run** – `cd /Users/hom/Documents/GitHub/kapasitet && node --test scripts/validate/rules.test.mjs` → FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/validate/schemas.mjs
import { ALL_FETCHERS } from "../fetch/index.mjs";

const CURATED = {
  "municipalities.csv": { columns: ["municipality_code", "county_code", "municipality_name", "county_name"], required: true },
  "sites.csv": { columns: ["site_id", "site_navn", "hf_id", "municipality_code", "lokalsykehus_id", "lat", "lon", "site_type", "akuttfunksjon"], required: false },
  "hospital_beds.csv": { columns: ["site_id", "site_navn", "hf_id", "municipality_code", "kategori", "senger", "period", "quality", "source_url", "source_note", "last_verified"], required: false },
};

/** Every normalized table the pipeline knows: fetcher outputs (required) + curated tables. */
export const SCHEMAS = {
  ...Object.fromEntries(ALL_FETCHERS.flatMap((f) => Object.entries(f.columns).map(([file, columns]) => [file, { columns, required: true }]))),
  ...CURATED,
};
```

```js
// scripts/validate/rules.mjs
import { SCHEMAS } from "./schemas.mjs";

export const QUALITIES = new Set(["ekte", "avledet", "estimat"]);
export const BED_TOLERANCE = 0.15;
const CONTROL_SUMS = [
  ["983974880", "Finnmarkssykehuset", 134], ["983974899", "UNN", 593], ["983974910", "Nordlandssykehuset", 295], ["983974929", "Helgelandssykehuset", 121],
];
const NUMERIC = { value: true, senger: true };

export function validateTables(tables, schemas = SCHEMAS) {
  const errors = [], warnings = [], info = [];
  const err = (m) => errors.push(m);

  // 1. presence + columns
  for (const [file, s] of Object.entries(schemas)) {
    const rows = tables[file];
    if (!rows) { (s.required ? errors : warnings).push(`${file} mangler${s.required ? "" : " (ikke kuratert ennå)"}`); continue; }
    const have = rows.length ? Object.keys(rows[0]) : s.columns;
    if (have.join(",") !== s.columns.join(",")) err(`${file}: kolonner er [${have}] – forventet [${s.columns}]`);
  }
  const t = (file) => tables[file] ?? [];

  // 2–3. quality, numbers, period
  for (const [file, rows] of Object.entries(tables)) {
    if (!schemas[file]) continue;
    const cols = schemas[file].columns;
    let badQ = 0, badN = 0, badP = 0, example = "";
    for (const r of rows) {
      if (cols.includes("quality") && !QUALITIES.has(r.quality)) { badQ++; example ||= JSON.stringify(r); }
      for (const c of cols) if (NUMERIC[c] && !Number.isFinite(Number(r[c]))) badN++;
      if (cols.includes("period") && !/^\d{4}$/.test(r.period)) badP++;
    }
    if (badQ) err(`${file}: ${badQ} rader med ugyldig quality, f.eks. ${example}`);
    if (badN) err(`${file}: ${badN} rader med ikke-numerisk value/senger`);
    if (badP) err(`${file}: ${badP} rader med period som ikke er årstall`);
  }

  // 4. catchment integrity
  const hfIds = new Set(t("helseforetak.csv").map((r) => r.hf_id));
  const areas = new Map(t("opptaksomrader.csv").map((r) => [r.omrade_id, r]));
  const catchBy = new Map();
  for (const r of t("municipality_catchment.csv")) (catchBy.get(r.municipality_code) ?? catchBy.set(r.municipality_code, []).get(r.municipality_code)).push(r);
  for (const m of t("municipalities.csv")) {
    const rows = catchBy.get(m.municipality_code) ?? [];
    if (rows.length === 0) { err(`Kommune ${m.municipality_code} ${m.municipality_name} mangler i municipality_catchment.csv`); continue; }
    if (rows.length > 1) err(`Kommune ${m.municipality_code} har flere enn ett lokalsykehusområde i municipality_catchment.csv (${rows.map((r) => r.lokalsykehus_id).join(", ")})`);
    const r = rows[0];
    if (!r.hf_id || !hfIds.has(r.hf_id)) err(`Kommune ${m.municipality_code} ${m.municipality_name} mangler HF (hf_id="${r.hf_id}")`);
    if (!areas.has(r.lokalsykehus_id)) err(`Kommune ${m.municipality_code}: lokalsykehus_id "${r.lokalsykehus_id}" finnes ikke i opptaksomrader.csv`);
    if (!r.dps_id) warnings.push(`Kommune ${m.municipality_code} ${m.municipality_name} mangler DPS-område`);
  }

  // 5. referential integrity
  const muniIds = new Set(t("municipalities.csv").map((r) => r.municipality_code));
  const siteIds = new Set(t("sites.csv").map((r) => r.site_id));
  const ref = (file, col, ok, label) => {
    const bad = [...new Set(t(file).filter((r) => !ok(r[col])).map((r) => r[col]))];
    if (bad.length) err(`${file}: ${col} ${bad.length} ukjente ${label}: ${bad.slice(0, 5).join(", ")}`);
  };
  for (const f of ["opptaksomrader.csv", "sites.csv", "hospital_beds.csv"]) ref(f, "hf_id", (v) => hfIds.has(v), "HF");
  for (const f of Object.keys(tables).filter((f) => f.startsWith("municipal_")).concat("sites.csv", "hospital_beds.csv")) ref(f, "municipality_code", (v) => muniIds.has(v), "kommuner");
  ref("hospital_beds.csv", "site_id", (v) => siteIds.has(v), "site_id");
  const cpBad = [...new Set(t("catchment_population.csv").filter((r) => (r.omrade_type === "lokalsykehus" || r.omrade_type === "dps") && !areas.has(r.omrade_id)).map((r) => r.omrade_id))];
  if (cpBad.length) err(`catchment_population.csv: ${cpBad.length} områder finnes ikke i opptaksomrader.csv: ${cpBad.slice(0, 5).join(", ")}`);

  // 6. curated somatic beds vs SSB 13942
  const ssbBeds = new Map(); // hf_id → {period, value}
  for (const r of t("hf_activity.csv")) {
    if (r.tjenesteomrade !== "SOM" || r.metric !== "dognplasser") continue;
    const cur = ssbBeds.get(r.hf_id);
    if (!cur || r.period > cur.period) ssbBeds.set(r.hf_id, { period: r.period, value: Number(r.value) });
  }
  const curated = new Map(); // hf_id → Map(site_id → {period, senger})
  for (const r of t("hospital_beds.csv")) {
    if (r.kategori !== "somatikk") continue;
    const sites = curated.get(r.hf_id) ?? curated.set(r.hf_id, new Map()).get(r.hf_id);
    const cur = sites.get(r.site_id);
    if (!cur || r.period > cur.period) sites.set(r.site_id, { period: r.period, senger: Number(r.senger) });
  }
  for (const [hf, sites] of curated) {
    const sum = [...sites.values()].reduce((a, s) => a + s.senger, 0);
    const ssb = ssbBeds.get(hf);
    if (!ssb) { warnings.push(`hospital_beds.csv: HF ${hf} har ingen SOM døgnplasser i hf_activity.csv å kontrollere mot`); continue; }
    const dev = Math.abs(sum - ssb.value) / ssb.value;
    const line = `HF ${hf}: kuratert somatikk ${sum} senger vs SSB 13942 ${ssb.value} døgnplasser (${ssb.period}), avvik ${(dev * 100).toFixed(1)} %`;
    if (dev > BED_TOLERANCE) err(`${line} – avviker mer enn ${BED_TOLERANCE * 100} %`); else info.push(line);
  }
  for (const h of t("helseforetak.csv")) if (h.type === "hf" && !curated.has(h.hf_id)) info.push(`HF ${h.hf_id} ${h.hf_navn}: ingen kuratert sengetabell`);

  // 7. control sums
  for (const [hf, navn, expected] of CONTROL_SUMS) {
    const row = t("hf_activity.csv").find((r) => r.hf_id === hf && r.tjenesteomrade === "SOM" && r.metric === "dognplasser" && r.period === "2025");
    if (row && Number(row.value) !== expected) warnings.push(`Kontrollsum: ${navn} SOM døgnplasser 2025 er ${row.value}, forventet ${expected} (SSB har revidert?)`);
  }
  return { errors, warnings, info };
}
```

```js
// scripts/validate.mjs
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
```

- [ ] **Step 4: Run tests and the validator on the real data**

Run: `cd /Users/hom/Documents/GitHub/kapasitet && npm test && npm run validate`
Expected: tests PASS; validator prints info lines (four "ingen kuratert sengetabell"-style lines for Helse Nord HFs plus the other HFs), two warnings (`sites.csv`/`hospital_beds.csv` not curated yet), `0 feil`. If it reports errors, they are real data problems from Task 13 – fix the fetcher, rerun `npm run fetch -- --only <id>`, and commit the corrected CSV together with the fix.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate scripts/validate.mjs
git commit -m "feat(validate): schema, quality, catchment integrity and bed control rules"
```

### Task 15: Drift test – three live cells against the CSVs

**Files:**
- Create: `scripts/drift.mjs`
- Test: `scripts/drift.test.mjs`

**Interfaces:**
- Consumes: `ssbQuery`, `item` (Task 2), `jsonStatToRows` (Task 1), `readCsv`, `normalized` (Task 1).
- Produces: `driftReport(results) → {ok: boolean, lines: string[]}` with `results = [{navn, live, csv}]`; CLI `npm run drift` (manual, network) exits 1 when any cell differs.

- [ ] **Step 1: Failing test**

```js
// scripts/drift.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { driftReport } from "./drift.mjs";

test("reports OK and AVVIK lines", () => {
  const r = driftReport([{ navn: "a", live: 134, csv: 134 }, { navn: "b", live: 100, csv: 98 }, { navn: "c", live: 5, csv: undefined }]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.lines, ["OK     a: 134", "AVVIK  b: SSB 100, CSV 98", "AVVIK  c: SSB 5, CSV mangler"]);
  assert.equal(driftReport([{ navn: "a", live: 1, csv: 1 }]).ok, true);
});
```

- [ ] **Step 2: Run** – FAIL.

- [ ] **Step 3: Implement**

```js
// scripts/drift.mjs
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
```

- [ ] **Step 4: Run**

Run: `cd /Users/hom/Documents/GitHub/kapasitet && npm test && npm run drift`
Expected: tests PASS; drift prints three `OK` lines and exits 0. (An `AVVIK` right after a fresh fetch means a transform bug – fix it before committing.)

- [ ] **Step 5: Commit, then phase-1 gate**

```bash
git add scripts/drift.mjs scripts/drift.test.mjs
git commit -m "feat(pipeline): drift test against three live SSB cells"
cd /Users/hom/Documents/GitHub/kapasitet && npm test && npm run validate && (cd apps/web && npm run build)
```

All three must be green (the Next build is untouched by this plan but must stay green). The controller pushes after this gate.

## Phase 2 – Behandlingssteder og senger (Helse Nord)

### Task 16: `sites.csv` and curated `hospital_beds.csv` for Helse Nord

**Files:**
- Create: `data/normalized/sites.csv`, `data/normalized/hospital_beds.csv`, `docs/senger-helse-nord.md`
- Modify: `scripts/validate/schemas.mjs` (flip `sites.csv` and `hospital_beds.csv` to `required: true`)

**Interfaces:**
- Consumes: `opptaksomrader.csv`, `helseforetak.csv`, `hf_activity.csv`, `catchment_population.csv` (Task 13 output), `npm run validate` (Task 14).
- Produces: `sites.csv` (`site_id, site_navn, hf_id, municipality_code, lokalsykehus_id, lat, lon, site_type, akuttfunksjon`) and `hospital_beds.csv` (`site_id, site_navn, hf_id, municipality_code, kategori, senger, period, quality, source_url, source_note, last_verified`). `site_type` ∈ `sykehus | dps | klinikk`; `akuttfunksjon` ∈ `ja | nei | ukjent` (= somatic acute admissions); `kategori` ∈ `somatikk | psykisk_helsevern | tsb | intensiv | fode | annet`. `site_id` is the lowercase ASCII place name used in unit ids (`behandlingssted:hammerfest`).

This is a research task, not a coding task: **every row of `hospital_beds.csv` needs a `source_url` that a reader can open**, and `quality` must say how the number was obtained (`ekte` = the source states this number for this site; `avledet` = computed from a source that states it differently, e.g. a total minus a listed sub-unit; `estimat` = fallback formula below). Numbers must not be adjusted to satisfy the validator – see Step 5.

- [ ] **Step 1: Write `sites.csv`**

Start from these 15 rows. Coordinates come from `data/normalized/facilities.csv` (OSM) and are accepted as-is, with two exceptions to check against the HF's own address page or `https://nominatim.openstreetmap.org/search?format=json&q=<name>`: Hammerfest (Nye Hammerfest sykehus at Rossmolla opened in 2025 – use the new site if it has opened) and Karasjok (SANKS is not in facilities.csv; the row below uses Karasjok helsesenter's OSM point, which is the same campus). Sandnessjøen lies in Alstahaug (1820) – facilities.csv wrongly says 1827 Dønna.

```csv
site_id,site_navn,hf_id,municipality_code,lokalsykehus_id,lat,lon,site_type,akuttfunksjon
hammerfest,Hammerfest sykehus,983974880,5603,S01,70.67199,23.65252,sykehus,ja
kirkenes,Kirkenes sykehus,983974880,5605,S02,69.70703,30.03492,sykehus,ja
alta,Finnmarkssykehuset Klinikk Alta,983974880,5601,,69.96884,23.27611,klinikk,nei
karasjok,SANKS Karasjok,983974880,5610,,69.4717,25.5218,klinikk,nei
tromso,UNN Tromsø,983974899,5501,S05,69.68393,18.98265,sykehus,ja
asgard,UNN Åsgård,983974899,5501,,69.65910,18.91433,sykehus,nei
harstad,UNN Harstad,983974899,5503,S03,68.79627,16.52476,sykehus,ja
narvik,UNN Narvik,983974899,1806,S04,68.44742,17.46525,sykehus,ja
bodo,Nordlandssykehuset Bodø,983974910,1804,S06,67.28304,14.39688,sykehus,ja
ronvik,Nordlandssykehuset Rønvik,983974910,1804,,67.28616,14.43654,sykehus,nei
lofoten,Nordlandssykehuset Lofoten,983974910,1860,S07,68.11971,13.53695,sykehus,ja
vesteralen,Nordlandssykehuset Vesterålen,983974910,1866,S08,68.55999,14.91023,sykehus,ja
mo-i-rana,Helgelandssykehuset Mo i Rana,983974929,1833,S09,66.32598,14.18577,sykehus,ja
mosjoen,Helgelandssykehuset Mosjøen,983974929,1824,S10,65.83093,13.21239,sykehus,ja
sandnessjoen,Helgelandssykehuset Sandnessjøen,983974929,1820,S11,66.01822,12.61859,sykehus,ja
```

(That is 15 rows; add a 16th only if research in Step 2 turns up a bed-carrying site that is missing, e.g. a DPS with døgnplasser you have a source for.) Before saving, check the S-code mapping against the fetched names: `grep -E "^S(01|02|03|04|05|06|07|08|09|10|11)," data/normalized/opptaksomrader.csv` – each `omrade_navn` must name the site's town (Hammerfest, Kirkenes, Harstad, Narvik, Tromsø/UNN, Bodø, Lofoten, Vesterålen, Rana/Mo i Rana, Mosjøen, Sandnessjøen). If a code names a different town, fix `lokalsykehus_id` in the row above, not the fetched file. Also `grep -c "" data/normalized/helseforetak.csv` and confirm the four org.nr exist there.

- [ ] **Step 2: Research beds per site**

For each site and category, search in this order and stop at the first source that states a number for that site: (a) the HF's own pages (`finnmarkssykehuset.no`, `unn.no`, `nordlandssykehuset.no`, `helgelandssykehuset.no` – "Om oss", the site's page, "Årlig melding 2024/2025", "Utviklingsplan"), (b) Helse Nord RHF (`helse-nord.no`: "Regional utviklingsplan 2038", styresaker om sengekapasitet/funksjonsfordeling), (c) Sykehusbygg / project pages for new buildings (Nye Hammerfest sykehus, Nye UNN Narvik, Nye Helgelandssykehuset), (d) Helsedirektoratet / SAMDATA, (e) Wikipedia or press (`quality=avledet`, `source_note` says so). Useful WebSearch queries: `"Hammerfest sykehus" antall senger`, `"Kirkenes sykehus" sengeplasser`, `"UNN Harstad" senger`, `"Nordlandssykehuset Lofoten" senger`, `Helgelandssykehuset "Mo i Rana" senger`, `site:helse-nord.no sengekapasitet somatikk`. Record for each row: `senger`, `period` (the year the source describes), `source_url`, `source_note` (what the source literally says, e.g. "«Sykehuset har 46 somatiske senger» (om oss-siden, lest 2026-09-02)"), `last_verified` = today.

Categories: `somatikk` is mandatory for every `sykehus` row with a `lokalsykehus_id`; add `intensiv`, `fode`, `psykisk_helsevern`, `tsb` rows only when a source states them for that site (Åsgård, Rønvik and SANKS are the natural psykisk_helsevern rows; Klinikk Alta has somatic beds, add them if sourced). Do not put HF-level psychiatric totals on a site.

Fallback when no source states a somatic number for a site: `senger = round(HF_SOM × pop_site / Σ pop_sites-of-HF)` where `HF_SOM` = `hf_activity.csv` row (`hf_id`, `SOM`, `dognplasser`, latest period) and `pop_site` = `catchment_population.csv` row (`omrade_id` = the site's `lokalsykehus_id`, `SOM`, `alle`, same period); `quality=estimat`, `source_url` = `https://www.ssb.no/statbank/table/13942`, `source_note` = "Estimat: HF-ets SSB-døgnplasser fordelt etter opptaksbefolkning; UNN Tromsø/NLSH Bodø har regionfunksjoner, så estimatet undervurderer dem".

- [ ] **Step 3: Write `hospital_beds.csv`** with the header above and the researched rows, one row per site × category. Then write `docs/senger-helse-nord.md`: a table of the same numbers with the sources, plus a short paragraph on what SSB 13942 counts (gjennomsnittlig tilgjengelige døgnplasser over året) versus what hospital pages count (fysiske senger), so later readers understand deviations.

- [ ] **Step 4: Flip the schemas to required**

In `scripts/validate/schemas.mjs` change both `required: false` to `required: true`.

- [ ] **Step 5: Validate**

Run: `cd /Users/hom/Documents/GitHub/kapasitet && npm test && npm run validate`
Expected: `0 feil`, and four info lines `HF 9839748xx: kuratert somatikk N senger vs SSB 13942 M døgnplasser (2025), avvik x %`.
If the validator reports `avviker mer enn 15 %` for an HF: do **not** change sourced numbers. Re-check the sources (a page may count psychiatric or day beds inside "senger"), and if the deviation is real, leave the data as researched and put the numbers, sources and your reading of the cause in your final report – the controller decides whether to relabel rows or widen `BED_TOLERANCE`.

- [ ] **Step 6: Commit, then phase-2 gate**

```bash
cd /Users/hom/Documents/GitHub/kapasitet
git add data/normalized/sites.csv data/normalized/hospital_beds.csv docs/senger-helse-nord.md scripts/validate/schemas.mjs
git commit -m "feat(data): sites and curated hospital beds for Helse Nord with sources"
npm test && npm run validate && (cd apps/web && npm run build)
```

The controller pushes after this gate.

## Phase 3 – Enhetsmodell

Unit ids are `<type>:<kode>` with `type` ∈ `land | helseregion | helseforetak | behandlingssted | opptaksomrade | fylke | kommune` (e.g. `helseforetak:983974880`, `behandlingssted:hammerfest`, `opptaksomrade:S01`, `kommune:5603`, `fylke:56`, `helseregion:H05`, `land:H00`). A unit's fact sheet is written to `apps/web/public/data/units/<type>/<kode>.json`; the index to `apps/web/public/data/units/index.json`. Every number in a fact sheet is a **Tall**: `{value: number, unit, period, quality, source_id}`; a time series is `Tall[]` sorted by `period`. Fact sheets are read by the UI (plan 2), the scenario engine (plan 2) and the LLM layer (spec B), so shapes are locked here.

### Task 17: Unit helpers + HF-side units (land, helseregion, helseforetak, behandlingssted)

**Files:**
- Create: `scripts/units/common.mjs`, `scripts/units/hf.mjs`
- Test: `scripts/units/common.test.mjs`, `scripts/units/hf.test.mjs`

**Interfaces:**
- Consumes: `REGION_NAMES` (Task 3); the normalized tables as `{[file]: rows[]}` with string cell values (from `readCsv`).
- Produces (common): `num(v)`, `tall(row) → Tall`, `byPeriod`, `nest(rows, keys, {single}) → nested object (leaf = Tall[] or Tall)`, `sumRows(rows, keys) → rows` (summed values, worst quality), `seriesBlock(rows, codeCol, nameCol) → {[code]: {navn, serie: Tall[]}}`, `latestPeriod(rows)`, `groupBy(rows, key) → Map`, `unitId(type, code)`, `unitPath(id) → "<type>/<kode>.json"`, `ref(type, code, navn) → {id, navn}`, `sok(...terms) → string[]`, `patientsBlock(mainRows, detailRows) → {periode_siste, diagnoser, tidsserie, siste_aar, undergrupper_siste_aar} | null`.
- Produces (hf): `bedsBlock(bedRows) → {[kategori]: Tall & {source_url, source_note, last_verified}}`, `buildSiteUnits(tables)`, `buildHfUnits(tables)`, `buildRegionUnits(tables)` – each returns `Unit[]` where `Unit = {id, navn, type, parent_ids: string[], sok: string[], fakta: object}`; `fakta` is the JSON written to disk and always repeats `id, navn, type`.

- [ ] **Step 1: Failing common tests**

```js
// scripts/units/common.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { nest, sumRows, seriesBlock, unitPath, sok, patientsBlock } from "./common.mjs";

const row = (o) => ({ unit: "personer", quality: "ekte", source_id: "s", ...o });

test("nest builds nested objects with period-sorted Tall[] leaves, or single Tall", () => {
  const rows = [row({ a: "x", b: "p", period: "2025", value: "2" }), row({ a: "x", b: "p", period: "2024", value: "1" }), row({ a: "y", b: "q", period: "2024", value: "3" })];
  const n = nest(rows, ["a", "b"]);
  assert.deepEqual(n.x.p.map((t) => [t.period, t.value]), [["2024", 1], ["2025", 2]]);
  assert.equal(n.y.q[0].value, 3);
  assert.equal(nest(rows.slice(2), ["a", "b"], { single: true }).y.q.value, 3);
  assert.throws(() => nest(rows.slice(0, 2), ["a", "b"], { single: true }), /Duplikat/);
});

test("sumRows sums by keys and keeps the worst quality", () => {
  const rows = [row({ g: "alle", period: "2025", value: "10" }), row({ g: "alle", period: "2025", value: "5", quality: "estimat" }), row({ g: "alle", period: "2024", value: "1" })];
  const s = sumRows(rows, ["g", "period"]);
  assert.deepEqual(s.map((r) => [r.period, r.value, r.quality]), [["2025", 15, "estimat"], ["2024", 1, "ekte"]]);
});

test("seriesBlock, unitPath and sok", () => {
  const b = seriesBlock([row({ metric: "m1", metric_label: "Metric 1", period: "2025", value: "7" })], "metric", "metric_label");
  assert.deepEqual(b, { m1: { navn: "Metric 1", serie: [{ value: 7, unit: "personer", period: "2025", quality: "ekte", source_id: "s" }] } });
  assert.equal(unitPath("kommune:5603"), "kommune/5603.json");
  assert.deepEqual(sok("Hammerfest", "5603", "", "hammerfest"), ["hammerfest", "5603"]);
});

test("patientsBlock splits totals time series, latest-year chapters and detail", () => {
  const p = (o) => row({ region_id: "56", tjenesteomrade: "SOM", metric: "pasienter", unit: "personer", ...o });
  const main = [
    p({ diagnose_kode: "_T", diagnose_navn: "I alt", aldersgruppe: "alle", period: "2024", value: "100" }),
    p({ diagnose_kode: "_T", diagnose_navn: "I alt", aldersgruppe: "alle", period: "2025", value: "110" }),
    p({ diagnose_kode: "IX", diagnose_navn: "Sirkulasjon", aldersgruppe: "67-79", period: "2025", value: "20" }),
  ];
  const detail = [p({ diagnose_kode: "I21", diagnose_navn: "Hjerteinfarkt", aldersgruppe: "alle", period: "2025", value: "5" })];
  const b = patientsBlock(main, detail);
  assert.equal(b.periode_siste, "2025");
  assert.deepEqual(b.diagnoser, { _T: "I alt", IX: "Sirkulasjon", I21: "Hjerteinfarkt" });
  assert.deepEqual(b.tidsserie.SOM.pasienter.map((t) => t.value), [100, 110]);
  assert.equal(b.siste_aar.SOM.IX.pasienter["67-79"].value, 20);
  assert.equal(b.undergrupper_siste_aar.SOM.I21.pasienter.value, 5);
  assert.equal(patientsBlock([], []), null);
});
```

- [ ] **Step 2: Run** – `cd /Users/hom/Documents/GitHub/kapasitet && node --test scripts/units/common.test.mjs` → FAIL.

- [ ] **Step 3: Implement common.mjs**

```js
// scripts/units/common.mjs
const RANK = { ekte: 0, avledet: 1, estimat: 2 };

export const num = (v) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error(`Ikke et tall: "${v}"`); return n; };
export const tall = (r) => ({ value: num(r.value), unit: r.unit, period: r.period, quality: r.quality, source_id: r.source_id });
export const byPeriod = (a, b) => a.period.localeCompare(b.period);

/** rows → nested object keyed by `keys`; leaf = Tall[] sorted by period, or a single Tall with `single` (throws on duplicates). */
export function nest(rows, keys, { single = false } = {}) {
  const root = {};
  for (const r of rows) {
    let node = root;
    for (const k of keys.slice(0, -1)) node = node[r[k]] ??= {};
    const leaf = r[keys[keys.length - 1]];
    if (single) {
      if (leaf in node) throw new Error(`Duplikat for ${keys.map((k) => r[k]).join("/")}`);
      node[leaf] = tall(r);
    } else (node[leaf] ??= []).push(tall(r));
  }
  if (!single) sortLeaves(root);
  return root;
}
function sortLeaves(n) { for (const v of Object.values(n)) Array.isArray(v) ? v.sort(byPeriod) : sortLeaves(v); }

/** Sum `value` over rows sharing `keys` (which must include `period`); quality = worst input. First-seen order. */
export function sumRows(rows, keys) {
  const acc = new Map();
  for (const r of rows) {
    const k = keys.map((c) => r[c]).join("|");
    if (!acc.has(k)) acc.set(k, { ...Object.fromEntries(keys.map((c) => [c, r[c]])), value: 0, unit: r.unit, period: r.period, quality: "ekte", source_id: r.source_id });
    const e = acc.get(k);
    e.value += num(r.value);
    if (RANK[r.quality] > RANK[e.quality]) e.quality = r.quality;
  }
  return [...acc.values()];
}

export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) { const k = typeof key === "function" ? key(r) : r[key]; (m.get(k) ?? m.set(k, []).get(k)).push(r); }
  return m;
}

/** {[code]: {navn, serie: Tall[]}} – used for årsverk, spesialister, kommunale indikatorer. */
export function seriesBlock(rows, codeCol, nameCol) {
  const out = {};
  for (const [code, list] of groupBy(rows, codeCol)) out[code] = { navn: list[0][nameCol], serie: list.map(tall).sort(byPeriod) };
  return out;
}

export const latestPeriod = (rows) => rows.reduce((m, r) => (r.period > m ? r.period : m), "");
export const unitId = (type, code) => `${type}:${code}`;
export const unitPath = (id) => { const [type, code] = id.split(":"); return `${type}/${code}.json`; };
export const ref = (type, code, navn) => ({ id: unitId(type, code), navn: navn ?? code });
export const sok = (...terms) => [...new Set(terms.filter(Boolean).map((t) => String(t).toLowerCase()))];

/** Patients per diagnosis for one region (rows from patients_by_diagnosis(.detail).csv filtered on region_id). */
export function patientsBlock(main, detail) {
  if (main.length === 0) return null;
  const siste = latestPeriod(main);
  const diagnoser = {};
  for (const r of [...main, ...detail]) diagnoser[r.diagnose_kode] = r.diagnose_navn;
  return {
    periode_siste: siste,
    diagnoser,
    tidsserie: nest(main.filter((r) => r.diagnose_kode === "_T" && r.aldersgruppe === "alle"), ["tjenesteomrade", "metric"]),
    siste_aar: nest(main.filter((r) => r.period === siste), ["tjenesteomrade", "diagnose_kode", "metric", "aldersgruppe"], { single: true }),
    undergrupper_siste_aar: nest(detail.filter((r) => r.aldersgruppe === "alle"), ["tjenesteomrade", "diagnose_kode", "metric"], { single: true }),
  };
}
```

- [ ] **Step 4: Run** – PASS.

- [ ] **Step 5: Failing hf tests**

```js
// scripts/units/hf.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSiteUnits, buildHfUnits, buildRegionUnits, bedsBlock } from "./hf.mjs";

const q = { unit: "senger", quality: "ekte", source_id: "ssb_13942" };
const tables = () => ({
  "municipalities.csv": [{ municipality_code: "5603", county_code: "56", municipality_name: "Hammerfest", county_name: "Finnmark" }],
  "helseforetak.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" }],
  "opptaksomrader.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", hf_id: "983974880" }],
  "municipality_catchment.csv": [{ municipality_code: "5603", municipality_name: "Hammerfest", lokalsykehus_id: "S01", dps_id: "D01", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" }],
  "hf_activity.csv": [
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: "134", ...q },
    { hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2024", value: "130", ...q },
    { hf_id: "H05", hf_navn: "Helse Nord", helseregion: "H05", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: "1143", ...q },
    { hf_id: "H00", hf_navn: "Hele landet", helseregion: "", tjenesteomrade: "SOM", metric: "dognplasser", period: "2025", value: "10000", ...q },
  ],
  "hf_staffing.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", helseregion: "H05", yrkesgruppe_kode: "01", yrkesgruppe: "Leger", metric: "arsverk", period: "2025", value: "200", unit: "arsverk", source_id: "ssb_13953", quality: "ekte" }],
  "hf_specialists.csv": [],
  "catchment_population.csv": [
    { omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", tjenesteomrade: "SOM", aldersgruppe: "alle", period: "2025", value: "40000", unit: "personer", source_id: "ssb_13982", quality: "ekte" },
    { omrade_id: "983974880", omrade_navn: "Finnmarkssykehuset HF", omrade_type: "hf", tjenesteomrade: "SOM", aldersgruppe: "alle", period: "2025", value: "75000", unit: "personer", source_id: "ssb_13982", quality: "ekte" },
  ],
  "patients_by_diagnosis.csv": [{ region_id: "H05", region_navn: "Helse Nord", region_type: "helseregion", tjenesteomrade: "SOM", aldersgruppe: "alle", diagnose_kode: "_T", diagnose_navn: "I alt", metric: "pasienter", period: "2025", value: "150000", unit: "personer", source_id: "ssb_14824", quality: "ekte" }],
  "patients_by_diagnosis_detail.csv": [],
  "sites.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", lokalsykehus_id: "S01", lat: "70.67", lon: "23.65", site_type: "sykehus", akuttfunksjon: "ja" }],
  "hospital_beds.csv": [
    { site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", kategori: "somatikk", senger: "46", period: "2024", quality: "ekte", source_url: "https://a", source_note: "n", last_verified: "2026-09-02" },
    { site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", kategori: "somatikk", senger: "50", period: "2025", quality: "ekte", source_url: "https://b", source_note: "n2", last_verified: "2026-09-02" },
  ],
});

test("site unit has beds (latest period), parents and catchment population", () => {
  const [s] = buildSiteUnits(tables());
  assert.equal(s.id, "behandlingssted:hammerfest");
  assert.deepEqual(s.parent_ids, ["helseforetak:983974880", "kommune:5603"]);
  assert.deepEqual(s.fakta.senger.somatikk, { value: 50, unit: "senger", period: "2025", quality: "ekte", source_id: "curated_helse_nord", source_url: "https://b", source_note: "n2", last_verified: "2026-09-02" });
  assert.equal(s.fakta.opptaksomrade.befolkning_alle.value, 40000);
  assert.equal(s.fakta.lat, 70.67);
});

test("hf unit aggregates activity, staffing, population, areas, kommuner and sites", () => {
  const [h] = buildHfUnits(tables());
  assert.equal(h.id, "helseforetak:983974880");
  assert.deepEqual(h.parent_ids, ["helseregion:H05"]);
  assert.deepEqual(h.fakta.aktivitet.SOM.dognplasser.map((t) => t.value), [130, 134]);
  assert.equal(h.fakta.arsverk["01"].navn, "Leger");
  assert.equal(h.fakta.befolkning.SOM.alle[0].value, 75000);
  assert.deepEqual(h.fakta.opptaksomrader, [{ id: "opptaksomrade:S01", navn: "Hammerfest", type: "lokalsykehus" }]);
  assert.deepEqual(h.fakta.kommuner, [{ id: "kommune:5603", navn: "Hammerfest" }]);
  assert.equal(h.fakta.behandlingssteder[0].senger.somatikk.value, 50);
});

test("region units: land + four helseregioner with activity, patients and HF list", () => {
  const units = buildRegionUnits(tables());
  assert.deepEqual(units.map((u) => u.id), ["land:H00", "helseregion:H03", "helseregion:H04", "helseregion:H05", "helseregion:H12"]);
  const nord = units.find((u) => u.id === "helseregion:H05");
  assert.deepEqual(nord.parent_ids, ["land:H00"]);
  assert.equal(nord.fakta.aktivitet.SOM.dognplasser[0].value, 1143);
  assert.equal(nord.fakta.pasienter.tidsserie.SOM.pasienter[0].value, 150000);
  assert.deepEqual(nord.fakta.helseforetak, [{ id: "helseforetak:983974880", navn: "Finnmarkssykehuset HF", type: "hf" }]);
  assert.equal(units[0].fakta.aktivitet.SOM.dognplasser[0].value, 10000);
});

test("bedsBlock keeps the latest period per kategori", () => {
  assert.equal(bedsBlock(tables()["hospital_beds.csv"]).somatikk.period, "2025");
});
```

- [ ] **Step 6: Run** – FAIL.

- [ ] **Step 7: Implement hf.mjs**

```js
// scripts/units/hf.mjs
import { nest, tall, byPeriod, unitId, ref, sok, groupBy, seriesBlock, patientsBlock } from "./common.mjs";
import { REGION_NAMES } from "../lib/regions.mjs";

const t = (tables, f) => tables[f] ?? [];
const byCol = (rows, col, v) => rows.filter((r) => r[col] === v);
const nameMap = (rows, idCol, nameCol) => new Map(rows.map((r) => [r[idCol], r[nameCol]]));

/** Latest period per kategori, provenance columns kept on the Tall. */
export function bedsBlock(bedRows) {
  const out = {};
  for (const [kategori, list] of groupBy(bedRows, "kategori")) {
    const r = list.reduce((a, b) => (b.period > a.period ? b : a));
    out[kategori] = { value: Number(r.senger), unit: "senger", period: r.period, quality: r.quality, source_id: "curated_helse_nord", source_url: r.source_url, source_note: r.source_note, last_verified: r.last_verified };
  }
  return out;
}

export function buildSiteUnits(tables) {
  const hfName = nameMap(t(tables, "helseforetak.csv"), "hf_id", "hf_navn");
  const muniName = nameMap(t(tables, "municipalities.csv"), "municipality_code", "municipality_name");
  const areaName = nameMap(t(tables, "opptaksomrader.csv"), "omrade_id", "omrade_navn");
  const beds = groupBy(t(tables, "hospital_beds.csv"), "site_id");
  return t(tables, "sites.csv").map((s) => {
    const id = unitId("behandlingssted", s.site_id);
    const pop = t(tables, "catchment_population.csv").filter((r) => r.omrade_id === s.lokalsykehus_id && r.tjenesteomrade === "SOM" && r.aldersgruppe === "alle").sort(byPeriod);
    return {
      id, navn: s.site_navn, type: "behandlingssted",
      parent_ids: [unitId("helseforetak", s.hf_id), unitId("kommune", s.municipality_code)],
      sok: sok(s.site_navn, s.site_id, muniName.get(s.municipality_code)),
      fakta: {
        id, navn: s.site_navn, type: "behandlingssted",
        hf: ref("helseforetak", s.hf_id, hfName.get(s.hf_id)),
        kommune: ref("kommune", s.municipality_code, muniName.get(s.municipality_code)),
        lat: Number(s.lat), lon: Number(s.lon), site_type: s.site_type, akuttfunksjon: s.akuttfunksjon,
        senger: bedsBlock(beds.get(s.site_id) ?? []),
        opptaksomrade: s.lokalsykehus_id
          ? { ...ref("opptaksomrade", s.lokalsykehus_id, areaName.get(s.lokalsykehus_id)), befolkning_alle: pop.length ? tall(pop[pop.length - 1]) : null }
          : null,
      },
    };
  });
}

export function buildHfUnits(tables) {
  const sites = buildSiteUnits(tables);
  const activity = groupBy(t(tables, "hf_activity.csv"), "hf_id");
  const staffing = groupBy(t(tables, "hf_staffing.csv"), "hf_id");
  const specialists = groupBy(t(tables, "hf_specialists.csv"), "hf_id");
  const population = groupBy(t(tables, "catchment_population.csv"), "omrade_id");
  const areas = groupBy(t(tables, "opptaksomrader.csv"), "hf_id");
  const kommuner = groupBy(t(tables, "municipality_catchment.csv"), "hf_id");
  return t(tables, "helseforetak.csv").map((h) => {
    const id = unitId("helseforetak", h.hf_id);
    return {
      id, navn: h.hf_navn, type: "helseforetak",
      parent_ids: h.helseregion ? [unitId("helseregion", h.helseregion)] : [],
      sok: sok(h.hf_navn, h.hf_id),
      fakta: {
        id, navn: h.hf_navn, type: "helseforetak", hf_type: h.type,
        helseregion: h.helseregion ? ref("helseregion", h.helseregion, REGION_NAMES[h.helseregion]) : null,
        aktivitet: nest(activity.get(h.hf_id) ?? [], ["tjenesteomrade", "metric"]),
        arsverk: seriesBlock(staffing.get(h.hf_id) ?? [], "yrkesgruppe_kode", "yrkesgruppe"),
        spesialister: seriesBlock(specialists.get(h.hf_id) ?? [], "spesialitet_kode", "spesialitet"),
        befolkning: nest(population.get(h.hf_id) ?? [], ["tjenesteomrade", "aldersgruppe"]),
        opptaksomrader: (areas.get(h.hf_id) ?? []).map((a) => ({ ...ref("opptaksomrade", a.omrade_id, a.omrade_navn), type: a.omrade_type })),
        kommuner: (kommuner.get(h.hf_id) ?? []).map((k) => ref("kommune", k.municipality_code, k.municipality_name)),
        behandlingssteder: sites.filter((s) => s.fakta.hf.id === id).map((s) => ({ id: s.id, navn: s.navn, senger: s.fakta.senger })),
      },
    };
  });
}

/** land:H00 + the four helseregioner. hf_activity/catchment_population use H-codes; the patients tables use "0" for the country. */
export function buildRegionUnits(tables) {
  const hfs = t(tables, "helseforetak.csv");
  const defs = [["H00", "Hele landet", "land", [], "norge"], ...Object.entries(REGION_NAMES).map(([c, n]) => [c, n, "helseregion", [unitId("land", "H00")], n.replace("Helse ", "")])];
  return defs.map(([code, navn, type, parent_ids, alias]) => {
    const id = unitId(type, code);
    const regionId = code === "H00" ? "0" : code;
    return {
      id, navn, type, parent_ids, sok: sok(navn, code, alias),
      fakta: {
        id, navn, type,
        aktivitet: nest(byCol(t(tables, "hf_activity.csv"), "hf_id", code), ["tjenesteomrade", "metric"]),
        befolkning: nest(byCol(t(tables, "catchment_population.csv"), "omrade_id", code), ["tjenesteomrade", "aldersgruppe"]),
        pasienter: patientsBlock(byCol(t(tables, "patients_by_diagnosis.csv"), "region_id", regionId), byCol(t(tables, "patients_by_diagnosis_detail.csv"), "region_id", regionId)),
        helseforetak: (type === "land" ? hfs : hfs.filter((h) => h.helseregion === code)).map((h) => ({ ...ref("helseforetak", h.hf_id, h.hf_navn), type: h.type })),
      },
    };
  });
}
```

- [ ] **Step 8: Run** – `npm test` → PASS.

- [ ] **Step 9: Commit**

```bash
git add scripts/units/common.mjs scripts/units/common.test.mjs scripts/units/hf.mjs scripts/units/hf.test.mjs
git commit -m "feat(units): Tall helpers and land/helseregion/helseforetak/behandlingssted units"
```

### Task 18: Geographic units, `buildUnits`, CLI, generated JSON

**Files:**
- Create: `scripts/units/geo.mjs`, `scripts/units/build.mjs`, `scripts/build-units.mjs`, `.gitattributes`
- Test: `scripts/units/geo.test.mjs`, `scripts/units/build.test.mjs`
- Generated (committed): `apps/web/public/data/units/index.json` and `apps/web/public/data/units/<type>/<kode>.json`

**Interfaces:**
- Consumes: everything in Task 17; `loadTables` (Task 14, `scripts/validate.mjs`), `validateTables` (Task 14), `UNITS_DIR` (Task 1), `REGION_NAMES` (Task 3).
- Produces: `buildOpptaksomradeUnits(tables)`, `buildFylkeUnits(tables)`, `buildKommuneUnits(tables)` (→ `Unit[]`), `buildUnits(tables, {today}) → {index: {generated, units: [{id, navn, type, parent_ids, sok}]}, files: {[relPath]: fakta}}` (throws on duplicate ids or a `parent_id` that is not a unit); CLI `npm run build:data` (validates first, wipes `UNITS_DIR`, writes files).

- [ ] **Step 1: Failing geo tests**

```js
// scripts/units/geo.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOpptaksomradeUnits, buildFylkeUnits, buildKommuneUnits } from "./geo.mjs";

const pop = (code, g, period, value) => ({ municipality_code: code, aldersgruppe: g, period, value: String(value), unit: "personer", source_id: "ssb_07459", quality: "ekte" });
const tables = () => ({
  "municipalities.csv": [
    { municipality_code: "5603", county_code: "56", municipality_name: "Hammerfest", county_name: "Finnmark" },
    { municipality_code: "5601", county_code: "56", municipality_name: "Alta", county_name: "Finnmark" },
  ],
  "helseforetak.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" }],
  "opptaksomrader.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", hf_id: "983974880" }, { omrade_id: "D01", omrade_navn: "Vest-Finnmark", omrade_type: "dps", hf_id: "983974880" }],
  "municipality_catchment.csv": [
    { municipality_code: "5603", municipality_name: "Hammerfest", lokalsykehus_id: "S01", dps_id: "D01", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" },
    { municipality_code: "5601", municipality_name: "Alta", lokalsykehus_id: "S01", dps_id: "D01", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" },
  ],
  "catchment_population.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", tjenesteomrade: "SOM", aldersgruppe: "alle", period: "2025", value: "40000", unit: "personer", source_id: "ssb_13982", quality: "ekte" }],
  "municipal_population.csv": [pop("5603", "alle", "2025", 11000), pop("5601", "alle", "2025", 21000), pop("5603", "0-17", "2025", 2000), pop("5601", "0-17", "2025", 4000), pop("5603", "alle", "2024", 10900), pop("5601", "alle", "2024", 20900)],
  "municipal_capacity.csv": [{ municipality_code: "5603", metric: "sykehjem_plasser", metric_label: "Sykehjemsplasser", period: "2024", value: "90", unit: "plasser", source_id: "ssb_11875", quality: "ekte" }],
  "municipal_needs.csv": [{ municipality_code: "5603", metric: "npr_i00_i99_antall", metric_label: "Hjerte- og karsykdommer – Antall", period: "2024", value: "410", unit: "personer", source_id: "fhi_nokkel_699", quality: "ekte" }],
  "patients_by_diagnosis.csv": [{ region_id: "56", region_navn: "Finnmark", region_type: "fylke", tjenesteomrade: "SOM", aldersgruppe: "alle", diagnose_kode: "_T", diagnose_navn: "I alt", metric: "pasienter", period: "2025", value: "30000", unit: "personer", source_id: "ssb_14824", quality: "ekte" }],
  "patients_by_diagnosis_detail.csv": [],
  "sites.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", lokalsykehus_id: "S01", lat: "70.67", lon: "23.65", site_type: "sykehus", akuttfunksjon: "ja" }],
  "hospital_beds.csv": [],
});

test("opptaksomrade unit lists kommuner, population, hf and site", () => {
  const units = buildOpptaksomradeUnits(tables());
  const s01 = units.find((u) => u.id === "opptaksomrade:S01");
  assert.deepEqual(s01.parent_ids, ["helseforetak:983974880"]);
  assert.deepEqual(s01.fakta.kommuner.map((k) => k.id), ["kommune:5603", "kommune:5601"]);
  assert.equal(s01.fakta.befolkning.SOM.alle[0].value, 40000);
  assert.deepEqual(s01.fakta.behandlingssted, { id: "behandlingssted:hammerfest", navn: "Hammerfest sykehus" });
  const d01 = units.find((u) => u.id === "opptaksomrade:D01");
  assert.equal(d01.fakta.omrade_type, "dps");
  assert.equal(d01.fakta.kommuner.length, 2);
  assert.equal(d01.fakta.behandlingssted, null);
});

test("fylke unit sums kommune population per aldersgruppe and lists HFs with kommune counts", () => {
  const [f] = buildFylkeUnits(tables());
  assert.equal(f.id, "fylke:56");
  assert.deepEqual(f.fakta.befolkning.alle.map((t) => [t.period, t.value]), [["2024", 31800], ["2025", 32000]]);
  assert.equal(f.fakta.befolkning["0-17"][0].value, 6000);
  assert.equal(f.fakta.pasienter.tidsserie.SOM.pasienter[0].value, 30000);
  assert.deepEqual(f.fakta.helseforetak, [{ id: "helseforetak:983974880", navn: "Finnmarkssykehuset HF", antall_kommuner: 2 }]);
});

test("kommune unit has tilhorighet, population, kapasitet and behov", () => {
  const k = buildKommuneUnits(tables()).find((u) => u.id === "kommune:5603");
  assert.deepEqual(k.parent_ids, ["fylke:56", "opptaksomrade:S01", "opptaksomrade:D01", "helseforetak:983974880"]);
  assert.deepEqual(k.fakta.tilhorighet.hf, { id: "helseforetak:983974880", navn: "Finnmarkssykehuset HF" });
  assert.deepEqual(k.fakta.tilhorighet.helseregion, { id: "helseregion:H05", navn: "Helse Nord" });
  assert.equal(k.fakta.befolkning.alle[1].value, 11000);
  assert.equal(k.fakta.kapasitet.sykehjem_plasser.navn, "Sykehjemsplasser");
  assert.equal(k.fakta.behov.npr_i00_i99_antall.serie[0].value, 410);
  assert.deepEqual(k.sok, ["hammerfest", "5603"]);
});
```

- [ ] **Step 2: Run** – FAIL.

- [ ] **Step 3: Implement geo.mjs**

```js
// scripts/units/geo.mjs
import { nest, unitId, ref, sok, sumRows, groupBy, seriesBlock, patientsBlock } from "./common.mjs";
import { REGION_NAMES } from "../lib/regions.mjs";

const t = (tables, f) => tables[f] ?? [];
const byCol = (rows, col, v) => rows.filter((r) => r[col] === v);
const nameMap = (rows, idCol, nameCol) => new Map(rows.map((r) => [r[idCol], r[nameCol]]));

export function buildOpptaksomradeUnits(tables) {
  const hfName = nameMap(t(tables, "helseforetak.csv"), "hf_id", "hf_navn");
  const population = groupBy(t(tables, "catchment_population.csv"), "omrade_id");
  const catchment = t(tables, "municipality_catchment.csv");
  const sites = t(tables, "sites.csv");
  return t(tables, "opptaksomrader.csv").map((a) => {
    const id = unitId("opptaksomrade", a.omrade_id);
    const col = a.omrade_type === "dps" ? "dps_id" : "lokalsykehus_id";
    const site = sites.find((s) => s.lokalsykehus_id === a.omrade_id);
    return {
      id, navn: a.omrade_navn, type: "opptaksomrade", parent_ids: [unitId("helseforetak", a.hf_id)], sok: sok(a.omrade_navn, a.omrade_id),
      fakta: {
        id, navn: a.omrade_navn, type: "opptaksomrade", omrade_type: a.omrade_type,
        hf: ref("helseforetak", a.hf_id, hfName.get(a.hf_id)),
        befolkning: nest(population.get(a.omrade_id) ?? [], ["tjenesteomrade", "aldersgruppe"]),
        kommuner: byCol(catchment, col, a.omrade_id).map((k) => ({ ...ref("kommune", k.municipality_code, k.municipality_name), quality: k.quality })),
        behandlingssted: site ? ref("behandlingssted", site.site_id, site.site_navn) : null,
      },
    };
  });
}

export function buildFylkeUnits(tables) {
  const hfName = nameMap(t(tables, "helseforetak.csv"), "hf_id", "hf_navn");
  const popBy = groupBy(t(tables, "municipal_population.csv"), "municipality_code");
  const catchBy = groupBy(t(tables, "municipality_catchment.csv"), "municipality_code");
  return [...groupBy(t(tables, "municipalities.csv"), "county_code")].map(([code, list]) => {
    const id = unitId("fylke", code);
    const navn = list[0].county_name;
    const pop = list.flatMap((m) => popBy.get(m.municipality_code) ?? []);
    const hfCount = groupBy(list.flatMap((m) => catchBy.get(m.municipality_code) ?? []), "hf_id");
    return {
      id, navn, type: "fylke", parent_ids: [], sok: sok(navn, code),
      fakta: {
        id, navn, type: "fylke",
        befolkning: nest(sumRows(pop, ["aldersgruppe", "period"]), ["aldersgruppe"]),
        pasienter: patientsBlock(byCol(t(tables, "patients_by_diagnosis.csv"), "region_id", code), byCol(t(tables, "patients_by_diagnosis_detail.csv"), "region_id", code)),
        kommuner: list.map((m) => ref("kommune", m.municipality_code, m.municipality_name)),
        helseforetak: [...hfCount].filter(([hf]) => hf).map(([hf, rows]) => ({ ...ref("helseforetak", hf, hfName.get(hf)), antall_kommuner: rows.length })),
      },
    };
  });
}

export function buildKommuneUnits(tables) {
  const hfName = nameMap(t(tables, "helseforetak.csv"), "hf_id", "hf_navn");
  const areaName = nameMap(t(tables, "opptaksomrader.csv"), "omrade_id", "omrade_navn");
  const catchBy = new Map(t(tables, "municipality_catchment.csv").map((r) => [r.municipality_code, r]));
  const popBy = groupBy(t(tables, "municipal_population.csv"), "municipality_code");
  const capBy = groupBy(t(tables, "municipal_capacity.csv"), "municipality_code");
  const needBy = groupBy(t(tables, "municipal_needs.csv"), "municipality_code");
  return t(tables, "municipalities.csv").map((m) => {
    const code = m.municipality_code;
    const id = unitId("kommune", code);
    const c = catchBy.get(code);
    const parent_ids = [unitId("fylke", m.county_code)];
    if (c) for (const [type, v] of [["opptaksomrade", c.lokalsykehus_id], ["opptaksomrade", c.dps_id], ["helseforetak", c.hf_id]]) if (v) parent_ids.push(unitId(type, v));
    return {
      id, navn: m.municipality_name, type: "kommune", parent_ids, sok: sok(m.municipality_name, code),
      fakta: {
        id, navn: m.municipality_name, type: "kommune",
        fylke: ref("fylke", m.county_code, m.county_name),
        tilhorighet: c ? {
          lokalsykehus: c.lokalsykehus_id ? ref("opptaksomrade", c.lokalsykehus_id, areaName.get(c.lokalsykehus_id)) : null,
          dps: c.dps_id ? ref("opptaksomrade", c.dps_id, areaName.get(c.dps_id)) : null,
          hf: c.hf_id ? ref("helseforetak", c.hf_id, hfName.get(c.hf_id)) : null,
          helseregion: c.helseregion ? ref("helseregion", c.helseregion, REGION_NAMES[c.helseregion]) : null,
          quality: c.quality, note: c.note,
        } : null,
        befolkning: nest(popBy.get(code) ?? [], ["aldersgruppe"]),
        kapasitet: seriesBlock(capBy.get(code) ?? [], "metric", "metric_label"),
        behov: seriesBlock(needBy.get(code) ?? [], "metric", "metric_label"),
      },
    };
  });
}
```

- [ ] **Step 4: Run** – PASS.

- [ ] **Step 5: Failing build test**

```js
// scripts/units/build.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUnits } from "./build.mjs";

const tables = () => ({
  "municipalities.csv": [{ municipality_code: "5603", county_code: "56", municipality_name: "Hammerfest", county_name: "Finnmark" }],
  "helseforetak.csv": [{ hf_id: "983974880", hf_navn: "Finnmarkssykehuset HF", rhf_id: "883658752", helseregion: "H05", type: "hf" }],
  "opptaksomrader.csv": [{ omrade_id: "S01", omrade_navn: "Hammerfest", omrade_type: "lokalsykehus", hf_id: "983974880" }],
  "municipality_catchment.csv": [{ municipality_code: "5603", municipality_name: "Hammerfest", lokalsykehus_id: "S01", dps_id: "", hf_id: "983974880", helseregion: "H05", quality: "ekte", note: "" }],
  "sites.csv": [{ site_id: "hammerfest", site_navn: "Hammerfest sykehus", hf_id: "983974880", municipality_code: "5603", lokalsykehus_id: "S01", lat: "70.67", lon: "23.65", site_type: "sykehus", akuttfunksjon: "ja" }],
});

test("buildUnits returns an index and one file per unit, with resolvable parents", () => {
  const { index, files } = buildUnits(tables(), { today: "2026-09-02" });
  assert.equal(index.generated, "2026-09-02");
  const ids = index.units.map((u) => u.id);
  assert.deepEqual(ids.slice(0, 5), ["land:H00", "helseregion:H03", "helseregion:H04", "helseregion:H05", "helseregion:H12"]);
  assert.ok(ids.includes("kommune:5603") && ids.includes("behandlingssted:hammerfest") && ids.includes("fylke:56") && ids.includes("opptaksomrade:S01"));
  assert.deepEqual(Object.keys(index.units[0]), ["id", "navn", "type", "parent_ids", "sok"]);
  assert.equal(files["kommune/5603.json"].navn, "Hammerfest");
  assert.equal(Object.keys(files).length, ids.length);
});

test("buildUnits throws on a parent that is not a unit", () => {
  const t = tables();
  t["municipality_catchment.csv"][0].hf_id = "999999999";
  assert.throws(() => buildUnits(t, { today: "2026-09-02" }), /ukjent forelder/);
});
```

- [ ] **Step 6: Run** – FAIL.

- [ ] **Step 7: Implement build.mjs, the CLI and .gitattributes**

```js
// scripts/units/build.mjs
import { unitPath } from "./common.mjs";
import { buildRegionUnits, buildHfUnits, buildSiteUnits } from "./hf.mjs";
import { buildOpptaksomradeUnits, buildFylkeUnits, buildKommuneUnits } from "./geo.mjs";

export function buildUnits(tables, { today }) {
  const units = [
    ...buildRegionUnits(tables), ...buildHfUnits(tables), ...buildSiteUnits(tables),
    ...buildOpptaksomradeUnits(tables), ...buildFylkeUnits(tables), ...buildKommuneUnits(tables),
  ];
  const ids = new Set();
  for (const u of units) { if (ids.has(u.id)) throw new Error(`Duplikat enhets-id ${u.id}`); ids.add(u.id); }
  for (const u of units) for (const p of u.parent_ids) if (!ids.has(p)) throw new Error(`${u.id} peker på ukjent forelder ${p}`);
  return {
    index: { generated: today, units: units.map(({ id, navn, type, parent_ids, sok }) => ({ id, navn, type, parent_ids, sok })) },
    files: Object.fromEntries(units.map((u) => [unitPath(u.id), u.fakta])),
  };
}
```

```js
// scripts/build-units.mjs
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { UNITS_DIR } from "./lib/paths.mjs";
import { loadTables } from "./validate.mjs";
import { validateTables } from "./validate/rules.mjs";
import { buildUnits } from "./units/build.mjs";

const tables = await loadTables();
const { errors } = validateTables(tables);
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
```

`.gitattributes` (repo root, new file) so the generated JSON does not flood diffs:

```
apps/web/public/data/units/** -diff linguist-generated=true
```

- [ ] **Step 8: Run tests, then build the real unit files**

Run: `cd /Users/hom/Documents/GitHub/kapasitet && npm test && npm run build:data`
Expected: tests PASS; `Skrev N enheter + index.json …` with N ≈ 1 + 4 + ~30 HF + 15 sites + 117 områder + 15 fylker + 357 kommuner ≈ 540.

Sanity checks:

```bash
cd /Users/hom/Documents/GitHub/kapasitet
ls apps/web/public/data/units/            # land helseregion helseforetak behandlingssted opptaksomrade fylke kommune index.json
du -sh apps/web/public/data/units/        # expect tens of MB – kommune files carry ~40 KOSTRA/FHI series each; fine for static hosting
node -e 'const j=require("./apps/web/public/data/units/helseforetak/983974880.json"); console.log(j.aktivitet.SOM.dognplasser.at(-1), j.behandlingssteder.map(s=>[s.navn, s.senger.somatikk?.value]))'
node -e 'const j=require("./apps/web/public/data/units/kommune/5603.json"); console.log(j.tilhorighet, j.befolkning.alle.at(-1), Object.keys(j.kapasitet).length, Object.keys(j.behov).length)'
node -e 'const j=require("./apps/web/public/data/units/fylke/56.json"); console.log(j.pasienter.periode_siste, Object.keys(j.pasienter.siste_aar.SOM).length, j.befolkning.alle.at(-1))'
(cd apps/web && npm run build)            # static export must still pass and now includes public/data/units
```

The Finnmarkssykehuset line must show `{ value: 134, … period: '2025' }` and the four sites with their curated somatic beds; kommune 5603 must show `hf` Finnmarkssykehuset and non-zero counts for kapasitet/behov; fylke 56 must show ~22 chapters.

- [ ] **Step 9: Commit code + generated JSON, then phase-3 gate**

```bash
cd /Users/hom/Documents/GitHub/kapasitet
git add .gitattributes scripts/units scripts/build-units.mjs apps/web/public/data/units
git commit -m "feat(units): opptaksomrade/fylke/kommune units, buildUnits, CLI and generated fact sheets"
npm test && npm run validate && (cd apps/web && npm run build)
```

### Task 19: Documentation

**Files:**
- Modify: `README.md` (sections "Kom i gang", "Mappestruktur"; add "Datapipeline")
- Modify: `docs/ARCHITECTURE.md` (replace the section "## Data pipeline (national coverage)" and everything below it)
- Create: `docs/SOURCES.md`

**Interfaces:** none (prose). Read `data/sources/manifest.json`, `scripts/validate/rules.mjs` and `scripts/units/*.mjs` first so the docs describe what exists, not the plan.

- [ ] **Step 1: README.md**

Replace "Kom i gang" and "Mappestruktur" with:

```markdown
## Kom i gang

1. Installer Node.js 22+
2. `npm install`
3. `npm test` – enhetstester for pipeline og enhetsmodell
4. `npm run validate` – skjema, kvalitet, brotabell-integritet og sengekontroll på `data/normalized/`
5. `npm run dev` – webappen

## Datapipeline

| Kommando | Gjør | Nettverk |
|---|---|---|
| `npm run fetch [-- --only id1,id2]` | Henter SSB/FHI/KLASS til `data/raw/` (gitignored) og skriver `data/normalized/*.csv` + `data/sources/manifest.json` | ja |
| `npm run validate` | Validerer CSV-ene, exit 1 ved feil | nei |
| `npm run build:data` | Bygger enhetsmodellen `apps/web/public/data/units/` (validerer først) | nei |
| `npm run drift` | Sammenligner tre kjente celler hos SSB med CSV-ene | ja |

Alle tall har `quality` = `ekte` (kilden oppgir tallet), `avledet` (regnet ut av ekte tall etter en oppgitt regel) eller `estimat` (modell/fordeling). Kildene står i `docs/SOURCES.md`; sengetallene for Helse Nord i `docs/senger-helse-nord.md`.

## Mappestruktur

- `apps/web`: webapp (Next.js, statisk eksport til Netlify)
- `apps/web/public/data/units`: generert enhetsmodell (`index.json` + faktaark per enhet) – ikke rediger for hånd
- `data/normalized`: normaliserte CSV-er (generert av `npm run fetch`; `sites.csv`, `hospital_beds.csv` og `municipalities.csv` er kuraterte)
- `data/raw`: rå json-stat fra siste `fetch` (gitignored)
- `data/sources`: `manifest.json` (generert) og `manifest.static.json` (kuraterte kilder)
- `scripts/lib`, `scripts/fetch`, `scripts/validate`, `scripts/units`: pipeline (ren Node, ingen avhengigheter)
- `scripts/*.ps1`, `data/derived`, `capacity.csv`/`needs.csv`: eldre modelldata, fjernes i neste runde
```

- [ ] **Step 2: docs/ARCHITECTURE.md**

Delete from `## Data pipeline (national coverage)` to the end of the file and write a new section `## Datapipeline og enhetsmodell` with: (a) the flow `fetch → data/raw → transform → data/normalized → validate → build:data → apps/web/public/data/units`; (b) one line per fetcher id with its tables (copy from `manifest.json`); (c) the geography chain kommune → lokalsykehusområde (S) / DPS-område (D) → HF → helseregion, with the five split kommuner and the `avledet` rule; (d) the unit id scheme and the Tall shape, with a 15-line example of `kommune/5603.json` trimmed to one entry per block; (e) the validator's rules and what is error vs warning; (f) known limits: no bed table outside Helse Nord, no kjønn in catchment population, 14820 has no diagnosis dimension, KOSTRA suppression, SSB døgnplasser ≠ physical beds.

- [ ] **Step 3: docs/SOURCES.md**

A table generated from `manifest.json` by hand: `id | navn | url | lisens | last_fetched | tables_out`, followed by a "Kuraterte tabeller" paragraph pointing to `docs/senger-helse-nord.md` and `data/sources/manifest.static.json`, and a "Slik oppdaterer du" paragraph (`npm run fetch && npm run validate && npm run build:data`, then commit CSV + units + manifest together).

- [ ] **Step 4: Check and commit**

Run: `cd /Users/hom/Documents/GitHub/kapasitet && npm test && npm run validate && (cd apps/web && npm run build)`
Expected: all green.

```bash
git add README.md docs/ARCHITECTURE.md docs/SOURCES.md
git commit -m "docs: pipeline, unit model and sources"
```

The controller pushes after this commit; that push closes plan 1.
