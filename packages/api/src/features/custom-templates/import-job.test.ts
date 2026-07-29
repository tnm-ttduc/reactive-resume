import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultTemplateAst } from "@reactive-resume/schema/template-ast";
import { compileCustomTemplate } from "./compiler";
import { buildImportedTemplate } from "./import-job";
import { analyzeTemplateSourceWithAiVision } from "./vision";

vi.mock("./compiler", () => ({ compileCustomTemplate: vi.fn() }));
vi.mock("./vision", () => ({ analyzeTemplateSourceWithAiVision: vi.fn() }));
vi.mock("@reactive-resume/db/client", () => ({ db: {}, getPool: vi.fn() }));

const sourceReport = {
	sourceFormat: "pdf" as const,
	confidence: 0.8,
	confidenceBreakdown: { semantic: 0.8, layout: 0.8, typography: 0.8, extraction: 0.8 },
	visualFidelity: 0.72,
	pageCount: 1,
	detectedLayout: "two-column" as const,
	detectedSections: ["summary" as const],
	warnings: [],
	mappingSummary: { supported: ["Semantic section: summary"], approximated: [], unsupported: [] },
	manualReviewRequired: true,
	generatedAt: new Date().toISOString(),
};

const source = {
	name: "template.pdf",
	data: new Uint8Array([1, 2, 3]),
	mediaType: "application/pdf" as const,
};

const blueprint = {
	version: "0.1" as const,
	analysisMode: "visual" as const,
	page: {
		preset: "one-column" as const,
		sidebarWidth: 32,
		sidebarPosition: "left" as const,
		pagePadding: 32,
		gap: 18,
		regions: [{ id: "main", width: 100, padding: 0 }],
	},
	header: { region: "main", variant: "standard" as const, showPicture: false, showContact: true },
	tokens: {},
	sections: [
		{
			section: "summary" as const,
			region: "main",
			order: 0,
			layout: {
				component: "flow" as const,
				columns: 1,
				columnGap: 8,
				rowGap: 8,
				heading: "underline" as const,
			},
			blocks: [
				{
					component: "rich-text" as const,
					binding: "section.content" as const,
					variant: "plain" as const,
					visible: true,
				},
			],
			confidence: 0.9,
			evidence: [],
		},
	],
	overallConfidence: 0.9,
	warnings: [],
};

describe("buildImportedTemplate", () => {
	beforeEach(() => {
		vi.mocked(compileCustomTemplate).mockReset();
		vi.mocked(analyzeTemplateSourceWithAiVision).mockReset();
		vi.mocked(analyzeTemplateSourceWithAiVision).mockResolvedValue(null);
		vi.mocked(compileCustomTemplate).mockResolvedValue({ ast: defaultTemplateAst, report: sourceReport });
	});

	it("runs AI Vision before deterministic extraction and mapping", async () => {
		const progress: Array<[string, number]> = [];
		const result = await buildImportedTemplate({
			userId: "user-1",
			source,
			onProgress: async (stage, value) => {
				progress.push([stage, value]);
			},
		});

		expect(result.ast).toEqual(defaultTemplateAst);
		expect(result.report.warnings).toContain(
			"AI Vision was unavailable or returned an invalid blueprint; deterministic composer mapping was used.",
		);
		expect(progress).toEqual([
			["ai-vision", 20],
			["extracting", 45],
			["mapping", 75],
			["saving", 90],
		]);
		expect(analyzeTemplateSourceWithAiVision).toHaveBeenCalledWith({ userId: "user-1", source });
		expect(vi.mocked(analyzeTemplateSourceWithAiVision).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(compileCustomTemplate).mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
		);
		expect(compileCustomTemplate).toHaveBeenCalledWith({
			data: source.data,
			mediaType: source.mediaType,
			visionBlueprint: null,
		});
	});

	it("passes the AI Vision blueprint into the compiler", async () => {
		vi.mocked(analyzeTemplateSourceWithAiVision).mockResolvedValue(blueprint);

		await buildImportedTemplate({ userId: "user-1", source });

		expect(compileCustomTemplate).toHaveBeenCalledWith({
			data: source.data,
			mediaType: source.mediaType,
			visionBlueprint: blueprint,
		});
	});
});
