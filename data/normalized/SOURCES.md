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

## Data Quality Notes

- Values are synthetic/estimated for demonstration purposes
- Real data would integrate directly from SSB API, FHI databases, and health directorate systems
- Geographic coordinates validated to Norwegian bounds (57-72°N, 3-32°E)
- All numeric values scaled to realistic population-adjusted ranges

## Future Integration

- [ ] SSB API integration for real-time KOSTRA data
- [ ] FHI disease registry API connections
- [ ] Health directorate facility database direct linking
- [ ] Automated monthly updates from official sources
