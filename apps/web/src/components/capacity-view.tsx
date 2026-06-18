"use client";

import { useEffect, useMemo, useState } from "react";
import type { CapacityRow, FacilityRow } from "../lib/types";

type Props = {
  rows: CapacityRow[];
  facilities: FacilityRow[];
  municipalityMap: Record<string, string>;
  countyMap: Record<string, string>;
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function getFacilityPointPosition(facility: FacilityRow) {
  const minLat = 57;
  const maxLat = 72;
  const minLon = 3;
  const maxLon = 32;

  const x = ((facility.lon - minLon) / (maxLon - minLon)) * 100;
  const y = ((maxLat - facility.lat) / (maxLat - minLat)) * 100;
  return { x, y };
}

function clampZoom(value: number) {
  return Math.min(2.4, Math.max(1, value));
}

export function CapacityView({ rows, facilities, municipalityMap, countyMap }: Props) {
  const [metric, setMetric] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [county, setCounty] = useState<string>("all");
  const [sector, setSector] = useState<string>("all");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.2);

  const metricOptions = uniqueSorted(rows.map((row) => row.metric));
  const periodOptions = uniqueSorted(rows.map((row) => row.period));
  const countyOptions = uniqueSorted(rows.map((row) => row.county_code));
  const sectorOptions = uniqueSorted(rows.map((row) => row.sector));

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
      if (sector !== "all" && row.sector !== sector) {
        return false;
      }
      return true;
    });
  }, [rows, metric, period, county, sector]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter((facility) => {
      if (county !== "all" && facility.county_code !== county) {
        return false;
      }
      return true;
    });
  }, [facilities, county]);

  const municipalityLabel = (municipalityCode: string) => municipalityMap[municipalityCode] ?? municipalityCode;
  const countyLabel = (countyCode: string) => countyMap[countyCode] ?? countyCode;
  const selectedFacility = filteredFacilities.find((facility) => facility.facility_id === selectedFacilityId) ?? filteredFacilities[0] ?? null;

  useEffect(() => {
    if (!filteredFacilities.some((facility) => facility.facility_id === selectedFacilityId)) {
      setSelectedFacilityId(filteredFacilities[0]?.facility_id ?? null);
    }
  }, [filteredFacilities, selectedFacilityId]);

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
                {countyLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sektor
          <select value={sector} onChange={(event) => setSector(event.target.value)}>
            <option value="all">Alle</option>
            {sectorOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <h2>Kartlag for institusjoner</h2>
        <p className="muted">Kartet er nå klikkbart med zoom og infofelt for valgt institusjon.</p>

        <div className="map-toolbar">
          <div className="button-row">
            <button type="button" className="action-button secondary" onClick={() => setZoom((value) => clampZoom(value - 0.2))}>
              Zoom -
            </button>
            <button type="button" className="action-button secondary" onClick={() => setZoom(1.2)}>
              Nullstill
            </button>
            <button type="button" className="action-button secondary" onClick={() => setZoom((value) => clampZoom(value + 0.2))}>
              Zoom +
            </button>
          </div>
          <p className="muted">Institusjoner vist: {filteredFacilities.length}</p>
        </div>

        <div className="map-layout">
          <div className="map-canvas" aria-label="Kartvisning av institusjoner">
            <div className="map-stage" style={{ transform: `scale(${zoom})` }}>
              <svg className="norway-shape" viewBox="0 0 100 160" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <path
                  d="M58 6 L64 13 L66 20 L63 27 L67 34 L72 42 L69 50 L73 58 L71 66 L75 73 L70 81 L73 88 L69 95 L66 104 L62 112 L58 120 L53 128 L48 135 L43 143 L40 151 L34 156 L28 151 L26 144 L22 139 L24 132 L21 124 L24 117 L21 109 L24 100 L21 91 L25 82 L23 73 L27 65 L26 56 L30 48 L29 39 L34 31 L37 23 L42 16 L48 11 Z"
                  className="norway-outline"
                />
              </svg>

              {filteredFacilities.map((facility) => {
                const point = getFacilityPointPosition(facility);
                const isSelected = facility.facility_id === selectedFacility?.facility_id;

                return (
                  <button
                    key={facility.facility_id}
                    type="button"
                    className={`map-point type-${facility.facility_type}${isSelected ? " selected" : ""}`}
                    title={`${facility.name} (${facility.facility_type}) | Kommune ${municipalityLabel(facility.municipality_code)} | Senger ${facility.beds}`}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    onClick={() => setSelectedFacilityId(facility.facility_id)}
                  >
                    <span className="sr-only">{facility.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="map-panel card">
            <h3>Valgt institusjon</h3>
            {selectedFacility ? (
              <>
                <p><strong>{selectedFacility.name}</strong></p>
                <p className="muted">{selectedFacility.facility_type}</p>
                <table>
                  <tbody>
                    <tr>
                      <th>Kommune</th>
                      <td>{municipalityLabel(selectedFacility.municipality_code)}</td>
                    </tr>
                    <tr>
                      <th>Fylke</th>
                      <td>{countyLabel(selectedFacility.county_code)}</td>
                    </tr>
                    <tr>
                      <th>Senger</th>
                      <td>{selectedFacility.beds.toLocaleString("nb-NO")}</td>
                    </tr>
                    <tr>
                      <th>Koordinater</th>
                      <td>{selectedFacility.lat.toFixed(3)}, {selectedFacility.lon.toFixed(3)}</td>
                    </tr>
                    <tr>
                      <th>Oppdatert</th>
                      <td>{selectedFacility.last_updated}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <p className="muted">Ingen institusjon valgt.</p>
            )}
          </aside>
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kommune</th>
              <th>Fylke</th>
              <th>Sektor</th>
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
                <td>{municipalityLabel(row.municipality_code)}</td>
                <td>{countyLabel(row.county_code)}</td>
                <td>{row.sector}</td>
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