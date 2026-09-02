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
  prod), passordport (`KAPASITET_PASSWORD`, samme mekanisme som drawcasts
  `netlify/functions/keys.mts` + Blobs-basert feilbudsjett; passord og nøkkel
  kopiert fra drawcast 2026-09-02) og rate-limit. Enhetsmodellen i A er
  designet slik at B kan hente faktaark per navngitt enhet og legge dem i
  kontekst.

## 2. Beslutninger (defaults Hans kan overstyre)

| Tema | Beslutning |
|---|---|
| Modellerte data | **Slettes** (ingen bakoverkompat, ingen brukere). `capacity.csv`, `needs.csv`, `medication_use.csv`, `hospital_unit_beds.csv`, `facilities.csv`-kolonnene `beds`/`capacity_value`/`capacity_unit`, og `.ps1`-scriptene fjernes. |
| Kvalitetsmerking | Tre nivåer på hvert tall: **Ekte** (registerdata som publisert), **Avledet** (regnet ut av ekte tall, f.eks. ledige senger = døgnplasser × (1−belegg)), **Estimat** (fordelingsnøkkel, f.eks. fylkesrate × opptaksbefolkning). Kilde + år vises på hvert tall. |
| Pipeline | Node ≥ 20 ESM i `scripts/`, null avhengigheter utover Node. `npm run fetch` / `validate` / `build:data` / `test` fra rotens `package.json`. |
| Geografi | Fire nivåer for spesialisthelsetjenesten: **behandlingssted → helseforetak → helseregion**, pluss **opptaksområde** (lokalsykehusområde/DPS-område) som kobler kommuner til sykehus. Kommune og fylke beholdes for befolkning og kommunale tjenester. |
| Senger per sykehus | Kuratert tabell `hospital_beds.csv` per behandlingssted med kilde-URL per rad. **Helse Nord først** (Finnmarkssykehuset, UNN, Nordlandssykehuset, Helgelandssykehuset). HF-sum fra SSB 13942 er kontrollsum. |
| Kommune → opptaksområde | **SSB KLASS** er fasit: klassifikasjon 629 (opptaksområder somatikk: RHF → HF → S01–S50 → grunnkrets) og 632 (DPS-områder: RHF → HF → D01–D69 → grunnkrets/kommune), pluss korrespondansetabellene 2688 (somatikk → kommune 2024) og 2690 (DPS → kommune 2024). Kommuner som er delt mellom områder (Oslo, Bergen, Asker, Holmestrand, Lurøy) får hovedområdet (flest grunnkretser) og `quality=avledet` med alle områdene i `note`. Ingen befolkningsmatching, ingen helsefellesskap-liste. |
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
| SSB KOSTRA 11875 | Disponible plasser i institusjon (sykehjem, demens, tidsbegrenset, rehabilitering) | Kommune | 2015– |
| SSB KOSTRA 12292 | Beboere i institusjon (lang-/korttid), brukere av hjemmetjenester, årsverk per bruker, oppholdsdøgn | Kommune | 2015– |
| SSB KOSTRA 12293 | Beleggsprosent i institusjon | Kommune | 2015– |
| SSB KOSTRA 14533 | Årsverk i omsorgstjenestene etter yrke | Kommune | 2015– |
| FHI `nokkel` 699 (NPR_1) og 370 (KPR_1) | Pasienter i spesialist-/primærhelsetjenesten per sykdomsgruppe (antall og rate) | Kommune | siste 3-årssnitt |
| FHI `kpr` 634 | Brukere av hjemmetjenester per tjeneste | Kommune | årlig |
| FHI `lmr` 825 | Legemiddelbrukere (beholdes som i dag) | Land | årlig |
| SSB KLASS 629 / 632 + korrespondansetabeller 2688 / 2690 | Offisielle opptaksområder: RHF → HF → lokalsykehusområde (S01–S50) / DPS-område (D01–D69) → kommune (2024-koder). S-/D-kodene er identiske med 13982s regionkoder. | Kommune | 2025 |
| Kuratert (styresaker, utviklingsplaner, NIPaR-årsrapport, SSB 04434 hist.) | Senger per behandlingssted per kategori | Behandlingssted | per rad |
| Geonorge / OSM | Kommunegrenser, sykehusnavn og koordinater (beholdes) | – | – |

