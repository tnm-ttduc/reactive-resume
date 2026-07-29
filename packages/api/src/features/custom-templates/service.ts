import type { TemplateAst, TemplateCompilerReport } from "@reactive-resume/schema/template-ast";
import { ORPCError } from "@orpc/client";
import { and, desc, eq, isNull, notInArray, or } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { defaultTemplateAst, templateAstSchema } from "@reactive-resume/schema/template-ast";
import { generateId } from "@reactive-resume/utils/string";
import { compileCustomTemplate } from "./compiler";
import { canTransitionTemplateStatus } from "./lifecycle";

type TemplateSourceMediaType =
	| "application/pdf"
	| "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function requireOwned(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(schema.customTemplate)
		.where(and(eq(schema.customTemplate.id, id), eq(schema.customTemplate.userId, userId)));
	if (!row) throw new ORPCError("NOT_FOUND");
	return row;
}

function stripUserId<T extends { userId: string }>(row: T): Omit<T, "userId"> {
	const { userId: _userId, ...value } = row;
	return value;
}

async function getSourceMetadata(templateId: string, userId: string) {
	const [source] = await db
		.select({
			filename: schema.customTemplateSource.filename,
			mediaType: schema.customTemplateSource.mediaType,
			size: schema.customTemplateSource.size,
		})
		.from(schema.customTemplateSource)
		.where(and(eq(schema.customTemplateSource.templateId, templateId), eq(schema.customTemplateSource.userId, userId)));

	return source ? { ...source, url: `/api/custom-templates/${templateId}/source` } : null;
}

async function withSource<T extends { id: string; userId: string }>(row: T) {
	return { ...stripUserId(row), source: await getSourceMetadata(row.id, row.userId) };
}

async function assertNameAvailable(userId: string, name: string, excludeId?: string) {
	const [existing] = await db
		.select({ id: schema.customTemplate.id })
		.from(schema.customTemplate)
		.where(and(eq(schema.customTemplate.userId, userId), eq(schema.customTemplate.name, name)));

	if (existing && existing.id !== excludeId) {
		throw new ORPCError("BAD_REQUEST", { message: "A template with this name already exists." });
	}
}

async function getWithVersions(id: string, userId: string) {
	const template = await requireOwned(id, userId);
	const [versions, source] = await Promise.all([
		db
			.select()
			.from(schema.customTemplateVersion)
			.where(and(eq(schema.customTemplateVersion.templateId, id), eq(schema.customTemplateVersion.userId, userId)))
			.orderBy(desc(schema.customTemplateVersion.version)),
		getSourceMetadata(id, userId),
	]);

	return { ...stripUserId(template), source, versions: versions.map(stripUserId) };
}

