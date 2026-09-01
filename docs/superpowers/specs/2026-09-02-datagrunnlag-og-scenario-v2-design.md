# Kapasitet: ekte datagrunnlag, enhetsmodell og scenario v2

Dato: 2026-09-02. Status: godkjent av Hans (chat, «ok» + «go ahead»), skrevet ut som spesifikasjon.

## 1. Formål

Appen skal gi oversikt over **behov, bemanning og kapasitet** i helsesektoren og
raskt svare på «hva om»-spørsmål: hva skjer hvis ett eller flere sykehus, et
helseforetak eller alle sykehus i et fylke må stenge (f.eks. evakuering av
Finnmark) – hvor mange pasienter i ulike kategorier berøres, hvilke senger og
årsverk faller bort, og hvor mye ledig kapasitet finnes hos mottakerne.

Kildegjennomgangen 2026-09-02 viste at alt på Kapasitet-, Behov- og
Scenario-sidene unntatt `hf_capacity.csv` er **modellert** (Oslo-forhold ×
befolkning + støy) og merket med kilde-ID-er som ser ut som registerdata.
Dette prosjektet erstatter modelltallene med ekte, åpne data og bygger
scenariomotoren på dem.

Prosjektet er delt i to spesifikasjoner:

- **A (denne):** datagrunnlag, enhetsmodell, scenario v2, presentasjon.
- **B (senere, egen spec):** «Spør dataene» – LLM-svar over enhetsmodellen via
  Netlify-funksjon med `ANTHROPIC_API_KEY` i miljø (`.env` lokalt, Netlify env i
  prod), passordport og rate-limit. Enhetsmodellen i A er designet slik at B
  kan hente faktaark per navngitt enhet og legge dem i kontekst.

## 2. Beslutninger (defaults Hans kan overstyre)

| Tema | Beslutning |
|---|---|
| Modellerte data | **Slettes** (ingen bakoverkompat, ingen brukere). `capacity.csv`, `needs.csv`, `medication_use.csv`, `hospital_unit_beds.csv`, `facilities.csv`-kolonnene `beds`/`capacity_value`/`capacity_unit`, og `.ps1`-scriptene fjernes. |
| Kvalitetsmerking | Tre nivåer på hvert tall: **Ekte** (registerdata som publisert), **Avledet** (regnet ut av ekte tall, f.eks. ledige senger = døgnplasser × (1−belegg)), **Estimat** (fordelingsnøkkel, f.eks. fylkesrate × opptaksbefolkning). Kilde + år vises på hvert tall. |
| Pipeline | Node ≥ 20 ESM i `scripts/`, null avhengigheter utover Node. `npm run fetch` / `validate` / `build:data` / `test` fra rotens `package.json`. |
| Geografi | Fire nivåer for spesialisthelsetjenesten: **behandlingssted → helseforetak → helseregion**, pluss **opptaksområde** (lokalsykehusområde/DPS-område) som kobler kommuner til sykehus. Kommune og fylke beholdes for befolkning og kommunale tjenester. |
| Senger per sykehus | Kuratert tabell `hospital_beds.csv` per behandlingssted med kilde-URL per rad. **Helse Nord først** (Finnmarkssykehuset, UNN, Nordlandssykehuset, Helgelandssykehuset). HF-sum fra SSB 13942 er kontrollsum. |
| Kommune → opptaksområde | Avledes ved befolkningsmatching (SSB 13982 vs 07459) og verifiseres for Helse Nord mot HF-enes egne kommunelister; HF-nivå fra Helsedirektoratets helsefellesskap-liste. |
| Språk | UI bokmål med æøå. Kode engelsk. Datakolonner norsk snake_case (som i dag). |
| Tilstand | URL-parametre (delbare lenker), ikke localStorage. |
| Tester | `node:test` for pipeline-verktøy, brotabell-integritet, kontrollsummer og scenariomatte. Scenariomotoren er rene funksjoner i `apps/web/src/lib/scenario/` (Node 26 kjører TS med `--experimental-strip-types`). |
| Deploy | Netlify bygger fra GitHub `main`. Push ved hver ferdig fase etter grønn `npm test` + `next build`. |

