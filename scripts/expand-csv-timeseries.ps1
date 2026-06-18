param($Path)
$name = Split-Path $Path -Leaf
Write-Host "Expanding $name with 2025 and 2024 data..."

# Read and parse
$lines = @(Get-Content $Path -Encoding UTF8)
$header = $lines[0]
$rows2026 = $lines[1..($lines.Count-1)] | Where-Object { $_ -match ',2026,' }

# Generate 2025 (98% of 2026)
$rows2025 = @()
foreach ($row in $rows2026) {
  $newRow = $row -replace ',2026,', ',2025,'
  $cols = $newRow -split ','
  $cols[7] = [int][math]::Round([int]$cols[7] * 0.98)
  $rows2025 += $cols -join ','
}

# Generate 2024 (96% of 2026)
$rows2024 = @()
foreach ($row in $rows2026) {
  $newRow = $row -replace ',2026,', ',2024,'
  $cols = $newRow -split ','
  $cols[7] = [int][math]::Round([int]$cols[7] * 0.96)
  $rows2024 += $cols -join ','
}

# Write expanded file
$output = @($header) + $lines[1..($lines.Count-1)] + $rows2025 + $rows2024
$output | Set-Content $Path -Encoding UTF8

Write-Host "OK: $name has $($rows2025.Count) rows for 2025 and $($rows2024.Count) rows for 2024"
