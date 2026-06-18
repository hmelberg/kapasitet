# Classifies facilities of type "sykehus" into the Norwegian specialist-health
# hierarchy and adds three columns to facilities.csv:
#   helseregion       - one of the 4 regions (from geography / county), for sykehus
#   helseforetak      - the health trust (HF), matched by hospital name (best effort)
#   sykehus_kategori  - Helseforetak | Privat/ideell | Kommunal/annet | Uklassifisert
#
# Region is derived from county and is accurate. HF is matched on name keywords
# against the curated list (data/reference/helseforetak.csv); unmatched public
# hospitals stay region-only. Non-hospital things OSM tags as hospital (legevakt,
# helsesenter, sykehjem, ambulanse) are flagged Kommunal/annet so the UI can
# separate genuine hospitals from the rest. Non-sykehus rows get empty values.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root "data/normalized/facilities.csv"

# county code (2 digits) -> helseregion
$countyRegion = @{
  "03" = "Helse Sør-Øst"; "31" = "Helse Sør-Øst"; "32" = "Helse Sør-Øst"; "33" = "Helse Sør-Øst";
  "34" = "Helse Sør-Øst"; "39" = "Helse Sør-Øst"; "40" = "Helse Sør-Øst"; "42" = "Helse Sør-Øst";
  "11" = "Helse Vest"; "46" = "Helse Vest";
  "15" = "Helse Midt-Norge"; "50" = "Helse Midt-Norge";
  "18" = "Helse Nord"; "55" = "Helse Nord"; "56" = "Helse Nord"
}

# Ordered HF matching: first matching pattern wins. Patterns are case-insensitive.
$hfRules = @(
  @{ hf = "Oslo universitetssykehus HF";        pat = @("ullev", "ulevoll", "rikshospital", "radiumhospital", "aker sykehus", "gaustad") }
  @{ hf = "Akershus universitetssykehus HF";    pat = @("akershus universitetssykehus", "ahus") }
  @{ hf = "Sykehuset Østfold HF";               pat = @("sykehuset østfold", "kalnes", "halden sykehus") }
  @{ hf = "Sykehuset Innlandet HF";             pat = @("sykehuset innlandet", "reinsvoll", "sanderud") }
  @{ hf = "Vestre Viken HF";                    pat = @("drammen sykehus", "kongsberg sykehus", "ringerike sykehus", "bærum sykehus", "blakstad") }
  @{ hf = "Sykehuset i Vestfold HF";            pat = @("sykehuset i vestfold", "kysthospitalet") }
  @{ hf = "Sykehuset Telemark HF";              pat = @("sykehuset telemark", "kragerø sykehus") }
  @{ hf = "Sørlandet sykehus HF";               pat = @("sørlandet sykehus") }
  @{ hf = "Sunnaas sykehus HF";                 pat = @("sunnås", "sunnaas") }
  @{ hf = "Helse Stavanger HF";                 pat = @("stavanger universitetssjukehus") }
  @{ hf = "Helse Fonna HF";                     pat = @("haugesund sykehus", "stord sjukehus", "odda sjukehus", "valen sjukehus") }
  @{ hf = "Helse Bergen HF";                    pat = @("haukeland", "voss sjukehus", "hagavik") }
  @{ hf = "Helse Førde HF";                     pat = @("førde sentralsjukehus", "lærdal sjukehus", "nordfjord sjukehus") }
  @{ hf = "St. Olavs hospital HF";              pat = @("st. olav", "st olav", "orkdal", "røros sykehus", "østmarka") }
  @{ hf = "Helse Nord-Trøndelag HF";            pat = @("levanger", "namsos") }
  @{ hf = "Helse Møre og Romsdal HF";           pat = @("ålesund sjukehus", "volda sjukehus", "nordmøre og romsdal", "molde") }
  @{ hf = "Universitetssykehuset Nord-Norge HF"; pat = @("universitetssykehuset nord-norge", "unn ", "narvik sykehus", "harstad sykehus", "åsgård") }
  @{ hf = "Nordlandssykehuset HF";              pat = @("nordlandssykehuset", "stokmarknes", "rønvik sykehus") }
  @{ hf = "Helgelandssykehuset HF";             pat = @("helgelandssykehuset", "mosjøen sykehus", "sandnessjøen sykehus") }
  @{ hf = "Finnmarkssykehuset HF";              pat = @("finnmarkssykehuset", "hammerfest sykehus", "kirkenes sykehus") }
)

$kommunalPat = @("legevakt", "helsesenter", "helsehus", "sykehjem", "ambulanse", "luftambulanse",
  "administrasjon", "bo- og service", "sengepost", "hjemmetjeneste", "bo og service")
$privatPat = @("volvat", "aleris", "forusakutten", "martina hansens", "glittreklinikken", "diakonhjemmet",
  "lovisenberg", "haraldsplass", "betanien", "cathinka", "vigør", "trondheimsklin", "estetisk",
  "plastikkirurgi", "lhl", "spesialsykehuset for epilepsi", "kursted", "rehabiliteringsklinikk")

function Match-Any($text, $patterns) {
  $t = $text.ToLower()
  foreach ($p in $patterns) { if ($t.Contains($p.ToLower())) { return $true } }
  return $false
}

$lines = Get-Content $path -Encoding utf8
$header = ($lines[0] -replace "^﻿", "") -split ","
$idx = @{}; for ($i = 0; $i -lt $header.Count; $i++) { $idx[$header[$i]] = $i }

$extra = @("helseregion", "helseforetak", "sykehus_kategori")
$baseHeader = $header | Where-Object { $extra -notcontains $_ }
$baseCount = $baseHeader.Count

$out = New-Object System.Collections.Generic.List[string]
$out.Add((($baseHeader + $extra) -join ","))

$stats = @{}
for ($i = 1; $i -lt $lines.Count; $i++) {
  if (-not $lines[$i].Trim()) { continue }
  $c = $lines[$i] -split ","
  $cBase = $c[0..($baseCount - 1)]
  $type = $c[$idx["facility_type"]]
  $name = $c[$idx["name"]]
  $cc = $c[$idx["county_code"]]

  $region = ""; $hf = ""; $kat = ""
  if ($type -eq "sykehus") {
    $region = if ($countyRegion.ContainsKey($cc)) { $countyRegion[$cc] } else { "" }
    if (Match-Any $name $kommunalPat) { $kat = "Kommunal/annet" }
    elseif (Match-Any $name $privatPat) { $kat = "Privat/ideell" }
    else {
      foreach ($rule in $hfRules) {
        if (Match-Any $name $rule.pat) { $hf = $rule.hf; break }
      }
      if ($hf) { $kat = "Helseforetak" } else { $kat = "Uklassifisert" }
    }
    $stats[$kat] = ($stats[$kat] + 1)
  }
  $out.Add(($cBase + @($region, $hf, $kat)) -join ",")
}

($out -join "`n") | Out-File -FilePath $path -Encoding utf8
Write-Host "Klassifiserte sykehus:"
$stats.GetEnumerator() | Sort-Object Name | ForEach-Object { "  $($_.Name): $($_.Value)" }
Write-Host "Skrev facilities.csv ($($out.Count - 1) rader)."
