import type { Express, Request, Response } from "express";
import { getCollectionRuleByScheduleTaskUid } from "./db";
import { runCollectionRule } from "./collectionRunner";
import { sdk } from "./_core/sdk";

export function registerScheduledCollectionRoute(app: Express) {
  app.post("/api/scheduled/reddit-collection", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const rule = await getCollectionRuleByScheduleTaskUid(user.taskUid);
      if (!rule || !rule.isActive) return res.json({ ok: true, skipped: "orphan-or-paused" });
      const result = await runCollectionRule(rule, "scheduled");
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Scheduled Reddit collection]", error);
      return res.status(500).json({
        error: message,
        context: { path: req.path },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
