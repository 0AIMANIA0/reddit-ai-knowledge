import { describe, expect, it } from "vitest";
import { computeRedditRetryDelay, parseComment, parseSubmission } from "./reddit";

describe("Reddit Data API response parsing", () => {
  it("normalizes a submission and preserves its source metadata", () => {
    const post = parseSubmission({
      id: "abc123",
      name: "t3_abc123",
      subreddit: "LocalLLaMA",
      permalink: "/r/LocalLLaMA/comments/abc123/example/",
      url: "https://example.com/article",
      title: "A new agent workflow",
      selftext: "This is a detailed post.",
      score: 42,
      num_comments: 8,
      created_utc: 1_700_000_000,
      edited: 1_700_000_300,
    });

    expect(post).toMatchObject({
      id: "abc123",
      name: "t3_abc123",
      subreddit: "LocalLLaMA",
      score: 42,
      numComments: 8,
      removed: false,
    });
    expect(post?.createdAt).toEqual(new Date(1_700_000_000 * 1000));
    expect(post?.editedAt).toEqual(new Date(1_700_000_300 * 1000));
  });

  it("marks deleted and removed content so it can be purged from storage", () => {
    const deletedComment = parseComment({
      id: "comment1",
      parent_id: "t3_abc123",
      body: "[deleted]",
      score: 0,
      created_utc: 1_700_000_000,
    });
    const removedPost = parseSubmission({
      id: "post2",
      title: "Removed post",
      selftext: "[removed]",
      score: 2,
      num_comments: 0,
      created_utc: 1_700_000_000,
      removed_by_category: "moderator",
    });

    expect(deletedComment?.removed).toBe(true);
    expect(removedPost?.removed).toBe(true);
  });

  it("rejects malformed objects without a Reddit id or source timestamp", () => {
    expect(parseSubmission({ title: "Missing identifiers" })).toBeUndefined();
    expect(parseComment({ id: "comment-without-time" })).toBeUndefined();
  });

  it("uses API-provided retry timing while keeping the wait time bounded", () => {
    const response = new Response(null, { status: 429, headers: { "retry-after": "8" } });
    const largeResetResponse = new Response(null, { status: 429, headers: { "x-ratelimit-reset": "120" } });

    expect(computeRedditRetryDelay(response, 0)).toBe(8_000);
    expect(computeRedditRetryDelay(largeResetResponse, 1)).toBe(30_000);
  });
});
