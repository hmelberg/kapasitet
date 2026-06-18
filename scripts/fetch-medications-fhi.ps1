# Fetches REAL national medication-use data from FHI Legemiddelregisteret (LMR),
# table 825 "Per ATC-kode", for a curated set of drug groups. Writes:
#   data/normalized/medications.csv         national, real: users + per-1000 per year
#   data/normalized/medication_use.csv      per-municipality ESTIMATE (national rate x population)
#
# Source: FHI Legemiddelregisteret (https://www.fhi.no/he/legemiddelbruk), CC BY 4.0.
# National figures are real. Per-municipality figures are estimates: the real
# national users-per-1000 rate applied to each municipality's real population.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$normalizedDir = Join-Path $root "data/normalized"
$derivedDir = Join-Path $root "data/derived"
$fhi = "https://statistikk-data.fhi.no/api/open/v1"

$groups = [ordered]@{
  "R03"  = "Astma og KOLS"
  "A10"  = "Diabetes"
  "C10"  = "Kolesterolsenkende"
  "C09"  = "Blodtrykk (RAAS-hemmere)"
  "C07"  = "Betablokkere"
  "N06A" = "Antidepressiva"
  "N05B" = "Angstdempende"
  "N06B" = "ADHD / psykostimulerende"
  "H03"  = "Stoffskifte (thyreoidea)"
  "M05B" = "Benskjorhet (osteoporose)"
  "N02A" = "Opioider (smertestillende)"
  "R06"  = "Allergi (antihistaminer)"
  "A02B" = "Magesyre (protonpumpehemmere)"
  "N03A" = "Epilepsi"
}
$nationalYears = @("2010","2013","2016","2019","2022","2023","2024","2025")
$muniYears = @("2024","2025")

# --- query LMR table 825 ---
$dims = @(
  @{ code = "Atc_Verdi"; filter = "item"; values = @($groups.Keys) },
  @{ code = "Kjonn_Verdi"; filter = "item"; values = @("TOTALT") },
  @{ code = "Aldersgruppe_Verdi"; filter = "item"; values = @("TOTALT") },
  @{ code = "Utlevering_Ar"; filter = "item"; values = @($nationalYears) },
  @{ code = "MEASURE_TYPE"; filter = "item"; values = @("AntallBrukere", "Brukere_Per1000_Innbyggere") }
)
$body = @{ dimensions = $dims; response = @{ format = "json-stat2"; maxRowCount = 50000 } } | ConvertTo-Json -Depth 8
Write-Host "Henter legemiddeldata fra FHI LMR..."
$ds = Invoke-RestMethod -Uri "$fhi/lmr/Table/825/data" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90

# generic json-stat2 indexer
$ids = $ds.id; $size = $ds.size
$stride = @{}; $acc = 1
for ($d = $ids.Count - 1; $d -ge 0; $d--) { $stride[$ids[$d]] = $acc; $acc *= $size[$d] }
function Idx($dimCode, $catValue) { return [array]::IndexOf($ds.dimension.$dimCode.category.index, $catValue) }
function Val($atc, $year, $measure) {
  $flat = (Idx "Atc_Verdi" $atc) * $stride["Atc_Verdi"] +
          (Idx "Kjonn_Verdi" "TOTALT") * $stride["Kjonn_Verdi"] +
          (Idx "Aldersgruppe_Verdi" "TOTALT") * $stride["Aldersgruppe_Verdi"] +
          (Idx "Utlevering_Ar" $year) * $stride["Utlevering_Ar"] +
          (Idx "MEASURE_TYPE" $measure) * $stride["MEASURE_TYPE"]
  return $ds.value[$flat]
}

# --- national CSV ---
$natLines = New-Object System.Collections.Generic.List[string]
$natLines.Add("group_code,group_label,period,users,per_1000,source_id,last_updated")
$rate = @{}  # rate[atc][year] = per-1000
foreach ($atc in $groups.Keys) {
  $rate[$atc] = @{}
  foreach ($y in $nationalYears) {
    $u = Val $atc $y "AntallBrukere"
    $p = Val $atc $y "Brukere_Per1000_Innbyggere"
    if ($null -eq $u) { $u = 0 }
    if ($null -eq $p) { $p = 0 }
    $rate[$atc][$y] = [double]$p
    $natLines.Add("$atc,$($groups[$atc]),$y,$([int]$u),$p,fhi_lmr_825,2026-02-16")
  }
}
($natLines -join "`n") | Out-File -FilePath (Join-Path $normalizedDir "medications.csv") -Encoding utf8
Write-Host "Skrev medications.csv ($($natLines.Count - 1) rader)."

# --- per-municipality estimate ---
$geo = Get-Content (Join-Path $derivedDir "municipalities_geo.json") -Raw | ConvertFrom-Json
$codes = $geo | ForEach-Object { $_.municipality_code }

Write-Host "Henter folketall fra SSB ($($muniYears -join ', '))..."
$popQuery = @{
  query = @(
    @{ code = "Region"; selection = @{ filter = "item"; values = @($codes) } },
    @{ code = "ContentsCode"; selection = @{ filter = "item"; values = @("Personer1") } },
    @{ code = "Tid"; selection = @{ filter = "item"; values = @($muniYears) } }
  )
  response = @{ format = "json-stat2" }
} | ConvertTo-Json -Depth 8
$pds = Invoke-RestMethod -Uri "https://data.ssb.no/api/v0/no/table/07459" -Method Post -Body $popQuery -ContentType "application/json" -TimeoutSec 90
$pStride = @{}; $pacc = 1
for ($d = $pds.id.Count - 1; $d -ge 0; $d--) { $pStride[$pds.id[$d]] = $pacc; $pacc *= $pds.size[$d] }
$pRegionIdx = $pds.dimension.Region.category.index
$pTidIdx = $pds.dimension.Tid.category.index
function Pop($code, $year) {
  # SSB json-stat2 category.index is an object (code -> position), not an array.
  $ri = $pRegionIdx.$code; $ti = $pTidIdx.$year
  if ($null -eq $ri -or $null -eq $ti) { return 0 }
  $v = $pds.value[[int]$ri * $pStride["Region"] + [int]$ti * $pStride["Tid"]]
  if ($null -eq $v) { return 0 }
  return [int]$v
}

$muniLines = New-Object System.Collections.Generic.List[string]
$muniLines.Add("dataset_id,source_id,group_code,group_label,municipality_code,county_code,period,value,per_1000,unit,last_updated")
foreach ($m in ($geo | Sort-Object municipality_code)) {
  foreach ($y in $muniYears) {
    $pop = Pop $m.municipality_code $y
    if ($pop -le 0) { $pop = 1000 }
    foreach ($atc in $groups.Keys) {
      $r = if ($rate[$atc].ContainsKey($y)) { $rate[$atc][$y] } else { 0 }
      $est = [math]::Round($pop * $r / 1000.0)
      $muniLines.Add("medication_estimate,fhi_lmr_825,$atc,$($groups[$atc]),$($m.municipality_code),$($m.county_code),$y,$est,$r,personer,2026-02-16")
    }
  }
}
($muniLines -join "`n") | Out-File -FilePath (Join-Path $normalizedDir "medication_use.csv") -Encoding utf8
Write-Host "Skrev medication_use.csv ($($muniLines.Count - 1) rader)."
