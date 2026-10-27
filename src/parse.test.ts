import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEntries, normalizeEntry, toRow } from "./parse.ts";

const searchEntry = {
  entryId: "tweet-123",
  content: {
    itemContent: {
      __typename: "TimelineTimelineTweet",
      tweet_results: {
        result: {
          legacy: {
            created_at: "Mon Jan 01 10:00:00 +0000 2024",
            id_str: "123",
            full_text: "halo dunia",
            lang: "in",
            reply_count: 1,
            retweet_count: 2,
            favorite_count: 3,
            quote_count: 0,
            user_id_str: "u1",
            conversation_id_str: "123",
            entities: { media: [{ media_url_https: "https://img/x.jpg" }] },
          },
          core: {
            user_results: {
              result: {
                core: { screen_name: "fikri", name: "Fikri" },
                legacy: { location: "Jakarta" },
              },
            },
          },
        },
      },
    },
  },
};

const detailEntry = {
  entryId: "conversationthread-1",
  content: {
    items: [
      {
        item: {
          itemContent: {
            tweet_results: {
              result: {
                legacy: {
                  created_at: "Mon Jan 01 10:00:00 +0000 2024",
                  id_str: "456",
                  full_text: "@someone ini balasan",
                  lang: "in",
                  reply_count: 0,
                  retweet_count: 0,
                  favorite_count: 5,
                  quote_count: 0,
                  user_id_str: "u2",
                  conversation_id_str: "456",
                  entities: { user_mentions: [{ screen_name: "someone" }] },
                },
                core: {
                  user_results: {
                    result: {
                      core: { screen_name: "budi", name: "Budi" },
                      legacy: { location: "Bandung" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
};

const promotedEntry = {
  entryId: "promoted-tweet-9",
  content: { itemContent: { tweet_results: { result: { legacy: {} } } } },
};

test("extractEntries baca search_by_raw_query", () => {
  const entries = extractEntries({
    search_by_raw_query: {
      search_timeline: { timeline: { instructions: [{ type: "TimelineAddEntries", entries: [searchEntry as any] }] } },
    },
  } as any);
  assert.equal(entries?.length, 1);
});

test("extractEntries baca thread detail", () => {
  const entries = extractEntries({
    threaded_conversation_with_injections_v2: { instructions: [{ entries: [detailEntry as any] }] },
  } as any);
  assert.equal(entries?.length, 1);
});

test("extractEntries balikin undefined kalau struktur nggak dikenal", () => {
  assert.equal(extractEntries({} as any), undefined);
});

test("normalizeEntry buang promoted tweet", () => {
  assert.equal(normalizeEntry(promotedEntry as any, "SEARCH"), null);
});

test("normalizeEntry search mode -> tweet + user", () => {
  const n = normalizeEntry(searchEntry as any, "SEARCH");
  assert.equal(n?.tweet.id_str, "123");
  assert.equal(n?.user.screen_name, "fikri");
});

test("normalizeEntry detail mode butuh mention ke thread creator", () => {
  const noMention = structuredClone(detailEntry);
  noMention.content.items[0].item.itemContent.tweet_results.result.legacy.entities.user_mentions = [];
  assert.equal(normalizeEntry(noMention as any, "DETAIL"), null);

  const withMention = normalizeEntry(detailEntry as any, "DETAIL");
  assert.equal(withMention?.tweet.id_str, "456");
});

test("toRow hasilkan 15 kolom final", () => {
  const row = toRow(normalizeEntry(searchEntry as any, "SEARCH")!, "SEARCH")!;
  assert.equal(Object.keys(row).length, 15);
  assert.equal(row.tweet_url, "https://x.com/fikri/status/123");
  assert.equal(row.image_url, "https://img/x.jpg");
  assert.equal(row.location, "Jakarta");
});

test("toRow detail mode buang prefix @mention", () => {
  const row = toRow(normalizeEntry(detailEntry as any, "DETAIL")!, "DETAIL")!;
  assert.equal(row.full_text, "ini balasan");
});

test("toRow balikin null kalau user hilang", () => {
  const noUser = { tweet: { id_str: "1", entities: {} }, user: null };
  assert.equal(toRow(noUser as any, "SEARCH"), null);
});
