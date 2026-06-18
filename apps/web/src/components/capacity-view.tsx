"use client";

import { useMemo, useState } from "react";
import type { CapacityRow } from "@/lib/types";

type Props = {
  rows: CapacityRow[];
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function getPointPosition(row: CapacityRow) {
  const countyNumber = Number(row.county_code);
  const municipalityNumber = Number(row.municipality_code);
  const x = ((countyNumber * 17 + municipalityNumber) % 80) + 10;
  const y = ((municipalityNumber * 13 + countyNumber) % 80) + 10;
  return { x, y };
}

export function CapacityView({ rows }: Props) {
  const [metric, setMetric] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [county, setCounty] = useState<string>("all");

  const metricOptions = uniqueSorted(rows.map((row) => row.metric));
  const periodOptions = uniqueSorted(rows.map((row) => row.period));
  const countyOptions = uniqueSorted(rows.map((row) => row.county_code));

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (metric !== "all" && row.metric !== metric) {
        return false;
      }
      if (period !== "all" && row.period !== period) {
        return false;
      }
      if (county !== "all" && row.county_code !== county) {
        return false;
      }
      return true;
    });
  }, [rows, metric, period, county]);

  return (
    <>
      <div className="card filters">
        <label>
          Indikator
          <select value={metric} onChange={(event) => setMetric(event.target.value)}>
            <option value="all">Alle</option>
            {metricOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Periode
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="all">Alle</option>
            {periodOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Fylke
          <select value={county} onChange={(event) => setCounty(event.target.value)}>
            <option value="all">Alle</option>
            {countyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <h2>Kartlag (forenklet)</h2>
        <p className="muted">Punkt viser kommunedata i valgt filter. Fullt geokart kobles i neste iterasjon.</p>
        <div className="map-canvas" aria-label="Forenklet kartvisning">
          {filteredRows.map((row) => {
            const point = getPointPosition(row);
            return (
              <div
                key={`${row.dataset_id}-${row.municipality_code}-${row.metric}-${row.period}`}
                className="map-point"
                title={`${row.municipality_code}: ${row.metric} ${row.value.toLocaleString("nb-NO")}`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            );
          })}
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kommune</th>
              <th>Fylke</th>
              <th>Periode</th>
              <th>Indikator</th>
              <th>Verdi</th>
              <th>Enhet</th>
              <th>Kilde</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={`${row.dataset_id}-${row.municipality_code}-${row.metric}-${row.period}`}>
                <td>{row.municipality_code}</td>
                <td>{row.county_code}</td>
                <td>{row.period}</td>
                <td>{row.metric}</td>
                <td>{row.value.toLocaleString("nb-NO")}</td>
                <td>{row.unit}</td>
                <td>
                  <span className="badge">{row.source_id}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Rader: {filteredRows.length}</p>
      </div>
    </>
  );
}