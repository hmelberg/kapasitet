# Kilder

Generert fra `data/sources/manifest.json` (skrevet av `npm run fetch`; `last_fetched` er tom for den kuraterte kilden, som ikke hentes over nett).

| id | navn | url | lisens | last_fetched | tables_out |
|---|---|---|---|---|---|
| `curated_helse_nord` | Kuraterte sengetall per behandlingssted i Helse Nord (manuell innsamling fra HF-ene og SSB 13942) | https://www.helse-nord.no | Offentlige kilder, se source_url per rad | – | `sites.csv`, `hospital_beds.csv` |
| `fhi_kommune` | FHI Kommunehelsa: NPR-brukere per diagnosegruppe (nøkkel 699), KPR-brukere 0–74 år (nøkkel 370), mottakere av hjemmetjenester (kpr 634) | https://statistikk.fhi.no/kommunehelsa | CC BY 4.0 | 2026-09-02 | `municipal_needs.csv` |
| `fhi_lmr_825` | FHI Legemiddelregisteret tabell 825 – brukere per ATC-gruppe, hele landet | https://www.fhi.no/he/legemiddelbruk | CC BY 4.0 | 2026-09-02 | `medications.csv` |
| `ssb_07459` | SSB 07459 Befolkning etter kommune, kjønn og ettårig alder | https://www.ssb.no/statbank/table/07459 | NLOD 2.0 | 2026-09-02 | `municipal_population.csv` |
| `ssb_13942` | SSB 13942 Spesialisthelsetjenesten – døgnplasser, aktivitet og belegg etter helseforetak | https://www.ssb.no/statbank/table/13942 | NLOD 2.0 | 2026-09-02 | `hf_activity.csv`, `helseforetak.csv` |
| `ssb_13953` | SSB 13953 Avtalte årsverk i spesialisthelsetjenesten etter helseforetak og yrkesgruppe | https://www.ssb.no/statbank/table/13953 | NLOD 2.0 | 2026-09-02 | `hf_staffing.csv` |
| `ssb_13982` | SSB 13982 Befolkning i opptaksområder for helseforetak, etter tjenesteområde og alder | https://www.ssb.no/statbank/table/13982 | NLOD 2.0 | 2026-09-02 | `catchment_population.csv` |
| `ssb_14080` | SSB 14080 Avtalte legeårsverk i spesialisthelsetjenesten etter helseforetak og spesialitet | https://www.ssb.no/statbank/table/14080 | NLOD 2.0 | 2026-09-02 | `hf_specialists.csv` |
| `ssb_klass_opptak` | SSB KLASS 629 lokalsykehusområder og 632 DPS-områder med korrespondanse til kommune (2688, 2690) | https://www.ssb.no/klass/klassifikasjoner/629 | NLOD 2.0 | 2026-09-02 | `opptaksomrader.csv`, `municipality_catchment.csv` |
| `ssb_kostra` | SSB KOSTRA 11875 (plasser), 12292 (beboere/brukere/årsverk), 12293 (belegg), 11996 (legeårsverk), 14533 (årsverk etter yrke) – kommunale helse- og omsorgstjenester | https://www.ssb.no/statbank/list/helsetjenester-kommuner | NLOD 2.0 | 2026-09-02 | `municipal_capacity.csv` |
| `ssb_pasienter` | SSB 14824 Pasienter i somatisk spesialisthelsetjeneste etter bosted, alder og diagnose + SSB 14820 pasienter i psykisk helsevern for voksne | https://www.ssb.no/statbank/table/14824 | NLOD 2.0 | 2026-09-02 | `patients_by_diagnosis.csv`, `patients_by_diagnosis_detail.csv` |

10 av de 11 radene er hentet av fetchere i `scripts/fetch/` (kjørt via `npm run fetch`); `curated_helse_nord` er manuelt samlet inn og merges inn fra `data/sources/manifest.static.json` (se under). Full spørring per kilde (SSB-utvalg, FHI-nøkler) står i `query`-feltet i `manifest.json` selv – den er for detaljert til å gjengi her.

## Kuraterte tabeller

To tabeller i `data/normalized/` fylles ikke av en fetcher, men er skrevet for hånd og validert mot de hentede tabellene: `sites.csv` (behandlingssteder i Helse Nord, med koordinater og opptaksområde) og `hospital_beds.csv` (sengetall per sted og kategori, med `quality`, kildelenke og sitat per rad). Bakgrunnen for hvert tall – hvorfor noen rader er `ekte` og andre `estimat`, og hvordan estimatformelen virker – står i `docs/senger-helse-nord.md`. Kildemetadata for disse to tabellene ligger i `data/sources/manifest.static.json`, som `npm run fetch` slår sammen med de hentede kildene til `manifest.json`.

## Slik oppdaterer du

```
npm run fetch && npm run validate && npm run build:data
```

Commit CSV-ene i `data/normalized/`, den genererte enhetsmodellen i `apps/web/public/data/units/` og `data/sources/manifest.json` sammen – de tre henger sammen og skal aldri committes hver for seg.
