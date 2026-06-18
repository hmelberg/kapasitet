"use client";

import { useMemo, useState } from "react";
import type { MedicationRow, MedicationUseRow } from "../lib/types";

type Props = {
  national: MedicationRow[];
  use: MedicationUseRow[];
  municipalityMap: Record<string, string>;
  countyMap: Record<string, string>;
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function MedicationsView({ national, use, municipalityMap, countyMap }: Props) {
  const nationalYears = useMemo(() => uniqueSorted(national.map((r) => r.period)), [national]);
  const useYears = useMemo(() => uniqueSorted(use.map((r) => r.period)), [use]);
  const groups = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of national) {
      map.set(r.group_code, r.group_label);
    }
    return Array.from(map, ([code, label]) => ({ code, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [national]);
  const countyOptions = useMemo(() => uniqueSorted(use.map((r) => r.county_code)), [use]);

  const latestYear = nationalYears[nationalYears.length - 1] ?? "";
  const [year, setYear] = useState<string>(latestYear);
  const [selectedGroup, setSelectedGroup] = useState<string>(groups[0]?.code ?? "");
  const [county, setCounty] = useState<string>("all");

  const countyLabel = (code: string) => countyMap[code] ?? code;
  const municipalityLabel = (code: string) => municipalityMap[code] ?? code;

  // National table for the selected year, with trend vs the earliest year.
  const nationalTable = useMemo(() => {
    const firstYear = nationalYears[0];
    return groups.map((g) => {
      const current = national.find((r) => r.group_code === g.code && r.period === year);
      const first = national.find((r) => r.group_code === g.code && r.period === firstYear);
      let trend: number | null = null;
      if (current && first && first.per_1000 > 0) {
        trend = ((current.per_1000 - first.per_1000) / first.per_1000) * 100;
      }
      return {
        code: g.code,
        label: g.label,
        users: current?.users ?? 0,
        per1000: current?.per_1000 ?? 0,
        trend
      };
    });
  }, [groups, national, nationalYears, year]);

  // Time series for the selected group across all national years.
  const groupSeries = useMemo(() => {
    return nationalYears.map((y) => {
      const row = national.find((r) => r.group_code === selectedGroup && r.period === y);
      return { period: y, users: row?.users ?? 0, per1000: row?.per_1000 ?? 0 };
    });
  }, [national, nationalYears, selectedGroup]);
  const maxUsers = Math.max(...groupSeries.map((p) => p.users), 1);
  const selectedGroupLabel = groups.find((g) => g.code === selectedGroup)?.label ?? selectedGroup;

  // Per-municipality estimate for the selected group/year/county.
  const useYear = useYears.includes(year) ? year : useYears[useYears.length - 1] ?? "";
  const municipalityEstimate = useMemo(() => {
    return use
      .filter(
        (r) =>
          r.group_code === selectedGroup &&
          r.period === useYear &&
          (county === "all" || r.county_code === county)
      )
      .sort((a, b) => b.value - a.value);
  }, [use, selectedGroup, useYear, county]);

  return (
    <>
      <div className="card filters">
        <label>
          År (nasjonalt)
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {nationalYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          Legemiddelgruppe
          <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
            {groups.map((g) => (
              <option key={g.code} value={g.code}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fylke (estimat per kommune)
          <select value={county} onChange={(e) => setCounty(e.target.value)}>
            <option value="all">Alle</option>
            {countyOptions.map((c) => (
              <option key={c} value={c}>
                {countyLabel(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card table-wrap">
        <h2>Nasjonalt: antall brukere per legemiddelgruppe ({year})</h2>
        <p className="muted">
          Ekte tall fra FHI Legemiddelregisteret (LMR). «Per 1000» = antall individer som fikk minst
          én resept utlevert, per 1000 innbyggere. Trend viser endring i rate fra {nationalYears[0]} til {year}.
        </p>
        <table>
          <thead>
            <tr>
              <th>Legemiddelgruppe</th>
              <th>Brukere</th>
              <th>Per 1000</th>
              <th>Trend (rate)</th>
            </tr>
          </thead>
          <tbody>
            {nationalTable.map((row) => (
              <tr
                key={row.code}
                onClick={() => setSelectedGroup(row.code)}
                style={{
                  cursor: "pointer",
                  backgroundColor: row.code === selectedGroup ? "#f0f0f0" : ""
                }}
              >
                <td>{row.label}</td>
                <td>{row.users.toLocaleString("nb-NO")}</td>
                <td>{row.per1000.toLocaleString("nb-NO")}</td>
                <td>
                  {row.trend === null ? (
                    "-"
                  ) : (
                    <span className="badge">
                      {row.trend > 0 ? "+" : ""}
                      {row.trend.toFixed(1)} %
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Utvikling over tid: {selectedGroupLabel}</h2>
        <p className="muted">Antall brukere nasjonalt per år (FHI LMR).</p>
        <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.6rem" }}>
          {groupSeries.map((p) => (
            <div key={p.period} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ width: "3rem", fontSize: "0.85rem" }}>{p.period}</span>
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
                    width: `${Math.max((p.users / maxUsers) * 100, 1)}%`,
                    background: "var(--brand, #1d4ed8)",
                    height: "100%"
                  }}
                />
              </div>
              <span style={{ width: "6.5rem", textAlign: "right", fontSize: "0.85rem" }}>
                {p.users.toLocaleString("nb-NO")}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card table-wrap">
        <h2>
          Estimat per kommune: {selectedGroupLabel} ({useYear})
        </h2>
        <p className="muted">
          Estimat = nasjonal rate (per 1000) × kommunens folketall (SSB). Reell geografisk fordeling
          kan avvike. Viser {municipalityEstimate.length} kommuner.
        </p>
        <table>
          <thead>
            <tr>
              <th>Kommune</th>
              <th>Fylke</th>
              <th>Estimert antall brukere</th>
              <th>Per 1000</th>
            </tr>
          </thead>
          <tbody>
            {municipalityEstimate.map((row) => (
              <tr key={`${row.municipality_code}-${row.group_code}-${row.period}`}>
                <td>{municipalityLabel(row.municipality_code)}</td>
                <td>{countyLabel(row.county_code)}</td>
                <td>{row.value.toLocaleString("nb-NO")}</td>
                <td>{row.per_1000.toLocaleString("nb-NO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
