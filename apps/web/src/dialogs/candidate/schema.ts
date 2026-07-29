import z from "zod";

export const candidateDialogSchemas = [
	z.object({ type: z.literal("candidate.import"), data: z.undefined() }),
	z.object({
		type: z.literal("candidate.create-resume"),
		data: z.object({ candidateId: z.string(), candidateName: z.string() }),
	}),
] as const;
