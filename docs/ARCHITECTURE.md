# Architecture: Timeseries & Municipality Boundaries

## Timeseries Support

The current system supports time-series analysis through the `period` field in all data files.

### Data Structure
- **CSV Format**: Each metric includes a `period` column (e.g., "2026", "2025")
- **Multiple Periods**: Same municipality/metric can appear in multiple rows with different periods
- **Period Filtering**: UI includes period dropdown to filter by year

### Example
```
dataset_id,source_id,sector,municipality_code,county_code,period,metric,value
capacity_workforce,ssb_kostra_001,sykehus,0301,03,2026,ansatte_legger_og_sykepleiere,12240
capacity_workforce,ssb_kostra_001,sykehus,0301,03,2025,ansatte_legger_og_sykepleiere,12100
```

### Future Enhancement
To add historical data:
1. Duplicate all rows in capacity.csv, needs.csv for previous years
2. Change `period` field to earlier years (e.g., 2024, 2023)
3. Adjust values to reflect historical trends
4. UI automatically includes new periods in period dropdown

### Time-Range Analysis
- Filter by period to show specific years
- Compare periods by selecting different values
- Compute trends (growth/decline) by comparing capacity/needs across periods

## GeoJSON Municipality Boundaries

### File Structure
Location: `/data/boundaries/municipalities.geojson`

### Format
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "municipality_code": "0301",
        "municipality_name": "Oslo",
        "county_code": "03",
        "county_name": "Oslo"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...], [...], ...]]
      }
    }
  ]
}
```

### Data Sources
- **Primary**: Kartverket (Norwegian Mapping Authority)
  - URL: https://ws.geonorge.no/kommuneinfo/v1/communes
  - Format: Simplified geometries for performance
  - Update frequency: Annually with municipal boundary changes

### Integration with Leaflet
The `FacilityLeafletMap` component currently renders:
- **Circle markers** for municipalities (pressure-based colors)
- **CircleMarker** for institutions (type-based colors)

Future: Add GeoJSON layer for actual municipal boundaries:
```tsx
import { GeoJSON } from 'react-leaflet';

<GeoJSON
  data={municipalitiesGeojson}
  style={(feature) => ({
    fillColor: getPressureColor(pressureMap[feature.properties.municipality_code]),
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.2
  })}
/>
```

### Performance Considerations
- Simplified geometries reduce file size (simplification tolerance: 20m)
- Lazy loading: Only render visible boundaries
- Vector tiles alternative: Consider Mapbox for better performance at scale

### County-Level Boundaries
Add similar structure for fylke (county) boundaries:
- File: `/data/boundaries/counties.geojson`
- Useful for regional analysis and comparisons
- Data source: Same Kartverket API with county geometry

## Implementation Roadmap

### Phase 1 (Current)
✅ Period filtering UI
✅ Multi-municipality data structure
- [ ] Add 2025, 2024 data to CSVs

### Phase 2 (Next)
- [ ] Download GeoJSON from Kartverket
- [ ] Integrate GeoJSON layer in Leaflet map
- [ ] Style boundaries by selected metric

### Phase 3 (Advanced)
- [ ] Time-series charts (pressure over years)
- [ ] Trend analysis (growth/decline)
- [ ] Forecasting (simple linear regression)
- [ ] County vs municipality comparison views
