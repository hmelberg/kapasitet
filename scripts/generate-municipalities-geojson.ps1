# Generate comprehensive GeoJSON for all 53 Norwegian municipalities from CSV
# Coordinates are approximate municipality centers based on known geographic locations

# Map of municipality codes to approximate coordinates (lat, lon)
$coordinateMap = @{
    "0301" = @(59.9139, 10.7522)    # Oslo
    "1103" = @(58.9700, 5.7331)     # Stavanger
    "1108" = @(58.7656, 5.7367)     # Sandnes
    "1149" = @(59.4182, 5.2682)     # Haugesund
    "1226" = @(60.5614, 6.4219)     # Voss
    "1235" = @(60.0549, 6.2135)     # Odda
    "1246" = @(60.4514, 5.2806)     # Knarvik
    "1401" = @(61.5947, 5.8625)     # Florø
    "1411" = @(61.1614, 6.7340)     # Sogndal
    "1412" = @(61.2308, 6.9014)     # Leikanger
    "1504" = @(62.7364, 7.1764)     # Molde
    "1505" = @(63.1108, 7.7250)     # Kristiansund
    "1508" = @(62.4706, 6.1414)     # Alesund
    "1804" = @(67.2808, 14.4050)    # Bodø
    "1816" = @(68.4389, 17.4256)    # Narvik
    "1821" = @(66.3133, 14.1897)    # Mo i Rana
    "1826" = @(65.9594, 12.4789)    # Sandnessjøen
    "2025" = @(61.1139, 10.4639)    # Lillehammer
    "2027" = @(60.7964, 11.0758)    # Hamar
    "2028" = @(60.7875, 10.6908)    # Gjøvik
    "3103" = @(59.4361, 10.6622)    # Moss
    "3107" = @(59.2181, 10.9478)    # Fredrikstad
    "3201" = @(59.8836, 10.3589)    # Bærum
    "3205" = @(59.9522, 11.0289)    # Lillestrøm
    "3301" = @(59.7439, 10.2050)    # Drammen
    "3603" = @(58.2557, 8.3725)     # Lillesand
    "3706" = @(59.2803, 11.1103)    # Sarpsborg
    "3905" = @(59.2736, 10.4133)    # Tønsberg
    "4003" = @(59.0142, 9.6089)     # Skien
    "4009" = @(59.1356, 9.6542)     # Porsgrunn
    "4201" = @(58.4611, 8.7725)     # Arendal
    "4204" = @(58.1450, 8.0728)     # Kristiansand
    "4206" = @(58.0225, 7.4697)     # Mandal
    "4601" = @(60.3913, 5.3250)     # Bergen
    "4626" = @(60.2425, 4.9392)     # Øygarden
    "4627" = @(60.5889, 5.1311)     # Askøy
    "5001" = @(63.4305, 10.3951)    # Trondheim
    "5006" = @(64.4697, 11.5000)    # Namsos
    "5007" = @(64.0136, 11.4919)    # Steinkjer
    "5014" = @(63.7558, 11.2578)    # Levanger
    "5035" = @(63.2997, 11.1572)    # Stjørdal
    "2004" = @(70.9821, 25.5163)    # Hammerfest
    "5501" = @(69.6492, 18.9553)    # Tromsø
    "0105" = @(59.1233, 11.4044)    # Halden
    "0106" = @(59.7164, 11.3897)    # Mysen
    "0209" = @(59.8522, 10.1639)    # Asker
    "0213" = @(60.0542, 10.8450)    # Ørsted
    "0604" = @(59.6608, 9.6453)     # Kongsberg
    "0709" = @(59.0542, 10.0306)    # Larvik
    "0710" = @(59.0386, 10.2264)    # Holmestrand
    "0807" = @(59.5686, 9.2086)     # Notodden
    "0809" = @(59.3014, 8.7667)     # Rjukan
    "1903" = @(68.5506, 16.5447)    # Harstad
}

# Read CSV and parse municipalities
$csvPath = "$PSScriptRoot/../data/normalized/municipalities.csv"
$lines = Get-Content $csvPath

# Skip header
$dataLines = $lines[1..$($lines.Count-1)]

$features = @()
$missingCoordinates = @()

foreach ($line in $dataLines) {
    $parts = $line -split ','
    $code = $parts[0].Trim()
    $countyCode = $parts[1].Trim()
    $name = $parts[2].Trim()
    $countyName = $parts[3].Trim()
    
    if ($coordinateMap.ContainsKey($code)) {
        $coords = $coordinateMap[$code]
        $lat = $coords[0]
        $lon = $coords[1]
        
    $feature = @{
        type = "Feature"
        properties = @{
                municipality_code = $code
                municipality_name = $name
                county_code = $countyCode
                county_name = $countyName
        }
        geometry = @{
            type = "Point"
                coordinates = @($lon, $lat)
        }
    }
    $features += $feature
    } else {
        $missingCoordinates += $code
    }
}

if ($missingCoordinates.Count -gt 0) {
    Write-Host "Warning: Missing coordinates for municipalities: $($missingCoordinates -join ', ')"
}

$geojson = @{
    type = "FeatureCollection"
    features = $features
}

# Write to file
$outputPath = "$PSScriptRoot/../data/boundaries/municipalities.geojson"
$output = $geojson | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($outputPath, $output, [System.Text.Encoding]::UTF8)

Write-Host "Generated municipalities.geojson with $($features.Count) municipalities"
