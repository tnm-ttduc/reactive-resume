import type { CandidateProfile } from "@reactive-resume/schema/candidate/data";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { CustomTemplateSnapshot } from "@reactive-resume/schema/template-ast";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

export function buildResumeDataFromCandidate(profile: CandidateProfile, template: CustomTemplateSnapshot): ResumeData {
	const data = structuredClone(defaultResumeData);
	data.picture = structuredClone(profile.picture);
	data.basics = structuredClone(profile.basics);
	data.summary = structuredClone(profile.summary);
	data.sections = structuredClone(profile.sections);
	data.customSections = structuredClone(profile.customSections);
	data.metadata.customTemplate = structuredClone(template);
	return data;
}
