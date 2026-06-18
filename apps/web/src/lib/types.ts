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
};
