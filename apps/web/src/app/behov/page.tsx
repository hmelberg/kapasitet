import { NeedsView } from "../../components/needs-view";
import { loadCapacityRows, loadMunicipalityRows, loadNeedRows } from "../../lib/csv";

export default function BehovPage() {
  const rows = loadNeedRows();
  const capacityRows = loadCapacityRows();
  const municipalities = loadMunicipalityRows();
  const municipalityMap = Object.fromEntries(
    municipalities.map((row) => [row.municipality_code, row.municipality_name])
  );

  return (
    <section className="grid">
      <div className="card">
        <h1>Behov</h1>
        <p className="muted">
          Behovsindikatorer for sykdomsforekomst og legemiddelbruk, hentet fra CSV-filer i repoet.
        </p>
      </div>

      <NeedsView rows={rows} capacityRows={capacityRows} municipalityMap={municipalityMap} />
    </section>
  );
}
