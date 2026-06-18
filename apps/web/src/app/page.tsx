import { loadCapacityRows, loadMunicipalityRows, loadNeedRows } from "../lib/csv";

export default function HomePage() {
  const rows = loadCapacityRows();
  const needs = loadNeedRows();
  const municipalities = loadMunicipalityRows();
  const countyMap = Object.fromEntries(
    municipalities.map((row) => [row.county_code, row.county_name])
  );

  const ansatte = rows
    .filter((row) => row.metric === "ansatte_legger_og_sykepleiere")
    .reduce((sum, row) => sum + row.value, 0);

  const brukerePerDag = rows
    .filter((row) => row.metric === "mottar_tjeneste_per_dag")
    .reduce((sum, row) => sum + row.value, 0);

  const sykdomsbelastning = needs
    .filter((row) => row.category === "hjerte" || row.category === "kreft")
    .reduce((sum, row) => sum + row.value, 0);

  const countySummary = Array.from(new Set(rows.map((row) => row.county_code)))
    .map((countyCode) => {
      const capacity = rows
        .filter((row) => row.county_code === countyCode && row.metric === "ansatte_legger_og_sykepleiere")
        .reduce((sum, row) => sum + row.value, 0);

      const demand = rows
        .filter((row) => row.county_code === countyCode && row.metric === "mottar_tjeneste_per_dag")
        .reduce((sum, row) => sum + row.value, 0);

      const need = needs
        .filter((row) => row.county_code === countyCode)
        .reduce((sum, row) => sum + row.value, 0);

      return {
        countyCode,
        countyName: countyMap[countyCode] ?? countyCode,
        capacity,
        demand,
        need
      };
    })
    .sort((a, b) => b.need - a.need);

  return (
    <section className="grid">
      <div className="card">
        <h1>Oversikt</h1>
        <p className="muted">
          MVP med GitHub-baserte CSV-data og Netlify deploy. Tallene under er eksempeldata for første sprint.
        </p>
      </div>

      <div className="kpi">
        <article className="card">
          <p className="muted">Ansatte (leger/sykepleiere)</p>
          <div className="value">{ansatte.toLocaleString("nb-NO")}</div>
        </article>
        <article className="card">
          <p className="muted">Mottar tjeneste per dag</p>
          <div className="value">{brukerePerDag.toLocaleString("nb-NO")}</div>
        </article>
        <article className="card">
          <p className="muted">Dekning</p>
          <div className="value">{new Set(rows.map((row) => row.municipality_code)).size} kommuner</div>
        </article>
        <article className="card">
          <p className="muted">Behov (hjerte + kreft)</p>
          <div className="value">{sykdomsbelastning.toLocaleString("nb-NO")}</div>
        </article>
      </div>

      <div className="card notice">
        Metoden i scenariofanen er forenklet: omfordeling skjer til naermeste tilgjengelige kapasitet.
      </div>

      <div className="card table-wrap">
        <h2>Fylkesoppsummering</h2>
        <table>
          <thead>
            <tr>
              <th>Fylke</th>
              <th>Ansatte</th>
              <th>Mottar tjeneste per dag</th>
              <th>Behovsindikatorer</th>
            </tr>
          </thead>
          <tbody>
            {countySummary.map((row) => (
              <tr key={row.countyCode}>
                <td>{row.countyName}</td>
                <td>{row.capacity.toLocaleString("nb-NO")}</td>
                <td>{row.demand.toLocaleString("nb-NO")}</td>
                <td>{row.need.toLocaleString("nb-NO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
