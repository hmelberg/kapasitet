# Kapasitet

Webapp for oversikt over kapasitet og behov i norsk helsesektor med tabeller, kart og scenarioer.

## Stack

- Next.js (TypeScript)
- CSV-data versjonert i GitHub
- Netlify deploy

## Kom i gang

1. Installer Node.js 20+
2. Kjor `npm install`
3. Kjor `npm run validate:data`
4. Kjor `npm run dev`

## Mappestruktur

- `apps/web`: webapp
- `data/raw`: ra uttrekk
- `data/normalized`: normaliserte CSV-er brukt av appen
- `data/derived`: avledede indikatorer
- `data/sources`: kildekatalog
- `scripts`: validering av data
