// Bentuk response XHR X/Twitter yang dipakai scraper. Cuma field yang
// dibutuhkan; field lain di response sengaja tidak dimodelkan.

export interface User {
  core: { created_at: string; name: string; screen_name: string };
  legacy: {
    location?: string;
    screen_name?: string;
    name?: string;
    description?: string;
    followers_count?: number;
    friends_count?: number;
    statuses_count?: number;
    [k: string]: any;
  };
}

export interface TweetResult {
  __typename: string;
  legacy?: {
    created_at: string;
    id_str: string;
    full_text: string;
    lang: string;
    reply_count: number;
    retweet_count: number;
    favorite_count: number;
    quote_count: number;
    user_id_str: string;
    conversation_id_str: string;
    in_reply_to_screen_name?: string;
    entities: {
      media?: Array<{ media_url_https: string }>;
      user_mentions?: Array<{ screen_name: string }>;
      [k: string]: any;
    };
  };
  core?: { user_results: { result: User } };
  tweet?: {
    legacy?: TweetResult["legacy"];
    core?: { user_results: { result: User } };
  };
}

export interface ItemContent {
  __typename: string;
  tweet_results: { result: TweetResult };
}

export interface Entry {
  entryId: string;
  content: {
    items?: Array<{ item: { itemContent: ItemContent } }>;
    itemContent?: ItemContent;
  };
}

export interface TweetResponseData {
  search_by_raw_query?: {
    search_timeline?: {
      timeline?: {
        instructions?: Array<{ type: string; entries: Entry[] }>;
      };
    };
  };
  threaded_conversation_with_injections_v2?: {
    instructions: Array<{ entries: Entry[] }>;
  };
}
