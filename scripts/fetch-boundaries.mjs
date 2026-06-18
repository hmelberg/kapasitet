// Kartverket Kommune Boundaries GeoJSON Downloader
// This script fetches simplified municipality boundaries from Kartverket
// and stores them for use in the Leaflet map component

const fs = require('fs');
const path = require('path');

async function downloadMunicipalityBoundaries() {
  console.log('Downloading Norwegian municipality boundaries from Kartverket...');
  
  try {
    // Kartverket provides simplified GeoJSON via their NVDB API
    // Using simplified geometries (simplification: 20m) for better performance
    const url = 'https://ws.geonorge.no/kommuneinfo/v1/communes?include=geometry&simplify=true';
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Convert to FeatureCollection format compatible with react-leaflet
    const features = data.communes.map(kommune => ({
      type: 'Feature',
      properties: {
        municipality_code: kommune.kommunenummer,
        municipality_name: kommune.kommunenavn,
        county_code: kommune.fylkesnummer,
        county_name: kommune.fylkesnavn
      },
      geometry: kommune.geometri
    }));
    
    const geojson = {
      type: 'FeatureCollection',
      features: features
    };
    
    // Save to data directory
    const outputPath = path.join(__dirname, '..', 'data', 'boundaries', 'municipalities.geojson');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
    
    console.log(`✅ Downloaded ${features.length} municipality boundaries`);
    console.log(`📁 Saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error downloading boundaries:', error.message);
    console.log('📝 Fallback: Using simplified static boundaries instead');
    
    // Fallback: Create minimal boundary data
    const fallbackPath = path.join(__dirname, '..', 'data', 'boundaries', 'municipalities.geojson');
    fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
    
    const fallbackData = {
      type: 'FeatureCollection',
      features: []
      // Features will be added by the Leaflet component using circle approximations
    };
    
    fs.writeFileSync(fallbackPath, JSON.stringify(fallbackData, null, 2));
  }
}

// Run if executed directly
if (require.main === module) {
  downloadMunicipalityBoundaries();
}

module.exports = { downloadMunicipalityBoundaries };