Ikke tilgjengelig som åpne strukturerte data: senger per enkeltsykehus etter
2012. Derfor kuratert tabell med kildehenvisning per rad.

## 4. Datamodell

### 4.1 Normaliserte tabeller (`data/normalized/`, committet)

Alle tabeller har `period`, `value`, `unit`, `source_id` og `quality`
(ekte/avledet/estimat). Summer av ekte tall (aldersgrupper, fylkesbefolkning)
arver den dårligste kvaliteten blant leddene. Kolonnelistene under er
låst i implementeringsplanen (`docs/superpowers/plans/2026-09-02-datagrunnlag-fase-1-3.md`).

- `hf_activity.csv` – 13942: `hf_id` (org.nr for HF/private; `H00` for landet
  og `H03/H04/H05/H12` for regionene), `hf_navn`, `helseregion`,
  `tjenesteomrade`, `metric` (dognplasser, utskrivninger, liggedager,
  polikliniske_konsultasjoner, dagbehandlinger, sengedogn, beleggsprosent,
  beleggsprosent_oecd), `period`, `value`. Erstatter `hf_capacity.csv`.
- `hf_staffing.csv` – 13953: `hf_id`, `hf_navn`, `helseregion`,
  `yrkesgruppe_kode`, `yrkesgruppe`, `metric` (arsverk), `period`, `value`.
- `hf_specialists.csv` – 14080: `hf_id`, `hf_navn`, `helseregion`,
  `spesialitet_kode`, `spesialitet`, `metric`, `period`, `value`.
- `catchment_population.csv` – 13982: `omrade_id`, `omrade_navn`, `omrade_type`
  (lokalsykehus | dps | hf | helseregion | land), `tjenesteomrade`,
  `aldersgruppe` (14824-gruppene 0-17, 18-29, 30-49, 50-66, 67-79, 80-89, 90+
  pluss `alle`), `period`, `value`. Ingen kjønnsdimensjon (begge kjønn
  summert) og ingen `hf_id` – HF-et finnes via `opptaksomrader.csv`. Ettårig
  alder beholdes i `data/raw/` (gitignored), ikke i normalisert.
- `patients_by_diagnosis.csv` – 14824 + 14820: `region_id`, `region_navn`,
  `region_type` (land | fylke | helseregion), `tjenesteomrade` (SOM | VOP),
  `aldersgruppe`, `diagnose_kode` (kapittel; 14820 har ingen
  diagnosedimensjon og får `_T`), `diagnose_navn`, `metric` (pasienter,
  pasienter_dogn, dognopphold, oppholdsdogn for SOM; 14820s fire metrikker
  for VOP), `period`, `value`. 14820 bruker aldersgruppene 18-29, 30-49,
  50-66, 67+; motoren slår sammen 67-79/80-89/90+ ved behov.
  `patients_by_diagnosis_detail.csv` (samme kolonner) har siste år, alle
  aldre samlet, alle 222 diagnoser og alle sju metrikker; den mates inn i
  enhets-JSON for fylker og regioner.
- `helseforetak.csv` – KLASS 629 nivå 1–2 + 13942-navn: `hf_id` (org.nr),
  `hf_navn`, `rhf_id`, `helseregion` (H03/H04/H05/H12), `type` (hf | privat).
  Erstatter `data/reference/helseforetak.csv`.
- `opptaksomrader.csv` – KLASS 629/632 nivå 3: `omrade_id` (S01–S50, D01–D69),
  `omrade_navn`, `omrade_type` (lokalsykehus | dps), `hf_id`.
