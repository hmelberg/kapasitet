# Fetches REAL capacity for every helseforetak from SSB and writes a long-format
# data/normalized/hf_capacity.csv with one row per (HF, metric, year):
#   - beds (døgnplasser) by service area + total, occupancy %, discharges   [SSB 13942]
#   - staffing (avtalte årsverk): total, doctors, nurses                      [SSB 13953]
#
# All figures are real and at the helseforetak level (not per hospital building).
# Sources: SSB tables 13942 and 13953 (NLOD).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$normalizedDir = Join-Path $root "data/normalized"
$refPath = Join-Path $root "data/reference/helseforetak.csv"
$years = @("2024", "2025")

$codeToHf = [ordered]@{
  "983974724" = "Helse Bergen HF"; "983974732" = "Helse Førde HF"; "983974678" = "Helse Stavanger HF"
  "983974694" = "Helse Fonna HF"; "883974832" = "St. Olavs hospital HF"; "993467049" = "Oslo universitetssykehus HF"
  "894166762" = "Vestre Viken HF"; "983974791" = "Helse Nord-Trøndelag HF"; "983974910" = "Nordlandssykehuset HF"
  "983974929" = "Helgelandssykehuset HF"; "983974880" = "Finnmarkssykehuset HF"; "983974899" = "Universitetssykehuset Nord-Norge HF"
  "983975267" = "Sykehuset Telemark HF"; "883971752" = "Sunnaas sykehus HF"; "983971636" = "Akershus universitetssykehus HF"
  "983975240" = "Sørlandet sykehus HF"; "983975259" = "Sykehuset i Vestfold HF"; "983971709" = "Sykehuset Innlandet HF"
  "983971768" = "Sykehuset Østfold HF"; "997005562" = "Helse Møre og Romsdal HF"
}

$hfRegion = @{}
Get-Content $refPath -Encoding utf8 | Select-Object -Skip 1 | ForEach-Object {
  if ($_.Trim()) { $p = $_ -split ","; $hfRegion[$p[1]] = $p[0] }
}

function Invoke-Ssb($table, $body) {
  return Invoke-RestMethod -Uri "https://data.ssb.no/api/v0/no/table/$table" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90
}
function New-Indexer($ds) {
  $stride = @{}; $acc = 1
  for ($d = $ds.id.Count - 1; $d -ge 0; $d--) { $stride[$ds.id[$d]] = $acc; $acc *= $ds.size[$d] }
  return $stride
}

# --- 13942: beds, occupancy, discharges ---
$q1 = @{
  query = @(
    @{ code = "HelseReg"; selection = @{ filter = "item"; values = @($codeToHf.Keys) } },
    @{ code = "HelseTjenomr"; selection = @{ filter = "item"; values = @("SOM", "VOP", "BUP", "TSB", "TOT") } },
    @{ code = "ContentsCode"; selection = @{ filter = "item"; values = @("Dognplass", "BeleggSsb", "Utskriv") } },
    @{ code = "Tid"; selection = @{ filter = "item"; values = @($years) } }
  )
  response = @{ format = "json-stat2" }
} | ConvertTo-Json -Depth 8
Write-Host "Henter senger/belegg/utskrivninger fra SSB 13942..."
$d1 = Invoke-Ssb 13942 $q1
$s1 = New-Indexer $d1
$reg1 = $d1.dimension.HelseReg.category.index; $tj1 = $d1.dimension.HelseTjenomr.category.index
$cc1 = $d1.dimension.ContentsCode.category.index; $tid1 = $d1.dimension.Tid.category.index
function V1($code, $tj, $cc, $y) {
  $f = [int]$reg1.$code * $s1["HelseReg"] + [int]$tj1.$tj * $s1["HelseTjenomr"] + [int]$cc1.$cc * $s1["ContentsCode"] + [int]$tid1.$y * $s1["Tid"]
  return $d1.value[$f]
}

