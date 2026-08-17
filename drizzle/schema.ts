import {
  boolean,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing the Manus OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Saved filter and scheduling definition for one Reddit collection stream. */
export const collectionRules = mysqlTable(
  "collectionRules",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    subreddits: text("subreddits").notNull(),
    keywords: text("keywords").notNull(),
    minScore: int("minScore").default(0).notNull(),
    lookbackDays: int("lookbackDays").default(7).notNull(),
    sortMode: mysqlEnum("sortMode", ["new", "hot", "top", "relevance"]).default("new").notNull(),
    includeComments: boolean("includeComments").default(true).notNull(),
    maxPostsPerRun: int("maxPostsPerRun").default(25).notNull(),
    cronExpression: varchar("cronExpression", { length: 64 }).default("0 0 */6 * * *").notNull(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    isActive: boolean("isActive").default(true).notNull(),
    lastRunAt: timestamp("lastRunAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("collectionRules_ownerId_idx").on(table.ownerId),
    uniqueIndex("collectionRules_scheduleTask_idx").on(table.scheduleCronTaskUid),
  ],
);

/** A Reddit submission enriched with Japanese translation, summary, and taxonomy. */
export const knowledgeArticles = mysqlTable(
  "knowledgeArticles",
  {
    id: int("id").autoincrement().primaryKey(),
    collectionRuleId: int("collectionRuleId").notNull(),
    redditPostId: varchar("redditPostId", { length: 32 }).notNull(),
    subreddit: varchar("subreddit", { length: 128 }).notNull(),
    permalink: varchar("permalink", { length: 1024 }).notNull(),
    externalUrl: varchar("externalUrl", { length: 2048 }),
    score: int("score").default(0).notNull(),
    commentCount: int("commentCount").default(0).notNull(),
    sourceCreatedAt: timestamp("sourceCreatedAt").notNull(),
    sourceUpdatedAt: timestamp("sourceUpdatedAt"),
    lastVerifiedAt: timestamp("lastVerifiedAt").notNull(),
    sourceDeletedAt: timestamp("sourceDeletedAt"),
    titleOriginal: text("titleOriginal").notNull(),
    bodyOriginal: longtext("bodyOriginal").notNull(),
    titleJa: text("titleJa").notNull(),
    bodyJa: longtext("bodyJa").notNull(),
    summaryJa: text("summaryJa").notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    tags: text("tags").notNull(),
    searchText: longtext("searchText").notNull(),
    processingStatus: mysqlEnum("processingStatus", ["pending", "processed", "failed", "deleted"])
      .default("pending")
      .notNull(),
    processingError: text("processingError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("knowledgeArticles_redditPostId_idx").on(table.redditPostId),
    index("knowledgeArticles_ruleId_idx").on(table.collectionRuleId),
    index("knowledgeArticles_subreddit_idx").on(table.subreddit),
    index("knowledgeArticles_created_idx").on(table.sourceCreatedAt),
    index("knowledgeArticles_status_idx").on(table.processingStatus),
  ],
);

/** A material comment retained as part of an imported Reddit thread. */
export const articleComments = mysqlTable(
  "articleComments",
  {
    id: int("id").autoincrement().primaryKey(),
    articleId: int("articleId").notNull(),
    redditCommentId: varchar("redditCommentId", { length: 32 }).notNull(),
    parentRedditId: varchar("parentRedditId", { length: 32 }),
    score: int("score").default(0).notNull(),
    sourceCreatedAt: timestamp("sourceCreatedAt").notNull(),
    lastVerifiedAt: timestamp("lastVerifiedAt").notNull(),
    sourceDeletedAt: timestamp("sourceDeletedAt"),
    bodyOriginal: longtext("bodyOriginal").notNull(),
    bodyJa: longtext("bodyJa").notNull(),
    summaryJa: text("summaryJa").notNull(),
    processingStatus: mysqlEnum("processingStatus", ["pending", "processed", "failed", "deleted"])
      .default("pending")
      .notNull(),
    processingError: text("processingError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("articleComments_redditCommentId_idx").on(table.redditCommentId),
    index("articleComments_articleId_idx").on(table.articleId),
    index("articleComments_created_idx").on(table.sourceCreatedAt),
  ],
);

/** Immutable audit record for manual and scheduled collection executions. */
export const collectionJobRuns = mysqlTable(
  "collectionJobRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    collectionRuleId: int("collectionRuleId").notNull(),
    trigger: mysqlEnum("trigger", ["manual", "scheduled"]).notNull(),
    status: mysqlEnum("status", ["running", "success", "partial", "failed"]).default("running").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    fetchedPosts: int("fetchedPosts").default(0).notNull(),
    fetchedComments: int("fetchedComments").default(0).notNull(),
    acceptedPosts: int("acceptedPosts").default(0).notNull(),
    skippedPosts: int("skippedPosts").default(0).notNull(),
    processedItems: int("processedItems").default(0).notNull(),
    failedItems: int("failedItems").default(0).notNull(),
    rateLimitRemaining: int("rateLimitRemaining"),
    rateLimitResetSeconds: int("rateLimitResetSeconds"),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("collectionJobRuns_ruleId_idx").on(table.collectionRuleId),
    index("collectionJobRuns_startedAt_idx").on(table.startedAt),
    index("collectionJobRuns_status_idx").on(table.status),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CollectionRule = typeof collectionRules.$inferSelect;
export type InsertCollectionRule = typeof collectionRules.$inferInsert;
export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;
export type InsertKnowledgeArticle = typeof knowledgeArticles.$inferInsert;
export type ArticleComment = typeof articleComments.$inferSelect;
export type InsertArticleComment = typeof articleComments.$inferInsert;
export type CollectionJobRun = typeof collectionJobRuns.$inferSelect;
