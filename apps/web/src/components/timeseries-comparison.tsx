"use client";

import { useMemo } from "react";
import type { CapacityRow, NeedRow } from "../lib/types";

const CAPACITY_METRIC = "ansatte_legger_og_sykepleiere";

type MunicipalityOption = {
  code: string;
  name: string;
};

type Props = {
  rows: CapacityRow[];
  needRows: NeedRow[];
  selectedMunicipalityCode: string | null;
  onSelectMunicipality: (code: string) => void;
  municipalityOptions: MunicipalityOption[];
  municipalityMap: Record<string, string>;
  sector: string;
  activePeriod: string;
};

type PeriodPoint = {
  period: string;
  capacity: number;
  need: number;
  pressure: number;
};

function formatNumber(value: number) {
  return value.toLocaleString("nb-NO");
}

function formatDelta(current: number, previous: number | null) {
  if (previous === null || previous === 0) {
    return null;
  }
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)} %`;
}

export function TimeseriesComparison({
  rows,
  needRows,
  selectedMunicipalityCode,
  onSelectMunicipality,
  municipalityOptions,
  municipalityMap,
  sector,
  activePeriod
}: Props) {
  // All periods present across capacity + needs, independent of the active
  // period filter so the comparison always shows the full time series.
  const periods = useMemo(() => {
    const all = new Set<string>();
    for (const row of rows) {
      all.add(row.period);
    }
    for (const row of needRows) {
      all.add(row.period);
    }
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [rows, needRows]);

  const series = useMemo<PeriodPoint[]>(() => {
    if (!selectedMunicipalityCode) {
      return [];
    }

    return periods.map((period) => {
      const capacity = rows
        .filter(
          (row) =>
            row.municipality_code === selectedMunicipalityCode &&
            row.period === period &&
            row.metric === CAPACITY_METRIC &&
            (sector === "all" || row.sector === sector)
        )
        .reduce((sum, row) => sum + row.value, 0);

      const need = needRows
        .filter((row) => row.municipality_code === selectedMunicipalityCode && row.period === period)
        .reduce((sum, row) => sum + row.value, 0);

      const pressure = capacity > 0 ? need / capacity : 0;

      return { period, capacity, need, pressure };
    });
  }, [periods, rows, needRows, selectedMunicipalityCode, sector]);

  const hasData = series.some((point) => point.capacity > 0 || point.need > 0);
  const maxPressure = Math.max(...series.map((point) => point.pressure), 0.0001);

  const municipalityName = selectedMunicipalityCode
    ? municipalityMap[selectedMunicipalityCode] ?? selectedMunicipalityCode
    : null;

  return (
    <div className="card table-wrap">
      <h3>Tidsserie: årssammenligning per kommune</h3>
      <p className="muted">
        Sammenligner kapasitet (ansatte), behov (sum behovsindikatorer) og pressindeks (behov / kapasitet) over tid.
        {sector !== "all" ? ` Sektor: ${sector}.` : ""}
      </p>

      <label className="filters" style={{ marginBottom: "0.8rem", maxWidth: "320px" }}>
        <span>Velg kommune</span>
        <select
          value={selectedMunicipalityCode ?? ""}
          onChange={(event) => onSelectMunicipality(event.target.value)}
        >
          {municipalityOptions.length === 0 && <option value="">Ingen kommuner tilgjengelig</option>}
          {municipalityOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      {!selectedMunicipalityCode || !hasData ? (
        <p className="muted">
          {selectedMunicipalityCode
            ? `Ingen tidsseriedata tilgjengelig for ${municipalityName}.`
            : "Velg en kommune for å se årssammenligning."}
        </p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Mål</th>
                {series.map((point) => (
                  <th
                    key={point.period}
                    style={
                      activePeriod !== "all" && activePeriod === point.period
                        ? { color: "var(--brand, #1d4ed8)", fontWeight: 700 }
                        : undefined
                    }
                  >
                    {point.period}
                    {activePeriod !== "all" && activePeriod === point.period ? " (valgt)" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Kapasitet (ansatte)</th>
                {series.map((point, index) => {
                  const prev = index > 0 ? series[index - 1].capacity : null;
                  const delta = formatDelta(point.capacity, prev);
                  return (
                    <td key={point.period}>
                      {formatNumber(point.capacity)}
                      {delta && <span className="muted"> ({delta})</span>}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th>Behov (sum)</th>
                {series.map((point, index) => {
                  const prev = index > 0 ? series[index - 1].need : null;
                  const delta = formatDelta(point.need, prev);
                  return (
                    <td key={point.period}>
                      {formatNumber(point.need)}
                      {delta && <span className="muted"> ({delta})</span>}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th>Pressindeks</th>
                {series.map((point, index) => {
                  const prev = index > 0 ? series[index - 1].pressure : null;
                  const delta = formatDelta(point.pressure, prev);
                  return (
                    <td key={point.period}>
                      <strong>{point.pressure.toFixed(2)}</strong>
                      {delta && <span className="muted"> ({delta})</span>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
            <p className="muted" style={{ margin: 0 }}>Pressindeks over tid</p>
            {series.map((point) => (
              <div key={point.period} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ width: "3rem", fontSize: "0.85rem" }}>{point.period}</span>
                <div
                  style={{
                    flex: 1,
                    background: "var(--border, #e5e7eb)",
                    borderRadius: "999px",
                    overflow: "hidden",
                    height: "0.9rem"
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max((point.pressure / maxPressure) * 100, 2)}%`,
                      background: "var(--brand, #1d4ed8)",
                      height: "100%"
                    }}
                  />
                </div>
                <span style={{ width: "3rem", textAlign: "right", fontSize: "0.85rem" }}>
                  {point.pressure.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
