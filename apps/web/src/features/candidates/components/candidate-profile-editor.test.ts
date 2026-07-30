import { describe, expect, it } from "vitest";
import { customSectionSchema, sectionTypeSchema } from "@reactive-resume/schema/resume/data";
import {
	createCandidateCustomSection,
	createCandidateSectionItem,
	isCandidateRichTextField,
} from "./candidate-profile-editor";

describe("candidate structured editor item creation", () => {
	it.each(sectionTypeSchema.options)("creates a schema-valid %s custom section and item", (sectionType) => {
		const section = createCandidateCustomSection(sectionType);
		const item = createCandidateSectionItem(sectionType);

		const result = customSectionSchema.safeParse({
			...section,
			items: [item],
		});

		expect(result.success).toBe(true);
		expect(item.id).toBeTruthy();
	});

	it("generates a new identity for every section and item", () => {
		expect(createCandidateCustomSection("projects").id).not.toBe(createCandidateCustomSection("projects").id);
		expect(createCandidateSectionItem("projects").id).not.toBe(createCandidateSectionItem("projects").id);
	});

	it.each([
		"content",
		"description",
		"recipient",
		"responsibilities",
	])("uses the rich-text editor for the %s field", (field) => {
		expect(isCandidateRichTextField(field)).toBe(true);
	});

	it.each(["name", "headline", "keywords", "notes"])("keeps the %s field as plain text", (field) => {
		expect(isCandidateRichTextField(field)).toBe(false);
	});
});
