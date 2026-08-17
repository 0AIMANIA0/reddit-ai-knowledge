import type { CollectionRule } from "../drizzle/schema";
import {
  completeCollectionJobRun,
  createCollectionJobRun,
  deleteArticleCommentByRedditCommentId,
  deleteKnowledgeArticleByRedditPostId,
  updateCollectionRuleSystem,
  upsertArticleComment,
  upsertKnowledgeArticle,
} from "./db";
import { enrichEnglishText } from "./knowledgeProcessor";
import { fetchComments, searchSubreddit, type RedditRateLimit, type RedditSubmission } from "./reddit";

export type CollectionRunResult = {
  jobRunId: number;
  status: "success" | "partial" | "failed";
  fetchedPosts: number;
  fetchedComments: number;
  acceptedPosts: number;
  skippedPosts: number;
  processedItems: number;
  failedItems: number;
  rateLimit: RedditRateLimit;
};

const parseStringArray = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const asErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

function shouldCollect(post: RedditSubmission, rule: CollectionRule) {
  const lookbackStart = Date.now() - rule.lookbackDays * 24 * 60 * 60 * 1000;
  return !post.removed && post.score >= rule.minScore && post.createdAt.getTime() >= lookbackStart && Boolean(post.title || post.selftext);
}

function mergeRateLimit(current: RedditRateLimit, received: RedditRateLimit): RedditRateLimit {
  return { ...current, ...received };
}

export async function runCollectionRule(rule: CollectionRule, trigger: "manual" | "scheduled"): Promise<CollectionRunResult> {
  const jobRunId = await createCollectionJobRun(rule.id, trigger);
  let fetchedPosts = 0;
  let fetchedComments = 0;
  let acceptedPosts = 0;
  let skippedPosts = 0;
  let processedItems = 0;
  let failedItems = 0;
  let rateLimit: RedditRateLimit = {};

  try {
    const subreddits = parseStringArray(rule.subreddits);
    const keywords = parseStringArray(rule.keywords);
    const collected = new Map<string, RedditSubmission>();
    const perSubredditLimit = Math.max(1, Math.ceil(rule.maxPostsPerRun / Math.max(1, subreddits.length)));

    for (const subreddit of subreddits) {
      const result = await searchSubreddit({ subreddit, keywords, sortMode: rule.sortMode, limit: perSubredditLimit });
      fetchedPosts += result.posts.length;
      rateLimit = mergeRateLimit(rateLimit, result.rateLimit);
      for (const post of result.posts) {
        if (!shouldCollect(post, rule)) {
          skippedPosts += 1;
          if (post.removed) await deleteKnowledgeArticleByRedditPostId(post.id);
          continue;
        }
        if (!collected.has(post.id) && collected.size < rule.maxPostsPerRun) collected.set(post.id, post);
      }
    }

    acceptedPosts = collected.size;
    for (const post of Array.from(collected.values())) {
      try {
        const enrichment = await enrichEnglishText({ title: post.title, body: post.selftext || post.title, sourceKind: "post" });
        const articleId = await upsertKnowledgeArticle({
          collectionRuleId: rule.id,
          redditPostId: post.id,
          subreddit: post.subreddit,
          permalink: post.permalink,
          externalUrl: post.url || null,
          score: post.score,
          commentCount: post.numComments,
          sourceCreatedAt: post.createdAt,
          sourceUpdatedAt: post.editedAt ?? null,
          lastVerifiedAt: new Date(),
          sourceDeletedAt: null,
          titleOriginal: post.title,
          bodyOriginal: post.selftext,
          titleJa: enrichment.titleJa,
          bodyJa: enrichment.bodyJa,
          summaryJa: enrichment.summaryJa,
          category: enrichment.category,
          tags: JSON.stringify(enrichment.tags),
          searchText: [post.title, post.selftext, enrichment.titleJa, enrichment.bodyJa, enrichment.summaryJa, enrichment.category, ...enrichment.tags]
            .join("\n")
            .slice(0, 60_000),
          processingStatus: "processed",
          processingError: null,
        });
        processedItems += 1;

        if (rule.includeComments && articleId) {
          const commentResult = await fetchComments(post.permalink);
          rateLimit = mergeRateLimit(rateLimit, commentResult.rateLimit);
          fetchedComments += commentResult.comments.length;
          for (const comment of commentResult.comments) {
            if (comment.removed) {
              await deleteArticleCommentByRedditCommentId(comment.id);
              continue;
            }
            try {
              const commentEnrichment = await enrichEnglishText({ title: `r/${post.subreddit} のコメント`, body: comment.body, sourceKind: "comment" });
              await upsertArticleComment({
                articleId,
                redditCommentId: comment.id,
                parentRedditId: comment.parentId ?? null,
                score: comment.score,
                sourceCreatedAt: comment.createdAt,
                lastVerifiedAt: new Date(),
                sourceDeletedAt: null,
                bodyOriginal: comment.body,
                bodyJa: commentEnrichment.bodyJa,
                summaryJa: commentEnrichment.summaryJa,
                processingStatus: "processed",
                processingError: null,
              });
              processedItems += 1;
            } catch {
              failedItems += 1;
            }
          }
        }
      } catch {
        failedItems += 1;
      }
    }

    const status = failedItems > 0 ? "partial" : "success";
    const result: CollectionRunResult = {
      jobRunId,
      status,
      fetchedPosts,
      fetchedComments,
      acceptedPosts,
      skippedPosts,
      processedItems,
      failedItems,
      rateLimit,
    };
    await completeCollectionJobRun(jobRunId, {
      status,
      fetchedPosts,
      fetchedComments,
      acceptedPosts,
      skippedPosts,
      processedItems,
      failedItems,
      rateLimitRemaining: rateLimit.remaining,
      rateLimitResetSeconds: rateLimit.resetSeconds,
    });
    await updateCollectionRuleSystem(rule.id, { lastRunAt: new Date() });
    return result;
  } catch (error) {
    const errorMessage = asErrorMessage(error);
    await completeCollectionJobRun(jobRunId, {
      status: "failed",
      fetchedPosts,
      fetchedComments,
      acceptedPosts,
      skippedPosts,
      processedItems,
      failedItems: failedItems + 1,
      rateLimitRemaining: rateLimit.remaining,
      rateLimitResetSeconds: rateLimit.resetSeconds,
      errorMessage,
    });
    throw error;
  }
}
