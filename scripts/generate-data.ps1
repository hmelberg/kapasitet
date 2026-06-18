# Regenerates capacity.csv and needs.csv for ALL current municipalities.
#
# Geography/identity comes from data/derived/municipalities_geo.json (Geonorge).
# Population per municipality (2024-2026) is fetched live from SSB table 07459.
# Capacity/need values are MODELLED: real population is scaled by ratios derived
# from the Oslo reference figures, with a deterministic per-municipality variation
# so the pressure index (need/capacity) varies across the country. The absolute
# numbers are illustrative; the geography and population are real.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$derivedDir = Join-Path $root "data/derived"
$normalizedDir = Join-Path $root "data/normalized"

$periods = @("2024", "2025", "2026")

# --- ratios derived from Oslo (pop 728714 in 2026) ---
$capRatio = @{ sykehus = 0.016796; fastlege = 0.004254; sykehjem = 0.003980 }
$serviceRatio = 0.083986   # mottar_tjeneste_per_dag
$needRatio = @{ hjerte = 0.070261; kreft = 0.030053; blodtrykk = 0.094414 }

# Year multipliers: needs rise faster than capacity -> rising pressure over time.
$capYear = @{ "2024" = 1.00; "2025" = 1.01; "2026" = 1.02 }
$needYear = @{ "2024" = 1.00; "2025" = 1.025; "2026" = 1.05 }

function Get-Variation([string]$code) {
  # Two stable pseudo-random factors in [0,1) from the municipality code.
  $seed = [int]($code)
  $r1 = ((($seed * 1103515245 + 12345) % 2147483647) / 2147483647.0)
  $r2 = ((($seed * 1664525 + 1013904223) % 2147483647) / 2147483647.0)
  if ($r1 -lt 0) { $r1 += 1 }
  if ($r2 -lt 0) { $r2 += 1 }
  return @{ cap = (0.80 + 0.35 * $r1); need = (0.90 + 0.30 * $r2) }
}

# --- load municipalities ---
$geo = Get-Content (Join-Path $derivedDir "municipalities_geo.json") -Raw | ConvertFrom-Json
$codes = $geo | ForEach-Object { $_.municipality_code }
Write-Host "$($codes.Count) kommuner lastet."

# --- fetch population from SSB (table 07459) for exactly these codes ---
Write-Host "Henter folketall fra SSB..."
$query = @{
  query = @(
    @{ code = "Region"; selection = @{ filter = "item"; values = @($codes) } },
    @{ code = "ContentsCode"; selection = @{ filter = "item"; values = @("Personer1") } },
    @{ code = "Tid"; selection = @{ filter = "item"; values = @($periods) } }
  )
  response = @{ format = "json-stat2" }
}
$body = $query | ConvertTo-Json -Depth 8
$ds = Invoke-RestMethod -Uri "https://data.ssb.no/api/v0/no/table/07459" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90

# parse json-stat2 generically
$ids = $ds.id
$size = $ds.size
$stride = @{}
$acc = 1
for ($d = $ids.Count - 1; $d -ge 0; $d--) { $stride[$ids[$d]] = $acc; $acc *= $size[$d] }
$regionIdx = $ds.dimension.Region.category.index
$tidIdx = $ds.dimension.Tid.category.index
$values = $ds.value

$pop = @{}
foreach ($code in $codes) {
  $pop[$code] = @{}
  $ri = $regionIdx.$code
  foreach ($p in $periods) {
    $ti = $tidIdx.$p
    $flat = [int]$ri * [int]$stride["Region"] + [int]$tidIdx.$p * [int]$stride["Tid"]
    $v = $values[$flat]
    if ($null -eq $v -or $v -eq 0) { $v = 1000 }   # fallback for any gap
    $pop[$code][$p] = [int]$v
  }
}
Write-Host "Folketall hentet (Oslo 2026 = $($pop['0301']['2026']))."

# --- generate capacity.csv ---
$capLines = New-Object System.Collections.Generic.List[string]
$capLines.Add("dataset_id,source_id,sector,municipality_code,county_code,period,metric,value,unit,last_updated")
$needLines = New-Object System.Collections.Generic.List[string]
$needLines.Add("dataset_id,source_id,category,municipality_code,county_code,period,metric,value,unit,last_updated")

foreach ($m in ($geo | Sort-Object municipality_code)) {
  $code = $m.municipality_code
  $cc = $m.county_code
  $var = Get-Variation $code
  foreach ($p in $periods) {
    $pp = $pop[$code][$p]
    $cy = $capYear[$p]
    $ny = $needYear[$p]

    # capacity workforce (3 sectors)
    foreach ($sector in @("sykehus", "fastlege", "sykehjem")) {
      $val = [math]::Round($pp * $capRatio[$sector] * $var.cap * $cy)
      if ($val -lt 1) { $val = 1 }
      $capLines.Add("capacity_workforce,ssb_kostra_001,$sector,$code,$cc,$p,ansatte_legger_og_sykepleiere,$val,personer,2026-06-01")
    }
    # service volume
    $sv = [math]::Round($pp * $serviceRatio * $var.cap * $cy)
    if ($sv -lt 1) { $sv = 1 }
    $capLines.Add("service_volume,fhi_kpr_001,kommunal_omsorg,$code,$cc,$p,mottar_tjeneste_per_dag,$sv,personer,2026-06-05")

    # needs
    $h = [math]::Round($pp * $needRatio.hjerte * $var.need * $ny)
    $k = [math]::Round($pp * $needRatio.kreft * $var.need * $ny)
    $b = [math]::Round($pp * $needRatio.blodtrykk * $var.need * $ny)
    if ($h -lt 1) { $h = 1 }; if ($k -lt 1) { $k = 1 }; if ($b -lt 1) { $b = 1 }
    $needLines.Add("disease_prevalence,fhi_hkr_001,hjerte,$code,$cc,$p,pasienter_med_hjerte_karsykdom,$h,personer,2026-06-01")
    $needLines.Add("disease_prevalence,fhi_hkr_001,kreft,$code,$cc,$p,pasienter_med_kreft,$k,personer,2026-06-01")
    $needLines.Add("medication_use,fhi_lmr_001,legemidler,$code,$cc,$p,personer_pa_blodtrykksmedisin,$b,personer,2026-06-05")
  }
}

($capLines -join "`n") | Out-File -FilePath (Join-Path $normalizedDir "capacity.csv") -Encoding utf8
($needLines -join "`n") | Out-File -FilePath (Join-Path $normalizedDir "needs.csv") -Encoding utf8
Write-Host "Skrev capacity.csv ($($capLines.Count - 1) rader) og needs.csv ($($needLines.Count - 1) rader)."
