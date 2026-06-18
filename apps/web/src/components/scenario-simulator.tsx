"use client";

import { useEffect, useMemo, useState } from "react";
import type { CapacityRow, FacilityRow } from "../lib/types";

type Props = {
  rows: CapacityRow[];
  facilities: FacilityRow[];
};

type ScenarioType = "evakuering" | "steng_sykehus";

type ScenarioHistoryEntry = {
  id: string;
  timestamp: string;
  scenarioType: ScenarioType;
  period: string;
  description: string;
};

const HISTORY_KEY = "kapasitet_scenario_history";

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

function toCsvValue(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function ScenarioSimulator({ rows, facilities }: Props) {
  const municipalities = uniqueSorted(rows.map((row) => row.municipality_code));
  const periods = uniqueSorted(rows.map((row) => row.period)).reverse();
  const hospitals = facilities.filter((facility) => facility.facility_type === "sykehus");

  const [scenarioType, setScenarioType] = useState<ScenarioType>("evakuering");
  const [period, setPeriod] = useState(periods[0] ?? "");
  const [fromMunicipality, setFromMunicipality] = useState(municipalities[0] ?? "");
  const [toMunicipality, setToMunicipality] = useState(municipalities[1] ?? municipalities[0] ?? "");
  const [movedPopulation, setMovedPopulation] = useState(12000);
  const [selectedHospital, setSelectedHospital] = useState(hospitals[0]?.facility_id ?? "");
  const [closureDays, setClosureDays] = useState(14);
  const [history, setHistory] = useState<ScenarioHistoryEntry[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ScenarioHistoryEntry[];
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const evacuationScenario = useMemo(() => {
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

  const closureScenario = useMemo(() => {
    const hospital = hospitals.find((item) => item.facility_id === selectedHospital);
    if (!hospital) {
      return null;
    }

    const municipalityDemand = getMetricValue(rows, hospital.municipality_code, period, "mottar_tjeneste_per_dag");
    const redirectedPerDay = Math.ceil(municipalityDemand * 0.18);
    const totalRedirected = redirectedPerDay * closureDays;

    const neededDoctors = Math.ceil((redirectedPerDay / 1000) * 1.4);
    const neededNurses = Math.ceil((redirectedPerDay / 1000) * 5.2);
    const neededOther = Math.ceil((redirectedPerDay / 1000) * 3.3);

    return {
      hospital,
      redirectedPerDay,
      totalRedirected,
      lostBeds: hospital.beds,
      neededDoctors,
      neededNurses,
      neededOther
    };
  }, [hospitals, selectedHospital, rows, period, closureDays]);

  function saveScenario() {
    const timestamp = new Date().toISOString();
    const description =
      scenarioType === "evakuering"
        ? `Flytt ${movedPopulation.toLocaleString("nb-NO")} fra ${fromMunicipality} til ${toMunicipality}`
        : `Steng ${closureScenario?.hospital.name ?? selectedHospital} i ${closureDays} dager`;

    const newEntry: ScenarioHistoryEntry = {
      id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp,
      scenarioType,
      period,
      description
    };

    setHistory((prev) => [newEntry, ...prev].slice(0, 8));
  }

  function exportHistoryCsv() {
    if (history.length === 0) {
      return;
    }

    const header = ["timestamp", "scenario_type", "period", "description"];
    const rows = history.map((entry) => [
      entry.timestamp,
      entry.scenarioType,
      entry.period,
      entry.description
    ]);

    const csv = [
      header.join(","),
      ...rows.map((row) => row.map((value) => toCsvValue(value)).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "scenario-historikk.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="card filters">
        <label>
          Scenariotype
          <select value={scenarioType} onChange={(event) => setScenarioType(event.target.value as ScenarioType)}>
            <option value="evakuering">Flytting av befolkning</option>
            <option value="steng_sykehus">Stenging av sykehus</option>
          </select>
        </label>

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

        {scenarioType === "evakuering" ? (
          <>
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
          </>
        ) : (
          <>
            <label>
              Sykehus
              <select value={selectedHospital} onChange={(event) => setSelectedHospital(event.target.value)}>
                {hospitals.map((hospital) => (
                  <option key={hospital.facility_id} value={hospital.facility_id}>
                    {hospital.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Stengingsdager
              <input
                type="number"
                min={1}
                step={1}
                value={closureDays}
                onChange={(event) => setClosureDays(Number(event.target.value))}
              />
            </label>
          </>
        )}
      </div>

      <div className="card">
        <div className="button-row">
          <button type="button" className="action-button" onClick={saveScenario}>
            Lagre scenariokjoring
          </button>
          <button type="button" className="action-button secondary" onClick={exportHistoryCsv}>
            Eksporter historikk CSV
          </button>
        </div>
      </div>

      {scenarioType === "evakuering" ? (
        <>
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
                  <td>{evacuationScenario.fromBaseDemand.toLocaleString("nb-NO")}</td>
                  <td>{evacuationScenario.fromAfterDemand.toLocaleString("nb-NO")}</td>
                  <td>-{evacuationScenario.extraDailyDemand.toLocaleString("nb-NO")}</td>
                  <td>{evacuationScenario.fromBaseStaff.toLocaleString("nb-NO")}</td>
                </tr>
                <tr>
                  <td>{toMunicipality}</td>
                  <td>{evacuationScenario.toBaseDemand.toLocaleString("nb-NO")}</td>
                  <td>{evacuationScenario.toAfterDemand.toLocaleString("nb-NO")}</td>
                  <td>+{evacuationScenario.extraDailyDemand.toLocaleString("nb-NO")}</td>
                  <td>{evacuationScenario.toBaseStaff.toLocaleString("nb-NO")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="kpi">
            <article className="card">
              <p className="muted">Estimert behov leger</p>
              <div className="value">{evacuationScenario.doctors}</div>
            </article>
            <article className="card">
              <p className="muted">Estimert behov sykepleiere</p>
              <div className="value">{evacuationScenario.nurses}</div>
            </article>
            <article className="card">
              <p className="muted">Estimert behov andre ansatte</p>
              <div className="value">{evacuationScenario.other}</div>
            </article>
          </div>
        </>
      ) : (
        <>
          <div className="card notice">
            Modellantakelse: 18% av daglig tjenesteettersporsel i sykehuskommunen ma omfordeles ved stenging.
          </div>

          {closureScenario && (
            <>
              <div className="card table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sykehus</th>
                      <th>Kommune</th>
                      <th>Bortfall senger</th>
                      <th>Omfordelt per dag</th>
                      <th>Omfordelt totalt</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{closureScenario.hospital.name}</td>
                      <td>{closureScenario.hospital.municipality_code}</td>
                      <td>{closureScenario.lostBeds.toLocaleString("nb-NO")}</td>
                      <td>{closureScenario.redirectedPerDay.toLocaleString("nb-NO")}</td>
                      <td>{closureScenario.totalRedirected.toLocaleString("nb-NO")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="kpi">
                <article className="card">
                  <p className="muted">Behov leger</p>
                  <div className="value">{closureScenario.neededDoctors}</div>
                </article>
                <article className="card">
                  <p className="muted">Behov sykepleiere</p>
                  <div className="value">{closureScenario.neededNurses}</div>
                </article>
                <article className="card">
                  <p className="muted">Behov andre ansatte</p>
                  <div className="value">{closureScenario.neededOther}</div>
                </article>
              </div>
            </>
          )}
        </>
      )}

      <div className="card table-wrap">
        <h2>Scenariehistorikk</h2>
        <p className="muted">Siste 8 kjoringer lagres lokalt i nettleseren.</p>
        <table>
          <thead>
            <tr>
              <th>Tidspunkt</th>
              <th>Type</th>
              <th>Periode</th>
              <th>Beskrivelse</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">Ingen scenarier lagret enda.</td>
              </tr>
            ) : (
              history.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.timestamp).toLocaleString("nb-NO")}</td>
                  <td>{entry.scenarioType === "evakuering" ? "Flytting" : "Stenging"}</td>
                  <td>{entry.period}</td>
                  <td>{entry.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
