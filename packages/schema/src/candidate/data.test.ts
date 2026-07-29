import { describe, expect, it } from "vitest";
import { createSampleResumeData } from "../resume/sample";
import { candidateProfileFromResumeData, candidateProfileSchema } from "./data";

describe("candidateProfileSchema", () => {
	it("keeps candidate content and strips all presentation metadata", () => {
		const resume = createSampleResumeData("Candidate One");
		resume.metadata.template = "ditto";

		const profile = candidateProfileFromResumeData(resume);

		expect(profile.basics.name).toBe("Candidate One");
		expect("metadata" in profile).toBe(false);
		expect(candidateProfileSchema.safeParse(profile).success).toBe(true);
		expect(candidateProfileSchema.safeParse({ ...profile, metadata: resume.metadata }).success).toBe(false);
	});
});