## 3. Datakilder (alle verifisert mot API 2026-09-02)

| Tabell | Innhold | Nivå | År |
|---|---|---|---|
| SSB 13942 | Døgnplasser, utskrivninger, liggedager, polikliniske konsultasjoner, dagbehandlinger, beleggsprosent, per tjenesteområde (SOM/VOP/BUP/TSB) | HF, region, land | 2015–2025 |
| SSB 13953 | Årsverk etter yrkesgruppe (30) × tjenesteområde | HF | 2015–2025 |
| SSB 14080 | Legespesialister etter spesialitet | HF | 2015–2025 |
| SSB 13982 | Befolkning etter opptaksområde × tjenesteområde (SOM/VOP/BUP/TSB/DPS) × kjønn × ettårig alder | HF + lokalsykehus-/DPS-område (145 koder) | 2015–2026 |
| SSB 14824 | Pasienter, døgnopphold, oppholdsdøgn, polikliniske konsultasjoner i somatikk etter bostedsfylke × alder × ICD-10-kapittel (og undergrupper) | Fylke | 2015–2025 |
| SSB 14820 | Tilsvarende for psykisk helsevern voksne | Fylke | 2015–2025 |
| SSB 07459 | Befolkning etter kommune × kjønn × ettårig alder | Kommune | 1986– |
| SSB KOSTRA 11996 | Legeårsverk (fastlege, legevakt, sykehjem) | Kommune | 2015– |
| SSB KOSTRA 12292 | Plasser i institusjon (sykehjem) | Kommune | 2015– |
| SSB KOSTRA 14533 | Årsverk i omsorgstjenestene etter yrke | Kommune | 2015– |
| FHI `nokkel` NPR_1/NPR_3, KPR_1/KPR_3 | Pasienter i spesialist-/primærhelsetjenesten per sykdomsgruppe | Kommune | siste 3-årssnitt |
| FHI `kpr` 634 | Brukere av hjemmetjenester per tjeneste | Kommune | årlig |
| FHI `lmr` 825 | Legemiddelbrukere (beholdes som i dag) | Land | årlig |
| Helsedirektoratet helsefellesskap | Kommune → HF | Kommune | 2024 |
| Kuratert (styresaker, utviklingsplaner, NIPaR-årsrapport, SSB 04434 hist.) | Senger per behandlingssted per kategori | Behandlingssted | per rad |
| Geonorge / OSM | Kommunegrenser, sykehusnavn og koordinater (beholdes) | – | – |

Ikke tilgjengelig som åpne strukturerte data: senger per enkeltsykehus etter
2012. Derfor kuratert tabell med kildehenvisning per rad.

## 4. Datamodell

### 4.1 Normaliserte tabeller (`data/normalized/`, committet)

Felles kolonner der det gir mening: `period`, `value`, `unit`, `source_id`,
`quality` (ekte/avledet/estimat), `last_updated`.

- `hf_activity.csv` – 13942: `hf_id` (org.nr), `hf_navn`, `helseregion`,
  `tjenesteomrade`, `metric` (dognplasser, utskrivninger, liggedager,
  polikliniske_konsultasjoner, dagbehandlinger, beleggsprosent), `period`,
  `value`. Erstatter `hf_capacity.csv`.
- `hf_staffing.csv` – 13953: `hf_id`, `tjenesteomrade`, `yrkesgruppe`
  (kode + navn), `period`, `value` (årsverk).
- `hf_specialists.csv` – 14080: `hf_id`, `spesialitet`, `period`, `value`.
- `catchment_population.csv` – 13982: `omrade_id`, `omrade_navn`, `omrade_type`
  (hf | lokalsykehus | dps), `hf_id`, `tjenesteomrade`, `kjonn`, `aldersgruppe`
  (SSB 14824-gruppene: 0–17, 18–29, 30–49, 50–66, 67–79, 80–89, 90+), `period`,
  `value`. Ettårig alder beholdes i `data/raw/` (gitignored), ikke i normalisert.
  14820 (VOP) bruker 18–29, 30–49, 50–66, 67+; motoren slår sammen 67–79/80–89/90+
  ved behov.
