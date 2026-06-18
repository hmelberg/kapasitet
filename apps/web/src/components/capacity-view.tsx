"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { CapacityRow, FacilityRow, NeedRow } from "../lib/types";
import type { FeatureCollection } from "geojson";
import { TimeseriesComparison } from "./timeseries-comparison";

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

// Mirrors REGION_COLORS in facility-leaflet-map (kept local so this component
// does not statically import the Leaflet module, which is client-only).
const REGION_LEGEND: { label: string; color: string }[] = [
  { label: "Helse Sør-Øst", color: "#7c3aed" },
  { label: "Helse Vest", color: "#0f766e" },
  { label: "Helse Midt-Norge", color: "#ca8a04" },
  { label: "Helse Nord", color: "#0891b2" },
  { label: "Sykehus uten HF / legekontor / apotek", color: "#9ca3af" }
];

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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name" | "pressure" | "capacity">("name");
  const [helseregion, setHelseregion] = useState<string>("all");
  const [sykehusType, setSykehusType] = useState<string>("all");
  const [mapLayers, setMapLayers] = useState<Record<string, boolean>>({
    sykehus: true,
    legekontor: true,
    apotek: false,
    kommune: false
  });
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    // Load GeoJSON boundaries (fallback to empty if not available)
    fetch("/data/boundaries/municipalities.geojson")
      .then((res) => res.json())
      .then((data) => setGeojson(data))
      .catch(() => {
        console.log("Note: GeoJSON boundaries not available, using circle approximations");
      });
  }, []);

  const metricOptions = uniqueSorted(rows.map((row) => row.metric));
  const periodOptions = uniqueSorted(rows.map((row) => row.period));
  const countyOptions = uniqueSorted(rows.map((row) => row.county_code));
  const sectorOptions = uniqueSorted(rows.map((row) => row.sector));
  const regionOptions = uniqueSorted(
    facilities.filter((f) => f.facility_type === "sykehus" && f.helseregion).map((f) => f.helseregion)
  );
  const sykehusTypeOptions = uniqueSorted(
    facilities.filter((f) => f.facility_type === "sykehus" && f.sykehus_kategori).map((f) => f.sykehus_kategori)
  );

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

  const visibleFacilities = useMemo(() => {
    return filteredFacilities.filter((facility) => {
      if (mapLayers[facility.facility_type] !== true) {
        return false;
      }
      if (facility.facility_type === "sykehus") {
        if (helseregion !== "all" && facility.helseregion !== helseregion) {
          return false;
        }
        if (sykehusType !== "all" && facility.sykehus_kategori !== sykehusType) {
          return false;
        }
      }
      return true;
    });
  }, [filteredFacilities, mapLayers, helseregion, sykehusType]);

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

  const municipalityOptions = useMemo(() => {
    const codes = Array.from(
      new Set(
        rows
          .filter((row) => county === "all" || row.county_code === county)
          .map((row) => row.municipality_code)
      )
    );
    return codes
      .map((code) => ({ code, name: municipalityMap[code] ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, county, municipalityMap]);

  const searchedAndSortedMunicipalities = useMemo(() => {
    let result = [...municipalityOverlays];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.municipalityName.toLowerCase().includes(query) ||
          m.countyName.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === "pressure") {
        return b.pressure - a.pressure;
      }
      if (sortBy === "capacity") {
        return b.capacity - a.capacity;
      }
      // Default: sort by name
      return a.municipalityName.localeCompare(b.municipalityName);
    });

    return result;
  }, [municipalityOverlays, searchQuery, sortBy]);

  const municipalityLabel = (municipalityCode: string) => municipalityMap[municipalityCode] ?? municipalityCode;
  const countyLabel = (countyCode: string) => countyMap[countyCode] ?? countyCode;
  const selectedFacility = visibleFacilities.find((facility) => facility.facility_id === selectedFacilityId) ?? visibleFacilities[0] ?? null;
  const selectedMunicipality = municipalityOverlays.find((row) => row.municipalityCode === selectedMunicipalityCode) ?? municipalityOverlays[0] ?? null;

  useEffect(() => {
    if (!visibleFacilities.some((facility) => facility.facility_id === selectedFacilityId)) {
      setSelectedFacilityId(visibleFacilities[0]?.facility_id ?? null);
    }
  }, [visibleFacilities, selectedFacilityId]);

  const toggleMapLayer = (layer: string) => {
    setMapLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  };

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

        <label>
          Helseregion (sykehus)
          <select value={helseregion} onChange={(event) => setHelseregion(event.target.value)}>
            <option value="all">Alle</option>
            {regionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sykehustype
          <select value={sykehusType} onChange={(event) => setSykehusType(event.target.value)}>
            <option value="all">Alle</option>
            {sykehusTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Søk kommune/fylke
          <input
            type="text"
            placeholder="F.eks Oslo, Bergen, Rogaland..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>

        <label>
          Sorter etter
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "name" | "pressure" | "capacity")}>
            <option value="name">Navn</option>
            <option value="pressure">Pressindeks (høyeste først)</option>
            <option value="capacity">Kapasitet (høyeste først)</option>
          </select>
        </label>
      </div>

      <div className="card">
        <h2>Kartlag for institusjoner</h2>
        <p className="muted">Kartet bruker OpenStreetMap med ekte zoom, pan og popup for institusjoner i Norge.</p>

        <div className="map-toolbar">
          <p className="muted">Institusjoner vist: {visibleFacilities.length}</p>
          <div className="layer-filters" role="group" aria-label="Velg markorer pa kartet">
            <label>
              <input
                type="checkbox"
                checked={mapLayers.sykehus}
                onChange={() => toggleMapLayer("sykehus")}
              />
              Sykehus
            </label>
            <label>
              <input
                type="checkbox"
                checked={mapLayers.legekontor}
                onChange={() => toggleMapLayer("legekontor")}
              />
              Legekontor
            </label>
            <label>
              <input
                type="checkbox"
                checked={mapLayers.apotek}
                onChange={() => toggleMapLayer("apotek")}
              />
              Apotek
            </label>
            <label>
              <input
                type="checkbox"
                checked={mapLayers.kommune}
                onChange={() => toggleMapLayer("kommune")}
              />
              Kommune
            </label>
          </div>
        </div>

        <div className="map-legend" style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", margin: "0.4rem 0 0.8rem" }}>
          {REGION_LEGEND.map((item) => (
            <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem" }}>
              <span
                style={{
                  width: "0.8rem",
                  height: "0.8rem",
                  borderRadius: "50%",
                  background: item.color,
                  border: "1px solid #fff",
                  boxShadow: "0 0 0 1px #ccc"
                }}
              />
              {item.label}
            </span>
          ))}
        </div>

        <div className="map-layout">
          <div className="map-canvas" aria-label="Kartvisning av institusjoner">
            <FacilityLeafletMap
              facilities={visibleFacilities}
              municipalityMap={municipalityMap}
              countyMap={countyMap}
              municipalityOverlays={municipalityOverlays}
              selectedFacilityId={selectedFacility?.facility_id ?? null}
              onSelectFacility={setSelectedFacilityId}
              selectedMunicipalityCode={selectedMunicipality?.municipalityCode ?? null}
              onSelectMunicipality={setSelectedMunicipalityCode}
              geojson={geojson ?? undefined}
              showMunicipalityLayer={mapLayers.kommune}
            />
          </div>

          <aside className="map-panel card">
            <h3>Valgt institusjon</h3>
            {selectedFacility ? (
              <>
                <p><strong>{selectedFacility.name}</strong></p>
                <p className="muted">
                  {selectedFacility.facility_type}
                  {selectedFacility.facility_type === "sykehus" && selectedFacility.sykehus_kategori
                    ? ` · ${selectedFacility.sykehus_kategori}`
                    : ""}
                </p>
                <table>
                  <tbody>
                    {selectedFacility.facility_type === "sykehus" && selectedFacility.helseregion ? (
                      <tr>
                        <th>Helseregion</th>
                        <td>{selectedFacility.helseregion}</td>
                      </tr>
                    ) : null}
                    {selectedFacility.facility_type === "sykehus" && selectedFacility.helseforetak ? (
                      <tr>
                        <th>Helseforetak</th>
                        <td>{selectedFacility.helseforetak}</td>
                      </tr>
                    ) : null}
                    <tr>
                      <th>Kommune</th>
                      <td>{municipalityLabel(selectedFacility.municipality_code)}</td>
                    </tr>
                    <tr>
                      <th>Fylke</th>
                      <td>{countyLabel(selectedFacility.county_code)}</td>
                    </tr>
                    <tr>
                      <th>Kapasitet</th>
                      <td>{selectedFacility.capacity_value.toLocaleString("nb-NO")} {selectedFacility.capacity_unit}</td>
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
        <h3>Kommune-oversikt (sortering: {sortBy === "pressure" ? "Pressindeks" : sortBy === "capacity" ? "Kapasitet" : "Navn"})</h3>
        <table>
          <thead>
            <tr>
              <th>Kommune</th>
              <th>Fylke</th>
              <th>Ansatte</th>
              <th>Behov</th>
              <th>Pressindeks</th>
            </tr>
          </thead>
          <tbody>
            {searchedAndSortedMunicipalities.map((municipality) => (
              <tr
                key={municipality.municipalityCode}
                onClick={() => setSelectedMunicipalityCode(municipality.municipalityCode)}
                style={{
                  cursor: "pointer",
                  backgroundColor: municipality.municipalityCode === selectedMunicipalityCode ? "#f0f0f0" : ""
                }}
              >
                <td>{municipality.municipalityName}</td>
                <td>{municipality.countyName}</td>
                <td>{municipality.capacity.toLocaleString("nb-NO")}</td>
                <td>{municipality.need.toLocaleString("nb-NO")}</td>
                <td>
                  <strong>{municipality.pressure.toFixed(2)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Totalt: {searchedAndSortedMunicipalities.length} kommuner</p>
      </div>

      <TimeseriesComparison
        rows={rows}
        needRows={needRows}
        selectedMunicipalityCode={selectedMunicipality?.municipalityCode ?? null}
        onSelectMunicipality={setSelectedMunicipalityCode}
        municipalityOptions={municipalityOptions}
        municipalityMap={municipalityMap}
        sector={sector}
        activePeriod={period}
      />

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