import { protectedProcedure } from "../../context";
import { customTemplateDto } from "../../dto/custom-template";
import { aiRequestRateLimit, resumeMutationRateLimit } from "../../middleware/rate-limit";
import { improveTemplateAstWithAi } from "./ai-improve";
import { customTemplateImportJobService } from "./import-job";
import { customTemplateService } from "./service";

export const customTemplatesRouter = {
	list: protectedProcedure
		.route({ method: "GET", path: "/custom-templates", tags: ["Custom Templates"] })
		.input(customTemplateDto.list.input)
		.output(customTemplateDto.list.output)
		.handler(({ context }) => customTemplateService.list({ userId: context.user.id })),

	getById: protectedProcedure
		.route({ method: "GET", path: "/custom-templates/{id}", tags: ["Custom Templates"] })
		.input(customTemplateDto.getById.input)
		.output(customTemplateDto.getById.output)
		.handler(({ input, context }) => customTemplateService.getById({ id: input.id, userId: context.user.id })),

	create: protectedProcedure
		.route({ method: "POST", path: "/custom-templates", tags: ["Custom Templates"] })
		.input(customTemplateDto.create.input)
		.use(resumeMutationRateLimit)
		.output(customTemplateDto.create.output)
		.handler(({ input, context }) => customTemplateService.create({ ...input, userId: context.user.id })),

	import: protectedProcedure
		.route({
			method: "POST",
			path: "/custom-templates/import",
			tags: ["Custom Templates"],
			spec: (current) => {
				const requestBody = current.requestBody;
				if (!requestBody || "$ref" in requestBody) return current;
				const multipart = requestBody.content?.["multipart/form-data"];
				return multipart
					? { ...current, requestBody: { ...requestBody, content: { "multipart/form-data": multipart } } }
					: current;
			},
		})
		.input(customTemplateDto.import.input)
		.use(resumeMutationRateLimit)
		.use(aiRequestRateLimit)
		.output(customTemplateDto.import.output)
		.handler(async ({ input, context }) => {
			const data = new Uint8Array(await input.file.arrayBuffer());
			return customTemplateImportJobService.enqueue({
				name: input.name,
				userId: context.user.id,
				filename: input.file.name,
				data,
				mediaType: input.file.type as
					| "application/pdf"
					| "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			});
		}),

	getImportJob: protectedProcedure
		.route({ method: "GET", path: "/custom-template-import-jobs/{id}", tags: ["Custom Templates"] })
		.input(customTemplateDto.getImportJob.input)
		.output(customTemplateDto.getImportJob.output)
		.handler(({ input, context }) => customTemplateImportJobService.getById({ id: input.id, userId: context.user.id })),

	listActiveImportJobs: protectedProcedure
		.route({ method: "GET", path: "/custom-template-import-jobs", tags: ["Custom Templates"] })
		.input(customTemplateDto.listActiveImportJobs.input)
		.output(customTemplateDto.listActiveImportJobs.output)
		.handler(({ context }) => customTemplateImportJobService.listActive({ userId: context.user.id })),

	retryImport: protectedProcedure
		.route({ method: "POST", path: "/custom-template-import-jobs/{id}/retry", tags: ["Custom Templates"] })
		.input(customTemplateDto.retryImport.input)
		.use(resumeMutationRateLimit)
		.use(aiRequestRateLimit)
		.output(customTemplateDto.retryImport.output)
		.handler(({ input, context }) => customTemplateImportJobService.retry({ id: input.id, userId: context.user.id })),

	setSource: protectedProcedure
		.route({
			method: "PUT",
			path: "/custom-templates/{id}/source",
			tags: ["Custom Templates"],
			spec: (current) => {
				const requestBody = current.requestBody;
				if (!requestBody || "$ref" in requestBody) return current;
				const multipart = requestBody.content?.["multipart/form-data"];
				return multipart
					? { ...current, requestBody: { ...requestBody, content: { "multipart/form-data": multipart } } }
					: current;
			},
		})
		.input(customTemplateDto.setSource.input)
		.use(resumeMutationRateLimit)
		.output(customTemplateDto.setSource.output)
		.handler(async ({ input, context }) => {
			const data = new Uint8Array(await input.file.arrayBuffer());
			return customTemplateService.setSource({
				id: input.id,
				userId: context.user.id,
				filename: input.file.name,
				data,
				mediaType: input.file.type as
					| "application/pdf"
					| "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			});
		}),

	updateDraft: protectedProcedure
		.route({ method: "PUT", path: "/custom-templates/{id}/draft", tags: ["Custom Templates"] })
		.input(customTemplateDto.updateDraft.input)
		.use(resumeMutationRateLimit)
		.output(customTemplateDto.updateDraft.output)
		.handler(({ input, context }) => customTemplateService.updateDraft({ ...input, userId: context.user.id })),

	aiImprove: protectedProcedure
		.route({
			method: "POST",
			path: "/custom-templates/{id}/ai-improve",
			tags: ["Custom Templates", "AI"],
			spec: (current) => {
				const requestBody = current.requestBody;
				if (!requestBody || "$ref" in requestBody) return current;
				const multipart = requestBody.content?.["multipart/form-data"];
				return multipart
					? { ...current, requestBody: { ...requestBody, content: { "multipart/form-data": multipart } } }
					: current;
			},
		})
		.input(customTemplateDto.aiImprove.input)
		.use(aiRequestRateLimit)
		.output(customTemplateDto.aiImprove.output)
		.handler(async ({ input, context }) => {
			const template = await customTemplateService.getById({ id: input.id, userId: context.user.id });
			const storedSource = input.file
				? null
				: await customTemplateService.readSource({ id: input.id, userId: context.user.id });
			const sourceData = input.file ? new Uint8Array(await input.file.arrayBuffer()) : storedSource?.data;
			if (!sourceData) throw new Error("Template source is unavailable.");
			const previewData = input.preview ? new Uint8Array(await input.preview.arrayBuffer()) : undefined;
			return improveTemplateAstWithAi({
				userId: context.user.id,
				draft: input.draft,
				report: template.compilerReport,
				source: {
					name: input.file?.name ?? storedSource?.filename ?? "template-source",
					data: sourceData,
					mediaType:
						(input.file?.type as
							| "application/pdf"
							| "application/vnd.openxmlformats-officedocument.wordprocessingml.document") ??
						storedSource?.mediaType ??
						"application/pdf",
				},
				...(previewData
					? {
							preview: {
								data: previewData,
								mediaType: input.preview?.type as "image/png" | "image/jpeg",
							},
						}
					: {}),
			});
		}),

	submitReview: protectedProcedure
		.route({ method: "POST", path: "/custom-templates/{id}/review", tags: ["Custom Templates"] })
		.input(customTemplateDto.submitReview.input)
		.use(resumeMutationRateLimit)
		.output(customTemplateDto.submitReview.output)
		.handler(({ input, context }) => customTemplateService.submitReview({ ...input, userId: context.user.id })),

	publish: protectedProcedure
		.route({ method: "POST", path: "/custom-templates/{id}/publish", tags: ["Custom Templates"] })
		.input(customTemplateDto.publish.input)
		.use(resumeMutationRateLimit)
		.output(customTemplateDto.publish.output)
		.handler(({ input, context }) => customTemplateService.publish({ ...input, userId: context.user.id })),

	changeStatus: protectedProcedure
		.route({ method: "POST", path: "/custom-templates/{id}/status", tags: ["Custom Templates"] })
		.input(customTemplateDto.changeStatus.input)
		.use(resumeMutationRateLimit)
		.output(customTemplateDto.changeStatus.output)
		.handler(({ input, context }) => customTemplateService.changeStatus({ ...input, userId: context.user.id })),

	delete: protectedProcedure
		.route({ method: "DELETE", path: "/custom-templates/{id}", tags: ["Custom Templates"] })
		.input(customTemplateDto.delete.input)
		.use(resumeMutationRateLimit)
		.output(customTemplateDto.delete.output)
		.handler(({ input, context }) => customTemplateService.delete({ ...input, userId: context.user.id })),
};
