import { describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { defaultTemplateAst } from "@reactive-resume/schema/template-ast";
import { getModel } from "../ai/service";
import { aiProvidersService } from "../ai-providers/service";
import { diffTemplateAst, improveTemplateAstWithAi, parseAiImprovedTemplateAst } from "./ai-improve";
import { compileCustomTemplate } from "./compiler";

vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: vi.fn() }));
vi.mock("../ai/service", () => ({ getModel: vi.fn() }));
vi.mock("../ai-providers/service", () => ({ aiProvidersService: { getDefaultRunnable: vi.fn() } }));
vi.mock("./compiler", () => ({ compileCustomTemplate: vi.fn() }));

describe("parseAiImprovedTemplateAst", () => {
	it("accepts a valid template wrapped in a JSON code fence", () => {
		const result = parseAiImprovedTemplateAst(`Here is the result:
\`\`\`json
${JSON.stringify(defaultTemplateAst)}
\`\`\``);

		expect(result).toEqual(defaultTemplateAst);
	});

	it("rejects an invalid template without applying partial output", () => {
		expect(() => parseAiImprovedTemplateAst('{"schemaVersion":"0.1","nodes":[]}')).toThrow(
			"The AI returned an invalid template. No changes were applied.",
		);
	});

	it("salvages valid field changes and ignores invalid AI fields", () => {
		const result = parseAiImprovedTemplateAst(
			JSON.stringify({
				layout: { ...defaultTemplateAst.layout, imaginaryMode: true },
				tokens: { ...defaultTemplateAst.tokens, sectionGap: 22, bodySize: 999 },
				nodes: defaultTemplateAst.nodes.map((node) =>
					node.id === "summary" ? { ...node, variant: "compact", madeUpField: "ignored" } : node,
				),
			}),
			defaultTemplateAst,
		);

		expect(result.tokens.sectionGap).toBe(22);
		expect(result.tokens.bodySize).toBe(defaultTemplateAst.tokens.bodySize);
		expect(result.nodes.find((node) => node.id === "summary")).toMatchObject({ variant: "compact" });
	});

	it("accepts the source-aware response envelope", () => {
		const improved = {
			...defaultTemplateAst,
			tokens: { ...defaultTemplateAst.tokens, sectionGap: 20 },
		};
		const result = parseAiImprovedTemplateAst(
			JSON.stringify({
				improvedAst: improved,
				summary: "Matched source spacing.",
				changes: [{ path: "tokens.sectionGap", reason: "Matches the source." }],
			}),
			defaultTemplateAst,
		);

		expect(result.tokens.sectionGap).toBe(20);
	});

	it("accepts AI-proposed page grids and section-local component layouts", () => {
		const improved = {
			...defaultTemplateAst,
			layout: {
				...defaultTemplateAst.layout,
				preset: "grid" as const,
				pageGrid: {
					gap: 16,
					regions: [
						{ id: "sidebar", width: 30, padding: 8 },
						{ id: "main", width: 70, padding: 0 },
					],
				},
			},
			nodes: defaultTemplateAst.nodes.map((node) =>
				node.type === "shape"
					? node
					: {
							...node,
							region: node.column,
							...(node.type === "section"
								? {
										itemLayout: { columns: 2, columnGap: 10, rowGap: 8 },
										appearance: { heading: "filled", itemHeader: "inline", itemDecoration: "card" },
									}
								: {}),
						},
			),
		};
		const result = parseAiImprovedTemplateAst(JSON.stringify({ improvedAst: improved }), defaultTemplateAst);

		expect(result.layout.preset).toBe("grid");
		expect(result.nodes.find((node) => node.type === "section")).toMatchObject({
			itemLayout: { columns: 2 },
			appearance: { heading: "filled", itemHeader: "inline", itemDecoration: "card" },
		});
	});

	it("computes bounded before and after values instead of trusting the model", () => {
		const improved = {
			...defaultTemplateAst,
			layout: { ...defaultTemplateAst.layout, pagePadding: 40 },
			tokens: { ...defaultTemplateAst.tokens, sectionGap: 20 },
		};
		const changes = diffTemplateAst(
			defaultTemplateAst,
			improved,
			new Map([["tokens.sectionGap", "Spacing measured from the source."]]),
		);

		expect(changes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "layout.pagePadding", before: "32", after: "40" }),
				expect.objectContaining({
					path: "tokens.sectionGap",
					before: "18",
					after: "20",
					reason: "Spacing measured from the source.",
				}),
			]),
		);
	});

	it("returns deterministic source improvements when the configured model is unavailable", async () => {
		const sourceAst = {
			...defaultTemplateAst,
			layout: { ...defaultTemplateAst.layout, pagePadding: 40 },
		};
		vi.mocked(aiProvidersService.getDefaultRunnable).mockResolvedValue({
			provider: "openai",
			model: "gpt-4o",
			apiKey: "test",
			baseURL: "",
		} as never);
		vi.mocked(getModel).mockReturnValue({} as never);
		vi.mocked(compileCustomTemplate).mockResolvedValue({
			ast: sourceAst,
			report: {
				sourceFormat: "pdf",
				confidence: 0.8,
				confidenceBreakdown: { semantic: 0.8, layout: 0.8, typography: 0.8, extraction: 0.8 },
				visualFidelity: 0.75,
				pageCount: 1,
				detectedLayout: "two-column",
				detectedSections: ["summary"],
				warnings: [],
				mappingSummary: { supported: [], approximated: [], unsupported: [] },
				manualReviewRequired: true,
				generatedAt: new Date().toISOString(),
			},
		});
		vi.mocked(generateText).mockRejectedValue(new Error("gateway unavailable"));

		const result = await improveTemplateAstWithAi({
			userId: "user-1",
			draft: defaultTemplateAst,
			report: null,
			source: {
				name: "source.pdf",
				data: new Uint8Array([1, 2, 3]),
				mediaType: "application/pdf",
			},
		});

		expect(result.analysisMode).toBe("structural");
		expect(result.draft.layout.pagePadding).toBe(40);
		expect(result.changes).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: "layout.pagePadding", before: "32", after: "40" })]),
		);
		expect(result.remainingLimitations.join(" ")).toContain("deterministic source extraction");
	});
});