- `municipality_catchment.csv` – brotabell fra KLASS 2688/2690:
  `municipality_code`, `lokalsykehus_id`, `dps_id`, `hf_id` (HF-et
  lokalsykehusområdet tilhører), `helseregion`, `quality` (ekte når kommunen
  ligger i ett område; avledet når den er delt og hovedområdet er valgt),
  `note` (alle områder med grunnkretsantall for delte kommuner).
- `hospital_beds.csv` – kuratert: `site_id`, `site_navn`, `hf_id`,
  `municipality_code`, `kategori` (somatikk | psykisk_helsevern | tsb |
  intensiv | fode | annet), `senger`, `period`, `quality`, `source_url`,
  `source_note`, `last_verified`.
- `sites.csv` – behandlingssteder: `site_id`, `site_navn`, `hf_id`,
  `municipality_code`, `lokalsykehus_id` (S-kode for sykehus med
  opptaksområde, tom for klinikker/psykiatri), `lat`, `lon`, `site_type`
  (sykehus | dps | klinikk), `akuttfunksjon` (ja/nei/ukjent). Kuratert for
  Helse Nord med koordinater fra OSM-`facilities.csv`; erstatter
  `sykehus_kategori`-logikken.
- `municipal_capacity.csv` – KOSTRA 11875/12292/12293/11996/14533:
  `municipality_code`, `metric`, `metric_label`, `period`, `value`.
- `municipal_needs.csv` – FHI nokkel 699/370 + kpr 634: `municipality_code`,
  `metric`, `metric_label`, `period`, `value`.
- `municipal_population.csv` – 07459 summert til aldersgruppene over pluss
  `alle`: `municipality_code`, `aldersgruppe`, `period`, `value`.
- `municipalities.csv`, `facilities.csv` (uten modellkolonner),
  `medications.csv` (hentes nå av `fhi-lmr.mjs`): beholdes.

### 4.2 Kildemanifest (`data/sources/manifest.json`)

Én post per kilde: `id`, `navn`, `url` (dokumentasjon), `api_url`, `query`
(SSB json-query eller FHI query), `lisens`, `last_fetched`, `tables_out`.
Genereres av `fetch`, som slår sammen forrige manifest, resultatene fra
kjøringen og `manifest.static.json` (kuraterte kilder som `curated_helse_nord`,
med tom `last_fetched`). Kilder-siden genereres fra manifestet. `sources.csv`
slettes.

### 4.3 Enhetsmodell (`apps/web/public/data/units/`, bygget av `build:data`, committet)

`index.json`: `{generated, units: [{id, navn, type, parent_ids[], sok[]}]}`
for typene `land`, `helseregion`, `helseforetak`, `behandlingssted`,
`opptaksomrade`, `fylke`, `kommune`. ID-format `<type>:<kode>` med typenavnet
som prefiks (`helseforetak:983974880`, `behandlingssted:hammerfest`,
`opptaksomrade:S01`, `fylke:56`, `kommune:5601`, `helseregion:H05`,
`land:H00`). Filsti `<type>/<kode>.json` (ingen kolon i filnavn).

`<type>/<kode>.json` = faktaark; gjentar `id, navn, type`. Hvert tall er
`{value, unit, period, quality, source_id}` («Tall»); tidsserier er lister av
Tall sortert på `period`. Innhold etter type:

- **helseforetak**: aktivitet fra 13942 per tjenesteområde × metrikk
  (tidsserie, inkl. døgnplasser og belegg), årsverk per yrkesgruppe,
  legespesialister, opptaksbefolkning per tjenesteområde × aldersgruppe,
  opptaksområder, kommuner, behandlingssteder med senger per kategori.
- **behandlingssted**: senger per kategori (kuratert, siste periode, med
  `source_url`/`source_note`/`last_verified` på tallet), koordinater, HF,
  kommune, akutt, opptaksområdets befolkning hvis lokalsykehusområde er koblet.
