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
