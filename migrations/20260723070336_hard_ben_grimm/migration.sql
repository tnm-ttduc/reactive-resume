CREATE TABLE "custom_template_import_job" (
	"id" text PRIMARY KEY,
	"template_id" text NOT NULL UNIQUE,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 5 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "custom_template_import_job_user_id_created_at_index" ON "custom_template_import_job" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "custom_template_import_job_status_updated_at_index" ON "custom_template_import_job" ("status","updated_at");--> statement-breakpoint
ALTER TABLE "custom_template_import_job" ADD CONSTRAINT "custom_template_import_job_template_id_custom_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "custom_template"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_template_import_job" ADD CONSTRAINT "custom_template_import_job_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;