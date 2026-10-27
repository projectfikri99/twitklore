import { Page } from "@playwright/test";
import { log, logWarn } from "./page";

/**
 * Isi form search-advanced X. Tanggal DD-MM-YYYY diubah jadi
 * since:/until: yang ditempel ke keyword, sesuai sintaks search X.
 */
export async function fillSearchForm(
  page: Page,
  opts: {
    keywords: string;
    fromDate?: string; // DD-MM-YYYY
    toDate?: string; // DD-MM-YYYY
  }
) {
  const input = 'input[name="allOfTheseWords"]';
  await page.waitForSelector(input, { state: "visible" });
  await page.click(input);

  let query = opts.keywords;

  if (opts.fromDate) {
    const [d, m, y] = opts.fromDate.split("-");
    query += ` since:${y}-${m}-${d}`;
  }
  if (opts.toDate) {
    const [d, m, y] = opts.toDate.split("-");
    query += ` until:${y}-${m}-${d}`;
  }

  logWarn(`\nQuery: ${query}\n`);
  await page.fill(input, query);
  await page.press(input, "Enter");
}