# --- 13953: staffing (årsverk) ---
$q2 = @{
  query = @(
    @{ code = "HelseReg"; selection = @{ filter = "item"; values = @($codeToHf.Keys) } },
    @{ code = "HelseTjenomr"; selection = @{ filter = "item"; values = @("TOT") } },
    @{ code = "Yrke"; selection = @{ filter = "item"; values = @("TOT", "05", "02", "01") } },
    @{ code = "ContentsCode"; selection = @{ filter = "item"; values = @("Arsverk") } },
    @{ code = "Tid"; selection = @{ filter = "item"; values = @($years) } }
  )
  response = @{ format = "json-stat2" }
} | ConvertTo-Json -Depth 8
Write-Host "Henter årsverk fra SSB 13953..."
$d2 = Invoke-Ssb 13953 $q2
$s2 = New-Indexer $d2
$reg2 = $d2.dimension.HelseReg.category.index; $tj2 = $d2.dimension.HelseTjenomr.category.index
$yrk2 = $d2.dimension.Yrke.category.index; $cc2 = $d2.dimension.ContentsCode.category.index; $tid2 = $d2.dimension.Tid.category.index
function V2($code, $yrke, $y) {
  $f = [int]$reg2.$code * $s2["HelseReg"] + [int]$tj2."TOT" * $s2["HelseTjenomr"] + [int]$yrk2.$yrke * $s2["Yrke"] + [int]$cc2."Arsverk" * $s2["ContentsCode"] + [int]$tid2.$y * $s2["Tid"]
  return $d2.value[$f]
}

# metric definitions in display order
$bedAreas = @(
  @{ tj = "SOM"; metric = "senger_somatikk"; label = "Senger - somatikk" }
  @{ tj = "VOP"; metric = "senger_psyk_voksne"; label = "Senger - psykisk helsevern (voksne)" }
  @{ tj = "BUP"; metric = "senger_psyk_barn"; label = "Senger - psykisk helsevern (barn/unge)" }
  @{ tj = "TSB"; metric = "senger_rus"; label = "Senger - rusbehandling (TSB)" }
  @{ tj = "TOT"; metric = "senger_totalt"; label = "Senger - totalt" }
)
$staffYrke = @(
  @{ y = "TOT"; metric = "arsverk_totalt"; label = "Årsverk - totalt" }
  @{ y = "05"; metric = "arsverk_legespesialister"; label = "Årsverk - legespesialister" }
  @{ y = "02"; metric = "arsverk_sykepleiere"; label = "Årsverk - sykepleiere" }
  @{ y = "01"; metric = "arsverk_spesialsykepleiere"; label = "Årsverk - spesialsykepleiere" }
)

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("helseforetak,helseregion,metric,metric_label,period,value,unit,source_id,last_updated")
foreach ($code in $codeToHf.Keys) {
  $hf = $codeToHf[$code]
  $region = if ($hfRegion.ContainsKey($hf)) { $hfRegion[$hf] } else { "" }
  foreach ($y in $years) {
    foreach ($b in $bedAreas) {
      $v = V1 $code $b.tj "Dognplass" $y
      if ($null -ne $v) { $lines.Add("$hf,$region,$($b.metric),$($b.label),$y,$([int]$v),senger,ssb_13942,2026-06-18") }
    }
    $bel = V1 $code "SOM" "BeleggSsb" $y
    if ($null -ne $bel) { $lines.Add("$hf,$region,beleggsprosent_somatikk,Beleggsprosent - somatikk,$y,$bel,%,ssb_13942,2026-06-18") }
    $uts = V1 $code "SOM" "Utskriv" $y
    if ($null -ne $uts) { $lines.Add("$hf,$region,utskrivninger_somatikk,Utskrivninger - somatikk (per år),$y,$([int]$uts),opphold,ssb_13942,2026-06-18") }
    foreach ($st in $staffYrke) {
      $v = V2 $code $st.y $y
      if ($null -ne $v) { $lines.Add("$hf,$region,$($st.metric),$($st.label),$y,$([int]$v),årsverk,ssb_13953,2026-06-18") }
    }
  }
}
($lines -join "`n") | Out-File -FilePath (Join-Path $normalizedDir "hf_capacity.csv") -Encoding utf8
Write-Host "Skrev hf_capacity.csv ($($lines.Count - 1) rader)."
