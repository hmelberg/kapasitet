import { NeedsView } from "../../components/needs-view";
import { loadNeedRows } from "../../lib/csv";

export default function BehovPage() {
  const rows = loadNeedRows();

  return (
    <section className="grid">
      <div className="card">
        <h1>Behov</h1>
        <p className="muted">
          Behovsindikatorer for sykdomsforekomst og legemiddelbruk, hentet fra CSV-filer i repoet.
        </p>
      </div>

      <NeedsView rows={rows} />
    </section>
  );
}
