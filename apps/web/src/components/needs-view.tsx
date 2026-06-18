"use client";

import { useMemo, useState } from "react";
import type { CapacityRow, NeedRow } from "../lib/types";

type Props = {
  rows: NeedRow[];
  capacityRows: CapacityRow[];
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function NeedsView({ rows, capacityRows }: Props) {
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

  const gapRows = useMemo(() => {
    const municipalitySet = new Set(filteredRows.map((row) => row.municipality_code));
    const activePeriod = period === "all" ? periodOptions[periodOptions.length - 1] : period;

    return Array.from(municipalitySet)
      .map((municipalityCode) => {
        const need = filteredRows
          .filter((row) => row.municipality_code === municipalityCode)
          .reduce((sum, row) => sum + row.value, 0);

        const staff = capacityRows
          .filter(
            (row) =>
              row.municipality_code === municipalityCode &&
              row.metric === "ansatte_legger_og_sykepleiere" &&
              (activePeriod ? row.period === activePeriod : true)
          )
          .reduce((sum, row) => sum + row.value, 0);

        const needPerStaff = staff > 0 ? need / staff : null;

        return {
          municipalityCode,
          need,
          staff,
          needPerStaff
        };
      })
      .sort((a, b) => (b.needPerStaff ?? -1) - (a.needPerStaff ?? -1));
  }, [filteredRows, capacityRows, period, periodOptions]);

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

      <div className="card table-wrap">
        <h2>Gap-indikator per kommune</h2>
        <p className="muted">Forholdstall = behovsvolum delt pa antall ansatte (leger/sykepleiere).</p>
        <table>
          <thead>
            <tr>
              <th>Kommune</th>
              <th>Behovsvolum</th>
              <th>Ansatte</th>
              <th>Behov per ansatt</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {gapRows.map((row) => {
              let status = "Lav";
              if ((row.needPerStaff ?? 0) >= 8) {
                status = "Hoy";
              } else if ((row.needPerStaff ?? 0) >= 5) {
                status = "Moderat";
              }

              return (
                <tr key={row.municipalityCode}>
                  <td>{row.municipalityCode}</td>
                  <td>{row.need.toLocaleString("nb-NO")}</td>
                  <td>{row.staff.toLocaleString("nb-NO")}</td>
                  <td>{row.needPerStaff ? row.needPerStaff.toFixed(2) : "-"}</td>
                  <td>
                    <span className="badge">{status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}