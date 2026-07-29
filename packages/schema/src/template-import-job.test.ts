import { describe, expect, it } from "vitest";
import { templateImportJobStageSchema, templateImportJobStatusSchema } from "./template-import-job";

describe("template import job schemas", () => {
	it("accepts the bounded processing lifecycle", () => {
		expect(templateImportJobStatusSchema.options).toEqual(["queued", "processing", "completed", "failed"]);
		expect(templateImportJobStageSchema.parse("ai-vision")).toBe("ai-vision");
	});

	it("rejects arbitrary worker states", () => {
		expect(templateImportJobStageSchema.safeParse("running-user-code").success).toBe(false);
	});
});
