# Architecture: Timeseries & Municipality Boundaries

## Timeseries Support

The current system supports time-series analysis through the `period` field in all data files.

### Data Structure
- **CSV Format**: Each metric includes a `period` column (e.g., "2026", "2025")
- **Multiple Periods**: Same municipality/metric can appear in multiple rows with different periods
- **Period Filtering**: UI includes period dropdown to filter by year

### Example
```
dataset_id,source_id,sector,municipality_code,county_code,period,metric,value
capacity_workforce,ssb_kostra_001,sykehus,0301,03,2026,ansatte_legger_og_sykepleiere,12240
capacity_workforce,ssb_kostra_001,sykehus,0301,03,2025,ansatte_legger_og_sykepleiere,12100
```

### Future Enhancement
To add historical data:
1. Duplicate all rows in capacity.csv, needs.csv for previous years
2. Change `period` field to earlier years (e.g., 2024, 2023)
3. Adjust values to reflect historical trends
4. UI automatically includes new periods in period dropdown

### Time-Range Analysis
- Filter by period to show specific years
- Compare periods by selecting different values
- Compute trends (growth/decline) by comparing capacity/needs across periods

## GeoJSON Municipality Boundaries

### File Structure
Location: `/data/boundaries/municipalities.geojson`

### Format
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "municipality_code": "0301",
        "municipality_name": "Oslo",
        "county_code": "03",
        "county_name": "Oslo"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...], [...], ...]]
      }
    }
  ]
}
```

### Data Sources
- **Primary**: Kartverket (Norwegian Mapping Authority)
  - URL: https://ws.geonorge.no/kommuneinfo/v1/communes
  - Format: Simplified geometries for performance
  - Update frequency: Annually with municipal boundary changes

### Integration with Leaflet
The `FacilityLeafletMap` component currently renders:
- **Circle markers** for municipalities (pressure-based colors)
- **CircleMarker** for institutions (type-based colors)

Future: Add GeoJSON layer for actual municipal boundaries:
```tsx
import { GeoJSON } from 'react-leaflet';

<GeoJSON
  data={municipalitiesGeojson}
  style={(feature) => ({
    fillColor: getPressureColor(pressureMap[feature.properties.municipality_code]),
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.2
  })}
/>
```

### Performance Considerations
- Simplified geometries reduce file size (simplification tolerance: 20m)
- Lazy loading: Only render visible boundaries
- Vector tiles alternative: Consider Mapbox for better performance at scale

### County-Level Boundaries
Add similar structure for fylke (county) boundaries:
- File: `/data/boundaries/counties.geojson`
- Useful for regional analysis and comparisons
- Data source: Same Kartverket API with county geometry

## Implementation Roadmap

### Phase 1 (Current)
✅ Period filtering UI
✅ Multi-municipality data structure
✅ Add 2025, 2024 data to CSVs (all 357 municipalities × 2024–2026)

### Phase 2 (Next)
✅ Integrate GeoJSON layer in Leaflet map
- [ ] Download **polygon** GeoJSON from Kartverket (currently centroid points)
- [ ] Style boundaries by selected metric (pressure shown via Circle overlays today)

### Phase 3 (Advanced)
✅ Time-series charts (pressure over years) — `timeseries-comparison.tsx`
- [ ] Trend analysis (growth/decline)
- [ ] Forecasting (simple linear regression)
- [ ] County vs municipality comparison views

## Datapipeline og enhetsmodell

Dette avsnittet beskriver koden i `scripts/fetch`, `scripts/validate` og `scripts/units` slik den faktisk er, ikke en plan. Den erstattet den PowerShell-baserte modellerte pipelinen som var beskrevet her tidligere.

### (a) Flyten

```
npm run fetch                npm run validate            npm run build:data
   │                              │                            │
   ▼                              ▼                            ▼
