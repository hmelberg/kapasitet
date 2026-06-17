type ScenarioInput = {
  fraOmrade: string;
  tilOmrade: string;
  flyttedePersoner: number;
};

const exampleInput: ScenarioInput = {
  fraOmrade: "0301",
  tilOmrade: "4601",
  flyttedePersoner: 12000
};

function estimatePersonnelNeed(movedPopulation: number) {
  const doctors = Math.ceil((movedPopulation / 1000) * 1.2);
  const nurses = Math.ceil((movedPopulation / 1000) * 4.5);
  const other = Math.ceil((movedPopulation / 1000) * 3.0);
  return { doctors, nurses, other };
}

export default function ScenarioPage() {
  const estimate = estimatePersonnelNeed(exampleInput.flyttedePersoner);

  return (
    <section className="grid">
      <div className="card">
        <h1>Scenarier</h1>
        <p className="muted">
          Forste implementasjon viser regelbasert estimat ved flytting av befolkning og kan senere kobles til ekte CSV-input.
        </p>
      </div>

      <div className="card">
        <p>
          Scenario: Flytt {exampleInput.flyttedePersoner.toLocaleString("nb-NO")} personer fra kommune {exampleInput.fraOmrade} til {exampleInput.tilOmrade}.
        </p>
        <ul>
          <li>Estimert behov leger: {estimate.doctors}</li>
          <li>Estimert behov sykepleiere: {estimate.nurses}</li>
          <li>Estimert behov andre ansatte: {estimate.other}</li>
        </ul>
      </div>
    </section>
  );
}
