CREATE TABLE "candidate" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"profile" jsonb NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_source_document" (
	"id" text PRIMARY KEY,
	"candidate_id" text NOT NULL,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" bytea NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "candidate_id" text;--> statement-breakpoint
CREATE INDEX "candidate_user_id_updated_at_index" ON "candidate" ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "candidate_user_id_name_index" ON "candidate" ("user_id","name");--> statement-breakpoint
CREATE INDEX "candidate_source_document_candidate_id_created_at_index" ON "candidate_source_document" ("candidate_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "candidate_source_document_user_id_created_at_index" ON "candidate_source_document" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "resume_candidate_id_index" ON "resume" ("candidate_id");--> statement-breakpoint
ALTER TABLE "candidate" ADD CONSTRAINT "candidate_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "candidate_source_document" ADD CONSTRAINT "candidate_source_document_candidate_id_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "candidate_source_document" ADD CONSTRAINT "candidate_source_document_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resume" ADD CONSTRAINT "resume_candidate_id_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE SET NULL;