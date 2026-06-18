"use client";

import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { FacilityRow } from "../lib/types";

type MunicipalityOverlay = {
  municipalityCode: string;
  municipalityName: string;
  countyName: string;
  lat: number;
  lon: number;
  capacity: number;
  demand: number;
  need: number;
  pressure: number;
};

type Props = {
  facilities: FacilityRow[];
  municipalityMap: Record<string, string>;
  countyMap: Record<string, string>;
  municipalityOverlays: MunicipalityOverlay[];
  selectedFacilityId: string | null;
  onSelectFacility: (facilityId: string) => void;
  selectedMunicipalityCode: string | null;
  onSelectMunicipality: (municipalityCode: string) => void;
};

function getMarkerColor(facilityType: string) {
  if (facilityType === "sykehus") {
    return "#0f766e";
  }
  if (facilityType === "legekontor") {
    return "#2563eb";
  }
  return "#dc2626";
}

function getPressureColor(pressure: number) {
  if (pressure >= 18) {
    return "#b91c1c";
  }
  if (pressure >= 12) {
    return "#ea580c";
  }
  if (pressure >= 8) {
    return "#d97706";
  }
  return "#0f766e";
}

function FitToFacilities({ facilities }: { facilities: FacilityRow[] }) {
  const map = useMap();

  useEffect(() => {
    if (facilities.length === 0) {
      map.setView([64.5, 14], 4);
      return;
    }

    if (facilities.length === 1) {
      map.setView([facilities[0].lat, facilities[0].lon], 8);
      return;
    }

    const bounds = facilities.map((facility) => [facility.lat, facility.lon] as [number, number]);
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [facilities, map]);

  return null;
}

export function FacilityLeafletMap({
  facilities,
  municipalityMap,
  countyMap,
  municipalityOverlays,
  selectedFacilityId,
  onSelectFacility,
  selectedMunicipalityCode,
  onSelectMunicipality
}: Props) {
  const municipalityLabel = (municipalityCode: string) => municipalityMap[municipalityCode] ?? municipalityCode;
  const countyLabel = (countyCode: string) => countyMap[countyCode] ?? countyCode;

  return (
    <MapContainer
      center={[64.5, 14]}
      zoom={4}
      scrollWheelZoom
      className="leaflet-map"
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitToFacilities facilities={facilities} />

      {municipalityOverlays.map((overlay) => {
        const isSelected = overlay.municipalityCode === selectedMunicipalityCode;

        return (
          <Circle
            key={overlay.municipalityCode}
            center={[overlay.lat, overlay.lon]}
            radius={isSelected ? 32000 : 24000}
            pathOptions={{
              color: getPressureColor(overlay.pressure),
              weight: isSelected ? 3 : 2,
              fillColor: getPressureColor(overlay.pressure),
              fillOpacity: isSelected ? 0.22 : 0.12
            }}
            eventHandlers={{
              click: () => onSelectMunicipality(overlay.municipalityCode)
            }}
          >
            <Popup>
              <strong>{overlay.municipalityName}</strong>
              <br />
              Fylke: {overlay.countyName}
              <br />
              Ansatte: {overlay.capacity.toLocaleString("nb-NO")}
              <br />
              Tjenester per dag: {overlay.demand.toLocaleString("nb-NO")}
              <br />
              Behov: {overlay.need.toLocaleString("nb-NO")}
              <br />
              Pressindeks: {overlay.pressure.toFixed(2)}
            </Popup>
          </Circle>
        );
      })}

      {facilities.map((facility) => {
        const isSelected = facility.facility_id === selectedFacilityId;

        return (
          <CircleMarker
            key={facility.facility_id}
            center={[facility.lat, facility.lon]}
            radius={isSelected ? 11 : 8}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: getMarkerColor(facility.facility_type),
              fillOpacity: 0.92
            }}
            eventHandlers={{
              click: () => onSelectFacility(facility.facility_id)
            }}
          >
            <Popup>
              <strong>{facility.name}</strong>
              <br />
              {facility.facility_type}
              <br />
              Kommune: {municipalityLabel(facility.municipality_code)}
              <br />
              Fylke: {countyLabel(facility.county_code)}
              <br />
              Senger: {facility.beds.toLocaleString("nb-NO")}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}