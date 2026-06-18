# Regenerates data/boundaries/municipalities.geojson from the Geonorge cache,
# one Point feature (representasjonspunkt) per current municipality.
# Consumed by the map's GeoJSON layer (pointToLayer).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$geo = Get-Content (Join-Path $root "data/derived/municipalities_geo.json") -Raw | ConvertFrom-Json

$features = foreach ($m in ($geo | Sort-Object municipality_code)) {
  [pscustomobject]@{
    type = "Feature"
    properties = [pscustomobject]@{
      municipality_code = $m.municipality_code
      municipality_name = $m.municipality_name
      county_code = $m.county_code
      county_name = $m.county_name
    }
    geometry = [pscustomobject]@{
      type = "Point"
      coordinates = @([double]$m.lon, [double]$m.lat)
    }
  }
}

$fc = [pscustomobject]@{ type = "FeatureCollection"; features = @($features) }
$out = Join-Path $root "data/boundaries/municipalities.geojson"
$fc | ConvertTo-Json -Depth 8 | Out-File -FilePath $out -Encoding utf8
Write-Host "Skrev $out ($($features.Count) features)."
