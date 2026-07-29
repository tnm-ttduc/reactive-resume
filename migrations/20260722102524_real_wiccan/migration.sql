CREATE TABLE "custom_template" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"draft" jsonb NOT NULL,
	"current_version" integer DEFAULT 0 NOT NULL,
	"user_id" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_template_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "custom_template_version" (
	"id" text PRIMARY KEY,
	"template_id" text NOT NULL,
	"user_id" text NOT NULL,
	"version" integer NOT NULL,
	"ast" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_template_version_template_id_version_unique" UNIQUE("template_id","version")
);
--> statement-breakpoint
CREATE INDEX "custom_template_user_id_updated_at_index" ON "custom_template" ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "custom_template_version_template_id_created_at_index" ON "custom_template_version" ("template_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "custom_template" ADD CONSTRAINT "custom_template_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_template_version" ADD CONSTRAINT "custom_template_version_template_id_custom_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "custom_template"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_template_version" ADD CONSTRAINT "custom_template_version_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;