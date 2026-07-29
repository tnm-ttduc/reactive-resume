import type { TemplateImportJobStage } from "@reactive-resume/schema/template-import-job";
import { Buffer } from "node:buffer";
import { ORPCError } from "@orpc/client";
import { and, desc, eq, gt, inArray, or } from "drizzle-orm";
import { db, getPool } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { defaultTemplateAst } from "@reactive-resume/schema/template-ast";
import { generateId } from "@reactive-resume/utils/string";
import { compileCustomTemplate } from "./compiler";
import { analyzeTemplateSourceWithAiVision } from "./vision";

type TemplateSourceMediaType =
	| "application/pdf"
	| "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ClaimedImportJob = {
	id: string;
	template_id: string;
	user_id: string;
	attempts: number;
};

const MAX_JOB_ATTEMPTS = 3;
const WORKER_POLL_MS = 1_000;
const STALE_JOB_MINUTES = 30;

let workerStarted = false;
let workerRunning = false;
let workerTimer: ReturnType<typeof setInterval> | undefined;

function errorMessage(error: unknown) {
	return (error instanceof Error ? error.message : "Template import failed unexpectedly.").slice(0, 1_000);
}

export async function buildImportedTemplate(input: {
	userId: string;
	source: {
		name: string;
		data: Uint8Array;
		mediaType: TemplateSourceMediaType;
	};
	onProgress?: (stage: TemplateImportJobStage, progress: number) => Promise<void>;
}) {
	const onProgress = input.onProgress ?? (async () => undefined);
	await onProgress("ai-vision", 20);
	const visionBlueprint = await analyzeTemplateSourceWithAiVision({
		userId: input.userId,
		source: input.source,
	});
	await onProgress("extracting", 45);
	const sourceCompilation = await compileCustomTemplate({
		data: input.source.data,
		mediaType: input.source.mediaType,
		visionBlueprint,
	});
	await onProgress("mapping", 75);
	await onProgress("saving", 90);
	if (visionBlueprint) return sourceCompilation;
	return {
		...sourceCompilation,
		report: {
			...sourceCompilation.report,
			warnings: [
				...sourceCompilation.report.warnings,
				"AI Vision was unavailable or returned an invalid blueprint; deterministic composer mapping was used.",
			],
			mappingSummary: {
				...sourceCompilation.report.mappingSummary,
				approximated: [
					...sourceCompilation.report.mappingSummary.approximated,
					"Page and component planning without AI Vision",
				],
			},
		},
	};
}

async function getImportJobResponse(input: { id: string; userId: string }) {
	const [job] = await db
		.select({
			id: schema.customTemplateImportJob.id,
			templateId: schema.customTemplateImportJob.templateId,
			templateName: schema.customTemplate.name,
			filename: schema.customTemplateSource.filename,
			status: schema.customTemplateImportJob.status,
			stage: schema.customTemplateImportJob.stage,
			progress: schema.customTemplateImportJob.progress,
			attempts: schema.customTemplateImportJob.attempts,
			error: schema.customTemplateImportJob.error,
			startedAt: schema.customTemplateImportJob.startedAt,
			completedAt: schema.customTemplateImportJob.completedAt,
			createdAt: schema.customTemplateImportJob.createdAt,
			updatedAt: schema.customTemplateImportJob.updatedAt,
		})
		.from(schema.customTemplateImportJob)
		.innerJoin(schema.customTemplate, eq(schema.customTemplate.id, schema.customTemplateImportJob.templateId))
		.innerJoin(
			schema.customTemplateSource,
			eq(schema.customTemplateSource.templateId, schema.customTemplateImportJob.templateId),
		)
		.where(
			and(eq(schema.customTemplateImportJob.id, input.id), eq(schema.customTemplateImportJob.userId, input.userId)),
		);
	if (!job) throw new ORPCError("NOT_FOUND");
	return job;
}

async function updateJobProgress(id: string, stage: TemplateImportJobStage, progress: number) {
	await db
		.update(schema.customTemplateImportJob)
		.set({ stage, progress, updatedAt: new Date() })
		.where(eq(schema.customTemplateImportJob.id, id));
}

async function claimNextJob(): Promise<ClaimedImportJob | null> {
	const result = await getPool().query<ClaimedImportJob>(
		`
			WITH next_job AS (
				SELECT id
				FROM custom_template_import_job
				WHERE attempts < $1
					AND (
						status = 'queued'
						OR (status = 'processing' AND updated_at < NOW() - ($2::text || ' minutes')::interval)
					)
				ORDER BY created_at ASC
				FOR UPDATE SKIP LOCKED
				LIMIT 1
			)
			UPDATE custom_template_import_job AS job
			SET
				status = 'processing',
				stage = 'ai-vision',
				progress = 15,
				attempts = job.attempts + 1,
				error = NULL,
				started_at = COALESCE(job.started_at, NOW()),
				updated_at = NOW()
			FROM next_job
			WHERE job.id = next_job.id
			RETURNING job.id, job.template_id, job.user_id, job.attempts
		`,
		[MAX_JOB_ATTEMPTS, STALE_JOB_MINUTES],
	);
	return result.rows[0] ?? null;
}

