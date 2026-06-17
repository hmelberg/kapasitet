import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const normalizedDir = path.join(root, "data", "normalized");
const sourcesFile = path.join(root, "data", "sources", "sources.csv");

const requiredHeaders = [
  "dataset_id",
  "source_id",
  "municipality_code",
  "county_code",
  "period",
  "metric",
  "value",
  "unit",
  "last_updated"
];

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { header: [], rows: [] };
  }

  const splitLine = (line) => line.split(",").map((cell) => cell.trim());
  const header = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { header, rows };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateNormalizedFile(filePath) {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const { header, rows } = parseCsv(content);

  assert(header.length > 0, `${fileName}: mangler header`);

  for (const column of requiredHeaders) {
    assert(header.includes(column), `${fileName}: mangler kolonne '${column}'`);
  }

  const seen = new Set();
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  rows.forEach((row, i) => {
    const lineNo = i + 2;
    const get = (key) => row[idx[key]];

    for (const key of requiredHeaders) {
      assert((get(key) || "").length > 0, `${fileName}:${lineNo}: tom verdi i '${key}'`);
    }

    const value = Number(get("value"));
    assert(Number.isFinite(value), `${fileName}:${lineNo}: value er ikke et tall`);

    const municipalityCode = get("municipality_code");
    const countyCode = get("county_code");
    assert(/^\d{4}$/.test(municipalityCode), `${fileName}:${lineNo}: municipality_code ma vaere 4 siffer`);
    assert(/^\d{2}$/.test(countyCode), `${fileName}:${lineNo}: county_code ma vaere 2 siffer`);

    const key = [
      get("dataset_id"),
      get("municipality_code"),
      get("period"),
      get("metric")
    ].join("|");

    assert(!seen.has(key), `${fileName}:${lineNo}: duplikat i dataset/kommune/periode/metric`);
    seen.add(key);
  });
}

function validateSources() {
  assert(fs.existsSync(sourcesFile), "sources.csv finnes ikke");
  const content = fs.readFileSync(sourcesFile, "utf8");
  const { header, rows } = parseCsv(content);

  const required = [
    "source_id",
    "owner",
    "dataset_name",
    "url",
    "license",
    "geo_level",
    "update_frequency",
    "last_updated"
  ];

  for (const col of required) {
    assert(header.includes(col), `sources.csv: mangler kolonne '${col}'`);
  }

  assert(rows.length > 0, "sources.csv: ma inneholde minst en rad");
}

function main() {
  assert(fs.existsSync(normalizedDir), "data/normalized finnes ikke");

  const files = fs
    .readdirSync(normalizedDir)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => path.join(normalizedDir, f));

  assert(files.length > 0, "Ingen CSV-filer i data/normalized");

  files.forEach(validateNormalizedFile);
  validateSources();

  console.log(`CSV-validering OK. Filer kontrollert: ${files.length}`);
}

main();
