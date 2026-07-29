CREATE TABLE "custom_template_source" (
	"template_id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"media_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" bytea NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "custom_template_source_user_id_template_id_index" ON "custom_template_source" ("user_id","template_id");--> statement-breakpoint
ALTER TABLE "custom_template_source" ADD CONSTRAINT "custom_template_source_template_id_custom_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "custom_template"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_template_source" ADD CONSTRAINT "custom_template_source_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;