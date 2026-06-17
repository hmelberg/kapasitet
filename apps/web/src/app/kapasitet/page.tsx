import { sampleCapacity } from "@/lib/sample-data";

export default function KapasitetPage() {
  return (
    <section className="grid">
      <div className="card">
        <h1>Kart og kapasitet</h1>
        <p className="muted">
          Kartlag kobles i neste steg. Tabellen under viser CSV-normaliserte indikatorer per kommune.
        </p>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kommune</th>
              <th>Periode</th>
              <th>Indikator</th>
              <th>Verdi</th>
              <th>Enhet</th>
              <th>Kilde</th>
            </tr>
          </thead>
          <tbody>
            {sampleCapacity.map((row) => (
              <tr key={`${row.dataset_id}-${row.municipality_code}-${row.metric}`}>
                <td>{row.municipality_code}</td>
                <td>{row.period}</td>
                <td>{row.metric}</td>
                <td>{row.value.toLocaleString("nb-NO")}</td>
                <td>{row.unit}</td>
                <td>
                  <span className="badge">{row.source_id}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
