CREATE TABLE "candidate_version" (
	"id" text PRIMARY KEY,
	"candidate_id" text NOT NULL,
	"user_id" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"profile" jsonb NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_version_candidate_id_version_unique" UNIQUE("candidate_id","version")
);
--> statement-breakpoint
ALTER TABLE "candidate" ADD COLUMN "current_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
INSERT INTO "candidate_version" ("id", "candidate_id", "user_id", "version", "name", "tags", "profile", "label", "created_at")
SELECT
	"candidate"."id" || ':version:1',
	"candidate"."id",
	"candidate"."user_id",
	1,
	"candidate"."name",
	"candidate"."tags",
	"candidate"."profile",
	'Initial candidate snapshot',
	"candidate"."created_at"
FROM "candidate";--> statement-breakpoint
CREATE INDEX "candidate_version_candidate_id_created_at_index" ON "candidate_version" ("candidate_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "candidate_version_user_id_created_at_index" ON "candidate_version" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "candidate_version" ADD CONSTRAINT "candidate_version_candidate_id_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "candidate_version" ADD CONSTRAINT "candidate_version_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
