import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function escapeCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows, columns) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => escapeCell(row[c])).join(","));
  return lines.join("\n") + "\n";
}

export function parseCsv(text) {
  const src = text.replace(/^﻿/, "");
  const records = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); records.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); records.push(row); }
  const nonEmpty = records.filter((r) => r.length > 1 || r[0] !== "");
  if (nonEmpty.length === 0) return { columns: [], rows: [] };
  const columns = nonEmpty[0];
  const rows = nonEmpty.slice(1).map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ""])));
  return { columns, rows };
}

export async function writeCsv(filePath, rows, columns) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, toCsv(rows, columns), "utf8");
}

export async function readCsv(filePath) {
  return parseCsv(await readFile(filePath, "utf8"));
}
