import { describe, expect, it } from "vitest";
import { canTransitionTemplateStatus } from "./lifecycle";

describe("custom template lifecycle", () => {
	it("enforces Draft → Review → Published → Deprecated → Archived", () => {
		expect(canTransitionTemplateStatus("draft", "review")).toBe(true);
		expect(canTransitionTemplateStatus("review", "published")).toBe(true);
		expect(canTransitionTemplateStatus("published", "deprecated")).toBe(true);
		expect(canTransitionTemplateStatus("deprecated", "archived")).toBe(true);
	});

	it("rejects direct publishing and reviving archived templates", () => {
		expect(canTransitionTemplateStatus("draft", "published")).toBe(false);
		expect(canTransitionTemplateStatus("archived", "draft")).toBe(false);
	});

	it("allows an edited review or published version to return to draft", () => {
		expect(canTransitionTemplateStatus("review", "draft")).toBe(true);
		expect(canTransitionTemplateStatus("published", "draft")).toBe(true);
	});
});