async function processClaimedJob(job: ClaimedImportJob) {
	try {
		const [source] = await db
			.select()
			.from(schema.customTemplateSource)
			.where(eq(schema.customTemplateSource.templateId, job.template_id));
		if (!source) throw new Error("The imported source file is unavailable.");

		const sourceInput = {
			name: source.filename,
			data: new Uint8Array(source.data),
			mediaType: source.mediaType,
		};
		const compilation = await buildImportedTemplate({
			userId: job.user_id,
			source: sourceInput,
			onProgress: (stage, progress) => updateJobProgress(job.id, stage, progress),
		});
		const completedAt = new Date();
		await db.transaction(async (tx) => {
			await tx
				.update(schema.customTemplate)
				.set({
					draft: compilation.ast,
					compilerReport: compilation.report,
					updatedAt: completedAt,
				})
				.where(eq(schema.customTemplate.id, job.template_id));
			await tx
				.update(schema.customTemplateImportJob)
				.set({
					status: "completed",
					stage: "completed",
					progress: 100,
					error: null,
					completedAt,
					updatedAt: completedAt,
				})
				.where(eq(schema.customTemplateImportJob.id, job.id));
		});
	} catch (error) {
		const failedAt = new Date();
		await db
			.update(schema.customTemplateImportJob)
			.set({
				status: "failed",
				stage: "failed",
				error: errorMessage(error),
				updatedAt: failedAt,
			})
			.where(eq(schema.customTemplateImportJob.id, job.id));
	}
}

export async function runCustomTemplateImportWorkerTick() {
	if (workerRunning) return;
	workerRunning = true;
	try {
		for (;;) {
			const job = await claimNextJob();
			if (!job) break;
			await processClaimedJob(job);
		}
	} finally {
		workerRunning = false;
	}
}

export function requestCustomTemplateImportProcessing() {
	if (!workerStarted) return;
	const kick = setTimeout(() => void runCustomTemplateImportWorkerTick(), 25);
	kick.unref?.();
}

export function startCustomTemplateImportWorker() {
	if (workerStarted) return;
	workerStarted = true;
	void runCustomTemplateImportWorkerTick();
	workerTimer = setInterval(() => void runCustomTemplateImportWorkerTick(), WORKER_POLL_MS);
	workerTimer.unref?.();
}

export const customTemplateImportJobService = {
	enqueue: async (input: {
		name: string;
		userId: string;
		filename: string;
		data: Uint8Array;
		mediaType: TemplateSourceMediaType;
	}) => {
		const [existing] = await db
			.select({ id: schema.customTemplate.id })
			.from(schema.customTemplate)
			.where(and(eq(schema.customTemplate.userId, input.userId), eq(schema.customTemplate.name, input.name)));
		if (existing) throw new ORPCError("BAD_REQUEST", { message: "A template with this name already exists." });

		const templateId = generateId();
		const jobId = generateId();
		await db.transaction(async (tx) => {
			await tx.insert(schema.customTemplate).values({
				id: templateId,
				name: input.name,
				userId: input.userId,
				draft: defaultTemplateAst,
			});
			await tx.insert(schema.customTemplateSource).values({
				templateId,
				userId: input.userId,
				filename: input.filename,
				mediaType: input.mediaType,
				size: input.data.byteLength,
				data: Buffer.from(input.data),
			});
			await tx.insert(schema.customTemplateImportJob).values({
				id: jobId,
				templateId,
				userId: input.userId,
			});
		});
		requestCustomTemplateImportProcessing();
		return getImportJobResponse({ id: jobId, userId: input.userId });
	},

	getById: getImportJobResponse,

	listActive: async (input: { userId: string }) => {
		const recentFailureCutoff = new Date(Date.now() - 24 * 60 * 60 * 1_000);
		const jobs = await db
			.select({ id: schema.customTemplateImportJob.id })
			.from(schema.customTemplateImportJob)
			.where(
				and(
					eq(schema.customTemplateImportJob.userId, input.userId),
					or(
						inArray(schema.customTemplateImportJob.status, ["queued", "processing"]),
						and(
							eq(schema.customTemplateImportJob.status, "failed"),
							gt(schema.customTemplateImportJob.updatedAt, recentFailureCutoff),
						),
					),
				),
			)
			.orderBy(desc(schema.customTemplateImportJob.createdAt))
			.limit(10);
		return Promise.all(jobs.map((job) => getImportJobResponse({ id: job.id, userId: input.userId })));
	},

	retry: async (input: { id: string; userId: string }) => {
		const job = await getImportJobResponse(input);
		if (job.status !== "failed") {
			throw new ORPCError("BAD_REQUEST", { message: "Only a failed import can be retried." });
		}
		await db
			.update(schema.customTemplateImportJob)
			.set({
				status: "queued",
				stage: "queued",
				progress: 5,
				attempts: 0,
				error: null,
				startedAt: null,
				completedAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(eq(schema.customTemplateImportJob.id, input.id), eq(schema.customTemplateImportJob.userId, input.userId)),
			);
		requestCustomTemplateImportProcessing();
		return getImportJobResponse(input);
	},
};
