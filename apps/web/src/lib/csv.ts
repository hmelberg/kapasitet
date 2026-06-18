import fs from "node:fs";
import path from "node:path";
import type { CapacityRow, FacilityRow, MunicipalityRow, NeedRow, SourceRow } from "./types";

function resolveDataDir() {
  const candidates = [
    path.resolve(process.cwd(), "data"),
    path.resolve(process.cwd(), "..", "..", "data")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Fant ikke data-katalog. Forventet data/ i repo-roten.");
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { header: [], rows: [] as string[][] };
  }

  const splitLine = (line: string) => line.split(",").map((cell) => cell.trim());
  const header = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { header, rows };
}

function readCsvFile(relativePath: string) {
  const filePath = path.join(resolveDataDir(), relativePath);
  const content = fs.readFileSync(filePath, "utf8");
  return parseCsv(content);
}

export function loadCapacityRows(): CapacityRow[] {
  const { header, rows } = readCsvFile(path.join("normalized", "capacity.csv"));
  const idx = Object.fromEntries(header.map((name, i) => [name, i]));

  return rows.map((row) => ({
    dataset_id: row[idx.dataset_id],
    source_id: row[idx.source_id],
    sector: row[idx.sector],
    municipality_code: row[idx.municipality_code],
    county_code: row[idx.county_code],
    period: row[idx.period],
    metric: row[idx.metric],
    value: Number(row[idx.value]),
    unit: row[idx.unit],
    last_updated: row[idx.last_updated]
  }));
}

export function loadFacilityRows(): FacilityRow[] {
  const { header, rows } = readCsvFile(path.join("normalized", "facilities.csv"));
  const idx = Object.fromEntries(header.map((name, i) => [name, i]));

  return rows.map((row) => ({
    facility_id: row[idx.facility_id],
    source_id: row[idx.source_id],
    name: row[idx.name],
    facility_type: row[idx.facility_type],
    municipality_code: row[idx.municipality_code],
    county_code: row[idx.county_code],
    lat: Number(row[idx.lat]),
    lon: Number(row[idx.lon]),
    beds: Number(row[idx.beds]),
    last_updated: row[idx.last_updated]
  }));
}

export function loadNeedRows(): NeedRow[] {
  const { header, rows } = readCsvFile(path.join("normalized", "needs.csv"));
  const idx = Object.fromEntries(header.map((name, i) => [name, i]));

  return rows.map((row) => ({
    dataset_id: row[idx.dataset_id],
    source_id: row[idx.source_id],
    category: row[idx.category],
    municipality_code: row[idx.municipality_code],
    county_code: row[idx.county_code],
    period: row[idx.period],
    metric: row[idx.metric],
    value: Number(row[idx.value]),
    unit: row[idx.unit],
    last_updated: row[idx.last_updated]
  }));
}

export function loadMunicipalityRows(): MunicipalityRow[] {
  const { header, rows } = readCsvFile(path.join("normalized", "municipalities.csv"));
  const idx = Object.fromEntries(header.map((name, i) => [name, i]));

  return rows.map((row) => ({
    municipality_code: row[idx.municipality_code],
    county_code: row[idx.county_code],
    municipality_name: row[idx.municipality_name],
    county_name: row[idx.county_name]
  }));
}

export function loadSourceRows(): SourceRow[] {
  const { header, rows } = readCsvFile(path.join("sources", "sources.csv"));
  const idx = Object.fromEntries(header.map((name, i) => [name, i]));

  return rows.map((row) => ({
    source_id: row[idx.source_id],
    owner: row[idx.owner],
    dataset_name: row[idx.dataset_name],
    url: row[idx.url],
    license: row[idx.license],
    geo_level: row[idx.geo_level],
    update_frequency: row[idx.update_frequency],
    last_updated: row[idx.last_updated]
  }));
}