import type { CandidateProfile } from "@reactive-resume/schema/candidate/data";
import type { Locale } from "@reactive-resume/utils/locale";
import { ORPCError } from "@orpc/client";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { candidateProfileFromResumeData, candidateProfileSchema } from "@reactive-resume/schema/candidate/data";
import { generateId } from "@reactive-resume/utils/string";
import { resumeService } from "../resume/service";
import { buildResumeDataFromCandidate } from "./resume-data";

type CandidateSourceInput = {
	filename: string;
	mediaType: string;
	data: Uint8Array;
};

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAX_VERSIONS_PER_CANDIDATE = 50;

async function requireOwned(id: string, userId: string) {
	const [row] = await db
		.select()
		.from(schema.candidate)
		.where(and(eq(schema.candidate.id, id), eq(schema.candidate.userId, userId)));
	if (!row) throw new ORPCError("NOT_FOUND");
	return row;
}

async function writeCandidateVersion(
	client: DbOrTx,
	input: {
		candidateId: string;
		userId: string;
		version: number;
		name: string;
		tags: string[];
		profile: CandidateProfile;
		label: string;
	},
) {
	await client.insert(schema.candidateVersion).values({
		candidateId: input.candidateId,
		userId: input.userId,
		version: input.version,
		name: input.name,
		tags: input.tags,
		profile: input.profile,
		label: input.label,
	});

	const keepVersions = client
		.select({ id: schema.candidateVersion.id })
		.from(schema.candidateVersion)
		.where(eq(schema.candidateVersion.candidateId, input.candidateId))
		.orderBy(desc(schema.candidateVersion.version))
		.limit(MAX_VERSIONS_PER_CANDIDATE);

	await client
		.delete(schema.candidateVersion)
		.where(
			and(
				eq(schema.candidateVersion.candidateId, input.candidateId),
				eq(schema.candidateVersion.userId, input.userId),
				notInArray(schema.candidateVersion.id, keepVersions),
			),
		);
}

async function updateCandidateProfile(input: {
	id: string;
	userId: string;
	name: string;
	tags: string[];
	profile: CandidateProfile;
	expectedVersion: number;
	label: string;
}) {
	const profile = candidateProfileSchema.parse(input.profile);

	const updated = await db.transaction(async (tx) => {
		const [existing] = await tx
			.select({ currentVersion: schema.candidate.currentVersion })
			.from(schema.candidate)
			.where(and(eq(schema.candidate.id, input.id), eq(schema.candidate.userId, input.userId)))
			.for("update");

		if (!existing) throw new ORPCError("NOT_FOUND");
		if (existing.currentVersion !== input.expectedVersion) {
			throw new ORPCError("CONFLICT", {
				message: "Candidate data changed in another session. Reload before saving.",
			});
		}

		const nextVersion = existing.currentVersion + 1;
		const [candidate] = await tx
			.update(schema.candidate)
			.set({
				name: input.name,
				email: profile.basics.email,
				phone: profile.basics.phone,
				tags: input.tags,
				profile,
				currentVersion: nextVersion,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(schema.candidate.id, input.id),
					eq(schema.candidate.userId, input.userId),
					eq(schema.candidate.currentVersion, input.expectedVersion),
				),
			)
			.returning();

		if (!candidate) {
			throw new ORPCError("CONFLICT", {
				message: "Candidate data changed in another session. Reload before saving.",
			});
		}

		await writeCandidateVersion(tx, {
			candidateId: candidate.id,
			userId: input.userId,
			version: nextVersion,
			name: candidate.name,
			tags: candidate.tags,
			profile: candidate.profile,
			label: input.label,
		});

		return candidate;
	});

	return { ...publicCandidate(updated), sources: await getSources(input.id, input.userId) };
}

async function getSources(candidateId: string, userId: string) {
	return db
		.select({
			id: schema.candidateSourceDocument.id,
			filename: schema.candidateSourceDocument.filename,
			mediaType: schema.candidateSourceDocument.mediaType,
			size: schema.candidateSourceDocument.size,
			createdAt: schema.candidateSourceDocument.createdAt,
		})
		.from(schema.candidateSourceDocument)
		.where(
			and(
				eq(schema.candidateSourceDocument.candidateId, candidateId),
				eq(schema.candidateSourceDocument.userId, userId),
			),
		)
		.orderBy(desc(schema.candidateSourceDocument.createdAt));
}

function publicCandidate<T extends { userId: string }>(row: T) {
	const { userId: _userId, ...candidate } = row;
	return candidate;
}

