import { CapacityView } from "../../components/capacity-view";
import { loadCapacityRows, loadFacilityRows } from "../../lib/csv";

export default function KapasitetPage() {
  const rows = loadCapacityRows();
  const facilities = loadFacilityRows();

  return (
    <section className="grid">
      <div className="card">
        <h1>Kart og kapasitet</h1>
        <p className="muted">
          Denne visningen leser direkte fra CSV-filer i repoet med filtrering per indikator, periode og fylke.
        </p>
      </div>
      <CapacityView rows={rows} facilities={facilities} />
    </section>
  );
}
