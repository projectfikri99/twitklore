import type { Entry, TweetResponseData } from "./types.js";
import pkg from "lodash";
const { pick } = pkg;

export interface TweetRow {
  created_at: string;
  id_str: string;
  full_text: string;
  reply_count: number;
  retweet_count: number;
  favorite_count: number;
  quote_count: number;
  lang: string;
  user_id_str: string;
  conversation_id_str: string;
  username: string;
  tweet_url: string;
  image_url: string;
  location: string;
  in_reply_to_screen_name: string;
}

/**
 * Ambil entries dari response XHR. Search mode pakai search_by_raw_query,
 * detail/thread mode pakai threaded_conversation_with_injections_v2.
 */
export function extractEntries(data: TweetResponseData): Entry[] | undefined {
  if ((data as any).threaded_conversation_with_injections_v2) {
    return (data as any).threaded_conversation_with_injections_v2.instructions[0]?.entries;
  }
  return data?.search_by_raw_query?.search_timeline?.timeline?.instructions?.[0]?.entries;
}

interface NormalizedTweet {
  tweet: any;
  user: any;
}

/**
 * Satu entry -> { tweet, user } atau null kalau bukan tweet asli
 * (promoted, no result, atau di detail mode bukan balasan thread creator).
 */
export function normalizeEntry(entry: Entry, mode: "SEARCH" | "DETAIL"): NormalizedTweet | null {
  if (entry.entryId.includes("promoted")) return null;

  if (mode === "SEARCH") {
    const result = entry.content?.itemContent?.tweet_results?.result;
    if (!result) return null;
    const user = userFrom(result);
    if (!user) return null;
    return { tweet: result.legacy || result.tweet?.legacy, user };
  }

  const result = entry.content?.items?.[0]?.item?.itemContent?.tweet_results?.result;
  if (!result) return null;

  const mentionsThreadCreator = result.legacy?.entities?.user_mentions?.[0];
  if (!mentionsThreadCreator) return null;

  const user = userFrom(result);
  if (!user) return null;

  return { tweet: result.legacy, user };
}

function userFrom(result: any) {
  const u = result.core?.user_results?.result || result.tweet?.core?.user_results?.result;
  if (!u) return null;
  return { ...u.legacy, screen_name: u.core?.screen_name, name: u.core?.name };
}
/**
 * Normalized tweet -> row CSV dengan kolom final. Mengembalikan null kalau
 * field wajib (user) nggak ada.
 */
export function toRow(n: NormalizedTweet, mode: "SEARCH" | "DETAIL"): TweetRow | null {
  if (!n.user) return null;

  const tweet: any = pick(n.tweet, [
    "created_at",
    "id_str",
    "full_text",
    "reply_count",
    "retweet_count",
    "favorite_count",
    "quote_count",
    "lang",
    "user_id_str",
    "conversation_id_str",
  ]);

  let text = tweet.full_text ?? "";

  if (mode === "DETAIL") {
    const replyTo = n.tweet.entities?.user_mentions?.[0]?.screen_name;
    const firstChar = text.trimStart()[0];
    // buang "@user " di awal kalau itu balasan
    if (firstChar === "@" && replyTo) {
      text = text.replace(`@${replyTo} `, "");
    }
  }

  return {
    ...tweet,
    full_text: text,
    username: n.user.screen_name ?? "",
    tweet_url: `https://x.com/${n.user.screen_name}/status/${tweet.id_str}`,
    image_url: n.tweet.entities?.media?.[0]?.media_url_https ?? "",
    location: n.user.location ?? "",
    in_reply_to_screen_name: n.tweet.in_reply_to_screen_name ?? "",
  };
}
