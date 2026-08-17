import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import {
  createCollectionRule,
  deleteCollectionRule,
  getCollectionRule,
  getDashboardMetrics,
  getKnowledgeArticle,
  listCollectionRules,
  listKnowledgeArticles,
  listRecentJobRuns,
  updateCollectionRule,
  updateCollectionRuleSystem,
} from "./db";
import { runCollectionRule } from "./collectionRunner";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const cronExpression = z
  .string()
  .trim()
  .regex(/^\S+(?:\s+\S+){5}$/, "cron式は秒を含む6フィールド形式で入力してください。");

const collectionRuleInput = z.object({
  name: z.string().trim().min(1).max(120),
  subreddits: z.array(z.string().trim().regex(/^[A-Za-z0-9_]{2,21}$/)).min(1).max(20),
  keywords: z.array(z.string().trim().min(1).max(100)).max(30),
  minScore: z.number().int().min(0).max(1_000_000),
  lookbackDays: z.number().int().min(1).max(90),
  sortMode: z.enum(["new", "hot", "top", "relevance"]),
  includeComments: z.boolean(),
  maxPostsPerRun: z.number().int().min(1).max(100),
  cronExpression,
  isActive: z.boolean(),
});

function serializeRuleInput(ownerId: number, input: z.infer<typeof collectionRuleInput>) {
  return {
    ownerId,
    name: input.name,
    subreddits: JSON.stringify(Array.from(new Set(input.subreddits.map(item => item.replace(/^r\//i, ""))))),
    keywords: JSON.stringify(Array.from(new Set(input.keywords))),
    minScore: input.minScore,
    lookbackDays: input.lookbackDays,
    sortMode: input.sortMode,
    includeComments: input.includeComments,
    maxPostsPerRun: input.maxPostsPerRun,
    cronExpression: input.cronExpression,
    isActive: input.isActive,
  } as const;
}

function sessionToken(cookieHeader: string | undefined) {
  return parseCookie(cookieHeader ?? "")[COOKIE_NAME] ?? "";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  collectionRules: router({
    list: protectedProcedure.query(({ ctx }) => listCollectionRules(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) =>
      getCollectionRule(ctx.user.id, input.id),
    ),
    create: protectedProcedure.input(collectionRuleInput).mutation(async ({ ctx, input }) => {
      const id = await createCollectionRule(serializeRuleInput(ctx.user.id, input));
      return { id };
    }),
    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), rule: collectionRuleInput }))
      .mutation(async ({ ctx, input }) => {
        await updateCollectionRule(ctx.user.id, input.id, serializeRuleInput(ctx.user.id, input.rule));
        return { success: true } as const;
      }),
    syncSchedule: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const rule = await getCollectionRule(ctx.user.id, input.id);
        if (!rule) throw new Error("収集条件が見つかりません。");
        const token = sessionToken(ctx.req.headers.cookie);
        if (rule.scheduleCronTaskUid) {
          const updated = await updateHeartbeatJob(
            rule.scheduleCronTaskUid,
            {
              cron: rule.cronExpression,
              enable: rule.isActive,
              description: `Reddit AI Knowledge: ${rule.name}`,
            },
            token,
          );
          return { taskUid: rule.scheduleCronTaskUid, nextExecutionAt: updated.nextExecutionAt ?? null };
        }
        if (!rule.isActive) return { taskUid: null, nextExecutionAt: null };
        const created = await createHeartbeatJob(
          {
            name: `reddit-rule-${rule.id}`,
            cron: rule.cronExpression,
            path: "/api/scheduled/reddit-collection",
            description: `Reddit AI Knowledge: ${rule.name}`,
          },
          token,
        );
        await updateCollectionRuleSystem(rule.id, { scheduleCronTaskUid: created.taskUid });
        return { taskUid: created.taskUid, nextExecutionAt: created.nextExecutionAt ?? null };
      }),
    runNow: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const rule = await getCollectionRule(ctx.user.id, input.id);
      if (!rule) throw new Error("収集条件が見つかりません。");
      return runCollectionRule(rule, "manual");
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const rule = await getCollectionRule(ctx.user.id, input.id);
      if (!rule) return { success: true } as const;
      if (rule.scheduleCronTaskUid) {
        await deleteHeartbeatJob(rule.scheduleCronTaskUid, sessionToken(ctx.req.headers.cookie));
      }
      await deleteCollectionRule(ctx.user.id, input.id);
      return { success: true } as const;
    }),
  }),
  knowledge: router({
    list: protectedProcedure
      .input(
        z.object({
          query: z.string().trim().max(200).optional(),
          subreddit: z.string().trim().max(128).optional(),
          category: z.string().trim().max(80).optional(),
          tag: z.string().trim().max(80).optional(),
          from: z.date().optional(),
          to: z.date().optional(),
          limit: z.number().int().min(1).max(100).optional(),
        }),
      )
      .query(({ input }) => listKnowledgeArticles(input)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) =>
      getKnowledgeArticle(input.id),
    ),
  }),
  dashboard: router({
    metrics: protectedProcedure.query(({ ctx }) => getDashboardMetrics(ctx.user.id)),
    recentRuns: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).optional() }))
      .query(({ input }) => listRecentJobRuns(input.limit)),
  }),
});

export type AppRouter = typeof appRouter;
