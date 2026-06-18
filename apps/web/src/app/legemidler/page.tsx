import { MedicationsView } from "../../components/medications-view";
import { loadMedicationRows, loadMedicationUseRows, loadMunicipalityRows } from "../../lib/csv";

export default function LegemidlerPage() {
  const national = loadMedicationRows();
  const use = loadMedicationUseRows();
  const municipalities = loadMunicipalityRows();
  const municipalityMap = Object.fromEntries(
    municipalities.map((row) => [row.municipality_code, row.municipality_name])
  );
  const countyMap = Object.fromEntries(
    municipalities.map((row) => [row.county_code, row.county_name])
  );

  return (
    <section className="grid">
      <div className="card">
        <h1>Legemidler og sykdom</h1>
        <p className="muted">
          Antall personer som har fått legemidler utlevert på resept, etter legemiddelgruppe.
          Nasjonale tall er hentet direkte fra FHI Legemiddelregisteret (LMR); tall per kommune er
          estimater basert på nasjonal rate og folketall.
        </p>
      </div>

      <MedicationsView
        national={national}
        use={use}
        municipalityMap={municipalityMap}
        countyMap={countyMap}
      />
    </section>
  );
}
