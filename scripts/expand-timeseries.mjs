#!/usr/bin/env node
/**
 * Script to expand CSV data with historical periods (2025, 2024)
 * Creates trend data by reducing values by 2% per year (2026 -> 2025 -> 2024)
 */

const fs = require('fs');
const path = require('path');

function parseCsv(content) {
  return content.trim().split('\n');
}

function generateHistoricalData(csvFilePath, outputPath) {
  console.log(`📈 Generating historical periods for ${path.basename(csvFilePath)}...`);
  
  const content = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0];
  const rows = lines.slice(1);

  // Collect rows by period
  const rowsBy2026 = rows.filter(row => row.includes(',2026,'));
  
  if (rowsBy2026.length === 0) {
    console.log('⚠️  No 2026 data found');
    return;
  }

  const historicalRows = [];

  // Generate 2025 (98% of 2026 values - 2% reduction)
  for (const row of rowsBy2026) {
    const parts = row.split(',');
    const valueIndex = 7; // 0-indexed, value is at column 8
    const value = parseInt(parts[valueIndex], 10);
    parts[5] = '2025'; // period column
    parts[valueIndex] = Math.round(value * 0.98).toString();
    historicalRows.push(parts.join(','));
  }

  // Generate 2024 (96% of 2026 values - 4% reduction)
  for (const row of rowsBy2026) {
    const parts = row.split(',');
    const valueIndex = 7;
    const value = parseInt(parts[valueIndex], 10);
    parts[5] = '2024'; // period column
    parts[valueIndex] = Math.round(value * 0.96).toString();
    historicalRows.push(parts.join(','));
  }

  // Write output: header + 2026 + 2025 + 2024
  const output = [header, ...rows, ...historicalRows].join('\n');
  fs.writeFileSync(outputPath, output);
  
  console.log(`✅ Generated ${historicalRows.length} historical rows`);
  console.log(`📁 Output: ${outputPath}`);
}

// Process all CSV files
const csvDir = path.join(__dirname, '..', 'data', 'normalized');
const files = ['capacity.csv', 'needs.csv'];

for (const file of files) {
  const inputPath = path.join(csvDir, file);
  const outputPath = path.join(csvDir, file);
  
  if (fs.existsSync(inputPath)) {
    generateHistoricalData(inputPath, outputPath);
  }
}

console.log('\n✨ Historical data generation complete!');
