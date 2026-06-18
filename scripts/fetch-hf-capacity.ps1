# Fetches REAL bed capacity (døgnplasser) per helseforetak from SSB table 13942
# "Aktivitet, kapasitet og beleggsprosent i spesialisthelsetjenesten", by service
# area (somatic / adult psych / child psych / substance abuse / total), 2024-2025.
# Writes data/normalized/hf_capacity.csv.
#
# Source: SSB table 13942 (NLOD). These are real, authoritative figures at the
# helseforetak level (not per individual hospital building).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$normalizedDir = Join-Path $root "data/normalized"
$refPath = Join-Path $root "data/reference/helseforetak.csv"

# SSB org-number -> canonical HF name (must match data/reference/helseforetak.csv)
$codeToHf = [ordered]@{
  "983974724" = "Helse Bergen HF"; "983974732" = "Helse Førde HF"; "983974678" = "Helse Stavanger HF"
  "983974694" = "Helse Fonna HF"; "883974832" = "St. Olavs hospital HF"; "993467049" = "Oslo universitetssykehus HF"
  "894166762" = "Vestre Viken HF"; "983974791" = "Helse Nord-Trøndelag HF"; "983974910" = "Nordlandssykehuset HF"
  "983974929" = "Helgelandssykehuset HF"; "983974880" = "Finnmarkssykehuset HF"; "983974899" = "Universitetssykehuset Nord-Norge HF"
  "983975267" = "Sykehuset Telemark HF"; "883971752" = "Sunnaas sykehus HF"; "983971636" = "Akershus universitetssykehus HF"
  "983975240" = "Sørlandet sykehus HF"; "983975259" = "Sykehuset i Vestfold HF"; "983971709" = "Sykehuset Innlandet HF"
  "983971768" = "Sykehuset Østfold HF"; "997005562" = "Helse Møre og Romsdal HF"
}
$tjeneste = [ordered]@{ "TOT" = "I alt"; "SOM" = "Somatisk"; "VOP" = "Psykisk helsevern voksne"; "BUP" = "Psykisk helsevern barn og unge"; "TSB" = "Rusbehandling (TSB)" }
$years = @("2024", "2025")

# region lookup from reference
$hfRegion = @{}
Get-Content $refPath -Encoding utf8 | Select-Object -Skip 1 | ForEach-Object {
  if ($_.Trim()) { $p = $_ -split ","; $hfRegion[$p[1]] = $p[0] }
}

$query = @{
  query = @(
    @{ code = "HelseReg"; selection = @{ filter = "item"; values = @($codeToHf.Keys) } },
    @{ code = "HelseTjenomr"; selection = @{ filter = "item"; values = @($tjeneste.Keys) } },
    @{ code = "ContentsCode"; selection = @{ filter = "item"; values = @("Dognplass") } },
    @{ code = "Tid"; selection = @{ filter = "item"; values = @($years) } }
  )
  response = @{ format = "json-stat2" }
} | ConvertTo-Json -Depth 8
Write-Host "Henter sengekapasitet per helseforetak fra SSB 13942..."
$ds = Invoke-RestMethod -Uri "https://data.ssb.no/api/v0/no/table/13942" -Method Post -Body $query -ContentType "application/json" -TimeoutSec 90

$stride = @{}; $acc = 1
for ($d = $ds.id.Count - 1; $d -ge 0; $d--) { $stride[$ds.id[$d]] = $acc; $acc *= $ds.size[$d] }
$regIdx = $ds.dimension.HelseReg.category.index
$tjIdx = $ds.dimension.HelseTjenomr.category.index
$tidIdx = $ds.dimension.Tid.category.index
$ccIdx = $ds.dimension.ContentsCode.category.index

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("helseforetak,helseregion,tjenesteomrade_kode,tjenesteomrade,period,dognplasser,source_id,last_updated")
foreach ($code in $codeToHf.Keys) {
  $hf = $codeToHf[$code]
  $region = if ($hfRegion.ContainsKey($hf)) { $hfRegion[$hf] } else { "" }
  foreach ($tk in $tjeneste.Keys) {
    foreach ($y in $years) {
      $flat = [int]$regIdx.$code * $stride["HelseReg"] + [int]$tjIdx.$tk * $stride["HelseTjenomr"] +
              [int]$ccIdx."Dognplass" * $stride["ContentsCode"] + [int]$tidIdx.$y * $stride["Tid"]
      $v = $ds.value[$flat]
      if ($null -eq $v) { continue }
      $lines.Add("$hf,$region,$tk,$($tjeneste[$tk]),$y,$([int]$v),ssb_13942,2026-06-18")
    }
  }
}
($lines -join "`n") | Out-File -FilePath (Join-Path $normalizedDir "hf_capacity.csv") -Encoding utf8
Write-Host "Skrev hf_capacity.csv ($($lines.Count - 1) rader)."