export const customTemplateService = {
	list: async (input: { userId: string }) => {
		const rows = await db
			.select({
				id: schema.customTemplate.id,
				name: schema.customTemplate.name,
				status: schema.customTemplate.status,
				compilerReport: schema.customTemplate.compilerReport,
				currentVersion: schema.customTemplate.currentVersion,
				publishedAt: schema.customTemplate.publishedAt,
				createdAt: schema.customTemplate.createdAt,
				updatedAt: schema.customTemplate.updatedAt,
			})
			.from(schema.customTemplate)
			.leftJoin(schema.customTemplateImportJob, eq(schema.customTemplateImportJob.templateId, schema.customTemplate.id))
			.where(
				and(
					eq(schema.customTemplate.userId, input.userId),
					or(
						isNull(schema.customTemplateImportJob.id),
						notInArray(schema.customTemplateImportJob.status, ["queued", "processing"]),
					),
				),
			)
			.orderBy(desc(schema.customTemplate.updatedAt));
		return rows;
	},

	getById: async (input: { id: string; userId: string }) => getWithVersions(input.id, input.userId),

	create: async (input: { name: string; userId: string }) => {
		await assertNameAvailable(input.userId, input.name);
		const id = generateId();
		await db.insert(schema.customTemplate).values({
			id,
			name: input.name,
			userId: input.userId,
			draft: defaultTemplateAst,
		});
		return id;
	},

	import: async (input: {
		name: string;
		userId: string;
		filename: string;
		data: Uint8Array;
		mediaType: TemplateSourceMediaType;
		compilation?: { ast: TemplateAst; report: TemplateCompilerReport };
	}) => {
		await assertNameAvailable(input.userId, input.name);
		const { ast, report } =
			input.compilation ?? (await compileCustomTemplate({ data: input.data, mediaType: input.mediaType }));
		const id = generateId();
		const created = await db.transaction(async (tx) => {
			const [template] = await tx
				.insert(schema.customTemplate)
				.values({
					id,
					name: input.name,
					userId: input.userId,
					draft: ast,
					compilerReport: report,
				})
				.returning();
			if (!template) throw new ORPCError("INTERNAL_SERVER_ERROR");
			await tx.insert(schema.customTemplateSource).values({
				templateId: id,
				userId: input.userId,
				filename: input.filename,
				mediaType: input.mediaType,
				size: input.data.byteLength,
				data: Buffer.from(input.data),
			});
			return template;
		});
		if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return withSource(created);
	},

	setSource: async (input: {
		id: string;
		userId: string;
		filename: string;
		data: Uint8Array;
		mediaType: TemplateSourceMediaType;
	}) => {
		await requireOwned(input.id, input.userId);
		await db
			.insert(schema.customTemplateSource)
			.values({
				templateId: input.id,
				userId: input.userId,
				filename: input.filename,
				mediaType: input.mediaType,
				size: input.data.byteLength,
				data: Buffer.from(input.data),
			})
			.onConflictDoUpdate({
				target: schema.customTemplateSource.templateId,
				set: {
					filename: input.filename,
					mediaType: input.mediaType,
					size: input.data.byteLength,
					data: Buffer.from(input.data),
					createdAt: new Date(),
				},
			});
		const source = await getSourceMetadata(input.id, input.userId);
		if (!source) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return source;
	},

	updateDraft: async (input: { id: string; userId: string; name: string; draft: unknown }) => {
		const template = await requireOwned(input.id, input.userId);
		if (template.status !== "draft" && !canTransitionTemplateStatus(template.status, "draft")) {
			throw new ORPCError("BAD_REQUEST", { message: `A ${template.status} template cannot be edited.` });
		}
		await assertNameAvailable(input.userId, input.name, input.id);
		const draft = templateAstSchema.parse(input.draft);
		const [updated] = await db
			.update(schema.customTemplate)
			.set({ name: input.name, draft, status: "draft", updatedAt: new Date() })
			.where(and(eq(schema.customTemplate.id, input.id), eq(schema.customTemplate.userId, input.userId)))
			.returning();
		if (!updated) throw new ORPCError("NOT_FOUND");
		return withSource(updated);
	},

	readSource: async (input: { id: string; userId: string }) => {
		await requireOwned(input.id, input.userId);
		const [source] = await db
			.select()
			.from(schema.customTemplateSource)
			.where(
				and(eq(schema.customTemplateSource.templateId, input.id), eq(schema.customTemplateSource.userId, input.userId)),
			);
		if (!source) throw new ORPCError("NOT_FOUND", { message: "This template does not have an imported source file." });
		return {
			filename: source.filename,
			mediaType: source.mediaType,
			size: source.size,
			data: new Uint8Array(source.data),
		};
	},

	submitReview: async (input: { id: string; userId: string }) => {
		const template = await requireOwned(input.id, input.userId);
		if (!canTransitionTemplateStatus(template.status, "review")) {
			throw new ORPCError("BAD_REQUEST", { message: "Only a saved draft can be submitted for review." });
		}
		templateAstSchema.parse(template.draft);
		const [updated] = await db
			.update(schema.customTemplate)
			.set({ status: "review", updatedAt: new Date() })
			.where(and(eq(schema.customTemplate.id, input.id), eq(schema.customTemplate.userId, input.userId)))
			.returning();
		if (!updated) throw new ORPCError("NOT_FOUND");
		return getWithVersions(input.id, input.userId);
	},

	publish: async (input: { id: string; userId: string }) => {
		const template = await requireOwned(input.id, input.userId);
		if (!canTransitionTemplateStatus(template.status, "published")) {
			throw new ORPCError("BAD_REQUEST", { message: "Submit the draft for review before publishing." });
		}
		const ast = templateAstSchema.parse(template.draft);
		const nextVersion = template.currentVersion + 1;
		const publishedAt = new Date();

		await db.transaction(async (tx) => {
			await tx.insert(schema.customTemplateVersion).values({
				id: generateId(),
				templateId: template.id,
				userId: input.userId,
				version: nextVersion,
				ast,
			});
			await tx
				.update(schema.customTemplate)
				.set({ status: "published", currentVersion: nextVersion, publishedAt, updatedAt: publishedAt })
				.where(and(eq(schema.customTemplate.id, input.id), eq(schema.customTemplate.userId, input.userId)));
		});

		return getWithVersions(input.id, input.userId);
	},

	changeStatus: async (input: { id: string; userId: string; status: "deprecated" | "archived" }) => {
		const template = await requireOwned(input.id, input.userId);
		if (!canTransitionTemplateStatus(template.status, input.status)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Cannot transition a ${template.status} template to ${input.status}.`,
			});
		}
		await db
			.update(schema.customTemplate)
			.set({ status: input.status, updatedAt: new Date() })
			.where(and(eq(schema.customTemplate.id, input.id), eq(schema.customTemplate.userId, input.userId)));
		return getWithVersions(input.id, input.userId);
	},

	delete: async (input: { id: string; userId: string }) => {
		await requireOwned(input.id, input.userId);
		await db
			.delete(schema.customTemplate)
			.where(and(eq(schema.customTemplate.id, input.id), eq(schema.customTemplate.userId, input.userId)));
	},
};
