"use client";

import { useMemo, useState } from "react";

type CountySummaryRow = {
  countyCode: string;
  countyName: string;
  capacity: number;
  demand: number;
  need: number;
};

type MunicipalitySummaryRow = {
  municipalityCode: string;
  municipalityName: string;
  countyCode: string;
  countyName: string;
  capacity: number;
  demand: number;
  need: number;
};

type Props = {
  countySummary: CountySummaryRow[];
  municipalitySummary: MunicipalitySummaryRow[];
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function OverviewDashboard({ countySummary, municipalitySummary }: Props) {
  const [selectedCounty, setSelectedCounty] = useState<string>("all");
  const countyOptions = uniqueSorted(countySummary.map((row) => row.countyCode));
  const countyNameMap = Object.fromEntries(countySummary.map((row) => [row.countyCode, row.countyName]));

  const visibleCountySummary = useMemo(() => {
    return countySummary.filter((row) => selectedCounty === "all" || row.countyCode === selectedCounty);
  }, [countySummary, selectedCounty]);

  const visibleMunicipalities = useMemo(() => {
    return municipalitySummary
      .filter((row) => selectedCounty === "all" || row.countyCode === selectedCounty)
      .sort((a, b) => b.need - a.need);
  }, [municipalitySummary, selectedCounty]);

  const pressureRows = useMemo(() => {
    return visibleMunicipalities
      .map((row) => ({
        ...row,
        pressure: row.capacity > 0 ? row.need / row.capacity : row.need
      }))
      .sort((a, b) => b.pressure - a.pressure)
      .slice(0, 5);
  }, [visibleMunicipalities]);

  return (
    <>
      <div className="card filters">
        <label>
          Fylke
          <select value={selectedCounty} onChange={(event) => setSelectedCounty(event.target.value)}>
            <option value="all">Alle fylker</option>
            {countyOptions.map((option) => (
              <option key={option} value={option}>
                {countyNameMap[option] ?? option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card table-wrap">
        <h2>Fylkesoppsummering</h2>
        <table>
          <thead>
            <tr>
              <th>Fylke</th>
              <th>Ansatte</th>
              <th>Mottar tjeneste per dag</th>
              <th>Behovsindikatorer</th>
            </tr>
          </thead>
          <tbody>
            {visibleCountySummary.map((row) => (
              <tr key={row.countyCode}>
                <td>{row.countyName}</td>
                <td>{row.capacity.toLocaleString("nb-NO")}</td>
                <td>{row.demand.toLocaleString("nb-NO")}</td>
                <td>{row.need.toLocaleString("nb-NO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <h2>Kommuneoppsummering</h2>
        <p className="muted">Sortert etter behovsindikatorer innen valgt fylke.</p>
        <table>
          <thead>
            <tr>
              <th>Kommune</th>
              <th>Fylke</th>
              <th>Ansatte</th>
              <th>Mottar tjeneste per dag</th>
              <th>Behovsindikatorer</th>
            </tr>
          </thead>
          <tbody>
            {visibleMunicipalities.map((row) => (
              <tr key={row.municipalityCode}>
                <td>{row.municipalityName}</td>
                <td>{row.countyName}</td>
                <td>{row.capacity.toLocaleString("nb-NO")}</td>
                <td>{row.demand.toLocaleString("nb-NO")}</td>
                <td>{row.need.toLocaleString("nb-NO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <h2>Topp Presskommuner</h2>
        <p className="muted">Kommuner med hoyest forhold mellom behovsindikatorer og registrert kapasitet.</p>
        <table>
          <thead>
            <tr>
              <th>Kommune</th>
              <th>Fylke</th>
              <th>Behov</th>
              <th>Ansatte</th>
              <th>Pressindeks</th>
            </tr>
          </thead>
          <tbody>
            {pressureRows.map((row) => (
              <tr key={row.municipalityCode}>
                <td>{row.municipalityName}</td>
                <td>{row.countyName}</td>
                <td>{row.need.toLocaleString("nb-NO")}</td>
                <td>{row.capacity.toLocaleString("nb-NO")}</td>
                <td>{row.pressure.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}