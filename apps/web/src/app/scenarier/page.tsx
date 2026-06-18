import { ScenarioSimulator } from "../../components/scenario-simulator";
import { loadCapacityRows, loadFacilityRows } from "../../lib/csv";

export default function ScenarioPage() {
  const rows = loadCapacityRows();
  const facilities = loadFacilityRows();

  return (
    <section className="grid">
      <div className="card">
        <h1>Scenarier</h1>
        <p className="muted">
          Interaktiv scenariomodul for flytting av befolkning mellom kommuner, basert pa CSV-data i valgt periode.
        </p>
      </div>

      <ScenarioSimulator rows={rows} facilities={facilities} />
    </section>
  );
}
