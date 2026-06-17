import { sampleCapacity } from "@/lib/sample-data";

export default function HomePage() {
  const ansatte = sampleCapacity
    .filter((row) => row.metric === "ansatte_legger_og_sykepleiere")
    .reduce((sum, row) => sum + row.value, 0);

  const brukerePerDag = sampleCapacity
    .filter((row) => row.metric === "mottar_tjeneste_per_dag")
    .reduce((sum, row) => sum + row.value, 0);

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
          <div className="value">2 kommuner</div>
        </article>
      </div>

      <div className="card notice">
        Metoden i scenariofanen er forenklet: omfordeling skjer til naermeste tilgjengelige kapasitet.
      </div>
    </section>
  );
}