- `patients_by_diagnosis.csv` – 14824 + 14820: `fylke_id`, `tjenesteomrade`,
  `aldersgruppe`, `diagnose_kode` (kapittel), `diagnose_navn`, `metric`
  (pasienter, dognopphold, oppholdsdogn, polikliniske_konsultasjoner), `period`,
  `value`. Kun kapittelnivå i CSV; undergrupper for siste år legges i
  fylkets enhets-JSON.
- `municipality_catchment.csv` – brotabell: `municipality_code`, `hf_id`,
  `lokalsykehus_id`, `dps_id`, `quality` (ekte for HF via helsefellesskap,
  avledet for lokalsykehus/DPS via befolkningsmatching), `verified` (ja/nei),
  `note`.
- `hospital_beds.csv` – kuratert: `site_id`, `site_navn`, `hf_id`,
  `municipality_code`, `kategori` (somatikk | psykisk_helsevern | tsb |
  intensiv | fode | annet), `senger`, `period`, `quality`, `source_url`,
  `source_note`, `last_verified`.
- `sites.csv` – behandlingssteder: `site_id`, `site_navn`, `hf_id`,
  `municipality_code`, `lat`, `lon`, `site_type` (sykehus | dps | klinikk),
  `akuttfunksjon` (ja/nei/ukjent). Bygges fra OSM-`facilities.csv` + manuell
  kobling til HF; erstatter `sykehus_kategori`-logikken.
- `municipal_capacity.csv` – KOSTRA 11996/12292/14533: `municipality_code`,
  `metric`, `period`, `value`.
- `municipal_needs.csv` – FHI nokkel + kpr 634: `municipality_code`, `metric`,
  `period`, `value`.
- `municipalities.csv`, `facilities.csv` (uten modellkolonner),
  `medications.csv`: beholdes.

### 4.2 Kildemanifest (`data/sources/manifest.json`)

Én post per kilde: `id`, `navn`, `url` (dokumentasjon), `api_url`, `query`
(SSB json-query eller FHI query), `lisens`, `last_fetched`, `tables_out`.
Kilder-siden genereres fra manifestet. `sources.csv` slettes.

### 4.3 Enhetsmodell (`apps/web/public/data/units/`, bygget av `build:data`, committet)

`index.json`: liste av `{id, navn, type, parent_ids[], sok[]}` for typene
`kommune`, `fylke`, `opptaksomrade`, `helseforetak`, `behandlingssted`,
`helseregion`. ID-format `type:kode` (f.eks. `hf:983974880`, `kommune:5601`,
`site:hammerfest`).

`<type>/<id>.json` = faktaark. Hvert tall er `{value, unit, period, quality,
source_id}`. Innhold etter type:

- **helseforetak**: senger per tjenesteområde (tidsserie), belegg, aktivitet,
  årsverk per yrkesgruppe, legespesialister, opptaksbefolkning per
  aldersgruppe, liste over behandlingssteder med senger per kategori.
- **behandlingssted**: senger per kategori (kuratert), koordinater, HF, akutt,
  opptaksområde-befolkning hvis lokalsykehusområde er koblet.
- **opptaksomrade**: befolkning per aldersgruppe × kjønn (tidsserie),
  kommuneliste, HF, tilhørende behandlingssted.
- **fylke**: befolkning, pasienter/døgnopphold/oppholdsdøgn per diagnosekapittel
  × aldersgruppe (siste år), tidsserie for totaler, undergrupper siste år.
- **kommune**: befolkning per aldersgruppe, HF/lokalsykehus/DPS-tilhørighet,
  kommunale kapasitets- og behovsindikatorer.
- **helseregion**: aggregat av HF-ene.

UI-faktaark, scenariomotor og senere LLM-laget leser samme JSON.

## 5. Pipeline (`scripts/`)

