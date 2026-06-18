export type CapacityRow = {
  dataset_id: string;
  source_id: string;
  sector: string;
  municipality_code: string;
  county_code: string;
  period: string;
  metric: string;
  value: number;
  unit: string;
  last_updated: string;
};

export type SourceRow = {
  source_id: string;
  owner: string;
  dataset_name: string;
  url: string;
  license: string;
  geo_level: string;
  update_frequency: string;
  last_updated: string;
};

export type NeedRow = {
  dataset_id: string;
  source_id: string;
  category: string;
  municipality_code: string;
  county_code: string;
  period: string;
  metric: string;
  value: number;
  unit: string;
  last_updated: string;
};

export type MunicipalityRow = {
  municipality_code: string;
  county_code: string;
  municipality_name: string;
  county_name: string;
};

export type FacilityRow = {
  facility_id: string;
  source_id: string;
  name: string;
  facility_type: string;
  municipality_code: string;
  county_code: string;
  lat: number;
  lon: number;
  beds: number;
  last_updated: string;
  capacity_value: number;
  capacity_unit: string;
  // Specialist-health hierarchy (populated for facility_type "sykehus" only):
  helseregion: string;
  helseforetak: string;
  sykehus_kategori: string;
};

// National, real medication-use figures from FHI Legemiddelregisteret (LMR).
export type MedicationRow = {
  group_code: string;
  group_label: string;
  period: string;
  users: number;
  per_1000: number;
  source_id: string;
  last_updated: string;
};

// Real bed capacity per helseforetak from SSB table 13942.
export type HfCapacityRow = {
  helseforetak: string;
  helseregion: string;
  tjenesteomrade_kode: string;
  tjenesteomrade: string;
  period: string;
  dognplasser: number;
  source_id: string;
  last_updated: string;
};

// Curated department-level bed breakdown for selected hospitals (cited).
export type HospitalUnitBedRow = {
  helseforetak: string;
  hospital_match: string;
  enhet: string;
  sengeplasser: number;
  period: string;
  kilde: string;
  kilde_note: string;
};

// Per-municipality ESTIMATE: national LMR rate x municipality population.
export type MedicationUseRow = {
  dataset_id: string;
  source_id: string;
  group_code: string;
  group_label: string;
  municipality_code: string;
  county_code: string;
  period: string;
  value: number;
  per_1000: number;
  unit: string;
  last_updated: string;
};
