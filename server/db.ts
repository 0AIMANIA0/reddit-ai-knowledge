import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  articleComments,
  collectionJobRuns,
  collectionRules,
  InsertArticleComment,
  InsertCollectionRule,
  InsertKnowledgeArticle,
  InsertUser,
  knowledgeArticles,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function listCollectionRules(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(collectionRules).where(eq(collectionRules.ownerId, ownerId)).orderBy(desc(collectionRules.updatedAt));
}

export async function getCollectionRule(ownerId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db
      .select()
      .from(collectionRules)
      .where(and(eq(collectionRules.id, id), eq(collectionRules.ownerId, ownerId)))
      .limit(1)
  )[0];
}

export async function getCollectionRuleSystem(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(collectionRules).where(eq(collectionRules.id, id)).limit(1))[0];
}

export async function getCollectionRuleByScheduleTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(collectionRules).where(eq(collectionRules.scheduleCronTaskUid, taskUid)).limit(1))[0];
}

export async function createCollectionRule(input: InsertCollectionRule) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(collectionRules).values(input);
  return Number(result[0].insertId);
}

export async function updateCollectionRule(ownerId: number, id: number, input: Partial<InsertCollectionRule>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(collectionRules).set(input).where(and(eq(collectionRules.id, id), eq(collectionRules.ownerId, ownerId)));
}

export async function updateCollectionRuleSystem(id: number, input: Partial<InsertCollectionRule>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(collectionRules).set(input).where(eq(collectionRules.id, id));
}

export async function deleteCollectionRule(ownerId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(collectionRules).where(and(eq(collectionRules.id, id), eq(collectionRules.ownerId, ownerId)));
}

export async function listKnowledgeArticles(input: {
  query?: string;
  subreddit?: string;
  category?: string;
  tag?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(knowledgeArticles.processingStatus, "processed")];
  if (input.query) {
    const escaped = input.query.replace(/[\\%_]/g, "\\$&");
    filters.push(
      or(
        like(knowledgeArticles.searchText, `%${escaped}%`),
        like(knowledgeArticles.titleJa, `%${escaped}%`),
        like(knowledgeArticles.titleOriginal, `%${escaped}%`),
      )!,
    );
  }
  if (input.subreddit) filters.push(eq(knowledgeArticles.subreddit, input.subreddit));
  if (input.category) filters.push(eq(knowledgeArticles.category, input.category));
  if (input.tag) filters.push(like(knowledgeArticles.tags, `%\"${input.tag}\"%`));
  if (input.from) filters.push(sql`${knowledgeArticles.sourceCreatedAt} >= ${input.from}`);
  if (input.to) filters.push(sql`${knowledgeArticles.sourceCreatedAt} <= ${input.to}`);
  return db
    .select()
    .from(knowledgeArticles)
    .where(and(...filters))
    .orderBy(desc(knowledgeArticles.sourceCreatedAt))
    .limit(input.limit ?? 50);
}

export async function getKnowledgeArticle(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, id)).limit(1))[0];
}

export async function upsertKnowledgeArticle(input: InsertKnowledgeArticle) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(knowledgeArticles).values(input).onDuplicateKeyUpdate({
    set: {
      collectionRuleId: input.collectionRuleId,
      subreddit: input.subreddit,
      permalink: input.permalink,
      externalUrl: input.externalUrl,
      score: input.score,
      commentCount: input.commentCount,
      sourceCreatedAt: input.sourceCreatedAt,
      sourceUpdatedAt: input.sourceUpdatedAt,
      lastVerifiedAt: input.lastVerifiedAt,
      sourceDeletedAt: null,
      titleOriginal: input.titleOriginal,
      bodyOriginal: input.bodyOriginal,
      titleJa: input.titleJa,
      bodyJa: input.bodyJa,
      summaryJa: input.summaryJa,
      category: input.category,
      tags: input.tags,
      searchText: input.searchText,
      processingStatus: input.processingStatus,
      processingError: input.processingError,
    },
  });
  return (
    await db.select({ id: knowledgeArticles.id }).from(knowledgeArticles).where(eq(knowledgeArticles.redditPostId, input.redditPostId)).limit(1)
  )[0]?.id;
}

export async function deleteKnowledgeArticleByRedditPostId(redditPostId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const article = (
    await db.select({ id: knowledgeArticles.id }).from(knowledgeArticles).where(eq(knowledgeArticles.redditPostId, redditPostId)).limit(1)
  )[0];
  if (!article) return;
  await db.delete(articleComments).where(eq(articleComments.articleId, article.id));
  await db.delete(knowledgeArticles).where(eq(knowledgeArticles.id, article.id));
}

export async function upsertArticleComment(input: InsertArticleComment) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(articleComments).values(input).onDuplicateKeyUpdate({
    set: {
      articleId: input.articleId,
      parentRedditId: input.parentRedditId,
      score: input.score,
      sourceCreatedAt: input.sourceCreatedAt,
      lastVerifiedAt: input.lastVerifiedAt,
      sourceDeletedAt: null,
      bodyOriginal: input.bodyOriginal,
      bodyJa: input.bodyJa,
      summaryJa: input.summaryJa,
      processingStatus: input.processingStatus,
      processingError: input.processingError,
    },
  });
}

export async function deleteArticleCommentByRedditCommentId(redditCommentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(articleComments).where(eq(articleComments.redditCommentId, redditCommentId));
}

export async function createCollectionJobRun(collectionRuleId: number, trigger: "manual" | "scheduled") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(collectionJobRuns).values({ collectionRuleId, trigger, status: "running" });
  return Number(result[0].insertId);
}

export async function completeCollectionJobRun(
  id: number,
  input: {
    status: "success" | "partial" | "failed";
    fetchedPosts: number;
    fetchedComments: number;
    acceptedPosts: number;
    skippedPosts: number;
    processedItems: number;
    failedItems: number;
    rateLimitRemaining?: number;
    rateLimitResetSeconds?: number;
    errorMessage?: string;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(collectionJobRuns).set({ ...input, completedAt: new Date() }).where(eq(collectionJobRuns.id, id));
}

export async function listRecentJobRuns(limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ run: collectionJobRuns, ruleName: collectionRules.name })
    .from(collectionJobRuns)
    .innerJoin(collectionRules, eq(collectionJobRuns.collectionRuleId, collectionRules.id))
    .orderBy(desc(collectionJobRuns.startedAt))
    .limit(limit);
}

export async function getDashboardMetrics(ownerId: number) {
  const db = await getDb();
  if (!db) return { activeRules: 0, processedArticles: 0, latestRun: undefined };
  const [ruleCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(collectionRules)
    .where(and(eq(collectionRules.ownerId, ownerId), eq(collectionRules.isActive, true)));
  const [articleCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.processingStatus, "processed"));
  const latestRun = (await listRecentJobRuns(1))[0];
  return {
    activeRules: Number(ruleCount?.count ?? 0),
    processedArticles: Number(articleCount?.count ?? 0),
    latestRun,
  };
}
