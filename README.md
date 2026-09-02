# Kapasitet

Webapp for oversikt over kapasitet og behov i norsk helsesektor med tabeller, kart og scenarioer.

## Stack

- Next.js (TypeScript)
- CSV-data versjonert i GitHub
- Netlify deploy

## Kom i gang

1. Installer Node.js 22+
2. `npm install`
3. `npm test` – enhetstester for pipeline og enhetsmodell
4. `npm run validate` – skjema, kvalitet, brotabell-integritet og sengekontroll på `data/normalized/`
5. `npm run dev` – webappen

## Datapipeline

| Kommando | Gjør | Nettverk |
|---|---|---|
| `npm run fetch [-- --only id1,id2]` | Henter SSB/FHI/KLASS til `data/raw/` (gitignored) og skriver `data/normalized/*.csv` + `data/sources/manifest.json` | ja |
| `npm run validate` | Validerer CSV-ene, exit 1 ved feil | nei |
| `npm run build:data` | Bygger enhetsmodellen `apps/web/public/data/units/` (validerer først) | nei |
| `npm run drift` | Sammenligner tre kjente celler hos SSB med CSV-ene | ja |

Alle tall har `quality` = `ekte` (kilden oppgir tallet), `avledet` (regnet ut av ekte tall etter en oppgitt regel) eller `estimat` (modell/fordeling). Kildene står i `docs/SOURCES.md`; sengetallene for Helse Nord i `docs/senger-helse-nord.md`.

## Mappestruktur

- `apps/web`: webapp (Next.js, statisk eksport til Netlify)
- `apps/web/public/data/units`: generert enhetsmodell (`index.json` + faktaark per enhet) – ikke rediger for hånd
- `data/normalized`: normaliserte CSV-er (generert av `npm run fetch`; `sites.csv`, `hospital_beds.csv` og `municipalities.csv` er kuraterte)
- `data/raw`: rå json-stat fra siste `fetch` (gitignored)
- `data/sources`: `manifest.json` (generert) og `manifest.static.json` (kuraterte kilder)
- `scripts/lib`, `scripts/fetch`, `scripts/validate`, `scripts/units`: pipeline (ren Node, ingen avhengigheter)
- `scripts/*.ps1`, `data/derived`, `capacity.csv`/`needs.csv`: eldre modelldata, fjernes i neste runde
