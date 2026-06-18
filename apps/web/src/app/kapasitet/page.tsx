import { CapacityView } from "../../components/capacity-view";
import {
  loadCapacityRows,
  loadFacilityRows,
  loadHfCapacityRows,
  loadHospitalUnitBedRows,
  loadMunicipalityRows,
  loadNeedRows
} from "../../lib/csv";

export default function KapasitetPage() {
  const rows = loadCapacityRows();
  const facilities = loadFacilityRows();
  const needRows = loadNeedRows();
  const hfCapacity = loadHfCapacityRows();
  const hospitalUnitBeds = loadHospitalUnitBedRows();
  const municipalities = loadMunicipalityRows();
  const municipalityMap = Object.fromEntries(
    municipalities.map((row) => [row.municipality_code, row.municipality_name])
  );
  const countyMap = Object.fromEntries(
    municipalities.map((row) => [row.county_code, row.county_name])
  );

  return (
    <section className="grid">
      <div className="card">
        <h1>Kart og kapasitet</h1>
        <p className="muted">
          Denne visningen leser direkte fra CSV-filer i repoet med filtrering per indikator, periode og fylke.
        </p>
      </div>
      <CapacityView
        rows={rows}
        facilities={facilities}
        needRows={needRows}
        hfCapacity={hfCapacity}
        hospitalUnitBeds={hospitalUnitBeds}
        municipalityMap={municipalityMap}
        countyMap={countyMap}
      />
    </section>
  );
}
