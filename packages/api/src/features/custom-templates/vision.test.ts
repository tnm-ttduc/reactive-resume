import { describe, expect, it, vi } from "vitest";
import { extractTextFromSseResponseBody, parseTemplateVisionBlueprint } from "./vision";

vi.mock("../ai/service", () => ({ getModel: vi.fn() }));
vi.mock("../ai-providers/service", () => ({
	aiProvidersService: { getDefaultRunnable: vi.fn() },
}));

describe("parseTemplateVisionBlueprint", () => {
	it("extracts and validates a fenced blueprint", () => {
		const result = parseTemplateVisionBlueprint(`\`\`\`json
		{
			"version": "0.1",
			"analysisMode": "visual",
			"page": {
				"preset": "one-column",
				"sidebarWidth": 32,
				"sidebarPosition": "left",
				"pagePadding": 32,
				"gap": 18,
				"regions": [{"id":"main","width":100,"padding":0}]
			},
			"header": {"region":"main","variant":"standard","showPicture":false,"showContact":true},
			"tokens": {},
			"sections": [{
				"section":"summary",
				"region":"main",
				"order":0,
				"layout":{"component":"flow","columns":1,"columnGap":8,"rowGap":8,"heading":"underline"},
				"blocks":[{"component":"rich-text","binding":"section.content","variant":"plain","visible":true}],
				"confidence":0.9,
				"evidence":[]
			}],
			"overallConfidence": 0.9,
			"warnings": []
		}
		\`\`\``);
		expect(result.page.preset).toBe("one-column");
		expect(result.sections[0]?.blocks[0]?.binding).toBe("section.content");
	});

	it("rejects unbounded AI output", () => {
		expect(() => parseTemplateVisionBlueprint('{"version":"0.1","analysisMode":"visual"}')).toThrow();
	});

	it("normalizes harmless omissions from per-page Vision responses", () => {
		const result = parseTemplateVisionBlueprint(`{
			"version": "0.1",
			"analysisMode": "visual",
			"page": {
				"preset": "one-column",
				"sidebarWidth": 32,
				"sidebarPosition": "left",
				"pagePadding": 32,
				"gap": 18,
				"regions": [{"id":"main","width":100,"padding":0}]
			},
			"header": {"region":"main","variant":"standard","showPicture":false,"showContact":true},
			"tokens": {},
			"sections": [{
				"section":"experience",
				"sourceTitle":"",
				"region":"main",
				"order":0,
				"layout":{"component":"table","columns":2,"columnGap":0,"rowGap":0,"heading":"filled"},
				"dataModel":{"kind":"tabular-records","itemLabel":"","numbered":false,"fields":[]},
				"tables":[{
					"title":"",
					"kind":"section-items",
					"orientation":"key-value-cards",
					"columnCount":2,
					"rowCount":8,
					"recordCount":3,
					"columns":[{"label":"Technology","role":"keywords","binding":"","confidence":0.9}],
					"confidence":0.9,
					"evidence":[]
				}],
				"confidence":0.9,
				"evidence":[]
			}],
			"overallConfidence":0.9,
			"warnings":[]
		}`);

		expect(result.sections[0]?.sourceTitle).toBeUndefined();
		expect(result.sections[0]?.blocks).toEqual([
			{ component: "heading", binding: "section.title", variant: "accent", visible: true },
			{ component: "table", binding: "section.content", variant: "plain", visible: true },
		]);
		expect(result.sections[0]?.dataModel?.itemLabel).toBeUndefined();
		expect(result.sections[0]?.tables?.[0]?.title).toBeUndefined();
		expect(result.sections[0]?.tables?.[0]?.columns[0]?.binding).toBeUndefined();
	});
});

describe("extractTextFromSseResponseBody", () => {
	it("reassembles content from an OpenAI-compatible streaming response", () => {
		const responseBody = [
			'data: {"choices":[{"delta":{"role":"assistant"}}]}',
			"",
			'data: {"choices":[{"delta":{"content":"{\\"version\\":"}}]}',
			"",
			'data: {"choices":[{"delta":{"content":"\\"0.1\\"}"}}]}',
			"",
			"data: [DONE]",
		].join("\n");

		expect(extractTextFromSseResponseBody(responseBody)).toBe('{"version":"0.1"}');
	});

	it("rejects malformed streaming chunks", () => {
		expect(extractTextFromSseResponseBody("data: {invalid}")).toBeNull();
	});
});
