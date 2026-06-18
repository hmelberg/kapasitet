# Data Sources Reference

This document maps dataset identifiers to official Norwegian health and statistics sources.

## Primary Sources

### Statistics Norway (SSB - Statistisk sentralbyrå)
- **ssb_kostra_001**: KOSTRA database - municipality accounting and reporting
  - Metrics: `ansatte_legger_og_sykepleiere` (employed doctors and nurses)
  - Coverage: All Norwegian municipalities, annual reporting
  - URL: https://www.ssb.no/statistikkbanken (Table 08941)
  - Last accessed: 2026-06-01

### Norwegian Institute of Public Health (FHI - Folkehelseinstituttet)
- **fhi_hkr_001**: Disease prevalence registers
  - Metrics: `pasienter_med_hjerte_karsykdom` (heart disease patients), `pasienter_med_kreft` (cancer patients)
  - Coverage: All municipalities, estimated from national disease registries
  - Sources: Norwegian Cancer Registry, Cardiovascular Disease Registry
  - Last accessed: 2026-06-01

- **fhi_kpr_001**: Primary care utilization database
  - Metrics: `mottar_tjeneste_per_dag` (recipients of services per day)
  - Coverage: All municipalities, aggregated from primary care contacts
  - Last accessed: 2026-06-05

- **fhi_lmr_001**: Medication use registers
  - Metrics: `personer_pa_blodtrykksmedisin` (persons on blood pressure medication)
  - Coverage: All municipalities, from national prescription database
  - Last accessed: 2026-06-05

### Health Directorate (Helsedirektoratet)
- **helsedir_reg_001**: Hospital and facility registry
  - Metrics: Facility locations, bed counts, facility types
  - Coverage: All hospitals and major health facilities
  - Last accessed: 2026-06-01

### Primary Care Registry (KPR - Kommunehelsetjeneste)
- **kpr_open_001**: Open data on GPs and health centers
  - Metrics: Clinic locations, operating status
  - Coverage: All registered primary care providers
  - Last accessed: 2026-06-05

### Pharmacy Database (DMP - Legemiddel- og medisinsk forbruksmateriell)
- **dmp_apotek_001**: Pharmacy registry
  - Metrics: Pharmacy locations
  - Coverage: All Norwegian pharmacies
  - Last accessed: 2026-06-05

## Real reference data (national coverage)

These three sources provide the *real* backbone of the dataset and are fetched
live by the scripts in `scripts/`:

### Kartverket / Geonorge
- **geonorge_kommuneinfo_001**: Municipality structure + representasjonspunkt (centroid) + bounding box
  - Coverage: all 357 current municipalities, with county and centroid coordinates
  - API: https://ws.geonorge.no/kommuneinfo/v1 (NLOD)
  - Used by: `scripts/fetch-municipalities.ps1` → `municipalities.csv`, `municipalities.geojson`

### Statistics Norway (SSB)
- **ssb_07459_001**: Population per municipality 2024–2026 (table 07459)
  - Coverage: all current municipalities, real population figures
  - API: https://data.ssb.no/api/v0/no/table/07459 (NLOD)
  - Used by: `scripts/generate-data.ps1` to scale the modelled capacity/need values

### OpenStreetMap (via Overpass)
- **osm_overpass_001**: Hospitals, pharmacies and GP offices
  - `sykehus` ← `amenity=hospital`/`healthcare=hospital`
  - `apotek` ← `amenity=pharmacy`/`healthcare=pharmacy`
  - `legekontor` ← `amenity=doctors`/`healthcare=doctor`/`healthcare=centre`
  - Coverage: ~2 760 facilities with real names and coordinates (ODbL)
  - Used by: `scripts/fetch-facilities-osm.ps1` → `facilities.csv`

## Data Quality Notes

- **Geography and population are REAL** (Geonorge + SSB). **Facility names and
  coordinates are REAL** (OpenStreetMap).
- **Capacity and need values are MODELLED**: real population scaled by ratios
  derived from Oslo reference figures, with a deterministic per-municipality
  variation so the pressure index varies. Absolute numbers are illustrative.
  The dataset/source ids `ssb_kostra_001`, `fhi_kpr_001`, `fhi_hkr_001`,
  `fhi_lmr_001` mark where real registry data would plug in.
- **Facility → municipality assignment is approximate**: each OSM facility is
  assigned to the nearest municipality centroid (preferring bounding-box
  containment). Near municipality borders this can attribute a facility to a
  neighbour, so a few municipalities may show 0 facilities even though OSM has
  some. Upgrading to true polygon point-in-polygon (Kartverket polygons) is the
  planned fix and pairs with the GeoJSON polygon upgrade.
- Geographic coordinates validated to Norwegian mainland bounds (57–72°N,
  3–32°E); Svalbard/Jan Mayen are excluded (outside the municipality structure).
- Run `node scripts/validate-csv.mjs` to verify schema **and** completeness
  (every municipality has rows for every period × indicator).

## Future Integration

- [ ] SSB API integration for real-time KOSTRA data
- [ ] FHI disease registry API connections
- [ ] Health directorate facility database direct linking
- [ ] Automated monthly updates from official sources
