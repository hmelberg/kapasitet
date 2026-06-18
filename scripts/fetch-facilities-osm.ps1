# Fetches real health facilities (hospitals, pharmacies, GP offices) for all of
# Norway from OpenStreetMap via the Overpass API, and assigns each to a
# municipality using the Geonorge centroids/bounding boxes (point-in-bbox, then
# nearest centroid). Writes data/normalized/facilities.csv.
#
# facility_type mapping (matches the map layer keys in the app):
#   sykehus    <- amenity=hospital / healthcare=hospital
#   apotek     <- amenity=pharmacy / healthcare=pharmacy
#   legekontor <- amenity=doctors  / healthcare=doctor / healthcare=centre
#
# Source: OpenStreetMap contributors (ODbL). Coordinates are real; municipality
# assignment is geometric (approximate near municipality borders).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$derivedDir = Join-Path $root "data/derived"
$normalizedDir = Join-Path $root "data/normalized"

$geo = Get-Content (Join-Path $derivedDir "municipalities_geo.json") -Raw | ConvertFrom-Json

$query = @"
[out:json][timeout:300];
area["ISO3166-1"="NO"][admin_level=2]->.no;
(
  nwr["amenity"="hospital"](area.no);
  nwr["healthcare"="hospital"](area.no);
  nwr["amenity"="pharmacy"](area.no);
  nwr["healthcare"="pharmacy"](area.no);
  nwr["amenity"="doctors"](area.no);
  nwr["healthcare"="doctor"](area.no);
  nwr["healthcare"="centre"](area.no);
);
out center tags;
"@

$endpoints = @(
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
)

$data = $null
foreach ($ep in $endpoints) {
  try {
    Write-Host "Spør Overpass: $ep ..."
    $data = Invoke-RestMethod -Uri $ep -Method Post -Body @{ data = $query } -TimeoutSec 300
    if ($data.elements.Count -gt 0) { break }
  } catch {
    Write-Host "  feilet: $($_.Exception.Message)"
  }
}
if ($null -eq $data -or $data.elements.Count -eq 0) { throw "Ingen data fra Overpass." }
Write-Host "Mottok $($data.elements.Count) elementer."

function Get-FacilityType($tags) {
  if ($tags.amenity -eq "hospital" -or $tags.healthcare -eq "hospital") { return "sykehus" }
  if ($tags.amenity -eq "pharmacy" -or $tags.healthcare -eq "pharmacy") { return "apotek" }
  if ($tags.amenity -eq "doctors" -or $tags.healthcare -eq "doctor" -or $tags.healthcare -eq "centre") { return "legekontor" }
  return $null
}

# Pre-extract centroids into arrays for fast nearest lookup
$mCode = @(); $mCounty = @(); $mLat = @(); $mLon = @(); $mW = @(); $mS = @(); $mE = @(); $mN = @()
foreach ($m in $geo) {
  $mCode += $m.municipality_code; $mCounty += $m.county_code
  $mLat += [double]$m.lat; $mLon += [double]$m.lon
  $mW += [double]$m.bbox[0]; $mS += [double]$m.bbox[1]; $mE += [double]$m.bbox[2]; $mN += [double]$m.bbox[3]
}
$count = $mCode.Count

function Find-Municipality([double]$lat, [double]$lon) {
  $best = -1; $bestDist = [double]::MaxValue
  $cos = [math]::Cos($lat * [math]::PI / 180.0)
  for ($i = 0; $i -lt $count; $i++) {
    $dLat = $lat - $mLat[$i]
    $dLon = ($lon - $mLon[$i]) * $cos
    $dist = $dLat * $dLat + $dLon * $dLon
    $inBox = ($lon -ge $mW[$i] -and $lon -le $mE[$i] -and $lat -ge $mS[$i] -and $lat -le $mN[$i])
    if ($inBox) { $dist = $dist * 0.0001 }   # strongly prefer bbox containment
    if ($dist -lt $bestDist) { $bestDist = $dist; $best = $i }
  }
  return $best
}

$rows = New-Object System.Collections.Generic.List[object]
$perMuniType = @{}
$skipped = 0
foreach ($el in $data.elements) {
  $tags = $el.tags
  if ($null -eq $tags) { $skipped++; continue }
  $ftype = Get-FacilityType $tags
  if ($null -eq $ftype) { $skipped++; continue }

  if ($el.type -eq "node") { $lat = $el.lat; $lon = $el.lon }
  else { $lat = $el.center.lat; $lon = $el.center.lon }
  if ($null -eq $lat -or $null -eq $lon) { $skipped++; continue }

  # Mainland Norway bounds. Excludes Svalbard/Jan Mayen, which are outside the
  # municipality structure and would otherwise be mis-assigned to Finnmark.
  if ($lat -lt 57 -or $lat -gt 72 -or $lon -lt 3 -or $lon -gt 32) { $skipped++; continue }

  $idx = Find-Municipality ([double]$lat) ([double]$lon)
  if ($idx -lt 0) { $skipped++; continue }
  $code = $mCode[$idx]; $cc = $mCounty[$idx]

  $key = "$code|$ftype"
  $n = ($perMuniType[$key] | ForEach-Object { $_ }); if ($null -eq $n) { $n = 0 }
  $n++; $perMuniType[$key] = $n

  $name = $tags.name
  if ([string]::IsNullOrWhiteSpace($name)) {
    $name = switch ($ftype) { "sykehus" { "Sykehus" } "apotek" { "Apotek" } default { "Legekontor" } }
  }
  $name = ($name -replace "[,\r\n]", " ").Trim()

  $beds = 0
  if ($tags.beds -and ($tags.beds -match '^\d+$')) { $beds = [int]$tags.beds }

  $rows.Add([pscustomobject]@{
    facility_id = "fac_osm_$($el.type)_$($el.id)"
    source_id = "osm_overpass_001"
    name = $name
    facility_type = $ftype
    municipality_code = $code
    county_code = $cc
    lat = [math]::Round([double]$lat, 5)
    lon = [math]::Round([double]$lon, 5)
    beds = $beds
    last_updated = "2026-06-18"
  }) | Out-Null
}

Write-Host "Beholdt $($rows.Count) institusjoner (hoppet over $skipped)."
$byType = $rows | Group-Object facility_type | ForEach-Object { "$($_.Name)=$($_.Count)" }
Write-Host "Per type: $($byType -join ', ')"

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("facility_id,source_id,name,facility_type,municipality_code,county_code,lat,lon,beds,last_updated")
foreach ($r in ($rows | Sort-Object municipality_code, facility_type, name)) {
  $lines.Add("$($r.facility_id),$($r.source_id),$($r.name),$($r.facility_type),$($r.municipality_code),$($r.county_code),$($r.lat),$($r.lon),$($r.beds),$($r.last_updated)")
}
($lines -join "`n") | Out-File -FilePath (Join-Path $normalizedDir "facilities.csv") -Encoding utf8
Write-Host "Skrev facilities.csv ($($rows.Count) rader)."
