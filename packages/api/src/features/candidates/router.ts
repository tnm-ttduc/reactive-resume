import { protectedProcedure } from "../../context";
import { candidateDto } from "../../dto/candidate";
import { resumeMutationRateLimit } from "../../middleware/rate-limit";
import { candidateService } from "./service";

export const candidatesRouter = {
	list: protectedProcedure
		.input(candidateDto.list.input)
		.output(candidateDto.list.output)
		.handler(({ context }) => candidateService.list({ userId: context.user.id })),

	getById: protectedProcedure
		.input(candidateDto.getById.input)
		.output(candidateDto.getById.output)
		.handler(({ input, context }) => candidateService.getById({ id: input.id, userId: context.user.id })),

	import: protectedProcedure
		.input(candidateDto.import.input)
		.use(resumeMutationRateLimit)
		.output(candidateDto.import.output)
		.handler(async ({ input, context }) =>
			candidateService.import({
				userId: context.user.id,
				data: input.data,
				tags: input.tags,
				source: {
					filename: input.file.name,
					mediaType: input.file.type,
					data: new Uint8Array(await input.file.arrayBuffer()),
				},
			}),
		),

	update: protectedProcedure
		.input(candidateDto.update.input)
		.output(candidateDto.update.output)
		.handler(({ input, context }) => candidateService.update({ ...input, userId: context.user.id })),

	listVersions: protectedProcedure
		.input(candidateDto.listVersions.input)
		.output(candidateDto.listVersions.output)
		.handler(({ input, context }) =>
			candidateService.versions.list({ candidateId: input.candidateId, userId: context.user.id }),
		),

	restoreVersion: protectedProcedure
		.input(candidateDto.restoreVersion.input)
		.use(resumeMutationRateLimit)
		.output(candidateDto.restoreVersion.output)
		.handler(({ input, context }) =>
			candidateService.versions.restore({
				candidateId: input.candidateId,
				versionId: input.versionId,
				expectedVersion: input.expectedVersion,
				userId: context.user.id,
			}),
		),

	delete: protectedProcedure
		.input(candidateDto.delete.input)
		.output(candidateDto.delete.output)
		.handler(({ input, context }) => candidateService.delete({ ...input, userId: context.user.id })),

	createResume: protectedProcedure
		.input(candidateDto.createResume.input)
		.use(resumeMutationRateLimit)
		.output(candidateDto.createResume.output)
		.handler(({ input, context }) =>
			candidateService.createResume({
				candidateId: input.candidateId,
				templateId: input.templateId,
				...(input.templateVersion !== undefined ? { templateVersion: input.templateVersion } : {}),
				name: input.name,
				slug: input.slug,
				tags: input.tags,
				userId: context.user.id,
				locale: context.locale,
			}),
		),
};