```
scripts/
  lib/            ssb.mjs (json-stat2 → rader), fhi.mjs, csv.mjs, geo.mjs
  fetch/          en fil per kilde: ssb-13942.mjs, ssb-13953.mjs, ssb-14080.mjs,
                  ssb-13982.mjs, ssb-14824.mjs, ssb-14820.mjs, ssb-07459.mjs,
                  ssb-kostra.mjs, fhi-nokkel.mjs, fhi-kpr.mjs, fhi-lmr.mjs,
                  helsedir-helsefellesskap.mjs (kuratert JSON i repo med URL)
  derive/         catchment-map.mjs (befolkningsmatching), sites.mjs
  build-units.mjs
  validate.mjs    skjema per tabell + kontrollsummer + brotabell-integritet
  *.test.mjs
```

Regler:

- `fetch` skriver rå json-stat til `data/raw/<id>.json` (gitignored) og
  normaliserte CSV-er. Idempotent, ingen nettverk i `build:data`/`validate`.
- `validate` feiler bygget hvis: en kommune mangler HF, en kommune har mer enn
  ett lokalsykehusområde, sum `hospital_beds` somatikk per HF avviker > 15 % fra
  SSB døgnplasser SOM (avvik rapporteres, ikke feiler, for HF uten kuratert
  tabell), eller `quality` mangler.
- Drift-test (`npm run drift`, manuell): henter tre kjente celler fra SSB og
  sammenligner med normalisert CSV.

### 5.1 Befolkningsmatching (kommune → lokalsykehusområde)

For hvert HF: kommunelisten fra helsefellesskap; for hvert lokalsykehus-/
DPS-område i 13982: finn delmengden av HF-ets kommuner der befolkningssummen
matcher 13982 eksakt for alle år 2020–2025 og begge kjønn (07459). Søket er
backtracking over ≤ 40 kommuner per HF; en løsning som matcher 12 uavhengige
summer regnes som entydig. Uløste områder (Oslo bydeler, kommuner delt mellom
områder) får `lokalsykehus_id` tom og `note` med årsak. Helse Nord verifiseres
manuelt mot HF-enes kommunelister og markeres `verified=ja`.

## 6. Scenariomotor v2 (`apps/web/src/lib/scenario/`)

Rene funksjoner, ingen React. Inndata:

```ts
type Closure = {
  units: UnitId[];                       // site:, hf:, fylke:, region:
  tjenesteomrade: "SOM" | "VOP" | "BUP" | "TSB" | "ALLE";
  period: number;                        // dataår
  params: Partial<Assumptions>;          // overstyringer
};
```

`Assumptions` (alle med kilde og default fra data, redigerbare i UI):
`beleggsgrense` (default 85 % – vanlig planleggingsnorm for sykehussenger,
Bagust m.fl., BMJ 1999), `fyllRekkefolge` (nærmeste først), `siteAndelAvHF`
(default = sitens somatiske senger / HF-ets døgnplasser SOM). Pasienttall
hentes for «alle aktører» (offentlige HF + private) i 14824/14820.

Utdata (`ScenarioResult`), hver seksjon med `quality`:

1. **Befolkning berørt**: kommuner i de stengte enhetenes opptaksområder,
   summert per aldersgruppe (13982 via brotabell). Ekte.
2. **Pasienter berørt per år**: pasienter, døgnopphold, oppholdsdøgn per
   ICD-kapittel × aldersgruppe. Fylke: direkte fra 14824/14820 (Ekte).
   HF/opptaksområde/site: fylkesrate per aldersgruppe × berørt befolkning per
   aldersgruppe (Estimat). Oppholdsdøgn/365 = belagte senger per dag som må
   flyttes.
3. **Bortfall**: senger per kategori (site: kuratert Ekte; HF: SSB Ekte),
   årsverk per yrkesgruppe og legespesialister (HF: Ekte; site: HF ×
   siteAndelAvHF, Estimat).
4. **Mottak**: kandidat-HF sortert etter avstand (sentroide fra sites/HF-hovedsete),
   `ledige_senger = døgnplasser × (1 − belegg/100)` (Avledet), fyll i rekkefølge
   til `beleggsgrense`; vis belegg før/etter og hvor mange belagte senger som
   ikke får plass innenfor grensen.
5. **Antakelser**: liste over alle parametere med verdi, kilde og om de er
   overstyrt.

