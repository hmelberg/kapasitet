"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { CapacityRow, FacilityRow, NeedRow } from "../lib/types";

type Props = {
  rows: CapacityRow[];
  facilities: FacilityRow[];
  needRows: NeedRow[];
  municipalityMap: Record<string, string>;
  countyMap: Record<string, string>;
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

const FacilityLeafletMap = dynamic(
  () => import("./facility-leaflet-map").then((mod) => mod.FacilityLeafletMap),
  { ssr: false }
);

export function CapacityView({ rows, facilities, needRows, municipalityMap, countyMap }: Props) {
  const [metric, setMetric] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [county, setCounty] = useState<string>("all");
  const [sector, setSector] = useState<string>("all");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [selectedMunicipalityCode, setSelectedMunicipalityCode] = useState<string | null>(null);

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

  const municipalityOverlays = useMemo(() => {
    const facilitiesByMunicipality = new Map<string, FacilityRow[]>();
    for (const facility of filteredFacilities) {
      const list = facilitiesByMunicipality.get(facility.municipality_code) ?? [];
      list.push(facility);
      facilitiesByMunicipality.set(facility.municipality_code, list);
    }

    const municipalityCodes = Array.from(new Set(filteredRows.map((row) => row.municipality_code))).filter((code) =>
      facilitiesByMunicipality.has(code)
    );

    return municipalityCodes.map((municipalityCode) => {
      const muniFacilities = facilitiesByMunicipality.get(municipalityCode) ?? [];
      const lat = muniFacilities.reduce((sum, facility) => sum + facility.lat, 0) / muniFacilities.length;
      const lon = muniFacilities.reduce((sum, facility) => sum + facility.lon, 0) / muniFacilities.length;
      const capacity = filteredRows
        .filter((row) => row.municipality_code === municipalityCode && row.metric === "ansatte_legger_og_sykepleiere")
        .reduce((sum, row) => sum + row.value, 0);
      const demand = filteredRows
        .filter((row) => row.municipality_code === municipalityCode && row.metric === "mottar_tjeneste_per_dag")
        .reduce((sum, row) => sum + row.value, 0);
      const need = needRows
        .filter((row) => row.municipality_code === municipalityCode && (period === "all" || row.period === period))
        .reduce((sum, row) => sum + row.value, 0);
      const pressure = capacity > 0 ? need / capacity : 0;

      return {
        municipalityCode,
        municipalityName: municipalityMap[municipalityCode] ?? municipalityCode,
        countyName: countyMap[muniFacilities[0]?.county_code ?? ""] ?? muniFacilities[0]?.county_code ?? "",
        lat,
        lon,
        capacity,
        demand,
        need,
        pressure
      };
    });
  }, [filteredFacilities, filteredRows, needRows, municipalityMap, countyMap, period]);

  const municipalityLabel = (municipalityCode: string) => municipalityMap[municipalityCode] ?? municipalityCode;
  const countyLabel = (countyCode: string) => countyMap[countyCode] ?? countyCode;
  const selectedFacility = filteredFacilities.find((facility) => facility.facility_id === selectedFacilityId) ?? filteredFacilities[0] ?? null;
  const selectedMunicipality = municipalityOverlays.find((row) => row.municipalityCode === selectedMunicipalityCode) ?? municipalityOverlays[0] ?? null;

  useEffect(() => {
    if (!filteredFacilities.some((facility) => facility.facility_id === selectedFacilityId)) {
      setSelectedFacilityId(filteredFacilities[0]?.facility_id ?? null);
    }
  }, [filteredFacilities, selectedFacilityId]);

  useEffect(() => {
    if (!municipalityOverlays.some((row) => row.municipalityCode === selectedMunicipalityCode)) {
      setSelectedMunicipalityCode(municipalityOverlays[0]?.municipalityCode ?? null);
    }
  }, [municipalityOverlays, selectedMunicipalityCode]);

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
        <p className="muted">Kartet bruker OpenStreetMap med ekte zoom, pan og popup for institusjoner i Norge.</p>

        <div className="map-toolbar">
          <p className="muted">Institusjoner vist: {filteredFacilities.length}</p>
        </div>

        <div className="map-layout">
          <div className="map-canvas" aria-label="Kartvisning av institusjoner">
            <FacilityLeafletMap
              facilities={filteredFacilities}
              municipalityMap={municipalityMap}
              countyMap={countyMap}
              municipalityOverlays={municipalityOverlays}
              selectedFacilityId={selectedFacility?.facility_id ?? null}
              onSelectFacility={setSelectedFacilityId}
              selectedMunicipalityCode={selectedMunicipality?.municipalityCode ?? null}
              onSelectMunicipality={setSelectedMunicipalityCode}
            />
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

            <h3>Kommuneprofil</h3>
            {selectedMunicipality ? (
              <table>
                <tbody>
                  <tr>
                    <th>Kommune</th>
                    <td>{selectedMunicipality.municipalityName}</td>
                  </tr>
                  <tr>
                    <th>Fylke</th>
                    <td>{selectedMunicipality.countyName}</td>
                  </tr>
                  <tr>
                    <th>Ansatte</th>
                    <td>{selectedMunicipality.capacity.toLocaleString("nb-NO")}</td>
                  </tr>
                  <tr>
                    <th>Tjenester/dag</th>
                    <td>{selectedMunicipality.demand.toLocaleString("nb-NO")}</td>
                  </tr>
                  <tr>
                    <th>Behov</th>
                    <td>{selectedMunicipality.need.toLocaleString("nb-NO")}</td>
                  </tr>
                  <tr>
                    <th>Pressindeks</th>
                    <td>{selectedMunicipality.pressure.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="muted">Ingen kommune valgt.</p>
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