import z from "zod";
import { candidateProfileSchema } from "@reactive-resume/schema/candidate/data";
import { resumeDataSchema } from "@reactive-resume/schema/resume/data";

const MAX_CANDIDATE_SOURCE_BYTES = 10 * 1024 * 1024;

const candidateSourceFileSchema = z
	.file()
	.max(MAX_CANDIDATE_SOURCE_BYTES, "Candidate CV must be less than 10MB")
	.mime(
		[
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/json",
		],
		"Candidate CV must be a PDF, Word document or supported JSON file.",
	);

const candidateSourceSchema = z.object({
	id: z.string(),
	filename: z.string(),
	mediaType: z.string(),
	size: z.number().int().nonnegative(),
	createdAt: z.date(),
});

const candidateSchema = z.object({
	id: z.string(),
	name: z.string().trim().min(1).max(120),
	email: z.string(),
	phone: z.string(),
	tags: z.array(z.string()),
	profile: candidateProfileSchema,
	currentVersion: z.number().int().positive(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const candidateVersionSchema = z.object({
	id: z.string(),
	version: z.number().int().positive(),
	name: z.string(),
	label: z.string(),
	createdAt: z.date(),
});

export const candidateDto = {
	list: {
		input: z.object({}).optional().default({}),
		output: z.array(candidateSchema.omit({ profile: true })),
	},
	getById: {
		input: z.object({ id: z.string() }),
		output: candidateSchema.extend({ sources: z.array(candidateSourceSchema) }),
	},
	import: {
		input: z.object({
			file: candidateSourceFileSchema,
			data: resumeDataSchema,
			tags: z.array(z.string()).default([]),
		}),
		output: z.string(),
	},
	update: {
		input: z.object({
			id: z.string(),
			name: z.string().trim().min(1).max(120),
			tags: z.array(z.string()),
			profile: candidateProfileSchema,
			expectedVersion: z.number().int().positive(),
		}),
		output: candidateSchema.extend({ sources: z.array(candidateSourceSchema) }),
	},
	listVersions: {
		input: z.object({ candidateId: z.string() }),
		output: z.array(candidateVersionSchema),
	},
	restoreVersion: {
		input: z.object({
			candidateId: z.string(),
			versionId: z.string(),
			expectedVersion: z.number().int().positive(),
		}),
		output: candidateSchema.extend({ sources: z.array(candidateSourceSchema) }),
	},
	delete: {
		input: z.object({ id: z.string() }),
		output: z.void(),
	},
	createResume: {
		input: z.object({
			candidateId: z.string(),
			templateId: z.string(),
			templateVersion: z.number().int().positive().optional(),
			name: z.string().trim().min(1).max(64),
			slug: z.string().trim().min(1).max(64),
			tags: z.array(z.string()).default([]),
		}),
		output: z.string(),
	},
};
