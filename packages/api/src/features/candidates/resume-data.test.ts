import { describe, expect, it } from "vitest";
import { candidateProfileFromResumeData } from "@reactive-resume/schema/candidate/data";
import { createSampleResumeData } from "@reactive-resume/schema/resume/sample";
import { defaultTemplateAst } from "@reactive-resume/schema/template-ast";
import { buildResumeDataFromCandidate } from "./resume-data";

describe("buildResumeDataFromCandidate", () => {
	it("combines candidate content with an immutable custom-template snapshot", () => {
		const source = createSampleResumeData("Candidate One");
		source.metadata.template = "ditto";
		const profile = candidateProfileFromResumeData(source);
		const template = { id: "template-1", name: "Agency CV", version: 3, ast: defaultTemplateAst };

		const resume = buildResumeDataFromCandidate(profile, template);

		expect(resume.basics.name).toBe("Candidate One");
		expect(resume.metadata.customTemplate).toEqual(template);
		expect(resume.metadata.template).toBe("onyx");

		resume.basics.name = "Resume Variant";
		const snapshot = resume.metadata.customTemplate;
		expect(snapshot).toBeDefined();
		if (!snapshot) throw new Error("Expected custom template snapshot");
		snapshot.ast.tokens.primaryColor = "#000000";
		expect(profile.basics.name).toBe("Candidate One");
		expect(template.ast.tokens.primaryColor).not.toBe("#000000");
	});
});