- **opptaksomrade**: befolkning per tjenesteområde × aldersgruppe (tidsserie,
  begge kjønn samlet), kommuneliste med kvalitet, HF, tilhørende
  behandlingssted.
- **fylke**: befolkning per aldersgruppe (sum av kommunene), pasienter per
  diagnosekapittel × aldersgruppe (siste år), tidsserie for totaler,
  undergrupper siste år, kommuneliste, HF-er med antall kommuner.
- **kommune**: befolkning per aldersgruppe, fylke,
  HF/lokalsykehus/DPS/helseregion-tilhørighet med kvalitet, kommunale
  kapasitets- og behovsindikatorer (tidsserier).
- **helseregion** og **land**: aktivitet og opptaksbefolkning fra SSBs egne
  region-/landsrader (ikke sum av HF-ene), pasienter per diagnose, HF-liste.

UI-faktaark, scenariomotor og senere LLM-laget leser samme JSON.

## 5. Pipeline (`scripts/`)

```
scripts/
  lib/            paths.mjs, csv.mjs, jsonstat.mjs (json-stat2 → rader), http.mjs
                  (retry), ssb.mjs, fhi.mjs, klass.mjs, age.mjs, regions.mjs,
                  fetcher.mjs (felles kjøring), test-helpers.mjs
  fetch/          klass-catchment.mjs, ssb-13942.mjs, ssb-13953.mjs, ssb-14080.mjs,
                  ssb-13982.mjs, ssb-pasienter.mjs (14824 + 14820), ssb-07459.mjs,
                  ssb-kostra.mjs, fhi-kommune.mjs (nokkel 699/370 + kpr 634),
                  fhi-lmr.mjs, manifest.mjs; index.mjs kjører alle (eller
                  `--only=id,…`) og skriver manifestet
  validate/       schemas.mjs, rules.mjs;  validate.mjs = CLI
  units/          common.mjs (Tall-hjelpere), hf.mjs, geo.mjs, build.mjs;
                  build-units.mjs = CLI
  drift.mjs
  **/*.test.mjs   node --test, ingen nettverk
```

Regler:

- `fetch` skriver rå json-stat til `data/raw/<id>.json` (gitignored) og
  normaliserte CSV-er. Idempotent, ingen nettverk i `build:data`/`validate`.
- `validate` feiler bygget hvis: en kommune mangler HF, en kommune har mer enn
  ett lokalsykehusområde, sum `hospital_beds` somatikk per HF avviker > 15 % fra
  SSB døgnplasser SOM (avvik rapporteres, ikke feiler, for HF uten kuratert
  tabell), `quality` mangler, eller en fremmednøkkel (`hf_id`, `site_id`,
  `municipality_code`, `omrade_id`) ikke finnes. Fire kontrollsummer mot
  13942 (Helse Nord-HF-ene, SOM døgnplasser 2025) er advarsler, siden SSB
  reviderer. `build:data` kjører `validate` først.
- Drift-test (`npm run drift`, manuell): henter tre kjente celler fra SSB og
  sammenligner med normalisert CSV.

### 5.1 Kommune → opptaksområde (KLASS)

`klass-catchment.mjs` henter:

- `classifications/629/codes?from=2025-01-01&to=2025-01-02` – nivå 1 RHF
  (org.nr), nivå 2 HF/private (org.nr, parent = RHF), nivå 3 S-koder (parent =
  HF), nivå 4 grunnkretser (8 siffer, parent = S-kode). Tilsvarende 632 for
  D-koder (nivå 4 er blanding av grunnkretser og hele kommuner).
- `correspondencetables/2688` (S → kommune, 364 rader) og `2690` (D → kommune).

