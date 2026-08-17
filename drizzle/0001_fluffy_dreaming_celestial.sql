CREATE TABLE `articleComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`redditCommentId` varchar(32) NOT NULL,
	`parentRedditId` varchar(32),
	`score` int NOT NULL DEFAULT 0,
	`sourceCreatedAt` timestamp NOT NULL,
	`lastVerifiedAt` timestamp NOT NULL,
	`sourceDeletedAt` timestamp,
	`bodyOriginal` longtext NOT NULL,
	`bodyJa` longtext NOT NULL,
	`summaryJa` text NOT NULL,
	`processingStatus` enum('pending','processed','failed','deleted') NOT NULL DEFAULT 'pending',
	`processingError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `articleComments_id` PRIMARY KEY(`id`),
	CONSTRAINT `articleComments_redditCommentId_idx` UNIQUE(`redditCommentId`)
);
--> statement-breakpoint
CREATE TABLE `collectionJobRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionRuleId` int NOT NULL,
	`trigger` enum('manual','scheduled') NOT NULL,
	`status` enum('running','success','partial','failed') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`fetchedPosts` int NOT NULL DEFAULT 0,
	`fetchedComments` int NOT NULL DEFAULT 0,
	`acceptedPosts` int NOT NULL DEFAULT 0,
	`skippedPosts` int NOT NULL DEFAULT 0,
	`processedItems` int NOT NULL DEFAULT 0,
	`failedItems` int NOT NULL DEFAULT 0,
	`rateLimitRemaining` int,
	`rateLimitResetSeconds` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collectionJobRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collectionRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`subreddits` text NOT NULL,
	`keywords` text NOT NULL,
	`minScore` int NOT NULL DEFAULT 0,
	`lookbackDays` int NOT NULL DEFAULT 7,
	`sortMode` enum('new','hot','top','relevance') NOT NULL DEFAULT 'new',
	`includeComments` boolean NOT NULL DEFAULT true,
	`maxPostsPerRun` int NOT NULL DEFAULT 25,
	`cronExpression` varchar(64) NOT NULL DEFAULT '0 0 */6 * * *',
	`scheduleCronTaskUid` varchar(65),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collectionRules_id` PRIMARY KEY(`id`),
	CONSTRAINT `collectionRules_scheduleTask_idx` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `knowledgeArticles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionRuleId` int NOT NULL,
	`redditPostId` varchar(32) NOT NULL,
	`subreddit` varchar(128) NOT NULL,
	`permalink` varchar(1024) NOT NULL,
	`externalUrl` varchar(2048),
	`score` int NOT NULL DEFAULT 0,
	`commentCount` int NOT NULL DEFAULT 0,
	`sourceCreatedAt` timestamp NOT NULL,
	`sourceUpdatedAt` timestamp,
	`lastVerifiedAt` timestamp NOT NULL,
	`sourceDeletedAt` timestamp,
	`titleOriginal` text NOT NULL,
	`bodyOriginal` longtext NOT NULL,
	`titleJa` text NOT NULL,
	`bodyJa` longtext NOT NULL,
	`summaryJa` text NOT NULL,
	`category` varchar(80) NOT NULL,
	`tags` text NOT NULL,
	`searchText` longtext NOT NULL,
	`processingStatus` enum('pending','processed','failed','deleted') NOT NULL DEFAULT 'pending',
	`processingError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledgeArticles_id` PRIMARY KEY(`id`),
	CONSTRAINT `knowledgeArticles_redditPostId_idx` UNIQUE(`redditPostId`)
);
--> statement-breakpoint
CREATE INDEX `articleComments_articleId_idx` ON `articleComments` (`articleId`);--> statement-breakpoint
CREATE INDEX `articleComments_created_idx` ON `articleComments` (`sourceCreatedAt`);--> statement-breakpoint
CREATE INDEX `collectionJobRuns_ruleId_idx` ON `collectionJobRuns` (`collectionRuleId`);--> statement-breakpoint
CREATE INDEX `collectionJobRuns_startedAt_idx` ON `collectionJobRuns` (`startedAt`);--> statement-breakpoint
CREATE INDEX `collectionJobRuns_status_idx` ON `collectionJobRuns` (`status`);--> statement-breakpoint
CREATE INDEX `collectionRules_ownerId_idx` ON `collectionRules` (`ownerId`);--> statement-breakpoint
CREATE INDEX `knowledgeArticles_ruleId_idx` ON `knowledgeArticles` (`collectionRuleId`);--> statement-breakpoint
CREATE INDEX `knowledgeArticles_subreddit_idx` ON `knowledgeArticles` (`subreddit`);--> statement-breakpoint
CREATE INDEX `knowledgeArticles_created_idx` ON `knowledgeArticles` (`sourceCreatedAt`);--> statement-breakpoint
CREATE INDEX `knowledgeArticles_status_idx` ON `knowledgeArticles` (`processingStatus`);