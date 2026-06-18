"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { FacilityRow } from "../lib/types";

type Props = {
  facilities: FacilityRow[];
  municipalityMap: Record<string, string>;
  countyMap: Record<string, string>;
  selectedFacilityId: string | null;
  onSelectFacility: (facilityId: string) => void;
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
  selectedFacilityId,
  onSelectFacility
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