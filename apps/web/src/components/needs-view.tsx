"use client";

import { useMemo, useState } from "react";
import type { NeedRow } from "../lib/types";

type Props = {
  rows: NeedRow[];
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function NeedsView({ rows }: Props) {
  const [period, setPeriod] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [county, setCounty] = useState<string>("all");

  const periodOptions = uniqueSorted(rows.map((row) => row.period));
  const categoryOptions = uniqueSorted(rows.map((row) => row.category));
  const countyOptions = uniqueSorted(rows.map((row) => row.county_code));

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (period !== "all" && row.period !== period) {
        return false;
      }
      if (category !== "all" && row.category !== category) {
        return false;
      }
      if (county !== "all" && row.county_code !== county) {
        return false;
      }
      return true;
    });
  }, [rows, period, category, county]);

  const totalPopulation = filteredRows.reduce((sum, row) => sum + row.value, 0);

  return (
    <>
      <div className="card filters">
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
          Kategori
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Alle</option>
            {categoryOptions.map((option) => (
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

      <div className="kpi">
        <article className="card">
          <p className="muted">Berort populasjon</p>
          <div className="value">{totalPopulation.toLocaleString("nb-NO")}</div>
        </article>
        <article className="card">
          <p className="muted">Antall indikatorrader</p>
          <div className="value">{filteredRows.length}</div>
        </article>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kommune</th>
              <th>Fylke</th>
              <th>Periode</th>
              <th>Kategori</th>
              <th>Indikator</th>
              <th>Verdi</th>
              <th>Enhet</th>
              <th>Kilde</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={`${row.dataset_id}-${row.category}-${row.municipality_code}-${row.metric}-${row.period}`}>
                <td>{row.municipality_code}</td>
                <td>{row.county_code}</td>
                <td>{row.period}</td>
                <td>{row.category}</td>
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
      </div>
    </>
  );
}