Eksport: JSON + CSV. Tilstand i URL: `?steng=hf:983974880,site:kirkenes&omr=SOM&aar=2025&belegg=85`.

Tester: kjent Finnmark-case (Finnmarkssykehuset HF, SOM, 2025) skal gi
befolkning = 13982 D-områdene for Finnmark, pasienter = 14824 Finnmark-total
(34 956 i 2025), bortfall senger = 134, mottak UNN ledige = 593 × (1−0,74).

## 7. Presentasjon og organisering (`apps/web`)

Navigasjon (spørsmålsbasert):

| Rute | Tittel | Innhold |
|---|---|---|
| `/` | Oversikt | Nøkkeltall land/region, pressindikatorer per valgt nivå, kart |
| `/kapasitet` | Hva har vi? | Senger per tjenesteområde, belegg, årsverk per yrke, legespesialister; senger per sykehus (kuratert); tidsserier 2015–2025 |
| `/behov` | Hvem trenger? | Opptaksbefolkning per alder, pasienter per diagnosekapittel per fylke, kommunale behovsindikatorer, legemidler (seksjon) |
| `/scenarier` | Hva om? | Scenario v2 |
| `/enheter` | Enheter | Søk i `index.json`, faktaark for valgt enhet (`?id=`) |
| `/kilder` | Kilder | Generert fra manifest + kvalitetslegende |

Felles:

- **Global verktøylinje** i layout: nivå (kommune / opptaksområde / HF / fylke /
  region), år, tjenesteområde. Alt i URL.
- **`<Tall>`-komponent**: verdi + enhet + kvalitetsmerke (Ekte/Avledet/Estimat,
  farge + tekst) + tooltip med kilde og år. Alle tall i appen går gjennom den.
- **Pressindikatorer** definert eksplisitt i `lib/indicators.ts`: belegg,
  døgnplasser per 1 000 i opptaksområdet, årsverk per 1 000, andel 80+.
- **Kart**: kommuner farget etter opptaksområde (ingen dissolve), sykehuspunkter
  skalert etter senger; i scenario skraveres stengte områder og linjer tegnes
  til mottakende HF med avstand.
- **Legemidler-siden** fjernes som egen rute; innholdet blir en seksjon under
  Behov.
- Alle UI-strenger med æøå. Store komponenter (`capacity-view.tsx` 637 linjer)
  deles etter seksjon.

Data-lasting: små tabeller leses ved byggetid som i dag (`lib/csv.ts`);
enhets-JSON hentes klientside fra `/data/units/`.

## 8. Feilhåndtering

- Pipeline: nettverksfeil → tydelig melding med kilde-ID, avbryt uten å
  skrive delvis CSV. Skjemaendring hos SSB (ukjent kode) → feil, ikke stille
  hopp.
- UI: manglende enhets-JSON → «Ingen data for denne enheten», aldri tomme
  nuller. Scenario uten brotabell-treff → seksjonen merkes «kan ikke beregnes»
  med årsak.

## 9. Faser

1. **Pipeline + ekte spesialistdata**: Node-scripts, manifest, 13942/13953/
   14080/13982/14824/14820/07459, validate, tester. Slett modelltall og .ps1.
2. **Brotabeller + senger per sykehus**: helsefellesskap, befolkningsmatching,
   `sites.csv`, kuratert `hospital_beds.csv` for Helse Nord.
3. **Enhetsmodell**: `build-units.mjs`, `index.json`, faktaark-JSON.
4. **Scenario v2**: motor + tester + UI + URL-tilstand.
5. **Presentasjon**: ny navigasjon, verktøylinje, `<Tall>`, kart, faktaark-side,
   Kilder fra manifest, kommunale data (KOSTRA + FHI) inn i Kapasitet/Behov.
6. **Spør dataene** (spec B, senere).

Hver fase avsluttes med grønn `npm test`, `next build`, commit og push.

## 10. Ikke i scope

Sengetabell utenfor Helse Nord (kan legges til rad for rad senere),
Oslo-bydeler i brotabellen, dissolve av opptaksområde-polygoner, historikk
per bruker, autentisering av selve appen.
