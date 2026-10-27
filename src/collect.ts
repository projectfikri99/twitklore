import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import dayjs from "dayjs";
import { Page } from "@playwright/test";
import type { TweetResponseData, Entry } from "./types";
import { extractEntries, normalizeEntry, toRow, TweetRow } from "./parse";
import { blockMedia, scrollToBottom, scrollToTop, log, logWarn, logError } from "./page";
import { fillSearchForm } from "./form";
import { archiveExisting, ensureOutDir, outPath, CsvWriter, XlsxWriter } from "./writer";
import { rateLimitDelay } from "./backoff";

chromium.use(stealth());

const SEARCH_URL = {
  LATEST: "https://x.com/search-advanced?f=live",
  TOP: "https://x.com/search-advanced",
};

// env override dipakai smoke test; dibaca saat runtime, bukan saat modul di-load
function searchUrl(tab: "LATEST" | "TOP") {
  return process.env[tab === "LATEST" ? "TWITKLORE_SEARCH_URL_LATEST" : "TWITKLORE_SEARCH_URL_TOP"] || SEARCH_URL[tab];
}

export interface CollectParams {
  authToken: string;
  keywords?: string;
  threadUrl?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  delayPerTweet?: number;
  delayPer100?: number;
  outputName?: string;
  tab?: "LATEST" | "TOP";
  insertMode?: "REPLACE" | "APPEND";
  format?: "csv" | "xlsx";
  headless?: boolean;
}

const IDLE_LIMIT = 20; // berapa kali scroll tanpa response baru sebelum berhenti
const RESPONSE_TIMEOUT_MS = 1500;

export async function collect(params: CollectParams) {
  const {
    authToken,
    keywords,
    threadUrl,
    fromDate,
    toDate,
    limit = 10,
    delayPerTweet = 3,
    delayPer100 = 10,
    outputName,
    tab = "LATEST",
    insertMode = "REPLACE",
    format = "csv",
    headless = true,
  } = params;

  const mode = threadUrl ? "DETAIL" : "SEARCH";
  const fallbackTab = tab === "TOP" ? "LATEST" : "TOP";

  const now = dayjs().format("DD-MM-YYYY_HH-mm-ss");
  const baseName = (outputName || keywords || "thread").trim().replace(/[^\w-]+/g, "_");
  const file = outPath(`${baseName}_${now}`, format);

  ensureOutDir();
  if (insertMode === "REPLACE") archiveExisting(file);

  const writer = format === "xlsx" ? new XlsxWriter(file) : new CsvWriter(file);
  const seen = new Set<string>();
  let saved = 0;

  log("\nMembuka browser...");

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    screen: { width: 1240, height: 1080 },
    storageState: {
      cookies: [
        {
          name: "auth_token",
          value: authToken,
          domain: "x.com",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: "Strict",
        },
      ],
      origins: [],
    },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await blockMedia(page);

  function flush(entries: Entry[]) {
    const rows: TweetRow[] = [];
    for (const entry of entries) {
      const norm = normalizeEntry(entry, mode);
      if (!norm) continue;
      const row = toRow(norm, mode);
      if (!row) continue;
      if (seen.has(row.id_str)) continue;
      seen.add(row.id_str);
      rows.push(row);
    }
    if (rows.length) {
      writer.append(rows);
      saved += rows.length;
    }
    return rows.length;
  }

  let queued: any[] = [];

  async function scrapeOnce(url: string): Promise<boolean> {
    // Pasang listener SEBELUM navigasi/form supaya XHR yang fire saat page load
    // ikut ketangkep. waitForResponse cuma nangkep response yang datang setelah
    // listener terpasang — ini bug yang sama seperti upstream tweet-harvest.
    queued.length = 0;
    page.on("response", (r) => {
      if (r.url().includes("SearchTimeline") || r.url().includes("TweetDetail")) queued.push(r);
    });

    await page.goto(url);

    // X redirect ke onboarding/login kalau token invalid. Cocokkan path, bukan
    // substring "/login" — X pakai /i/jf/onboarding/web?...&mode=login juga.
    const landed = new URL(page.url());
    // smoke test pakai host lokal; hanya host X/Twitter yang dianggap auth wall
    const isXHost = landed.hostname === "x.com" || landed.hostname.endsWith(".x.com") || landed.hostname === "twitter.com" || landed.hostname.endsWith(".twitter.com");
    if (isXHost && (landed.pathname.includes("login") || landed.searchParams.get("mode") === "login")) {
      logError("Token tidak valid atau sudah expired — X mengalihkan ke halaman login.");
      return false;
    }

    if (mode === "SEARCH") {
      await fillSearchForm(page, { keywords: keywords!, fromDate, toDate });
    }

    let idle = 0;
    let rateAttempt = 0;
    let sinceLastSave = 0;

    while (saved < limit && idle < IDLE_LIMIT) {
      let response = queued.shift();

      if (!response) {
        const raced = await Promise.race([
          page.waitForResponse(
            (r) => r.url().includes("SearchTimeline") || r.url().includes("TweetDetail")
          ),
          page.waitForTimeout(RESPONSE_TIMEOUT_MS),
        ]);
        response = raced;
      }

      if (!response) {
        idle++;
        await scrollToBottom(page);
        continue;
      }

      idle = 0;

      let data: TweetResponseData;
      try {
        data = await response.json();
      } catch {
        const body = await response.text().catch(() => "");
        if (body.toLowerCase().includes("rate limit")) {
          const wait = rateLimitDelay(rateAttempt++);
          logWarn(`Kena rate limit — tunggu ${Math.round(wait / 1000)}s lalu retry.`);
          await page.waitForTimeout(wait);
          await page.click("text=Retry").catch(() => {});
          continue;
        }
        break;
      }

      rateAttempt = 0;
      const entries = extractEntries(data);
      if (!entries) {
        logWarn("Struktur response X berubah — tidak menemukan timeline entries.");
        return false;
      }

      const added = flush(entries);
      log(`Tersimpan ${saved}/${limit} tweet -> ${file}`);

      sinceLastSave += added;
      if (sinceLastSave >= 100) {
        sinceLastSave = 0;
        if (delayPer100) await page.waitForTimeout(delayPer100 * 1000);
      } else if (sinceLastSave >= 20) {
        if (delayPerTweet) await page.waitForTimeout(delayPerTweet * 1000);
      }

      await scrollToBottom(page);
    }

    return saved > 0;
  }

  try {
    const target = mode === "DETAIL" ? threadUrl! : searchUrl(tab);
    const got = await scrapeOnce(target);

    // fallback: kalau tab aktif kosong, coba tab sebaliknya (search mode saja)
    if (!got && mode === "SEARCH") {
      logWarn(`Tab ${tab} kosong, mencoba tab ${fallbackTab}...`);
      await scrapeOnce(searchUrl(fallbackTab));
    }
  } catch (err) {
    logError(err);
    const shot = `twitklore-data/Error-${now}.png`;
    await page.screenshot({ path: shot }).catch(() => {});
    logWarn(`Screenshot error disimpan: ${shot}`);
  } finally {
    if (!params.headless) log("Headless nonaktif — browser dibiarkan terbuka.");
    else await browser.close();
  }

  if (saved === 0) logWarn("Tidak ada tweet terkumpul.");
  else log(`\nSelesai. ${saved} tweet tersimpan di ${file}`);

  return { saved, file };
}
