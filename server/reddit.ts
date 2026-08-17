import { ENV } from "./_core/env";

export type RedditRateLimit = {
  remaining?: number;
  resetSeconds?: number;
};

export type RedditSubmission = {
  id: string;
  name: string;
  subreddit: string;
  permalink: string;
  url: string;
  title: string;
  selftext: string;
  score: number;
  numComments: number;
  createdAt: Date;
  editedAt?: Date;
  removed: boolean;
};

export type RedditComment = {
  id: string;
  name: string;
  parentId?: string;
  body: string;
  score: number;
  createdAt: Date;
  removed: boolean;
};

type RedditChild = { kind: string; data: Record<string, unknown> };
type RedditListing = { data?: { children?: RedditChild[] } };

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | undefined;

export class RedditConfigurationError extends Error {}

export function isRedditConfigured() {
  return Boolean(ENV.redditClientId && ENV.redditClientSecret && ENV.redditUserAgent);
}

function requireConfiguration() {
  if (!isRedditConfigured()) {
    throw new RedditConfigurationError("Reddit OAuth認証情報が未設定です。管理者設定でClient ID、Client Secret、User-Agentを指定してください。");
  }
}

function parseTimestamp(value: unknown): Date | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return new Date(value * 1000);
}

function readString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

function readNumber(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rateLimitFrom(response: Response): RedditRateLimit {
  const remaining = Number(response.headers.get("x-ratelimit-remaining"));
  const resetSeconds = Number(response.headers.get("x-ratelimit-reset"));
  return {
    ...(Number.isFinite(remaining) ? { remaining: Math.max(0, Math.floor(remaining)) } : {}),
    ...(Number.isFinite(resetSeconds) ? { resetSeconds: Math.max(0, Math.ceil(resetSeconds)) } : {}),
  };
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function computeRedditRetryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get("retry-after"));
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  const headerDelayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Number.isFinite(reset) && reset > 0 ? reset * 1000 : 0;
  const exponentialMs = 1_000 * 2 ** attempt;
  return Math.min(30_000, Math.max(exponentialMs, headerDelayMs));
}

async function getAccessToken(forceRefresh = false) {
  requireConfiguration();
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;

  const credentials = Buffer.from(`${ENV.redditClientId}:${ENV.redditClientSecret}`).toString("base64");
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": ENV.redditUserAgent,
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`Reddit OAuth token request failed (${response.status}).`);
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Reddit OAuth token response did not include an access token.");
  tokenCache = { accessToken: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
  return tokenCache.accessToken;
}

async function redditGet<T>(path: string, refreshedToken = false, attempt = 0): Promise<{ data: T; rateLimit: RedditRateLimit }> {
  const token = await getAccessToken(refreshedToken);
  const response = await fetch(`https://oauth.reddit.com${path}`, {
    headers: { authorization: `Bearer ${token}`, "user-agent": ENV.redditUserAgent },
  });
  if (response.status === 401 && !refreshedToken) return redditGet<T>(path, true, attempt);
  if ((response.status === 429 || response.status >= 500) && attempt < 2) {
    await sleep(computeRedditRetryDelay(response, attempt));
    return redditGet<T>(path, refreshedToken, attempt + 1);
  }
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(`Reddit Data API request failed (${response.status})${retryAfter ? `; retry after ${retryAfter}s` : ""}.`);
  }
  return { data: (await response.json()) as T, rateLimit: rateLimitFrom(response) };
}

function isRemoved(data: Record<string, unknown>) {
  const body = readString(data, "selftext") || readString(data, "body");
  return body === "[removed]" || body === "[deleted]" || Boolean(data.removed_by_category);
}

export function parseSubmission(data: Record<string, unknown>): RedditSubmission | undefined {
  const id = readString(data, "id");
  const createdAt = parseTimestamp(data.created_utc);
  if (!id || !createdAt) return undefined;
  return {
    id,
    name: readString(data, "name") || `t3_${id}`,
    subreddit: readString(data, "subreddit"),
    permalink: readString(data, "permalink"),
    url: readString(data, "url"),
    title: readString(data, "title"),
    selftext: readString(data, "selftext"),
    score: readNumber(data, "score"),
    numComments: readNumber(data, "num_comments"),
    createdAt,
    editedAt: parseTimestamp(data.edited),
    removed: isRemoved(data),
  };
}

export function parseComment(data: Record<string, unknown>): RedditComment | undefined {
  const id = readString(data, "id");
  const createdAt = parseTimestamp(data.created_utc);
  if (!id || !createdAt) return undefined;
  return {
    id,
    name: readString(data, "name") || `t1_${id}`,
    parentId: readString(data, "parent_id") || undefined,
    body: readString(data, "body"),
    score: readNumber(data, "score"),
    createdAt,
    removed: isRemoved(data),
  };
}

export async function searchSubreddit(input: {
  subreddit: string;
  keywords: string[];
  sortMode: "new" | "hot" | "top" | "relevance";
  limit: number;
}) {
  const query = input.keywords.length > 0 ? input.keywords.map(keyword => `"${keyword.replace(/"/g, "")}"`).join(" OR ") : "*";
  const params = new URLSearchParams({
    q: query,
    restrict_sr: "on",
    sort: input.sortMode === "relevance" ? "relevance" : input.sortMode,
    t: "all",
    limit: String(Math.min(100, input.limit)),
    raw_json: "1",
  });
  const response = await redditGet<RedditListing>(`/r/${encodeURIComponent(input.subreddit)}/search?${params.toString()}`);
  const posts = (response.data.data?.children ?? [])
    .filter(child => child.kind === "t3")
    .map(child => parseSubmission(child.data))
    .filter((post): post is RedditSubmission => Boolean(post));
  return { posts, rateLimit: response.rateLimit };
}

export async function fetchComments(permalink: string, limit = 12) {
  const suffix = permalink.startsWith("/") ? permalink : `/${permalink}`;
  const params = new URLSearchParams({ limit: String(Math.min(100, limit)), raw_json: "1", sort: "top" });
  const response = await redditGet<RedditListing[]>(`${suffix}.json?${params.toString()}`);
  const listing = response.data[1];
  const comments = (listing?.data?.children ?? [])
    .filter(child => child.kind === "t1")
    .map(child => parseComment(child.data))
    .filter((comment): comment is RedditComment => Boolean(comment))
    .slice(0, limit);
  return { comments, rateLimit: response.rateLimit };
}
