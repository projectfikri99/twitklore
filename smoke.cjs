/**
 * Smoke test end-to-end: jalanin collect() ke fake X server lokal.
 * Verifikasi browser launch, intercept media, scrape loop, dedup, dan tulis CSV.
 * Nggak butuh token X nyata dan nggak sentuh jaringan eksternal.
 */
const { chromium } = require("@playwright/test");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const collect = require("./dist/collect.cjs");

const PAGE_HTML = `<!doctype html><html><body><h1>fake x search</h1>
<input name="allOfTheseWords" type="text" />
<script>
  // tiru X: page fire XHR SearchTimeline tiap kali di-scroll
  let n = 0;
  function fire() { n++; fetch("/api/SearchTimeline?n=" + n); }
  fire();
  window.addEventListener("scroll", () => fire());
</script></body></html>`;

const entry = (id, text, promoted = false) => ({
  entryId: promoted ? `promoted-tweet-${id}` : `tweet-${id}`,
  content: {
    itemContent: {
      tweet_results: {
        result: {
          legacy: {
            created_at: "Mon Jan 01 10:00:00 +0000 2024",
            id_str: String(id),
            full_text: text,
            lang: "in",
            reply_count: 1,
            retweet_count: 2,
            favorite_count: 3,
            quote_count: 0,
            user_id_str: "u1",
            conversation_id_str: String(id),
            entities: { media: [{ media_url_https: "https://x.com/img.jpg" }] },
          },
          core: { user_results: { result: { core: { screen_name: "fikri", name: "Fikri" }, legacy: { location: "Jakarta" } } } },
        },
      },
    },
  },
});

const payload = {
  search_by_raw_query: {
    search_timeline: {
      timeline: {
        instructions: [
          { type: "TimelineAddEntries", entries: [entry(1, "tweet asli satu"), entry(2, "tweet asli dua"), entry(3, "iklan", true)] },
        ],
      },
    },
  },
};

let requests = 0;

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/SearchTimeline")) {
    requests++;
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(payload));
  }
  if (req.url.includes("img.jpg")) {
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    return res.end(Buffer.alloc(1024, 1));
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(PAGE_HTML);
});

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/search-advanced`;

  process.env.TWITKLORE_SEARCH_URL_LATEST = url;
  process.env.TWITKLORE_SEARCH_URL_TOP = url;

  const started = Date.now();
  const result = await collect.collect({
    authToken: "x".repeat(40),
    keywords: "smoke",
    limit: 10,
    delayPerTweet: 0,
    delayPer100: 0,
    outputName: "smoke",
    tab: "LATEST",
    format: "csv",
    insertMode: "REPLACE",
    headless: true,
  });

  const OUT = result.file;
  const lines = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").trim().split("\n") : [];
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log("\n--- SMOKE RESULT ---");
  console.log("saved:", result.saved, "| csv lines:", lines.length, "| xhr hits:", requests, "| elapsed:", elapsed + "s");
  console.log("header:", lines[0]);
  console.log("row1  :", lines[1]);

  const ok =
    result.saved === 2 &&
    lines.length === 3 &&
    lines[0].includes("tweet_url") &&
    lines[1].includes("tweet asli satu") &&
    !fs.readFileSync(OUT, "utf8").includes("iklan");

  console.log(ok ? "SMOKE TEST PASS" : "SMOKE TEST FAIL");
  server.close();
  process.exit(ok ? 0 : 1);
});
