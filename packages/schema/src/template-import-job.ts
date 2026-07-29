import z from "zod";

export const templateImportJobStatusSchema = z.enum(["queued", "processing", "completed", "failed"]);

export const templateImportJobStageSchema = z.enum([
	"queued",
	"ai-vision",
	"extracting",
	"mapping",
	"saving",
	"completed",
	"failed",
]);

export type TemplateImportJobStatus = z.infer<typeof templateImportJobStatusSchema>;
export type TemplateImportJobStage = z.infer<typeof templateImportJobStageSchema>;
