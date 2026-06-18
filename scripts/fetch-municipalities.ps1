# Fetches all current Norwegian municipalities from Geonorge (Kartverket),
# including official name, county, centroid (representasjonspunkt) and bounding box.
# Writes:
#   data/derived/municipalities_geo.json  (full cache used by other generators)
#   data/normalized/municipalities.csv    (app data)
# Source: https://ws.geonorge.no/kommuneinfo/v1/  (Kartverket, NLOD-lisens)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$derivedDir = Join-Path $root "data/derived"
$normalizedDir = Join-Path $root "data/normalized"

function Invoke-GeonorgeJson($url) {
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      return Invoke-RestMethod -Uri $url -TimeoutSec 30
    } catch {
      if ($attempt -eq 4) { throw }
      Start-Sleep -Milliseconds (250 * $attempt)
    }
  }
}

Write-Host "Henter fylkesliste..."
$fylker = Invoke-GeonorgeJson "https://ws.geonorge.no/kommuneinfo/v1/fylker"
$fylkeNavn = @{}
foreach ($f in $fylker) { $fylkeNavn[$f.fylkesnummer] = $f.fylkesnavn }

Write-Host "Henter kommuneliste..."
$kommuner = Invoke-GeonorgeJson "https://ws.geonorge.no/kommuneinfo/v1/kommuner"
$total = $kommuner.Count
Write-Host "  $total kommuner funnet."

$result = New-Object System.Collections.Generic.List[object]
$i = 0
foreach ($k in ($kommuner | Sort-Object kommunenummer)) {
  $i++
  $nr = $k.kommunenummer
  $detail = Invoke-GeonorgeJson "https://ws.geonorge.no/kommuneinfo/v1/kommuner/$nr"
  $pt = $detail.punktIOmrade.coordinates   # [lon, lat]
  $bbox = $detail.avgrensningsboks.coordinates[0]  # ring of [lon,lat]
  $fnr = $detail.fylkesnummer

  $result.Add([pscustomobject]@{
    municipality_code = $nr
    county_code       = $fnr
    municipality_name = $detail.kommunenavnNorsk
    county_name       = if ($fylkeNavn.ContainsKey($fnr)) { $fylkeNavn[$fnr] } else { $detail.fylkesnavn }
    lon               = [math]::Round([double]$pt[0], 5)
    lat               = [math]::Round([double]$pt[1], 5)
    bbox              = @(
      [math]::Round([double]$bbox[0][0], 5),  # west lon
      [math]::Round([double]$bbox[0][1], 5),  # south lat
      [math]::Round([double]$bbox[2][0], 5),  # east lon
      [math]::Round([double]$bbox[2][1], 5)   # north lat
    )
  }) | Out-Null

  if ($i % 25 -eq 0) { Write-Host "  $i / $total ..." }
}

New-Item -ItemType Directory -Force -Path $derivedDir | Out-Null
$jsonPath = Join-Path $derivedDir "municipalities_geo.json"
$result | ConvertTo-Json -Depth 6 | Out-File -FilePath $jsonPath -Encoding utf8
Write-Host "Skrev $jsonPath ($($result.Count) kommuner)"

# Write municipalities.csv (sorted by code)
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("municipality_code,county_code,municipality_name,county_name")
foreach ($m in ($result | Sort-Object municipality_code)) {
  $name = $m.municipality_name -replace ",", " "
  $cname = $m.county_name -replace ",", " "
  $lines.Add("$($m.municipality_code),$($m.county_code),$name,$cname")
}
$csvPath = Join-Path $normalizedDir "municipalities.csv"
$lines -join "`n" | Out-File -FilePath $csvPath -Encoding utf8
Write-Host "Skrev $csvPath ($($result.Count) rader)"
