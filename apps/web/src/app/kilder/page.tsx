import { sampleSources } from "@/lib/sample-data";

export default function KilderPage() {
  return (
    <section className="grid">
      <div className="card">
        <h1>Kilder</h1>
        <p className="muted">Alle KPI-er skal spores til en kilde med URL, lisens og oppdateringsdato.</p>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kilde-ID</th>
              <th>Eier</th>
              <th>Datasett</th>
              <th>Geografi</th>
              <th>Oppdatering</th>
              <th>Sist oppdatert</th>
            </tr>
          </thead>
          <tbody>
            {sampleSources.map((source) => (
              <tr key={source.source_id}>
                <td>{source.source_id}</td>
                <td>{source.owner}</td>
                <td>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.dataset_name}
                  </a>
                </td>
                <td>{source.geo_level}</td>
                <td>{source.update_frequency}</td>
                <td>{source.last_updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
