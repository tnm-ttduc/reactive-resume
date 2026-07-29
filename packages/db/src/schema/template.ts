import type {
	TemplateAst,
	TemplateCompilerReport,
	TemplateLifecycleStatus,
} from "@reactive-resume/schema/template-ast";
import type { TemplateImportJobStage, TemplateImportJobStatus } from "@reactive-resume/schema/template-import-job";
import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { user } from "./auth";

export const customTemplate = pg.pgTable(
	"custom_template",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		name: pg.text("name").notNull(),
		status: pg.text("status").notNull().$type<TemplateLifecycleStatus>().default("draft"),
		draft: pg.jsonb("draft").notNull().$type<TemplateAst>(),
		compilerReport: pg.jsonb("compiler_report").$type<TemplateCompilerReport>(),
		currentVersion: pg.integer("current_version").notNull().default(0),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		publishedAt: pg.timestamp("published_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId, t.updatedAt.desc()), pg.unique().on(t.userId, t.name)],
);

export const customTemplateVersion = pg.pgTable(
	"custom_template_version",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		templateId: pg
			.text("template_id")
			.notNull()
			.references(() => customTemplate.id, { onDelete: "cascade" }),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		version: pg.integer("version").notNull(),
		ast: pg.jsonb("ast").notNull().$type<TemplateAst>(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.unique().on(t.templateId, t.version), pg.index().on(t.templateId, t.createdAt.desc())],
);

export const customTemplateSource = pg.pgTable(
	"custom_template_source",
	{
		templateId: pg
			.text("template_id")
			.notNull()
			.primaryKey()
			.references(() => customTemplate.id, { onDelete: "cascade" }),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		filename: pg.text("filename").notNull(),
		mediaType: pg
			.text("media_type")
			.notNull()
			.$type<"application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document">(),
		size: pg.integer("size").notNull(),
		data: pg.bytea("data").notNull(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.userId, t.templateId)],
);

export const customTemplateImportJob = pg.pgTable(
	"custom_template_import_job",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		templateId: pg
			.text("template_id")
			.notNull()
			.references(() => customTemplate.id, { onDelete: "cascade" }),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: pg.text("status").notNull().$type<TemplateImportJobStatus>().default("queued"),
		stage: pg.text("stage").notNull().$type<TemplateImportJobStage>().default("queued"),
		progress: pg.integer("progress").notNull().default(5),
		attempts: pg.integer("attempts").notNull().default(0),
		error: pg.text("error"),
		startedAt: pg.timestamp("started_at", { withTimezone: true }),
		completedAt: pg.timestamp("completed_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.unique().on(t.templateId),
		pg.index().on(t.userId, t.createdAt.desc()),
		pg.index().on(t.status, t.updatedAt),
	],
);