Fem kommuner ligger i flere somatiske områder (0301 Oslo: S34/S35/S36/S49,
4601 Bergen: S16/S17, 3203 Asker: S30/S31, 3903 Holmestrand: S31/S46, 1834
Lurøy: S09/S11). Hovedområde = området med flest grunnkretser i nivå 4;
`quality=avledet`, `note` lister alle. Alle andre kommuner: `quality=ekte`.
Befolkning per område hentes uansett direkte fra 13982 (ekte), så brotabellen
brukes bare til kart og til å summere kommunale tall per område.

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

1. **Pipeline + ekte spesialistdata**: Node-scripts, manifest, KLASS-brotabeller,
   13942/13953/14080/13982/14824/14820/07459, KOSTRA, FHI, validate, tester.
   Nye CSV-er skrives ved siden av de gamle; modelltall, `.ps1` og gamle
   loadere slettes i fase 5 når UI-et byttes (så bygget aldri er rødt).
2. **Senger per sykehus**: `sites.csv`, kuratert `hospital_beds.csv` for
   Helse Nord med kilde-URL per rad, kontrollsum mot 13942.
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

## 11. Overført fra sluttreviewen av fase 1–3 (2026-09-02)

Fase 1–3 er levert (414fa0c). Sluttreviewen fant ingen gale tall; disse
punktene ble bevisst utsatt og skal inn i planen for fase 4–5:

- **Slett pre-pipeline-restene**: `docs/ARCHITECTURE.md` linje 1–112 (gammel
  tekst med oppdiktet historikk), `scripts/*.ps1`, `data/derived/`,
  `capacity.csv`, `needs.csv`, `facilities.csv`, `hf_capacity.csv`,
  `medication_use.csv`, `sources.csv` og de gamle laderne i `apps/web`. De
  fem CSV-ene har `source_id`-er som ikke finnes i manifestet, men leses ikke
  av `loadTables`, så regel 8 ser dem ikke.
- **Droppede celler telles** (`jsonStatToRows` rapporterer antall ikke-finite
  celler per status; `runFetcher` logger «N rader, M celler droppet»), så
  KOSTRA/FHI-undertrykking (12293 45 %, kpr 634 59 %, nokkel 699 36 %) kan
  overvåkes. Aldri fyll inn nuller.
- **Kommuneuniverset** utledes fra KLASS 131 (gyldig per dato) i stedet for
  den frosne `municipalities.csv`; fetcherne logger antall regionkoder de
  dropper. Dekningsregelen (regel 9) finnes allerede.
- **Manifest-hygiene**: `mergeManifest` dropper aldri oppføringer;
  `--manifest-only` skriver ny `generated`-dato selv uten endringer; KLASS-
  datoen er låst til 2025-01-01 i `scripts/lib/klass.mjs`.
- **Skriving**: `fetcher.mjs` skriver tabellene sekvensielt uten tmp+rename;
  `build:data` skriver alle 547 faktaark hver gang (35 MB, `generated` churner).
- **Småting**: `csv.mjs` filtrerer bare rader med én tom celle;
  `medications.csv` mangler `quality`-kolonne; `docs/SOURCES.md` er
  håndskrevet fra manifestet (kan genereres).
- **Sengetabellen**: Mosjøen-estimatet (25) er trolig for høyt etter at
  akuttfunksjonen ble flyttet; Tromsø-estimatet (403) ignorerer
  regionfunksjoner; Alta, Åsgård og Rønvik har ingen sengerader, så «steng
  Alta» viser 0 senger tapt; Hammerfest 89 inkluderer 14 pasienthotell.
  Scenariomotoren må vise `quality` og disse hullene, ikke skjule dem.
- **LLM-laget (spec B)** må få med seg: manglende KOSTRA/FHI-verdi = ukjent,
  manglende aldersgruppe = 0, 8 av 11 somatikk-rader er estimat, og
  `source_id` på hvert Tall peker nå på en manifest-oppføring (regel 8 og
  `model.test.mjs` låser det).
