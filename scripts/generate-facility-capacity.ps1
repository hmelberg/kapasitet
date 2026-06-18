# Adds a capacity indicator to each facility in facilities.csv:
#   sykehus    -> beds (senger), scaled by the municipality population
#   legekontor -> list capacity (pasienter pa liste)
#   apotek     -> customers per day (kunder per dag)
# Values are modelled (deterministic per facility id). Real OSM `beds` tags are
# kept for hospitals where present. Adds columns: capacity_value, capacity_unit.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$normalizedDir = Join-Path $root "data/normalized"
$derivedDir = Join-Path $root "data/derived"

# population per municipality (2025) for hospital scaling
$geo = Get-Content (Join-Path $derivedDir "municipalities_geo.json") -Raw | ConvertFrom-Json
$codes = $geo | ForEach-Object { $_.municipality_code }
$popQuery = @{
  query = @(
    @{ code = "Region"; selection = @{ filter = "item"; values = @($codes) } },
    @{ code = "ContentsCode"; selection = @{ filter = "item"; values = @("Personer1") } },
    @{ code = "Tid"; selection = @{ filter = "item"; values = @("2025") } }
  )
  response = @{ format = "json-stat2" }
} | ConvertTo-Json -Depth 8
$pds = Invoke-RestMethod -Uri "https://data.ssb.no/api/v0/no/table/07459" -Method Post -Body $popQuery -ContentType "application/json" -TimeoutSec 90
$pStride = @{}; $pacc = 1
for ($d = $pds.id.Count - 1; $d -ge 0; $d--) { $pStride[$pds.id[$d]] = $pacc; $pacc *= $pds.size[$d] }
$pRegionIdx = $pds.dimension.Region.category.index; $pTidIdx = $pds.dimension.Tid.category.index
$pop = @{}
foreach ($c in $codes) {
  $ri = $pRegionIdx.$c
  if ($null -ne $ri) { $v = $pds.value[[int]$ri * $pStride["Region"] + [int]$pTidIdx."2025" * $pStride["Tid"]]; $pop[$c] = if ($v) { [int]$v } else { 1000 } }
  else { $pop[$c] = 1000 }
}

function Rand01([string]$id) {
  # stable [0,1) hash of the facility id
  $h = 2166136261
  foreach ($ch in $id.ToCharArray()) { $h = ($h -bxor [int][char]$ch) * 16777619; $h = $h -band 0x7FFFFFFF }
  return ($h % 100000) / 100000.0
}

$path = Join-Path $normalizedDir "facilities.csv"
$lines = Get-Content $path -Encoding utf8
$header = ($lines[0] -replace "^﻿", "") -split ","
$idx = @{}; for ($i = 0; $i -lt $header.Count; $i++) { $idx[$header[$i]] = $i }

$out = New-Object System.Collections.Generic.List[string]
$out.Add((($header + @("capacity_value", "capacity_unit")) -join ","))

for ($i = 1; $i -lt $lines.Count; $i++) {
  if (-not $lines[$i].Trim()) { continue }
  $c = $lines[$i] -split ","
  $type = $c[$idx["facility_type"]]
  $code = $c[$idx["municipality_code"]]
  $beds = [int]$c[$idx["beds"]]
  $r = Rand01 $c[$idx["facility_id"]]

  switch ($type) {
    "sykehus" {
      if ($beds -gt 0) { $val = $beds }
      else {
        $p = if ($pop.ContainsKey($code)) { $pop[$code] } else { 1000 }
        $val = [math]::Round($p * 0.0016 * (0.6 + 0.8 * $r))
        if ($val -lt 8) { $val = 8 }
        if ($val -gt 1300) { $val = 1300 }
      }
      $unit = "senger"
    }
    "legekontor" {
      $val = [math]::Round(1500 + 6000 * $r); $unit = "pasienter pa liste"
    }
    "apotek" {
      $val = [math]::Round(120 + 480 * $r); $unit = "kunder per dag"
    }
    default { $val = 0; $unit = "" }
  }
  $out.Add(($c + @($val, $unit)) -join ",")
}

($out -join "`n") | Out-File -FilePath $path -Encoding utf8
Write-Host "Oppdaterte facilities.csv med kapasitetsindikator ($($out.Count - 1) rader)."
