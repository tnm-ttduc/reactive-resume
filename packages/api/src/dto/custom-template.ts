import z from "zod";
import {
	templateAstSchema,
	templateCompilerReportSchema,
	templateLifecycleStatusSchema,
} from "@reactive-resume/schema/template-ast";
import {
	templateImportJobStageSchema,
	templateImportJobStatusSchema,
} from "@reactive-resume/schema/template-import-job";

const MAX_TEMPLATE_SOURCE_BYTES = 10 * 1024 * 1024;

const templateSourceFileSchema = z
	.file()
	.max(MAX_TEMPLATE_SOURCE_BYTES, "Template source must be less than 10MB")
	.mime(
		["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
		"Template source must be a PDF or DOCX file.",
	);

const templatePreviewFileSchema = z
	.file()
	.max(5 * 1024 * 1024, "Template preview must be less than 5MB")
	.mime(["image/png", "image/jpeg"], "Template preview must be a PNG or JPEG image.");

const templateAiChangeSchema = z.object({
	path: z.string().max(200),
	before: z.string().max(500).nullable(),
	after: z.string().max(500).nullable(),
	reason: z.string().max(500),
});

const templateSourceMetadataSchema = z.object({
	filename: z.string(),
	mediaType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
	size: z.number().int().nonnegative(),
	url: z.string(),
});

const customTemplateSchema = z.object({
	id: z.string(),
	name: z.string(),
	status: templateLifecycleStatusSchema,
	draft: templateAstSchema,
	compilerReport: templateCompilerReportSchema.nullable(),
	source: templateSourceMetadataSchema.nullable(),
	currentVersion: z.number().int().nonnegative(),
	publishedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const templateVersionSchema = z.object({
	id: z.string(),
	templateId: z.string(),
	version: z.number().int().positive(),
	ast: templateAstSchema,
	createdAt: z.date(),
});

const templateImportJobSchema = z.object({
	id: z.string(),
	templateId: z.string(),
	templateName: z.string(),
	filename: z.string(),
	status: templateImportJobStatusSchema,
	stage: templateImportJobStageSchema,
	progress: z.number().int().min(0).max(100),
	attempts: z.number().int().nonnegative(),
	error: z.string().nullable(),
	startedAt: z.date().nullable(),
	completedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const customTemplateDto = {
	list: {
		input: z.object({}).optional().default({}),
		output: z.array(customTemplateSchema.omit({ draft: true, source: true })),
	},
	getById: {
		input: z.object({ id: z.string() }),
		output: customTemplateSchema.extend({ versions: z.array(templateVersionSchema) }),
	},
	create: {
		input: z.object({ name: z.string().trim().min(1).max(120) }),
		output: z.string(),
	},
	import: {
		input: z.object({ name: z.string().trim().min(1).max(120), file: templateSourceFileSchema }),
		output: templateImportJobSchema,
	},
	getImportJob: {
		input: z.object({ id: z.string() }),
		output: templateImportJobSchema,
	},
	listActiveImportJobs: {
		input: z.object({}).optional().default({}),
		output: z.array(templateImportJobSchema),
	},
	retryImport: {
		input: z.object({ id: z.string() }),
		output: templateImportJobSchema,
	},
	setSource: {
		input: z.object({ id: z.string(), file: templateSourceFileSchema }),
		output: templateSourceMetadataSchema,
	},
	updateDraft: {
		input: z.object({ id: z.string(), name: z.string().trim().min(1).max(120), draft: templateAstSchema }),
		output: customTemplateSchema,
	},
	aiImprove: {
		input: z.object({
			id: z.string(),
			draft: templateAstSchema,
			file: templateSourceFileSchema.optional(),
			preview: templatePreviewFileSchema.optional(),
		}),
		output: z.object({
			draft: templateAstSchema,
			analysisMode: z.enum(["visual", "structural"]),
			summary: z.string().max(2_000),
			changes: z.array(templateAiChangeSchema).max(30),
			remainingLimitations: z.array(z.string().max(500)).max(12),
		}),
	},
	submitReview: {
		input: z.object({ id: z.string() }),
		output: customTemplateSchema.extend({ versions: z.array(templateVersionSchema) }),
	},
	publish: {
		input: z.object({ id: z.string() }),
		output: customTemplateSchema.extend({ versions: z.array(templateVersionSchema) }),
	},
	changeStatus: {
		input: z.object({ id: z.string(), status: z.enum(["deprecated", "archived"]) }),
		output: customTemplateSchema.extend({ versions: z.array(templateVersionSchema) }),
	},
	delete: {
		input: z.object({ id: z.string() }),
		output: z.void(),
	},
};
