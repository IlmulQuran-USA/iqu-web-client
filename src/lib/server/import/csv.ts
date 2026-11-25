/*
 * CSV reading and writing exactly as the plugin does it (includes/class-iqu-csv.php,
 * plugin 3.7.20): RFC 4180 with no escape character (PHP fgetcsv(..., ',', '"', '')
 * and fputcsv), a UTF-8 byte order mark skipped on read and written on output,
 * and the formula guard on every cell written.
 */

/** IQU_CSV::safe (csv.php:22-31): a cell a spreadsheet will not run as a formula, also after a ";". */
export function csvSafe(value: unknown): string {
  let v = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
  const num = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
  if (v !== "" && "=+-@\t\r".includes(v[0]) && !num(v)) v = `'${v}`;
  if (v.includes(";")) v = v.replace(/;([=+\-@\t\r][^;]*)/g, (_m, rest: string) => `;${num(rest) ? "" : "'"}${rest}`);
  return v;
}

/** IQU_CSV::put (csv.php:39-47): one line, each cell made safe; quoted when it holds , " CR LF tab space or ;. */
export function csvLine(cells: readonly unknown[]): string {
  return `${cells
    .map((c) => {
      const v = csvSafe(c);
      return /[,"\r\n\t ;]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
    })
    .join(",")}\n`;
}

export const BOM = "﻿";

/**
 * PHP fgetcsv with enclosure '"' and no escape character: quoted fields may hold
 * commas, doubled quotes and line breaks. Returns [line number, cells] per record
 * (the line number of the record's first line, as fgetcsv's counter in check_file).
 */
export function parseCsv(input: string): [number, string[]][] {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const out: [number, string[]][] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let started = false;
  let line = 1;
  let recordLine = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
      started = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
      started = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cells.push(cell);
      out.push([recordLine, cells]);
      cells = [];
      cell = "";
      started = false;
      line++;
      recordLine = line;
    } else {
      cell += ch;
      started = true;
    }
  }
  if (started || cell !== "" || cells.length) {
    cells.push(cell);
    out.push([recordLine, cells]);
  }
  return out;
}
