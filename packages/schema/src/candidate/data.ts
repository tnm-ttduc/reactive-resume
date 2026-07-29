import type z from "zod";
import { resumeDataSchema } from "../resume/data";

/**
 * Candidate data is presentation-neutral. It deliberately excludes resume
 * metadata such as templates, layout, typography, page settings and notes.
 */
export const candidateProfileSchema = resumeDataSchema
	.pick({
		picture: true,
		basics: true,
		summary: true,
		sections: true,
		customSections: true,
	})
	.strict()
	.describe("Normalized candidate content extracted from an imported CV.");

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

export function candidateProfileFromResumeData(data: z.infer<typeof resumeDataSchema>): CandidateProfile {
	return candidateProfileSchema.parse({
		picture: data.picture,
		basics: data.basics,
		summary: data.summary,
		sections: data.sections,
		customSections: data.customSections,
	});
}
