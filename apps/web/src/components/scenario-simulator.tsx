"use client";

import { useMemo, useState } from "react";
import type { CapacityRow } from "../lib/types";

type Props = {
  rows: CapacityRow[];
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function getMetricValue(rows: CapacityRow[], municipalityCode: string, period: string, metric: string) {
  return rows
    .filter(
      (row) =>
        row.municipality_code === municipalityCode &&
        row.period === period &&
        row.metric === metric
    )
    .reduce((sum, row) => sum + row.value, 0);
}

export function ScenarioSimulator({ rows }: Props) {
  const municipalities = uniqueSorted(rows.map((row) => row.municipality_code));
  const periods = uniqueSorted(rows.map((row) => row.period)).reverse();

  const [period, setPeriod] = useState(periods[0] ?? "");
  const [fromMunicipality, setFromMunicipality] = useState(municipalities[0] ?? "");
  const [toMunicipality, setToMunicipality] = useState(municipalities[1] ?? municipalities[0] ?? "");
  const [movedPopulation, setMovedPopulation] = useState(12000);

  const scenario = useMemo(() => {
    const fromBaseDemand = getMetricValue(rows, fromMunicipality, period, "mottar_tjeneste_per_dag");
    const toBaseDemand = getMetricValue(rows, toMunicipality, period, "mottar_tjeneste_per_dag");

    const fromBaseStaff = getMetricValue(rows, fromMunicipality, period, "ansatte_legger_og_sykepleiere");
    const toBaseStaff = getMetricValue(rows, toMunicipality, period, "ansatte_legger_og_sykepleiere");

    const extraDailyDemand = Math.ceil(movedPopulation * 0.06);
    const fromAfterDemand = Math.max(0, fromBaseDemand - extraDailyDemand);
    const toAfterDemand = toBaseDemand + extraDailyDemand;

    const doctors = Math.ceil((movedPopulation / 1000) * 1.2);
    const nurses = Math.ceil((movedPopulation / 1000) * 4.5);
    const other = Math.ceil((movedPopulation / 1000) * 3.0);

    return {
      fromBaseDemand,
      toBaseDemand,
      fromAfterDemand,
      toAfterDemand,
      fromBaseStaff,
      toBaseStaff,
      doctors,
      nurses,
      other,
      extraDailyDemand
    };
  }, [rows, fromMunicipality, toMunicipality, period, movedPopulation]);

  return (
    <>
      <div className="card filters">
        <label>
          Periode
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {periods.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Fra kommune
          <select value={fromMunicipality} onChange={(event) => setFromMunicipality(event.target.value)}>
            {municipalities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Til kommune
          <select value={toMunicipality} onChange={(event) => setToMunicipality(event.target.value)}>
            {municipalities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Flyttet befolkning
          <input
            type="number"
            min={0}
            step={500}
            value={movedPopulation}
            onChange={(event) => setMovedPopulation(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="card notice">
        Modellantakelse: 6% av flyttet befolkning gir ekstra tjenesteettersporsel per dag i mottakskommune.
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Omrade</th>
              <th>Ettersporsel for</th>
              <th>Ettersporsel etter</th>
              <th>Endring</th>
              <th>Ansatte (baseline)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{fromMunicipality}</td>
              <td>{scenario.fromBaseDemand.toLocaleString("nb-NO")}</td>
              <td>{scenario.fromAfterDemand.toLocaleString("nb-NO")}</td>
              <td>-{scenario.extraDailyDemand.toLocaleString("nb-NO")}</td>
              <td>{scenario.fromBaseStaff.toLocaleString("nb-NO")}</td>
            </tr>
            <tr>
              <td>{toMunicipality}</td>
              <td>{scenario.toBaseDemand.toLocaleString("nb-NO")}</td>
              <td>{scenario.toAfterDemand.toLocaleString("nb-NO")}</td>
              <td>+{scenario.extraDailyDemand.toLocaleString("nb-NO")}</td>
              <td>{scenario.toBaseStaff.toLocaleString("nb-NO")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="kpi">
        <article className="card">
          <p className="muted">Estimert behov leger</p>
          <div className="value">{scenario.doctors}</div>
        </article>
        <article className="card">
          <p className="muted">Estimert behov sykepleiere</p>
          <div className="value">{scenario.nurses}</div>
        </article>
        <article className="card">
          <p className="muted">Estimert behov andre ansatte</p>
          <div className="value">{scenario.other}</div>
        </article>
      </div>
    </>
  );
}