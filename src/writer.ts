import * as fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { TweetRow } from "./parse";

export const OUT_DIR = "./twitklore-data";

export function outPath(filename: string, format: "csv" | "xlsx") {
  const ext = format === "xlsx" ? "xlsx" : "csv";
  return path.join(OUT_DIR, `${filename}.${ext}`);
}

/** Writer CSV append-only: header ditulis sekali per file. */
export class CsvWriter {
  private headerWritten = false;

  constructor(private file: string) {}

  append(rows: TweetRow[]) {
    const csv = Papa.unparse(rows, {
      quotes: true,
      header: !this.headerWritten,
      skipEmptyLines: true,
    });
    this.headerWritten = true;
    fs.appendFileSync(this.file, csv);
    fs.appendFileSync(this.file, "\r\n");
  }
}

/**
 * Writer XLSX. Rewrite file penuh tiap append karena format .xlsx
 * tidak bisa di-append streaming. Data di-hold di memori.
 */
export class XlsxWriter {
  private rows: TweetRow[] = [];

  constructor(private file: string) {}

  append(rows: TweetRow[]) {
    this.rows.push(...rows);
    const ws = XLSX.utils.json_to_sheet(this.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tweets");
    XLSX.writeFile(wb, this.file);
  }
}

export function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/** Mode REPLACE: file lama di-rename jadi .old.<ext>, bukan dihapus. */
export function archiveExisting(file: string) {
  if (!fs.existsSync(file)) return;
  const old = file.replace(/\.(csv|xlsx)$/, ".old.$1");
  fs.renameSync(file, old);
}
