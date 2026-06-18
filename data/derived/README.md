# Derived data

Avledede indikatorer bygges fra data/normalized og lagres her som CSV.

## municipalities_geo.json

Cache over alle 357 kommuner fra Geonorge (Kartverket): kommune-/fylkesnummer,
navn, representasjonspunkt (sentroide `lat`/`lon`) og `bbox`
(`[vest, sør, øst, nord]`). Genereres av `scripts/fetch-municipalities.ps1` og
brukes som geografisk grunnlag av `scripts/generate-data.ps1` (folketallsskalering)
og `scripts/fetch-facilities-osm.ps1` (kommunetilordning).
