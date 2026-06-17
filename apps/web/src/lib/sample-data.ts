import type { CapacityRow, SourceRow } from "@/lib/types";

export const sampleCapacity: CapacityRow[] = [
  {
    dataset_id: "capacity_workforce",
    source_id: "ssb_kostra_001",
    municipality_code: "0301",
    county_code: "03",
    period: "2026",
    metric: "ansatte_legger_og_sykepleiere",
    value: 18240,
    unit: "personer",
    last_updated: "2026-06-01"
  },
  {
    dataset_id: "capacity_workforce",
    source_id: "ssb_kostra_001",
    municipality_code: "4601",
    county_code: "46",
    period: "2026",
    metric: "ansatte_legger_og_sykepleiere",
    value: 9850,
    unit: "personer",
    last_updated: "2026-06-01"
  },
  {
    dataset_id: "service_volume",
    source_id: "fhi_kpr_001",
    municipality_code: "0301",
    county_code: "03",
    period: "2026",
    metric: "mottar_tjeneste_per_dag",
    value: 61200,
    unit: "personer",
    last_updated: "2026-06-05"
  }
];

export const sampleSources: SourceRow[] = [
  {
    source_id: "ssb_kostra_001",
    owner: "SSB",
    dataset_name: "KOSTRA helse og omsorg",
    url: "https://www.ssb.no/offentlig-sektor/kostra",
    license: "NLOD",
    geo_level: "kommune",
    update_frequency: "arlig",
    last_updated: "2026-06-01"
  },
  {
    source_id: "fhi_kpr_001",
    owner: "FHI",
    dataset_name: "KPR fastlege og kommunale tjenester",
    url: "https://www.fhi.no/helseregistre/kpr",
    license: "Offentlig statistikk",
    geo_level: "kommune",
    update_frequency: "arlig",
    last_updated: "2026-06-05"
  }
];
