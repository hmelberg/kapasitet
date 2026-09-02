# Senger per behandlingssted, Helse Nord

Kuratert fra `data/normalized/sites.csv` og `data/normalized/hospital_beds.csv`. Tallene er hentet per sted, ikke bare per helseforetak (HF), slik at man kan regne på hva som skjer med kapasiteten dersom ett enkelt sykehus – eller alle sykehusene i ett fylke, f.eks. Finnmark – stenger eller evakueres.

## To ulike telletradisjoner

Denne tabellen blander to kilder som ikke teller likt, og avvik mellom dem er forventet:

- **SSB-tabell 13942** (`data/normalized/hf_activity.csv`, `metric=dognplasser`) teller **gjennomsnittlig tilgjengelige døgnplasser over året**, rapportert på HF-nivå. Det er et driftstall: senger tas ut av drift ved bemanningsmangel, ombygging osv., så tallet svinger år for år og ligger ofte lavere enn det fysiske sengetallet.
- **Sykehusenes egne sider / sykehusbygg.no** (kolonnene under) teller stort sett **fysiske senger** – sengerom bygget inn i bygningsmassen, slik de er beskrevet i byggeprosjekter, "sengeområde"-sider eller avdelingssider. Dette tallet endrer seg sjelden, og er upåvirket av kortsiktig bemanningssituasjon.

`npm run validate` sammenligner summen av kuraterte `somatikk`-rader per HF (fysiske senger, nyeste periode) mot SSB 13942 (drift, 2025) med 15 %-toleranse. Et avvik i det intervallet er forventet – ikke en feil i dataene – fordi de to kildene måler forskjellige ting. Se avvikstall i tabellen nedenfor.

## Senger per behandlingssted