fetchRaw() → data/raw/<id>.json → transform() → data/normalized/*.csv → validateTables() → buildUnits() → apps/web/public/data/units/**/*.json + index.json
```

Hver fetcher i `scripts/fetch/*.mjs` er et objekt `{ meta, fetchRaw(deps), transform(raw) → {fil: rader}, columns: {fil: [...]} }` kjørt av `scripts/lib/fetcher.mjs`: `fetchRaw` henter fra API-et og lagrer den rå responsen som `data/raw/<fetcher-id>.json` (gitignored), `transform` gjør den om til rader, og resultatet skrives til `data/normalized/<fil>.csv` med de deklarerte kolonnene. `npm run fetch` kjører alle fetcherne i `ALL_FETCHERS` (`scripts/fetch/index.mjs`) – eller et utvalg med `--only id1,id2` – og oppdaterer til slutt `data/sources/manifest.json`.

`npm run validate` (`scripts/validate.mjs` → `scripts/validate/rules.mjs`) leser alle CSV-ene i `data/normalized/` og kjører reglene i (e). `npm run build:data` (`scripts/build-units.mjs`) validerer på nytt – og stopper med exit 1 uten å skrive noe dersom det er feil – før den kaller `buildUnits()` i `scripts/units/build.mjs` og skriver enhetstreet.

### (b) Kildene (`data/sources/manifest.json`)

10 av kildene hentes av en fetcher via `npm run fetch`; én (`curated_helse_nord`) er kuratert for hånd og merges inn fra `data/sources/manifest.static.json`. I tillegg står 10 **sub-kilder** i manifestet: de fem KOSTRA-tabellene, de tre FHI-tabellene og SSB 14824/14820, altså de tabellene fetcherne stempler som `source_id` på radene. De deklareres som `meta.sub_sources` på fetcheren, utledes fra den samme tabell-lista fetcheren spør med, arver `lisens`/`last_fetched` fra fetcheren og får et `parent`-felt. Uten dem ville tre firedeler av tallene i modellen hatt en `source_id` uten manifestoppføring; validatorregelen i (e) sørger for at det ikke skjer igjen. Full tabell med url/lisens/last_fetched/tables_out står i `docs/SOURCES.md`; her er fetcher-id → tabeller:

- `klass-catchment.mjs` (`ssb_klass_opptak`, SSB KLASS 629/632 + korrespondanse 2688/2690) → `opptaksomrader.csv`, `municipality_catchment.csv`
- `ssb-13942.mjs` (SSB 13942, døgnplasser/aktivitet/belegg per HF) → `hf_activity.csv`, `helseforetak.csv`
- `ssb-13953.mjs` (SSB 13953, årsverk per HF/yrkesgruppe) → `hf_staffing.csv`
- `ssb-14080.mjs` (SSB 14080, legeårsverk per HF/spesialitet) → `hf_specialists.csv`
- `ssb-13982.mjs` (SSB 13982, opptaksbefolkning per HF-tjenesteområde/alder) → `catchment_population.csv`
- `ssb-pasienter.mjs` (SSB 14824 + 14820, pasienter etter bosted/alder/diagnose) → `patients_by_diagnosis.csv`, `patients_by_diagnosis_detail.csv`
- `ssb-07459.mjs` (SSB 07459, befolkning per kommune/kjønn/alder) → `municipal_population.csv`
- `ssb-kostra.mjs` (KOSTRA 11875/12292/12293/11996/14533, kommunale helse- og omsorgstjenester) → `municipal_capacity.csv`
- `fhi-kommune.mjs` (FHI Kommunehelsa, nøkkel 699/370/634) → `municipal_needs.csv`
- `fhi-lmr.mjs` (FHI Legemiddelregisteret tabell 825) → `medications.csv`

I tillegg er `sites.csv` og `municipalities.csv` kuraterte tabeller uten egen fetcher (se `CURATED` i `scripts/validate/schemas.mjs`).

### (c) Geografikjeden

`kommune → lokalsykehusområde (S, KLASS 629) / DPS-område (D, KLASS 632) → helseforetak → helseregion`, bygget av `scripts/fetch/klass-catchment.mjs` og lagt i `municipality_catchment.csv`. KLASS-korrespondansetabellene 2688 og 2690 knytter grunnkretser (eller hele kommuner, kode 4 siffer) til område-koder; `hf_id` for en kommune er alltid HF-eieren av kommunens lokalsykehusområde (`sAreas[s.id].parentCode`), og `helseregion` slås opp via HF-ets eier-RHF (`RHF_TO_REGION`, med `PRIVATE_RHF` som reserve for HF-er uten egen forelder i KLASS 629, f.eks. fusjonerte/private/støtte-HF-er).

Når en kommunes grunnkretser er delt mellom flere områder, velger `pickArea()` området med størst befolkningsvekt (`WHOLE_KOMMUNE_WEIGHT = 10 000` for en hel-kommune-kode, 1 per grunnkrets) og skriver fordelingen i `note`; kommunen får `quality: "avledet"` i stedet for `"ekte"`. 9 kommuner er `avledet` i dagens data, hvorav 5 har et delt **lokalsykehusområde** (det som avgjør `hf_id`): Oslo (0301, delt mellom Oslo universitetssykehus/Lovisenberg/Diakonhjemmet/Akershus), Lurøy (1834, Sandnessjøen/Mo i Rana), Asker (3203, Bærum/Drammen), Holmestrand (3903, Vestfold/Drammen) og Bergen (4601, Haukeland/Haraldsplass). De fire øvrige (Stavanger, Kristiansand, Trondheim, Levanger) har bare et delt **DPS-område** og er dermed `avledet` uten at `hf_id` er usikkert.

### (d) Enhets-id og Tall-formen

Enhets-id er `type:kode` (`unitId`/`unitPath` i `scripts/units/common.mjs`), og filstien under `apps/web/public/data/units/` er `type/kode.json` – f.eks. `kommune:5603` → `kommune/5603.json`, `helseforetak:983974880` (org.nr) → `helseforetak/983974880.json`, `opptaksomrade:S01`/`D02` (KLASS-kode), `helseregion:H05`, `land:H00`, `fylke:56` (fylkesnummer), `behandlingssted:hammerfest` (site_id). `index.json` lister `{id, navn, type, parent_ids, sok}` for alle 541 enheter (357 kommuner, 117 opptaksområder, 32 helseforetak, 15 behandlingssteder, 15 fylker, 4 helseregioner, 1 land); hver enhet har i tillegg et faktaark på `type/kode.json` med det fulle innholdet.

Hvert tall i faktaarket er et `Tall`: `{ value, unit, period, quality, source_id }`, bygget av `tall(r)` i `scripts/units/common.mjs` fra én rad i en normalisert CSV-tabell. Under er `apps/web/public/data/units/kommune/5603.json` (Hammerfest) trimmet til én oppføring per blokk – i den ekte fila er `befolkning` 8 aldersgrupper × årganger, `kapasitet` ~27 KOSTRA-serier og `behov` ~24 FHI-serier:

```json
{
  "id": "kommune:5603",
  "navn": "Hammerfest",
  "type": "kommune",
  "fylke": { "id": "fylke:56", "navn": "Finnmark" },
  "tilhorighet": {
    "lokalsykehus": { "id": "opptaksomrade:S01", "navn": "Hammerfest" },
    "dps": { "id": "opptaksomrade:D02", "navn": "Vest-Finnmark" },
    "hf": { "id": "helseforetak:983974880", "navn": "Finnmarkssykehuset HF" },
    "helseregion": { "id": "helseregion:H05", "navn": "Helse Nord" },
    "quality": "ekte", "note": ""
  },
  "befolkning": { "alle": [{ "value": 11391, "unit": "personer", "period": "2026", "quality": "ekte", "source_id": "ssb_07459" }] },
  "kapasitet": { "inst_plasser": { "navn": "Institusjon - alle disponible plasser (antall)", "serie": [{ "value": 138, "unit": "plasser", "period": "2025", "quality": "ekte", "source_id": "ssb_11875" }] } },
  "behov": { "npr_i00_i99_antall": { "navn": "Hjerte og karsykdom (I00-I99) – antall", "serie": [{ "value": 209, "unit": "personer", "period": "2024", "quality": "ekte", "source_id": "fhi_nokkel_699" }] } }
}
```

### (e) Validatoren (`scripts/validate/rules.mjs`)

`validateTables()` returnerer `{errors, warnings, info}`; `npm run validate` og `npm run build:data` avbryter (exit 1 / ingen skriving) bare på `errors`.

**Feil (errors):**
- en påkrevd tabell mangler, eller kolonnene i en tabell stemmer ikke med skjemaet
- en rad har ugyldig `quality` (må være `ekte`/`avledet`/`estimat`), et ikke-numerisk `value`/`senger`, eller en `period` som ikke er et 4-sifret årstall
- en kommune mangler i `municipality_catchment.csv`, har mer enn én lokalsykehus-rad, mangler/har ukjent `hf_id`, eller peker på en `lokalsykehus_id` som ikke finnes i `opptaksomrader.csv`
- en ukjent `hf_id` i `opptaksomrader.csv`/`sites.csv`/`hospital_beds.csv`, en ukjent `municipality_code` i en `municipal_*`-tabell/`sites.csv`/`hospital_beds.csv`, en ukjent `site_id` i `hospital_beds.csv`, eller et opptaksområde i siste periode av `catchment_population.csv` som ikke finnes i `opptaksomrader.csv`
- kuratert somatikk-sengesum for et HF avviker fra SSB 13942 med mer enn `BED_TOLERANCE = 0.15` (15 %)
- en `source_id` i en tabell finnes ikke i `data/sources/manifest.json` (hoppes over dersom manifestet ikke er lest inn, f.eks. i enhetstester)

**Advarsler (warnings):**
- en valgfri/ikke-kuratert tabell mangler
- en kommune mangler DPS-område
- et HF med kuraterte sengerader har ingen SOM-døgnplasser å kontrollere mot i `hf_activity.csv`
- en av de fire kontrollsummene (Finnmarkssykehuset 134, UNN 593, Nordlandssykehuset 295, Helgelandssykehuset 121 – SOM døgnplasser 2025) stemmer ikke lenger (SSB kan ha revidert tallet)

**Info:** avvikslinjen for hvert HF som er innenfor 15 %-toleransen, og én linje per HF uten noen kuratert sengetabell i det hele tatt.

### (f) Kjente begrensninger

- `hospital_beds.csv` har bare rader for de fire HF-ene i Helse Nord – ingen andre HF har en sengetabell.
- `catchment_population.csv` (SSB 13982) er hentet med `Kjonn=0`, altså uten kjønnsfordeling.
- SSB 14820 (psykisk helsevern for voksne, VOP) har ingen diagnosedimensjon; alle VOP-rader i `patients_by_diagnosis.csv` får `diagnose_kode="_T"`, i motsetning til SOM-radene (14824) som er brutt ned på ICD-10-kapittel.
- KOSTRA-tabellene prikkes av SSB for små kommuner; `jsonStatToRows()` dropper stille alle ikke-numeriske celler, så en manglende kommune/metrikk/periode-kombinasjon i `municipal_capacity.csv` er ikke flagget noe sted – den er bare fraværende.
- SSB 13942 sine døgnplasser og de kuraterte fysiske sengetallene måler ikke det samme (driftstall vs. bygningsmasse); `docs/senger-helse-nord.md` forklarer forskjellen og hvorfor et avvik innenfor 15 % er forventet, ikke en feil.
- 8 av de 11 obligatoriske `somatikk`-radene i `hospital_beds.csv` er `estimat`: kirkenes, harstad, tromso, bodo, lofoten, mo-i-rana, mosjoen og sandnessjoen, fordelt fra HF-ets SSB-døgnplasser proporsjonalt med opptaksbefolkningen til stedet (formel og kildesøk i `docs/senger-helse-nord.md`). Mosjøens estimat er trolig for høyt – stedet har siden mistet sin akuttfunksjon til Sandnessjøen/Mo i Rana. UNN Tromsøs 403 er også et estimat, og formelen ser bort fra at Tromsø har regionfunksjoner som trekker det reelle tallet oppover. Klinikk Alta, UNN Åsgård og Nordlandssykehuset Rønvik har ingen sengerad i det hele tatt.
