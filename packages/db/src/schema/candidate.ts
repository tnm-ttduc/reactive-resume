import type { CandidateProfile } from "@reactive-resume/schema/candidate/data";
import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { user } from "./auth";

export const candidate = pg.pgTable(
	"candidate",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		name: pg.text("name").notNull(),
		email: pg.text("email").notNull().default(""),
		phone: pg.text("phone").notNull().default(""),
		tags: pg.text("tags").array().notNull().default([]),
		profile: pg.jsonb("profile").notNull().$type<CandidateProfile>(),
		currentVersion: pg.integer("current_version").notNull().default(1),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId, t.updatedAt.desc()), pg.index().on(t.userId, t.name)],
);

export const candidateVersion = pg.pgTable(
	"candidate_version",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		candidateId: pg
			.text("candidate_id")
			.notNull()
			.references(() => candidate.id, { onDelete: "cascade" }),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		version: pg.integer("version").notNull(),
		name: pg.text("name").notNull(),
		tags: pg.text("tags").array().notNull().default([]),
		profile: pg.jsonb("profile").notNull().$type<CandidateProfile>(),
		label: pg.text("label").notNull(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.unique().on(t.candidateId, t.version),
		pg.index().on(t.candidateId, t.createdAt.desc()),
		pg.index().on(t.userId, t.createdAt.desc()),
	],
);

export const candidateSourceDocument = pg.pgTable(
	"candidate_source_document",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		candidateId: pg
			.text("candidate_id")
			.notNull()
			.references(() => candidate.id, { onDelete: "cascade" }),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		filename: pg.text("filename").notNull(),
		mediaType: pg.text("media_type").notNull(),
		size: pg.integer("size").notNull(),
		data: pg.bytea("data").notNull(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.candidateId, t.createdAt.desc()), pg.index().on(t.userId, t.createdAt.desc())],
);