export const candidateService = {
	list: async (input: { userId: string }) => {
		return db
			.select({
				id: schema.candidate.id,
				name: schema.candidate.name,
				email: schema.candidate.email,
				phone: schema.candidate.phone,
				tags: schema.candidate.tags,
				currentVersion: schema.candidate.currentVersion,
				createdAt: schema.candidate.createdAt,
				updatedAt: schema.candidate.updatedAt,
			})
			.from(schema.candidate)
			.where(eq(schema.candidate.userId, input.userId))
			.orderBy(desc(schema.candidate.updatedAt));
	},

	getById: async (input: { id: string; userId: string }) => {
		const candidate = await requireOwned(input.id, input.userId);
		return {
			...publicCandidate(candidate),
			sources: await getSources(input.id, input.userId),
		};
	},

	import: async (input: {
		userId: string;
		data: Parameters<typeof candidateProfileFromResumeData>[0];
		tags: string[];
		source: CandidateSourceInput;
	}) => {
		const profile = candidateProfileFromResumeData(input.data);
		const name = profile.basics.name.trim() || input.source.filename.replace(/\.[^.]+$/, "") || "Imported Candidate";
		const id = generateId();

		await db.transaction(async (tx) => {
			await tx.insert(schema.candidate).values({
				id,
				name,
				email: profile.basics.email,
				phone: profile.basics.phone,
				tags: input.tags,
				profile,
				userId: input.userId,
			});
			await writeCandidateVersion(tx, {
				candidateId: id,
				userId: input.userId,
				version: 1,
				name,
				tags: input.tags,
				profile,
				label: `Imported from ${input.source.filename}`,
			});
			await tx.insert(schema.candidateSourceDocument).values({
				id: generateId(),
				candidateId: id,
				userId: input.userId,
				filename: input.source.filename,
				mediaType: input.source.mediaType,
				size: input.source.data.byteLength,
				data: Buffer.from(input.source.data),
			});
		});

		return id;
	},

	update: async (input: {
		id: string;
		userId: string;
		name: string;
		tags: string[];
		profile: CandidateProfile;
		expectedVersion: number;
	}) => updateCandidateProfile({ ...input, label: "Candidate profile updated" }),

	versions: {
		list: async (input: { candidateId: string; userId: string }) => {
			await requireOwned(input.candidateId, input.userId);
			return db
				.select({
					id: schema.candidateVersion.id,
					version: schema.candidateVersion.version,
					name: schema.candidateVersion.name,
					label: schema.candidateVersion.label,
					createdAt: schema.candidateVersion.createdAt,
				})
				.from(schema.candidateVersion)
				.where(
					and(
						eq(schema.candidateVersion.candidateId, input.candidateId),
						eq(schema.candidateVersion.userId, input.userId),
					),
				)
				.orderBy(desc(schema.candidateVersion.version))
				.limit(MAX_VERSIONS_PER_CANDIDATE);
		},

		restore: async (input: { candidateId: string; versionId: string; expectedVersion: number; userId: string }) => {
			const [version] = await db
				.select({
					version: schema.candidateVersion.version,
					name: schema.candidateVersion.name,
					tags: schema.candidateVersion.tags,
					profile: schema.candidateVersion.profile,
				})
				.from(schema.candidateVersion)
				.innerJoin(schema.candidate, eq(schema.candidateVersion.candidateId, schema.candidate.id))
				.where(
					and(
						eq(schema.candidateVersion.id, input.versionId),
						eq(schema.candidateVersion.candidateId, input.candidateId),
						eq(schema.candidate.userId, input.userId),
					),
				);

			if (!version) throw new ORPCError("NOT_FOUND");

			return updateCandidateProfile({
				id: input.candidateId,
				userId: input.userId,
				name: version.name,
				tags: version.tags,
				profile: version.profile,
				expectedVersion: input.expectedVersion,
				label: `Restored from version ${version.version}`,
			});
		},
	},

	delete: async (input: { id: string; userId: string }) => {
		await requireOwned(input.id, input.userId);
		await db
			.delete(schema.candidate)
			.where(and(eq(schema.candidate.id, input.id), eq(schema.candidate.userId, input.userId)));
	},

	createResume: async (input: {
		candidateId: string;
		templateId: string;
		templateVersion?: number;
		name: string;
		slug: string;
		tags: string[];
		userId: string;
		locale: Locale;
	}) => {
		const candidate = await requireOwned(input.candidateId, input.userId);
		const [template] = await db
			.select({
				id: schema.customTemplate.id,
				name: schema.customTemplate.name,
				status: schema.customTemplate.status,
				currentVersion: schema.customTemplate.currentVersion,
			})
			.from(schema.customTemplate)
			.where(and(eq(schema.customTemplate.id, input.templateId), eq(schema.customTemplate.userId, input.userId)));

		if (!template) throw new ORPCError("NOT_FOUND", { message: "Template not found." });
		if (template.status !== "published" || template.currentVersion < 1) {
			throw new ORPCError("BAD_REQUEST", { message: "Only a published template can be used to create a CV." });
		}

		const versionNumber = input.templateVersion ?? template.currentVersion;
		const [version] = await db
			.select({
				version: schema.customTemplateVersion.version,
				ast: schema.customTemplateVersion.ast,
			})
			.from(schema.customTemplateVersion)
			.where(
				and(
					eq(schema.customTemplateVersion.templateId, template.id),
					eq(schema.customTemplateVersion.userId, input.userId),
					eq(schema.customTemplateVersion.version, versionNumber),
				),
			);
		if (!version) throw new ORPCError("NOT_FOUND", { message: "Published template version not found." });

		const data = buildResumeDataFromCandidate(candidate.profile, {
			id: template.id,
			name: template.name,
			version: version.version,
			ast: version.ast,
		});

		return resumeService.create({
			userId: input.userId,
			candidateId: candidate.id,
			name: input.name,
			slug: input.slug,
			tags: input.tags,
			locale: input.locale,
			data,
		});
	},
};