| site_id | Sted | HF | Kategori | Senger | Periode | Kvalitet | Kilde |
|---|---|---|---|---:|---|---|---|
| hammerfest | Hammerfest sykehus | Finnmarkssykehuset | somatikk | 89 | 2024 | ekte | [Sengeområder, Nye Hammerfest sykehus](https://kunnskapsbanken.sykehusbygg.no/eksempler/sengeomrader-nye-hammerfest-sykehus) |
| kirkenes | Kirkenes sykehus | Finnmarkssykehuset | somatikk | 48 | 2025 | estimat | [SSB 13942](https://www.ssb.no/statbank/table/13942) |
| karasjok | SANKS Karasjok | Finnmarkssykehuset | psykisk_helsevern | 6 | 2026 | ekte | [Døgnenhet psykisk helse og avhengighet, Karasjok](https://www.finnmarkssykehuset.no/avdelinger/sami-klinihkka/sanks/dognenheten/) |
| karasjok | SANKS Karasjok | Finnmarkssykehuset | tsb | 6 | 2026 | ekte | samme side |
| harstad | UNN Harstad | UNN | somatikk | 112 | 2025 | estimat | [SSB 13942](https://www.ssb.no/statbank/table/13942) |
| narvik | UNN Narvik | UNN | somatikk | 48 | 2024 | ekte | [Sengeområder, Nye UNN Narvik](https://kunnskapsbanken.sykehusbygg.no/eksempler/sengeomrader-nye-unn-narvik) |
| narvik | UNN Narvik | UNN | psykisk_helsevern | 43 | 2024 | ekte | samme side |
| tromso | UNN Tromsø | UNN | somatikk | 403 | 2025 | estimat | [SSB 13942](https://www.ssb.no/statbank/table/13942) |
| bodo | Nordlandssykehuset Bodø | Nordlandssykehuset | somatikk | 180 | 2025 | estimat | [SSB 13942](https://www.ssb.no/statbank/table/13942) |
| lofoten | Nordlandssykehuset Lofoten | Nordlandssykehuset | somatikk | 50 | 2025 | estimat | [SSB 13942](https://www.ssb.no/statbank/table/13942) |
| vesteralen | Nordlandssykehuset Vesterålen | Nordlandssykehuset | somatikk | 61 | 2014 | ekte | [Sengeområde, Vesterålen](https://kunnskapsbanken.sykehusbygg.no/eksempler/sengeområde5omrr) |
| mo-i-rana | Helgelandssykehuset Mo i Rana | Helgelandssykehuset | somatikk | 53 | 2025 | estimat | [SSB 13942](https://www.ssb.no/statbank/table/13942) |
| mosjoen | Helgelandssykehuset Mosjøen | Helgelandssykehuset | somatikk | 25 | 2025 | estimat | [SSB 13942](https://www.ssb.no/statbank/table/13942) |
| sandnessjoen | Helgelandssykehuset Sandnessjøen | Helgelandssykehuset | somatikk | 43 | 2025 | estimat | [SSB 13942](https://www.ssb.no/statbank/table/13942) |

14 rader, 12 av 15 steder i `sites.csv` (de tre uten sengerad er Klinikk Alta, UNN Åsgård og Nordlandssykehuset Rønvik – se «Steder uten egen sengerad» under).

## Kontroll mot SSB 13942 (`npm run validate`)

| HF | Kuratert somatikk (sum, siste periode) | SSB 13942 døgnplasser (2025) | Avvik |
|---|---:|---:|---:|
| Finnmarkssykehuset (983974880) | 137 (89 Hammerfest + 48 Kirkenes) | 134 | 2,2 % |
| UNN (983974899) | 563 (112 Harstad + 48 Narvik + 403 Tromsø) | 593 | 5,1 % |
| Nordlandssykehuset (983974910) | 291 (180 Bodø + 50 Lofoten + 61 Vesterålen) | 295 | 1,4 % |
| Helgelandssykehuset (983974929) | 121 (53 Mo i Rana + 25 Mosjøen + 43 Sandnessjøen) | 121 | 0,0 % |

Alle fire ligger godt innenfor 15 %-toleransen. UNN sitt avvik (5,1 %, kuratert *under* SSB) er størst; det er ventet siden Tromsø-tallet er et estimat (se under) og et reelt UNN Tromsø-tall trolig ville løftet summen nærmere/over SSB-tallet, gitt at Tromsø har regionfunksjoner.

## Estimat-rader: hvorfor ingen kilde ble funnet

For 7 av 11 obligatoriske `somatikk`-rader ble det ikke funnet en side som eksplisitt oppgir sengetallet for stedet, etter minst to målrettede søk hver (HFets egne avdelings-/steder-sider, sykehusbygg.no «sengeområder», Helse Nord styresaker, presseoppslag). Disse bruker fallback-formelen fra oppdraget:

```
senger = round(HF_SOM × pop_site / Σ pop_sites-of-HF)
```

der `HF_SOM` er HF-ets somatiske SSB-døgnplasser 2025 (`hf_activity.csv`) og `pop_site` er opptaksbefolkningen for stedets `lokalsykehus_id` i 2025 (`catchment_population.csv`, `SOM`/`alle`).

- **kirkenes**: Kirkenes-sider (radionordkapp.no, finnmarkssykehuset.no) omtaler en kutt på 8 senger, men ikke et grunntall å kutte fra.
- **harstad**: UNN Harstads avdelingssider beskriver funksjon, ikke sengetall; Helse Nord-styresaker funnet i søk gjaldt psykisk helse/rus, ikke somatikk Harstad.
- **tromso**: Søk traff mest tall om utskrivningsklare pasienter (44 senger/dag brukt til dette i 2024), ikke et totaltall for sykehuset.
- **bodo**: sykehusbygg.no sin «Sengeområder, Bodø sykehus»-side har rombeskrivelser (f.eks. «23 medisinske pasienter») men ikke en oppgitt totalsum; nordlandssykehuset.no sin stedsside for Bodø sentrum lister avdelinger uten sengesum.
- **lofoten**: Søk ga sengetall per avdeling (19 medisin, 14 kirurgi) fra ulike undersider uten en bekreftet totalsum for hele stedet.
- **mo-i-rana**: Avdelingssider ga delvise tall (26 medisinsk sengepost, 11 kvinne/føde) uten et bekreftet totaltall for stedet.
- **mosjoen**: Mosjøen mistet akuttfunksjon og døgnfunksjon i den somatiske sengeposten i en omstilling (2 senger flyttet til Sandnessjøen, 7 til Mo i Rana av 9 – kilde: helg.no); artikkelen oppgir ikke et nytt grunntall for Mosjøen etter omstillingen, så et pålitelig "senger i dag"-tall kunne ikke sourcedes. Dette er verdt å følge opp separat, siden det trolig betyr at det reelle sengetallet i Mosjøen er enda lavere enn estimatet over.
- **sandnessjoen**: Samme artikkel nevner et par overførte senger til Sandnessjøen, men ikke et totaltall for stedet.

## Steder uten egen sengerad

- **Klinikk Alta** (somatikk): en nordnorskdebatt.no-artikkel nevnte i søkeresultatet en økning fra 9 til 20 senger, men da siden ble åpnet direkte var sengetallet ikke lesbart der, og ingen annen side ga et entydig tall. Uten en side jeg selv har åpnet og som inneholder tallet, er raden utelatt (jf. oppdragets krav om ekte kilder). Alta har ingen `lokalsykehus_id`, så estimat-formelen kan heller ikke brukes.
- **UNN Åsgård** og **Nordlandssykehuset Rønvik** (psykisk_helsevern): søk ga bare tall for enkeltposter (f.eks. «17 senger» sikkerhetspsykiatri, «12» akuttpost Tromsø ved Åsgård; «8» en enkelt enhet ved Rønvik) – ingen åpnet side oppga et samlet sengetall for hele stedet, så radene er utelatt fremfor å gjette en sum.

## Åpne spørsmål til controller

- **Mosjøen**: se over – stedet har mistet akutt/døgnfunksjon i den somatiske sengeposten; estimatet (25 senger) er trolig for høyt for dagens drift. Vurder eget oppfølgingstask for å finne et post-omstilling-tall.
- **UNN sitt avvik (5,1 %)**: innenfor toleranse, men er det største av de fire. Hvis et ekte Tromsø-tall dukker opp senere, bør raden oppdateres og kontrollen kjøres på nytt.
- **Hammerfest-koordinat**: `sites.csv` bruker 70.67193/23.65210 (Nominatim-geokoding av offisiell adresse Kransvikveien 35, Nye Hammerfest sykehus, åpnet 14. januar 2025 på Rossmolla/Fuglenes), som ligger nær identisk med det gamle OSM-punktet i `facilities.csv` – Rossmolla ligger rett nedenfor/ved siden av den forrige sykehustomta på samme halvøy, så avviket er reelt lite (≈40 m), ikke en feilkilde.
